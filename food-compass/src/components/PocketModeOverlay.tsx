// dims the screen to 10% brightness to save battery, but keeps the compass and haptics active
import React, { useEffect, useRef } from 'react';

interface PocketModeOverlayProps {
    isActive: boolean;
    onToggle: () => void;
    isFacingTarget: boolean;
}

export const PocketModeOverlay: React.FC<PocketModeOverlayProps> = ({
    isActive,
    onToggle,
    isFacingTarget,
}) => {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Request Screen Wake Lock so mobile browser doesn't sleep in the pocket
    useEffect(() => {
        let isMounted = true;

        async function manageWakeLock() {
            if (isActive && 'wakeLock' in navigator) {
                try {
                    const lock = await navigator.wakeLock.request('screen');
                    if (isMounted) {
                        wakeLockRef.current = lock;
                    } else {
                        await lock.release();
                    }
                } catch (err) {
                    console.warn('Wake Lock request failed:', err);
                }
            } else if (!isActive && wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        }

        manageWakeLock();

        return () => {
            isMounted = false;
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        };
    }, [isActive]);

    if (!isActive) {
        return (
            <button
                onClick={onToggle}
                className="fixed bottom-6 px-5 py-2.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 shadow-lg active:scale-95 transition-all"
            >
                🕶️ Enter Pocket Mode (Dim Screen)
            </button>
        );
    }

    return (
        <div
            onClick={onToggle}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-10 cursor-pointer select-none"
        >
            <div className="text-center pt-8">
                <p className="text-[11px] uppercase tracking-widest text-slate-700 font-bold">
                    FoodCompass Active • Pocket Mode
                </p>
            </div>

            {/* Subtle pulsing indicator showing target alignment without bright light */}
            <div
                className={`w-6 h-6 rounded-full transition-all duration-300 ${isFacingTarget
                        ? 'bg-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-pulse'
                        : 'bg-slate-800'
                    }`}
            />

            <div className="text-center pb-8">
                <p className="text-xs text-slate-600">Tap anywhere to wake screen</p>
            </div>
        </div>
    );
};