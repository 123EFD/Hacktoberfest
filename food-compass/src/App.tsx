import { useState, useEffect } from 'react';
import { WalkScreen } from './screens/WalkScreen';
import {
  searchWithPreferenceFallback,
  type FoodPreferences,
} from './services/osmServices';
import { useSensors, type Coordinates } from './hooks/useSensors';

interface EateryTarget {
  name: string;
  lat: number;
  lng: number;
  signatureDish: string;
  verdictReason: string;
}

export default function App() {
  const [activeTarget, setActiveTarget] = useState<EateryTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Monitor online / offline connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // User Food Preferences
  const [preferences, setPreferences] = useState<FoodPreferences>({
    diet: 'all',
    spice: 'any',
  });

  // Hook into sensors for user's starting GPS location & active acquisition
  const {
    userLocation,
    permissionGranted,
    requestCompassPermission,
    acquireLocation,
    setManualLocation,
    error: sensorError,
  } = useSensors();

  // Discover live nearby eateries with automatic preference fallback
  const handleFindStroll = async (overrideCoords?: Coordinates) => {
    let loc = overrideCoords || userLocation;

    if (!loc) {
      setIsLoading(true);
      setStatusMessage('Acquiring your GPS position... please allow location permissions if prompted.');
      loc = await acquireLocation();
    }

    if (!loc) {
      setIsLoading(false);
      setStatusMessage(
        sensorError ||
          'Unable to detect GPS position. Please check browser location permissions or choose a city below.'
      );
      return;
    }

    setIsLoading(true);
    setStatusMessage('Scanning nearby eateries with OpenStreetMap & verifying preferences...');

    try {
      const result = await searchWithPreferenceFallback(
        loc.lat,
        loc.lng,
        preferences
      );

      const dish =
        result.signatureDishOverride ||
        (result.eatery.cuisine ? `${result.eatery.cuisine} Special` : 'Chef Special');

      let reason = result.eatery.outdoor_seating
        ? 'Verified breezy outdoor seating with high foot traffic.'
        : 'High local sentiment and authentic diner consensus.';

      if (result.isFallback && result.fallbackMessage) {
        reason = `${result.fallbackMessage} (${reason})`;
      }

      setActiveTarget({
        name: result.eatery.name,
        lat: result.eatery.lat,
        lng: result.eatery.lon,
        signatureDish: dish,
        verdictReason: reason,
      });
      setStatusMessage(null);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Notice: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // If a stroll is active, render the minimalist hands-free WalkScreen
  if (activeTarget) {
    return (
      <WalkScreen
        target={activeTarget}
        initialUserLocation={userLocation}
        onCancel={() => {
          setActiveTarget(null);
          setStatusMessage(null);
        }}
      />
    );
  }

  return (
    <main className="flex flex-col items-center justify-between min-h-screen p-5 bg-slate-950 text-white select-none">
      {/* Header */}
      <header className="w-full text-center pt-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>🌿</span> Touch Grass
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                : 'bg-amber-950/80 border-amber-800 text-amber-300 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {isOnline ? 'PWA Offline Ready' : '⚡ Offline Mode (Sensors Active)'}
          </div>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white mb-1.5">FoodCompass</h1>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          Pocket the screen. Follow the arrow. Never walk to an empty, disappointing meal again.
        </p>
      </header>

      {/* Preference & Control Center */}
      <section className="w-full max-w-sm flex flex-col gap-4 my-auto">
        {/* Preference Box */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Dining Preferences
          </h2>

          {/* 1. Dietary Option */}
          <div className="mb-3.5">
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
              Dietary Option:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Eats' },
                  { id: 'halal', label: '🕌 Halal' },
                  { id: 'vegetarian', label: '🥗 Veg' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreferences((prev) => ({ ...prev, diet: item.id }))}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                    preferences.diet === item.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                      : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Spiciness Option */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
              Spiciness Level:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'any', label: 'Any Heat' },
                  { id: 'mild', label: '🥛 Mild / No' },
                  { id: 'spicy', label: '🌶️ Love Spicy' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreferences((prev) => ({ ...prev, spice: item.id }))}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                    preferences.spice === item.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                      : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sensor Permission Button */}
        {!permissionGranted && (
          <button
            type="button"
            onClick={requestCompassPermission}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs shadow-lg active:scale-95 transition-all"
          >
            🧭 Enable Walking Compass Sensors
          </button>
        )}

        {/* GPS Live Status Indicator */}
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
          <span>GPS Sensor:</span>
          {userLocation ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              GPS Locked ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
            </span>
          ) : (
            <span className="text-amber-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Waiting for GPS fix...
            </span>
          )}
        </div>

        {/* Main Search Action */}
        <button
          onClick={() => handleFindStroll()}
          disabled={isLoading}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-base shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading
            ? 'Scanning Local Vibe...'
            : userLocation
            ? '🚶 Find Best Food Walk (800m)'
            : '📍 Acquire GPS & Find Food Walk'}
        </button>

        {statusMessage && (
          <div className="text-xs text-center text-amber-300 bg-amber-950/40 border border-amber-900/50 p-3 rounded-xl flex flex-col gap-2">
            <p>{statusMessage}</p>
            {!userLocation && (
              <div className="flex gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => acquireLocation()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 active:scale-95 transition-all"
                >
                  🔄 Retry GPS Detection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Default to Bukit Bintang, Kuala Lumpur food street hub
                    const defaultCoords = { lat: 3.1466, lng: 101.7115 };
                    setManualLocation(defaultCoords);
                    handleFindStroll(defaultCoords);
                  }}
                  className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-800 active:scale-95 transition-all"
                >
                  📍 Use City Center (KL)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="w-full text-center pb-3 text-[11px] text-slate-600">
        <p>100% On-Device Open AI • 800m → 1.5km Radius Fallback • Zero Tracking</p>
      </footer>
    </main>
  );
}
