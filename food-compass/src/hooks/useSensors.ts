/*
Features:
1. Track users walking in real-time
2. Which the phone is physically pointing
3. Give subtle vibrations when users doesn't have to keep staring at the screen
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

interface WebKitDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface SensorState {
  userLocation: Coordinates | null;
  heading: number; // 0° to 360° (0 = True/Magnetic North)
  accuracy: number | null; // meters
  permissionGranted: boolean;
  error: string | null;
}

export function useSensors(targetLocation?: Coordinates | null) {
  const [sensorState, setSensorState] = useState<SensorState>({
    userLocation: null,
    heading: 0,
    accuracy: null,
    permissionGranted: false,
    error: null,
  });

  // Track previous heading alignment to avoid spamming vibrations
  const wasFacingTargetRef = useRef(false);
  const hasArrivedRef = useRef(false);

  // -------------------------------------------------------------
  // 1. COMPASS / DEVICE ORIENTATION
  // -------------------------------------------------------------
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let compassHeading = 0;

    // iOS Safari / WebKit provides direct 0-360 compass heading
    const webkitEvent = event as WebKitDeviceOrientationEvent;
    if (typeof webkitEvent.webkitCompassHeading === 'number') {
      compassHeading = webkitEvent.webkitCompassHeading;
    }
    // Android / Standard W3C Specification
    else if (event.alpha !== null) {
      // On Android, alpha is 0 when pointing North, but increases counter-clockwise
      compassHeading = (360 - event.alpha) % 360;
    }

    setSensorState((prev) => ({
      ...prev,
      heading: Math.round(compassHeading),
    }));
  }, []);

  // Request permission for iOS 13+ devices
  const requestCompassPermission = async (): Promise<boolean> => {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      const orientationConstructor = DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;
      if (typeof orientationConstructor.requestPermission === 'function') {
        try {
          const response = await orientationConstructor.requestPermission();
          return response === 'granted';
        } catch (err) {
          console.error('iOS Orientation permission denied:', err);
          return false;
        }
      }
    }
    // Android and non-iOS browsers don't require explicit popup permission
    return true;
  };

  // -------------------------------------------------------------
  // 2. HAPTICS HELPERS
  // -------------------------------------------------------------
  const triggerHapticFeedback = async (style: ImpactStyle = ImpactStyle.Light) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Fallback for standard mobile browsers without Capacitor native wrapper
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }
  };

  const triggerArrivalHaptic = async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  };

  // -------------------------------------------------------------
  // 3. LIFECYCLE: SETUP ORIENTATION & GPS WATCH
  // -------------------------------------------------------------
  useEffect(() => {
    let watchId: string | null = null;
    let isMounted = true;
    const orientationEventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

    async function initSensors() {
      // A. Setup Orientation
      const granted = await requestCompassPermission();
      if (granted && isMounted) {
        setSensorState((prev) => ({ ...prev, permissionGranted: true }));
        window.addEventListener(
          orientationEventName,
          handleOrientation as unknown as EventListener,
          true
        );
      }

      // B. Setup High-Accuracy GPS Watch
      try {
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 1000,
          },
          (position: Position | null, err) => {
            if (err) {
              if (isMounted) setSensorState((prev) => ({ ...prev, error: err.message }));
              return;
            }

            if (position && isMounted) {
              setSensorState((prev) => ({
                ...prev,
                userLocation: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
                accuracy: position.coords.accuracy,
                error: null,
              }));
            }
          }
        );
        watchId = id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMounted) setSensorState((prev) => ({ ...prev, error: message }));
      }
    }

    initSensors();

    // Cleanup listeners when component unmounts
    return () => {
      isMounted = false;
      window.removeEventListener(
        orientationEventName,
        handleOrientation as unknown as EventListener,
        true
      );
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [handleOrientation]);

  // -------------------------------------------------------------
  // 4. COMPUTED MATH: BEARING, DISTANCE & HAPTIC ALIGNMENT
  // -------------------------------------------------------------
  let distanceMeters = 0;
  let targetBearing = 0;
  let needleAngle = 0; // Relative angle to point the compass arrow
  let isFacingTarget = false;
  let turnDirection: 'left' | 'right' | 'straight' | 'wrong_way' = 'straight';
  const minDistanceRef = useRef<number | null>(null);
  const [isDrifting, setIsDrifting] = useState(false);

  if (sensorState.userLocation && targetLocation) {
    distanceMeters = calculateDistance(sensorState.userLocation, targetLocation);
    targetBearing = calculateBearing(sensorState.userLocation, targetLocation);

    // Needle points to (Target Bearing - Phone's Heading)
    needleAngle = (targetBearing - sensorState.heading + 360) % 360;

    // "Aligned" if the phone is pointing within ±15 degrees of the target
    isFacingTarget = needleAngle <= 15 || needleAngle >= 345;

    // Determine street-level turn direction
    if (needleAngle > 15 && needleAngle <= 140) {
      turnDirection = 'right';
    } else if (needleAngle > 220 && needleAngle < 345) {
      turnDirection = 'left';
    } else if (needleAngle > 140 && needleAngle <= 220) {
      turnDirection = 'wrong_way';
    }
  }

  // Drift Guard: Check if distance increases by > 20m from best-recorded distance
  useEffect(() => {
    if (distanceMeters > 0) {
      if (minDistanceRef.current === null || distanceMeters < minDistanceRef.current) {
        minDistanceRef.current = distanceMeters;
        setIsDrifting(false);
      } else if (distanceMeters > minDistanceRef.current + 20) {
        setIsDrifting(true);
      }
    }
  }, [distanceMeters]);

  // Handle Haptic Walking Feedback Loop
  useEffect(() => {
    if (!targetLocation || !sensorState.userLocation) return;

    // Feedback 1: Haptic pulse when user points in the right walking direction
    if (isFacingTarget && !wasFacingTargetRef.current) {
      triggerHapticFeedback(ImpactStyle.Light);
    }
    wasFacingTargetRef.current = isFacingTarget;

    // Feedback 2: Arrival Alert (within 35 meters)
    if (distanceMeters > 0 && distanceMeters <= 35 && !hasArrivedRef.current) {
      hasArrivedRef.current = true;
      triggerArrivalHaptic();
    }
  }, [isFacingTarget, distanceMeters, targetLocation, sensorState.userLocation]);

  return {
    ...sensorState,
    distanceMeters,
    targetBearing,
    needleAngle,
    isFacingTarget,
    turnDirection,
    isDrifting,
    requestCompassPermission,
  };
}

/**
 * 5b. TACTILE THIGH HAPTICS (Felt Directly on the Leg)
 * Distinct vibration rhythms that can be felt through pocket fabric
 */
