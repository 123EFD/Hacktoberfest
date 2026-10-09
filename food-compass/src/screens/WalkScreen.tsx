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
  const [showTestControls, setShowTestControls] = useState(false);

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

  // Simulation handlers for instant hardware verification
  const handleSimulateTurn = (dir: TurnDirection) => {
    if (audioMode === 'earbuds') {
      const mockAngle = dir === 'right' ? 75 : dir === 'left' ? 285 : 0;
      playSpatialDirectionChime(mockAngle);
      speakJunctionWhisper(mockAngle);
    } else {
      playPocketMelodicChime(dir);
      speakPunchyVoicePrompt(dir);
      triggerThighHaptics(dir);
    }
  };

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

      {/* 3. Bottom Action Controls & Sensory Test Panel */}
      <div className="flex flex-col items-center gap-2.5 w-full max-w-xs px-4">
        <PocketModeOverlay
          isActive={pocketMode}
          onToggle={() => setPocketMode(!pocketMode)}
          isFacingTarget={isFacingTarget}
        />

        {/* Collapsible Sensory Hardware Test Controls */}
        <button
          type="button"
          onClick={() => setShowTestControls(!showTestControls)}
          className="text-[11px] text-slate-400 hover:text-emerald-400 underline underline-offset-4 transition-colors"
        >
          {showTestControls ? '▲ Hide Sensor Simulators' : '▼ Test Turns & Audio Cues'}
        </button>

        {showTestControls && (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col gap-1.5 shadow-2xl animate-fadeIn">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold text-center mb-1">
              Simulate Street Situations
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSimulateTurn('left')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-[11px] font-bold border border-slate-700"
              >
                ⬅️ Left Turn (2 Pulses)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateTurn('right')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-[11px] font-bold border border-slate-700"
              >
                ➡️ Right Turn (3 Pulses)
              </button>
              <button
                type="button"
                onClick={() => {
                  playDriftWarningSound();
                  triggerThighHaptics('wrong_way');
                }}
                className="py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 rounded-xl text-[11px] font-bold border border-rose-800"
              >
                ⚠️ Drift Guard Alert
              </button>
              <button
                type="button"
                onClick={() => {
                  playArrivalChime();
                  speakArrival(target.name, target.signatureDish);
                }}
                className="py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 rounded-xl text-[11px] font-bold border border-emerald-800"
              >
                🔔 Arrival Chime
              </button>
            </div>
          </div>
        )}

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