// src/screens/WalkScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSensors } from '../hooks/useSensors';
import { CompassView } from '../components/CompassView';
import { VibePill } from '../components/VibePill';
import { PocketModeOverlay } from '../components/PocketModeOverlay';
import { playArrivalChime, speakArrival } from '../services/soundFeedback';

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
    const hasTriggeredArrivalSound = useRef(false);

    // Hooking directly into our sensor framework from Phase 1
    const {
        needleAngle,
        distanceMeters,
        isFacingTarget,
        permissionGranted,
        requestCompassPermission,
    } = useSensors({ lat: target.lat, lng: target.lng });

    // Arrival Trigger (<= 35m)
    useEffect(() => {
        if (distanceMeters > 0 && distanceMeters <= 35 && !hasTriggeredArrivalSound.current) {
            hasTriggeredArrivalSound.current = true;
            playArrivalChime();
            speakArrival(target.name, target.signatureDish);
        }
    }, [distanceMeters, target.name, target.signatureDish]);

    return (
        <div className="relative flex flex-col items-center justify-between min-h-screen bg-slate-950 text-white overflow-hidden pb-8 select-none">
            {/* 1. Top Vibe Card */}
            <VibePill
                restaurantName={target.name}
                signatureDish={target.signatureDish}
                verdictReason={target.verdictReason}
                distanceMeters={distanceMeters}
            />

            {/* 2. Main Compass View */}
            <CompassView
                needleAngle={needleAngle}
                isFacingTarget={isFacingTarget}
                distanceMeters={distanceMeters}
                targetName={target.name}
                permissionGranted={permissionGranted}
                onRequestPermission={requestCompassPermission}
            />

            {/* 3. Bottom Action Controls */}
            <div className="flex flex-col items-center gap-2.5">
                <PocketModeOverlay
                    isActive={pocketMode}
                    onToggle={() => setPocketMode(!pocketMode)}
                    isFacingTarget={isFacingTarget}
                />

                <button
                    type="button"
                    onClick={() => {
                        playArrivalChime();
                        speakArrival(target.name, target.signatureDish);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-sm"
                >
                    🔔 Test Arrival Chime & Voice
                </button>

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