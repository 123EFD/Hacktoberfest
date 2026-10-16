// src/components/NavigationTurnBanner.tsx
// Google Navigation-style green turn-by-turn instruction header

import type { FC } from 'react';
import type { RouteStep } from '../services/routingService';

interface NavigationTurnBannerProps {
  currentStep: RouteStep | null;
  nextStep: RouteStep | null;
  stepDistanceRemainingMeters: number;
  totalDistanceMeters: number;
}

export const NavigationTurnBanner: FC<NavigationTurnBannerProps> = ({
  currentStep,
  nextStep,
  stepDistanceRemainingMeters,
}) => {
  if (!currentStep) return null;

  // Determine intuitive maneuver icon
  const getManeuverIcon = (step: RouteStep) => {
    if (step.maneuverType === 'arrive') return '🏁';
    const mod = step.modifier;
    switch (mod) {
      case 'left':
      case 'sharp left':
        return '⬅️';
      case 'right':
      case 'sharp right':
        return '➡️';
      case 'slight left':
        return '↖️';
      case 'slight right':
        return '↗️';
      case 'uturn':
        return '↩️';
      case 'straight':
      default:
        return '⬆️';
    }
  };

  const isArrival = currentStep.maneuverType === 'arrive' || stepDistanceRemainingMeters <= 20;

  return (
    <header className="w-full max-w-md mx-auto z-30 select-none px-3 pt-3">
      {/* Primary Google Navigation Green Card */}
      <div className="bg-emerald-700/95 border border-emerald-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-white transition-all">
        <div className="flex items-center gap-3.5">
          {/* Big Maneuver Icon */}
          <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
            {getManeuverIcon(currentStep)}
          </div>

          {/* Maneuver Instruction Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight text-white">
                {isArrival ? 'Arriving' : `In ${stepDistanceRemainingMeters}m`}
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-100 truncate mt-0.5">
              {currentStep.instruction}
            </p>
          </div>
        </div>

        {/* Subsequent Lane / Step Guidance */}
        {nextStep && nextStep.maneuverType !== 'arrive' && (
          <div className="mt-2.5 pt-2 border-t border-emerald-600/60 flex items-center justify-between text-[11px] text-emerald-200">
            <span className="flex items-center gap-1.5 font-medium">
              <span>Then:</span>
              <span>{getManeuverIcon(nextStep)}</span>
              <span className="truncate max-w-[200px]">{nextStep.instruction}</span>
            </span>
            <span className="font-semibold text-emerald-100">
              {nextStep.distanceMeters}m
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
