//displays the distance and the AI-generated signature dish
// src/components/VibePill.tsx
import React, { useState } from 'react';

interface VibePillProps {
    restaurantName: string;
    signatureDish: string;
    verdictReason: string;
    distanceMeters: number;
}

export const VibePill: React.FC<VibePillProps> = ({
    restaurantName,
    signatureDish,
    verdictReason,
    distanceMeters,
}) => {
    const [expanded, setExpanded] = useState(false);
    const walkingMinutes = Math.max(1, Math.round(distanceMeters / 80));

    return (
        <div className="w-full max-w-sm px-4 pt-4">
            <div
                onClick={() => setExpanded(!expanded)}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-[0.98]"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">{restaurantName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                                ⭐ {signatureDish}
                            </span>
                            <span className="text-xs text-slate-400">~{walkingMinutes} min stroll</span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                        {expanded ? '▲ Close' : '▼ Vibe'}
                    </div>
                </div>

                {/* Expandable Anti-Disappointment AI Report */}
                {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed animate-fadeIn">
                        <span className="text-emerald-400 font-semibold">AI Vibe Check: </span>
                        {verdictReason}
                    </div>
                )}
            </div>
        </div>
    );
};