export async function triggerThighHaptics(
  direction: 'left' | 'right' | 'straight' | 'wrong_way'
) {
  try {
    if (direction === 'left') {
      // 2 pulses = Left (Tap - Tap)
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 150);
    } else if (direction === 'right') {
      // 3 pulses = Right (Tap - Tap - Tap)
      await Haptics.impact({ style: ImpactStyle.Medium });
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }, 100);
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }, 200);
    } else if (direction === 'wrong_way') {
      // Harsh rumble for wrong way / drift
      await Haptics.notification({ type: NotificationType.Error });
    } else {
      // 1 gentle click = Straight / Aligned
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (direction === 'left') navigator.vibrate([120, 80, 120]);
      else if (direction === 'right') navigator.vibrate([50, 50, 50, 50, 50]);
      else if (direction === 'wrong_way') navigator.vibrate([350, 100, 350]);
      else navigator.vibrate(30);
    }
  }
}

// -------------------------------------------------------------
// 5. MATHEMATICAL FORMULAS (HAVERSINE & FORWARD AZIMUTH)
// -------------------------------------------------------------

/**
 * Calculates straight-line distance in meters using Haversine formula
 */
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(coord1.lat);
  const φ2 = toRad(coord2.lat);
  const Δφ = toRad(coord2.lat - coord1.lat);
  const Δλ = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Calculates initial bearing / forward azimuth from Point A to Point B (0-360°)
 */
function calculateBearing(start: Coordinates, dest: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(start.lat);
  const φ2 = toRad(dest.lat);
  const Δλ = toRad(dest.lng - start.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}