// src/screens/WalkScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSensors, triggerThighHaptics, type Coordinates } from '../hooks/useSensors';
import { CompassView } from '../components/CompassView';
import { VibePill } from '../components/VibePill';
import { PocketModeOverlay } from '../components/PocketModeOverlay';
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
}> = ({ target, onCancel, initialUserLocation }) => {
  const [pocketMode, setPocketMode] = useState(false);
  const [audioMode, setAudioMode] = useState<'pocket_speaker' | 'earbuds'>('pocket_speaker');

  const hasTriggeredArrivalSound = useRef(false);
  const prevTurnDirectionRef = useRef<TurnDirection>('straight');
  const lastDriftAlertTimeRef = useRef<number>(0);

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
    permissionGranted,
    requestCompassPermission,
    setManualHeading,
    simulateStep,
  } = useSensors({ lat: target.lat, lng: target.lng }, initialUserLocation);

  // 1. Arrival Trigger (<= 35m)
  useEffect(() => {
    if (distanceMeters > 0 && distanceMeters <= 35 && !hasTriggeredArrivalSound.current) {
      hasTriggeredArrivalSound.current = true;
      playArrivalChime();
      speakArrival(target.name, target.signatureDish);
    }
  }, [distanceMeters, target.name, target.signatureDish]);

  // 2. Intersection & Turn Guidance Loop
  // Triggers when turn direction changes at a fork or T-junction
  useEffect(() => {
    if (turnDirection === prevTurnDirectionRef.current) return;
    prevTurnDirectionRef.current = turnDirection;

    if (turnDirection === 'straight') return;

    if (audioMode === 'earbuds') {
      // Feature 1 & 2: Spatial Earbud Audio + Audio Whisper
      playSpatialDirectionChime(needleAngle);
      speakJunctionWhisper(needleAngle);
    } else {
      // Feature 5, 5a & 5b: Melodic Chimes (Rising/Falling) + Punchy Voice + Thigh Haptics
      playPocketMelodicChime(turnDirection);
      speakPunchyVoicePrompt(turnDirection);
      triggerThighHaptics(turnDirection);
    }
  }, [turnDirection, audioMode, needleAngle]);

  // 3. Feature 4: Wrong-Turn "Drift Guard" (Sound + Haptic)
  useEffect(() => {
    if (!isDrifting) return;
    const now = Date.now();
    // Throttle drift alert to every 10 seconds so it doesn't spam
    if (now - lastDriftAlertTimeRef.current > 10000) {
      lastDriftAlertTimeRef.current = now;
      playDriftWarningSound();
      triggerThighHaptics('wrong_way');
    }
  }, [isDrifting]);

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white overflow-hidden pb-6 select-none">
      {/* 1. Top Vibe Card */}
      <VibePill
        restaurantName={target.name}
        signatureDish={target.signatureDish}
        verdictReason={target.verdictReason}
        distanceMeters={distanceMeters}
      />

      {/* Audio Mode Toggle Switcher */}
      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-full p-1 shadow-md mt-2">
        <button
          type="button"
          onClick={() => setAudioMode('pocket_speaker')}
          className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
            audioMode === 'pocket_speaker'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔊 Pocket Speaker (No Buds)
        </button>
        <button
          type="button"
          onClick={() => setAudioMode('earbuds')}
          className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
            audioMode === 'earbuds'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🎧 Earbuds (Stereo 3D)
        </button>
      </div>

      {/* 2. Main Compass View with 1-Second Relative Turn Pill & Drift Alert */}
      <CompassView
        needleAngle={needleAngle}
        isFacingTarget={isFacingTarget}
        distanceMeters={distanceMeters}
        targetName={target.name}
        isDrifting={isDrifting}
        permissionGranted={permissionGranted}
        onRequestPermission={requestCompassPermission}
      />

      {/* 3. Interactive Sensor & Rotation Controls (Crucial for Laptops & In-Room Testing) */}
      <div className="w-full max-w-xs bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 shadow-lg flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
          <span>🧭 Compass & Rotation Test</span>
          <span className="text-emerald-400 font-mono">
            {heading}° (Bearing: {targetBearing}°)
          </span>
        </div>

        {/* Turn buttons & Step Forward */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setManualHeading(heading - 25)}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-all text-center"
            title="Rotate Heading Left 25°"
          >
            ↶ Turn -25°
          </button>
          <button
            type="button"
            onClick={() => simulateStep(15)}
            className="py-1.5 px-2 bg-emerald-950/80 hover:bg-emerald-900 active:scale-95 text-emerald-300 rounded-xl font-bold text-xs border border-emerald-800 transition-all text-center"
            title="Walk 15 meters forward toward eatery"
          >
            🚶 Step 15m
          </button>
          <button
            type="button"
            onClick={() => setManualHeading(heading + 25)}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-all text-center"
            title="Rotate Heading Right 25°"
          >
            ↷ Turn +25°
          </button>
        </div>

        {/* Live Heading Slider for Desktop / Laptop rotation */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[10px] text-slate-500 font-mono">0°</span>
          <input
            type="range"
            min="0"
            max="359"
            value={heading}
            onChange={(e) => setManualHeading(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <span className="text-[10px] text-slate-500 font-mono">359°</span>
        </div>

        {/* Live GPS & Needle Diagnostic HUD */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
          <span>
            GPS: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Resolving...'}
          </span>
          <span>
            Needle: <span className="text-slate-300 font-semibold">{needleAngle}°</span>
          </span>
        </div>
      </div>

      {/* 4. Bottom Action Controls */}
      <div className="flex flex-col items-center gap-2.5 w-full max-w-xs px-4 mt-1">
        <PocketModeOverlay
          isActive={pocketMode}
          onToggle={() => setPocketMode(!pocketMode)}
          isFacingTarget={isFacingTarget}
        />

        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-400 py-1 transition-colors"
        >
          ✕ Cancel Stroll
        </button>
      </div>
    </div>
  );
};