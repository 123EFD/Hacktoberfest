// src/screens/WalkScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSensors, triggerThighHaptics, type Coordinates } from '../hooks/useSensors';
import { Navigation3DMap, type Navigation3DMapRef } from '../components/Navigation3DMap';
import { NavigationTurnBanner } from '../components/NavigationTurnBanner';
import { NavigationControls } from '../components/NavigationControls';
import { NavigationTripCard } from '../components/NavigationTripCard';
import { NavigationLayersControl, type MapLayerType } from '../components/NavigationLayersControl';
import { PocketModeOverlay } from '../components/PocketModeOverlay';
import {
  fetchWalkingRoute,
  calculateDistanceMeters,
  type NavigationRoute,
} from '../services/routingService';
import {
  fetchNearbyEateries,
  type NearbyEatery,
} from '../services/osmServices';
import {
  playArrivalChime,
  speakArrival,
  playSpatialDirectionChime,
  speakJunctionWhisper,
  playPocketMelodicChime,
  speakPunchyVoicePrompt,
  playDriftWarningSound,
  type TurnDirection,
} from '../services/soundFeedback';

interface EateryTarget {
  name: string;
  lat: number;
  lng: number;
  signatureDish: string;
  verdictReason: string;
}

export const WalkScreen: React.FC<{
  target: EateryTarget;
  onCancel: () => void;
  initialUserLocation?: Coordinates | null;
}> = ({ target: initialTarget, onCancel, initialUserLocation }) => {
  // Current active destination (can be switched by tapping another restaurant on the map)
  const [currentTarget, setCurrentTarget] = useState<EateryTarget>(initialTarget);

  const [pocketMode, setPocketMode] = useState(false);
  const [audioMode, setAudioMode] = useState<'pocket_speaker' | 'earbuds'>('pocket_speaker');

  // Navigation Map & Route States
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [is3D, setIs3D] = useState(true);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [isPinMode, setIsPinMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('satellite'); // Default: Photorealistic Satellite Hybrid
  const [nearbyEateries, setNearbyEateries] = useState<NearbyEatery[]>([]);

  const mapRef = useRef<Navigation3DMapRef>(null);
  const hasTriggeredArrivalSound = useRef(false);
  const prevTurnDirectionRef = useRef<TurnDirection>('straight');
  const lastDriftAlertTimeRef = useRef<number>(0);
  const lastFetchedLocationRef = useRef<Coordinates | null>(null);

  // Hooking directly into our sensor framework
  const {
    needleAngle,
    distanceMeters,
    targetBearing,
    heading,
    userLocation,
    isFacingTarget,
    turnDirection,
    isDrifting,
    setManualHeading,
    setManualLocation,
    simulateStep,
  } = useSensors(
    { lat: currentTarget.lat, lng: currentTarget.lng },
    initialUserLocation
  );

  // Safe fallback coordinates for initial map render before GPS settles
  const activeUserCoords: Coordinates = userLocation ||
    initialUserLocation || {
      lat: currentTarget.lat - 0.003,
      lng: currentTarget.lng - 0.003,
    };

  // 1. Fetch nearby eateries (Google Maps POIs) to render on the map
  useEffect(() => {
    let isCancelled = false;
    const fetchPOIs = async () => {
      try {
        const eateries = await fetchNearbyEateries(
          activeUserCoords.lat,
          activeUserCoords.lng,
          1200
        );
        if (!isCancelled && eateries && eateries.length > 0) {
          setNearbyEateries(eateries);
        }
      } catch (err) {
        console.warn('Failed to load surrounding eateries:', err);
      }
    };
    fetchPOIs();
    return () => {
      isCancelled = true;
    };
  }, [activeUserCoords.lat, activeUserCoords.lng]);

  // 2. Fetch walking route from OSRM
  const loadRoute = useCallback(
    async (origin: Coordinates) => {
      try {
        const fetchedRoute = await fetchWalkingRoute(
          origin.lat,
          origin.lng,
          currentTarget.lat,
          currentTarget.lng,
          currentTarget.name
        );
        setRoute(fetchedRoute);
        setCurrentStepIndex(0);
        lastFetchedLocationRef.current = origin;
      } catch (err) {
        console.error('Failed to load pedestrian route:', err);
      }
    },
    [currentTarget.lat, currentTarget.lng, currentTarget.name]
  );

  // Initial and displacement-based route fetching (re-calculate if moved > 35m)
  useEffect(() => {
    if (!userLocation) return;

    if (!lastFetchedLocationRef.current) {
      loadRoute(userLocation);
      return;
    }

    const distFromLastFetch = calculateDistanceMeters(
      [lastFetchedLocationRef.current.lng, lastFetchedLocationRef.current.lat],
      [userLocation.lng, userLocation.lat]
    );

    if (distFromLastFetch > 35) {
      loadRoute(userLocation);
    }
  }, [userLocation, loadRoute]);

  // Initial fallback route if userLocation is null initially or currentTarget changes
  useEffect(() => {
    if (activeUserCoords) {
      loadRoute(activeUserCoords);
    }
  }, [currentTarget, activeUserCoords, loadRoute]);

  // 3. Track step-by-step maneuvers and auto-advance
  const steps = route?.steps || [];
  const currentStep = steps[currentStepIndex] || null;
  const nextStep = steps[currentStepIndex + 1] || null;

  const stepDistanceRemainingMeters =
    currentStep && userLocation
      ? calculateDistanceMeters(
          [userLocation.lng, userLocation.lat],
          currentStep.location
        )
      : distanceMeters;

  // Advance step when user reaches within 20m of current maneuver waypoint
  useEffect(() => {
    if (
      currentStep &&
      stepDistanceRemainingMeters <= 20 &&
      currentStepIndex < steps.length - 1
    ) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [stepDistanceRemainingMeters, currentStepIndex, steps.length, currentStep]);

  // 4. Arrival Trigger (<= 30m)
  useEffect(() => {
    if (distanceMeters > 0 && distanceMeters <= 30 && !hasTriggeredArrivalSound.current) {
      hasTriggeredArrivalSound.current = true;
      playArrivalChime();
      speakArrival(currentTarget.name, currentTarget.signatureDish);
    }
  }, [distanceMeters, currentTarget.name, currentTarget.signatureDish]);

  // 5. Intersection & Turn Guidance Loop
  useEffect(() => {
    if (turnDirection === prevTurnDirectionRef.current) return;
    prevTurnDirectionRef.current = turnDirection;

    if (turnDirection === 'straight') return;

    if (audioMode === 'earbuds') {
      playSpatialDirectionChime(needleAngle);
      speakJunctionWhisper(needleAngle);
    } else {
      playPocketMelodicChime(turnDirection);
      speakPunchyVoicePrompt(turnDirection);
      triggerThighHaptics(turnDirection);
    }
  }, [turnDirection, audioMode, needleAngle]);

  // 6. Wrong-Turn "Drift Guard" (Sound + Haptic)
  useEffect(() => {
    if (!isDrifting) return;
    const now = Date.now();
    if (now - lastDriftAlertTimeRef.current > 10000) {
      lastDriftAlertTimeRef.current = now;
      playDriftWarningSound();
      triggerThighHaptics('wrong_way');
    }
  }, [isDrifting]);

  // Handle map pinning to correct user GPS
  const handleSetLocation = (coords: Coordinates) => {
    setManualLocation(coords);
    loadRoute(coords);
    setIsPinMode(false);
  };

  // Switch destination when user taps a nearby restaurant on the map
  const handleSelectNearbyEatery = (eatery: NearbyEatery) => {
    setCurrentTarget({
      name: eatery.name,
      lat: eatery.lat,
      lng: eatery.lon,
      signatureDish: eatery.cuisine ? `${eatery.cuisine} Special` : 'Neighborhood Gem',
      verdictReason: 'Selected directly from neighborhood map',
    });
    hasTriggeredArrivalSound.current = false;
  };

  const routeCoordinates =
    route?.coordinates || [
      [activeUserCoords.lng, activeUserCoords.lat],
      [currentTarget.lng, currentTarget.lat],
    ];

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex flex-col justify-between select-none">
      {/* 1. Full-Screen 3D MapLibre Navigation Canvas */}
      <div className="absolute inset-0 z-0">
        <Navigation3DMap
          ref={mapRef}
          userLocation={activeUserCoords}
          targetLocation={{ lat: currentTarget.lat, lng: currentTarget.lng }}
          targetName={currentTarget.name}
          signatureDish={currentTarget.signatureDish}
          heading={heading}
          routeCoordinates={routeCoordinates}
          is3D={is3D}
          mapLayer={mapLayer}
          nearbyEateries={nearbyEateries}
          onSelectEatery={handleSelectNearbyEatery}
          isPinMode={isPinMode}
          onSetLocation={handleSetLocation}
          isAutoFollow={isAutoFollow}
          onUserPan={() => setIsAutoFollow(false)}
        />
      </div>

      {/* 2. Top Turn-by-Turn Instruction Banner (Google Navigation Emerald Header) */}
      <NavigationTurnBanner
        currentStep={currentStep}
        nextStep={nextStep}
        stepDistanceRemainingMeters={stepDistanceRemainingMeters}
        totalDistanceMeters={distanceMeters}
      />

      {/* 3. Floating Quick Action Controls (3D/2D toggle, Re-center, Pin mode, Zoom +/-) */}
      <NavigationControls
        is3D={is3D}
        onToggle3D={() => setIs3D((prev) => !prev)}
        onRecenter={() => setIsAutoFollow(true)}
        isPinMode={isPinMode}
        onTogglePinMode={() => setIsPinMode((prev) => !prev)}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />

      {/* 4. Google Maps Style Layers Switcher (Satellite vs Default Street vs Night) */}
      <NavigationLayersControl
        currentLayer={mapLayer}
        onChangeLayer={setMapLayer}
      />

      {/* 5. Bottom Trip Overview Card with ETA, Audio, and Simulator Controls */}
      <NavigationTripCard
        targetName={currentTarget.name}
        signatureDish={currentTarget.signatureDish}
        verdictReason={currentTarget.verdictReason}
        distanceMeters={distanceMeters}
        durationSeconds={route?.totalDurationSeconds || Math.round(distanceMeters / 1.2)}
        audioMode={audioMode}
        onToggleAudioMode={setAudioMode}
        onCancel={onCancel}
        heading={heading}
        targetBearing={targetBearing}
        onTurn={(deltaDeg) => setManualHeading(heading + deltaDeg)}
        onStep={(meters) => simulateStep(meters)}
        onHeadingChange={setManualHeading}
        isPinMode={isPinMode}
      />

      {/* 6. Pocket Screen-Dimming Saver Overlay */}
      <PocketModeOverlay
        isActive={pocketMode}
        onToggle={() => setPocketMode(!pocketMode)}
        isFacingTarget={isFacingTarget}
      />
    </div>
  );
};