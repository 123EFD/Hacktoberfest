// src/screens/WalkScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSensors, triggerThighHaptics } from '../hooks/useSensors';
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

export const WalkScreen: React.FC<{ target: EateryTarget; onCancel: () => void }> = ({
  target,
  onCancel,
}) => {
  const [pocketMode, setPocketMode] = useState(false);
  const [audioMode, setAudioMode] = useState<'pocket_speaker' | 'earbuds'>('pocket_speaker');

  const hasTriggeredArrivalSound = useRef(false);
  const prevTurnDirectionRef = useRef<TurnDirection>('straight');
  const lastDriftAlertTimeRef = useRef<number>(0);

  // Hooking directly into our sensor framework
  const {
    needleAngle,
    distanceMeters,
    isFacingTarget,
    turnDirection,
    isDrifting,
    permissionGranted,
    requestCompassPermission,
  } = useSensors({ lat: target.lat, lng: target.lng });

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

      {/* 3. Bottom Action Controls */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs px-4">
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