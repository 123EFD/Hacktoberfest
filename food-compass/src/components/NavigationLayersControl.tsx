// src/components/NavigationLayersControl.tsx
// Google Maps-style floating Layers switcher (Satellite Hybrid vs Default Street vs Dark)

import { useState, type FC } from 'react';

export type MapLayerType = 'satellite' | 'street' | 'dark';

interface NavigationLayersControlProps {
  currentLayer: MapLayerType;
  onChangeLayer: (layer: MapLayerType) => void;
}

export const NavigationLayersControl: FC<NavigationLayersControlProps> = ({
  currentLayer,
  onChangeLayer,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const layerOptions: { id: MapLayerType; label: string; icon: string; previewClass: string }[] = [
    {
      id: 'satellite',
      label: 'Satellite',
      icon: '🛰️',
      previewClass: 'bg-emerald-950 border-emerald-500 text-emerald-200',
    },
    {
      id: 'street',
      label: 'Default',
      icon: '🗺️',
      previewClass: 'bg-sky-950 border-sky-500 text-sky-200',
    },
    {
      id: 'dark',
      label: 'Night 3D',
      icon: '🌙',
      previewClass: 'bg-slate-900 border-slate-600 text-slate-300',
    },
  ];

  return (
    <div className="absolute left-4 bottom-72 z-20 select-none">
      {/* Expanded Selection Popover */}
      {isOpen && (
        <div className="mb-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 animate-fadeIn">
          <span className="text-[10px] font-bold text-slate-400 px-2 pt-1 uppercase tracking-wider">
            Map Layers
          </span>
          <div className="flex gap-2 p-1">
            {layerOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChangeLayer(opt.id);
                  setIsOpen(false);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-bold transition-all ${
                  currentLayer === opt.id
                    ? `${opt.previewClass} ring-2 ring-emerald-400 shadow-md scale-105`
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-[10px] whitespace-nowrap">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary Google Maps Mini Layers Thumbnail Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/90 rounded-2xl p-2 shadow-2xl backdrop-blur-md active:scale-95 transition-all"
        title="Toggle Map Layers (Satellite / Street)"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-800 border border-slate-600/60 shadow-inner text-base">
          {currentLayer === 'satellite' ? '🛰️' : currentLayer === 'street' ? '🗺️' : '🌙'}
        </div>
        <div className="flex flex-col items-start pr-1 text-left">
          <span className="text-[11px] font-black text-white leading-tight">
            {currentLayer === 'satellite' ? 'Satellite' : currentLayer === 'street' ? 'Default' : 'Night'}
          </span>
          <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-tight">
            Layers
          </span>
        </div>
      </button>
    </div>
  );
};
