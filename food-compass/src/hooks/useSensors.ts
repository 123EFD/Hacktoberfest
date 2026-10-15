/*
Features:
1. Track users walking in real-time
2. Which the phone is physically pointing
3. Give subtle vibrations when users doesn't have to keep staring at the screen
*/

import { useState, useEffect, useRef, useCallback } from 'react';
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

// Cache location globally so switching screens doesn't lose position
let globalLastKnownLocation: Coordinates | null = null;

function fetchBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser or environment.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function useSensors(
  targetLocation?: Coordinates | null,
  initialUserLocation?: Coordinates | null
) {
  const [sensorState, setSensorState] = useState<SensorState>({
    userLocation: initialUserLocation || globalLastKnownLocation || null,
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
    let compassHeading: number | null = null;
    const webkitEvent = event as WebKitDeviceOrientationEvent;

    // 1. iOS Safari webkitCompassHeading (0 = True North, clockwise)
    if (
      typeof webkitEvent.webkitCompassHeading === 'number' &&
      !isNaN(webkitEvent.webkitCompassHeading)
    ) {
      compassHeading = webkitEvent.webkitCompassHeading;
    }
    // 2. Android / Standard alpha orientation
    else if (event.alpha !== null && !isNaN(event.alpha)) {
      compassHeading = (360 - event.alpha) % 360;
    }

    if (compassHeading !== null) {
      setSensorState((prev) => ({
        ...prev,
        heading: Math.round(compassHeading!),
        permissionGranted: true,
      }));
    }
  }, []);

  const attachOrientationListeners = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener(
      'deviceorientationabsolute',
      handleOrientation as unknown as EventListener,
      true
    );
    window.addEventListener(
      'deviceorientation',
      handleOrientation as unknown as EventListener,
      true
    );
  }, [handleOrientation]);

  // Request permission for iOS 13+ devices
  const requestCompassPermission = useCallback(async (): Promise<boolean> => {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      const orientationConstructor =
        DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;
      if (typeof orientationConstructor.requestPermission === 'function') {
        try {
          const response = await orientationConstructor.requestPermission();
          if (response === 'granted') {
            attachOrientationListeners();
            setSensorState((prev) => ({ ...prev, permissionGranted: true }));
            return true;
          }
          return false;
        } catch (err) {
          console.error('iOS Orientation permission error:', err);
          return false;
        }
      }
    }
    // Android and desktop browsers
    attachOrientationListeners();
    setSensorState((prev) => ({ ...prev, permissionGranted: true }));
    return true;
  }, [attachOrientationListeners]);

  // Manual heading rotation (for laptop / desktop testing)
  const setManualHeading = useCallback((newHeading: number) => {
    const normalized = ((newHeading % 360) + 360) % 360;
    setSensorState((prev) => ({
      ...prev,
      heading: Math.round(normalized),
    }));
  }, []);

  // Step simulation towards target (for desktop testing or couch demo)
  const simulateStep = useCallback(
    (stepMeters = 15) => {
      setSensorState((prev) => {
        if (!prev.userLocation || !targetLocation) return prev;
        const currentDist = calculateDistance(prev.userLocation, targetLocation);
        if (currentDist <= stepMeters) {
          return {
            ...prev,
            userLocation: { ...targetLocation },
          };
        }
        const ratio = stepMeters / currentDist;
        const newLat =
          prev.userLocation.lat + (targetLocation.lat - prev.userLocation.lat) * ratio;
        const newLng =
          prev.userLocation.lng + (targetLocation.lng - prev.userLocation.lng) * ratio;
        const newCoords = { lat: newLat, lng: newLng };
        globalLastKnownLocation = newCoords;
        return {
          ...prev,
          userLocation: newCoords,
        };
      });
    },
    [targetLocation]
  );

  // -------------------------------------------------------------
  // 2. MULTI-TIER GPS ACQUISITION (HIGH-ACCURACY -> NETWORK -> IP)
  // -------------------------------------------------------------
  const acquireLocation = useCallback(async (): Promise<Coordinates | null> => {
    // Check secure context (mandatory for mobile browser geolocation)
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext === false &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      const errorMsg =
        'Geolocation requires HTTPS or localhost. If opening over LAN on mobile, please use localhost or HTTPS.';
      setSensorState((prev) => ({ ...prev, error: errorMsg }));
      return null;
    }

    // Tier 1: High Accuracy GPS (satellites / outdoor mobile)
    try {
      const pos = await fetchBrowserPosition({
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 30000,
      });
      const coords: Coordinates = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      globalLastKnownLocation = coords;
      setSensorState((prev) => ({
        ...prev,
        userLocation: coords,
        accuracy: pos.coords.accuracy,
        error: null,
        permissionGranted: true,
      }));
      return coords;
    } catch (highErr) {
      console.warn('High-accuracy GPS fix failed or timed out; falling back to network/Wi-Fi...', highErr);
    }

    // Tier 2: Low Accuracy (Wi-Fi triangulation / cellular / standard browser)
    try {
      const pos = await fetchBrowserPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
      const coords: Coordinates = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      globalLastKnownLocation = coords;
      setSensorState((prev) => ({
        ...prev,
        userLocation: coords,
        accuracy: pos.coords.accuracy,
        error: null,
        permissionGranted: true,
      }));
      return coords;
    } catch (stdErr) {
      console.warn('Browser network location failed; attempting IP-based fallback...', stdErr);
    }

    // Tier 3: IP Geolocation (ideal for desktop PCs without GPS chips or Wi-Fi scanning)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch('https://ipwho.is/', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        if (
          data &&
          data.success &&
          typeof data.latitude === 'number' &&
          typeof data.longitude === 'number'
        ) {
          const coords: Coordinates = {
            lat: data.latitude,
            lng: data.longitude,
          };
          globalLastKnownLocation = coords;
          setSensorState((prev) => ({
            ...prev,
            userLocation: coords,
            accuracy: 1000,
            error: null,
            permissionGranted: true,
          }));
          return coords;
        }
      }
    } catch (ipErr) {
      console.warn('IP geolocation fallback failed or unreachable:', ipErr);
    }

    // All attempts failed
    const finalErr =
      'Unable to acquire location automatically. Please check browser permissions or select a city location.';
    setSensorState((prev) => ({ ...prev, error: finalErr }));
    return null;
  }, []);

  // Manual coordinate override (e.g., city center fallback button)
  const setManualLocation = useCallback((coords: Coordinates) => {
    globalLastKnownLocation = coords;
    setSensorState((prev) => ({
      ...prev,
      userLocation: coords,
      accuracy: 10,
      error: null,
      permissionGranted: true,
    }));
  }, []);

  // -------------------------------------------------------------
  // 3. HAPTICS HELPERS
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
  // 4. LIFECYCLE: SETUP ORIENTATION & RESILIENT GPS WATCH
  // -------------------------------------------------------------
  useEffect(() => {
    let watchId: number | null = null;
    let isMounted = true;

    async function initSensors() {
      // A. Setup Orientation (on non-iOS, attach automatically)
      const isIOSWithPermission =
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (
          DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission
        ).requestPermission === 'function';

      if (!isIOSWithPermission) {
        attachOrientationListeners();
      }

      // B. Proactively acquire location if not yet resolved
      if (!globalLastKnownLocation) {
        acquireLocation();
      }

      // C. Setup Continuous GPS Watch with resilient fallback
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        let isHighAcc = true;
        const startWatch = () => {
          try {
            const id = navigator.geolocation.watchPosition(
              (pos) => {
                if (!isMounted) return;
                const coords: Coordinates = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                };
                globalLastKnownLocation = coords;

                // When moving, GPS ground course gives true travel direction
                const gpsHeading =
                  typeof pos.coords.heading === 'number' &&
                  !isNaN(pos.coords.heading) &&
                  pos.coords.heading >= 0
                    ? Math.round(pos.coords.heading)
                    : null;

                setSensorState((prev) => ({
                  ...prev,
                  userLocation: coords,
                  accuracy: pos.coords.accuracy,
                  error: null,
                  permissionGranted: true,
                  heading: gpsHeading !== null ? gpsHeading : prev.heading,
                }));
              },
              (err) => {
                if (!isMounted) return;
                console.warn(`watchPosition (${isHighAcc ? 'high-acc' : 'low-acc'}) error:`, err);
                if (isHighAcc) {
                  // Fall back from satellite to network watch
                  isHighAcc = false;
                  navigator.geolocation.clearWatch(id);
                  startWatch();
                } else if (!globalLastKnownLocation) {
                  setSensorState((prev) => ({ ...prev, error: err.message }));
                }
              },
              {
                enableHighAccuracy: isHighAcc,
                timeout: isHighAcc ? 15000 : 30000,
                maximumAge: 3000,
              }
            );
            watchId = id;
          } catch (e) {
            console.warn('Failed to start watchPosition:', e);
          }
        };

        startWatch();
      }
    }

    initSensors();

    // Cleanup listeners when component unmounts
    return () => {
      isMounted = false;
      window.removeEventListener(
        'deviceorientationabsolute',
        handleOrientation as unknown as EventListener,
        true
      );
      window.removeEventListener(
        'deviceorientation',
        handleOrientation as unknown as EventListener,
        true
      );
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [handleOrientation, attachOrientationListeners, acquireLocation]);

  // -------------------------------------------------------------
  // 5. COMPUTED MATH: BEARING, DISTANCE & HAPTIC ALIGNMENT
  // -------------------------------------------------------------
  let distanceMeters = 0;
  let targetBearing = 0;
  let needleAngle = 0; // Relative angle to point the compass arrow
  let isFacingTarget = false;
  let turnDirection: 'left' | 'right' | 'straight' | 'wrong_way' = 'straight';
  const minDistanceRef = useRef<number | null>(null);
  const [isDrifting, setIsDrifting] = useState(false);

  const effectiveUserLocation =
    sensorState.userLocation || initialUserLocation || globalLastKnownLocation;

  if (effectiveUserLocation && targetLocation) {
    distanceMeters = calculateDistance(effectiveUserLocation, targetLocation);
    targetBearing = calculateBearing(effectiveUserLocation, targetLocation);

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
    if (!targetLocation || !effectiveUserLocation) return;

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
  }, [isFacingTarget, distanceMeters, targetLocation, effectiveUserLocation]);

  return {
    ...sensorState,
    userLocation: effectiveUserLocation,
    distanceMeters,
    targetBearing,
    needleAngle,
    isFacingTarget,
    turnDirection,
    isDrifting,
    requestCompassPermission,
    acquireLocation,
    setManualLocation,
    setManualHeading,
    simulateStep,
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