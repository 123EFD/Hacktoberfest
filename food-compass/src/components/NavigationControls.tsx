// src/components/NavigationControls.tsx
// Floating Google Navigation quick controls: 3D/2D toggle, Re-center, GPS Pin fixer, and Zoom +/-

import type { FC } from 'react';

interface NavigationControlsProps {
  is3D: boolean;
  onToggle3D: () => void;
  onRecenter: () => void;
  isPinMode: boolean;
  onTogglePinMode: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const NavigationControls: FC<NavigationControlsProps> = ({
  is3D,
  onToggle3D,
  onRecenter,
  isPinMode,
  onTogglePinMode,
  onZoomIn,
  onZoomOut,
}) => {
  return (
    <aside
      className="absolute right-4 top-24 z-20 flex flex-col gap-2 select-none"
      aria-label="Map Navigation Controls"
    >
      {/* 1. 3D / 2D Perspective Toggle */}
      <button
        type="button"
        onClick={onToggle3D}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 shadow-xl flex items-center justify-center text-xs font-black text-white active:scale-95 transition-all backdrop-blur-md"
        title={is3D ? 'Switch to 2D Overhead View' : 'Switch to 3D Walking View'}
      >
        {is3D ? '3D' : '2D'}
      </button>

      {/* 2. Re-center on User Location */}
      <button
        type="button"
        onClick={onRecenter}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 shadow-xl flex items-center justify-center text-base text-emerald-400 active:scale-95 transition-all backdrop-blur-md"
        title="Re-center Camera on My Location"
      >
        🎯
      </button>

      {/* 3. Manual GPS Location Fixer */}
      <button
        type="button"
        onClick={onTogglePinMode}
        className={`w-11 h-11 rounded-2xl border shadow-xl flex items-center justify-center text-sm font-bold active:scale-95 transition-all backdrop-blur-md ${
          isPinMode
            ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 animate-bounce'
            : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border-slate-700/80'
        }`}
        title={isPinMode ? 'Tap map to snap location' : 'Fix GPS position by tapping map'}
      >
        📍
      </button>

      {/* 4. Google Maps Zoom In / Out Pair */}
      <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-xl overflow-hidden backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomIn}
          className="w-11 h-10 hover:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-200 active:bg-slate-700 transition-colors border-b border-slate-800"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="w-11 h-10 hover:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-200 active:bg-slate-700 transition-colors"
          title="Zoom Out"
        >
          −
        </button>
      </div>
    </aside>
  );
};
