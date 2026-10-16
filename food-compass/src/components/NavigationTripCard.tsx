// src/components/NavigationTripCard.tsx
// Bottom trip summary card with ETA, distance, audio mode, simulation, and cancel controls

import type { FC } from 'react';

interface NavigationTripCardProps {
  targetName: string;
  signatureDish: string;
  verdictReason: string;
  distanceMeters: number;
  durationSeconds: number;
  audioMode: 'pocket_speaker' | 'earbuds';
  onToggleAudioMode: (mode: 'pocket_speaker' | 'earbuds') => void;
  onCancel: () => void;
  heading: number;
  targetBearing: number;
  onTurn: (deltaDeg: number) => void;
  onStep: (meters: number) => void;
  onHeadingChange: (heading: number) => void;
  isPinMode: boolean;
}

export const NavigationTripCard: FC<NavigationTripCardProps> = ({
  targetName,
  signatureDish,
  verdictReason,
  distanceMeters,
  durationSeconds,
  audioMode,
  onToggleAudioMode,
  onCancel,
  heading,
  targetBearing,
  onTurn,
  onStep,
  onHeadingChange,
  isPinMode,
}) => {
  const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

  return (
    <footer className="w-full max-w-md mx-auto z-30 select-none px-3 pb-3 flex flex-col gap-2">
      {/* Pin Mode Helper Alert */}
      {isPinMode && (
        <div className="bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs px-3.5 py-2 rounded-xl text-center shadow-lg animate-pulse backdrop-blur-md">
          📍 Tap anywhere on the map to snap your GPS position to that street!
        </div>
      )}

      {/* Primary Trip Overview Card */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 shadow-2xl backdrop-blur-md text-white flex flex-col gap-3">
        {/* Destination & ETA Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black tracking-tight text-white truncate">
              {targetName}
            </h2>
            <p className="text-xs font-semibold text-emerald-400 truncate mt-0.5">
              ⭐ {signatureDish}
            </p>
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
              {verdictReason}
            </p>
          </div>

          {/* Big ETA Badge */}
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-black text-emerald-400 tracking-tight leading-none">
              {etaMinutes} <span className="text-xs font-bold text-slate-400">min</span>
            </div>
            <div className="text-xs font-bold text-slate-400 mt-1">
              {distanceMeters} m
            </div>
          </div>
        </div>

        {/* Audio Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-1 shadow-inner">
          <button
            type="button"
            onClick={() => onToggleAudioMode('pocket_speaker')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all text-center ${
              audioMode === 'pocket_speaker'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔊 Pocket Speaker
          </button>
          <button
            type="button"
            onClick={() => onToggleAudioMode('earbuds')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all text-center ${
              audioMode === 'earbuds'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎧 Earbuds (3D)
          </button>
        </div>

        {/* Simulation Bar (Ideal for Laptop & In-Room Testing) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Navigation Simulator</span>
            <span className="text-emerald-400 font-mono">
              Heading: {heading}° | Bearing: {targetBearing}°
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onTurn(-25)}
              className="py-1 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl font-bold text-[11px] border border-slate-700 transition-all text-center"
            >
              ↶ Turn -25°
            </button>
            <button
              type="button"
              onClick={() => onStep(15)}
              className="py-1 px-2 bg-emerald-950/90 hover:bg-emerald-900 active:scale-95 text-emerald-300 rounded-xl font-bold text-[11px] border border-emerald-800 transition-all text-center"
            >
              🚶 Step 15m
            </button>
            <button
              type="button"
              onClick={() => onTurn(25)}
              className="py-1 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl font-bold text-[11px] border border-slate-700 transition-all text-center"
            >
              ↷ Turn +25°
            </button>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-slate-500 font-mono">0°</span>
            <input
              type="range"
              min="0"
              max="359"
              value={heading}
              onChange={(e) => onHeadingChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <span className="text-[10px] text-slate-500 font-mono">359°</span>
          </div>
        </div>

        {/* Exit Button */}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-400 py-1 transition-colors"
          >
            ✕ End Stroll
          </button>
        </div>
      </div>
    </footer>
  );
};
