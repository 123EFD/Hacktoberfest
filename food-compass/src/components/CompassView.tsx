import React, { useState, useEffect, useRef } from 'react';

export interface CompassViewProps {
  needleAngle: number;       // 0 to 360 relative to phone heading
  isFacingTarget: boolean;   // within ±10° of target
  distanceMeters: number;
  targetName?: string;
  isDrifting?: boolean;
  permissionGranted?: boolean;
  onRequestPermission?: () => void;
}

/**
 * 3. THE 1-SECOND VISUAL CLUE: Relative Turn Action Classifier
 */
function getTurnGuidance(angle: number, isDrifting = false): { icon: string; text: string; color: string } {
  if (isDrifting) {
    return {
      icon: '⚠️',
      text: 'Drift Alert: Turn Around',
      color: 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse',
    };
  }
  if (angle <= 15 || angle >= 345) {
    return {
      icon: '⬆️',
      text: 'Straight Ahead',
      color: 'bg-emerald-950 text-emerald-400 border-emerald-800 shadow-[0_0_15px_rgba(52,211,153,0.2)]',
    };
  }
  if (angle > 15 && angle <= 60) {
    return {
      icon: '↗️',
      text: 'Bear Right at Fork',
      color: 'bg-slate-900 text-slate-200 border-slate-700',
    };
  }
  if (angle > 60 && angle <= 120) {
    return {
      icon: '➡️',
      text: 'Turn Right at T-Junction',
      color: 'bg-amber-950 text-amber-300 border-amber-800',
    };
  }
  if (angle > 120 && angle <= 240) {
    return {
      icon: '⬇️',
      text: 'Turn Around (Wrong Way)',
      color: 'bg-rose-950 text-rose-300 border-rose-800',
    };
  }
  if (angle > 240 && angle <= 300) {
    return {
      icon: '⬅️',
      text: 'Turn Left at T-Junction',
      color: 'bg-amber-950 text-amber-300 border-amber-800',
    };
  }
  return {
    icon: '↖️',
    text: 'Bear Left at Fork',
    color: 'bg-slate-900 text-slate-200 border-slate-700',
  };
}

export const CompassView: React.FC<CompassViewProps> = ({
  needleAngle,
  isFacingTarget,
  distanceMeters,
  targetName,
  isDrifting = false,
  permissionGranted = true,
  onRequestPermission,
}) => {
  // Store cumulative angle to prevent 360° spin-back glitches
  const [cumulativeAngle, setCumulativeAngle] = useState(needleAngle);
  const prevAngleRef = useRef(needleAngle);

  // Smooth unwrapping logic executed cleanly inside an effect
  useEffect(() => {
    let delta = needleAngle - prevAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    setCumulativeAngle((prev) => prev + delta);
    prevAngleRef.current = needleAngle;
  }, [needleAngle]);

  const turnGuidance = getTurnGuidance(needleAngle, isDrifting);

  return (
    <div className="flex flex-col items-center justify-center p-4 my-auto w-full select-none">
      {!permissionGranted && onRequestPermission && (
        <button
          onClick={onRequestPermission}
          className="mb-4 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full font-semibold shadow-lg text-sm active:scale-95 transition-transform"
        >
          Enable Compass & Walking Sensors
        </button>
      )}

      {/* Walking Distance Counter */}
      <div className="text-center mb-6">
        <h2 className="text-5xl font-black tracking-tight text-white">
          {distanceMeters}
          <span className="text-xl font-normal text-slate-400 ml-1">m</span>
        </h2>
        {targetName && (
          <p className="text-slate-400 text-sm mt-1 font-medium">Walking to {targetName}</p>
        )}
      </div>

      {/* Compass Needle Wheel */}
      <div
        className={`relative w-64 h-64 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
          isDrifting
            ? 'border-rose-500 bg-rose-950/30 shadow-[0_0_35px_rgba(244,63,94,0.4)] animate-pulse'
            : isFacingTarget
            ? 'border-emerald-400 bg-emerald-950/20 shadow-[0_0_35px_rgba(52,211,153,0.3)]'
            : 'border-slate-800 bg-slate-900/40'
        }`}
      >
        {/* Cardinal tick marks */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-slate-600 rounded" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-3 bg-slate-600 rounded" />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-1 bg-slate-600 rounded" />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-1 bg-slate-600 rounded" />

        {/* Needle Arrow rotates smoothly */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out will-change-transform"
          style={{ transform: `rotate(${cumulativeAngle}deg)` }}
        >
          <div className="relative flex flex-col items-center h-full justify-start pt-4">
            <div
              className={`w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[32px] transition-colors duration-300 ${
                isDrifting
                  ? 'border-b-rose-400'
                  : isFacingTarget
                  ? 'border-b-emerald-400'
                  : 'border-b-slate-400'
              }`}
            />
            <div
              className={`w-1.5 h-20 rounded-b transition-colors duration-300 ${
                isDrifting
                  ? 'bg-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                  : isFacingTarget
                  ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]'
                  : 'bg-slate-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 3. The 1-Second Visual Clue: Relative Turn Action Pill */}
      <div
        className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border shadow-lg transition-all ${turnGuidance.color}`}
      >
        <span className="text-base">{turnGuidance.icon}</span>
        <span>{turnGuidance.text}</span>
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {isFacingTarget ? '✓ On Course' : 'Turn towards arrow'}
      </p>
    </div>
  );
};