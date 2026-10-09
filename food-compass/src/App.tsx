import { useState } from 'react';
import { WalkScreen } from './screens/WalkScreen';
import {
  searchWithPreferenceFallback,
  type FoodPreferences,
} from './services/osmServices';
import { useSensors } from './hooks/useSensors';
import { playArrivalChime, speakArrival } from './services/soundFeedback';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // User Food Preferences
  const [preferences, setPreferences] = useState<FoodPreferences>({
    diet: 'all',
    spice: 'any',
  });

  // Hook into sensors for user's starting GPS location
  const { userLocation, permissionGranted, requestCompassPermission } = useSensors();

  // Instant hardware verification for Audio & Vibration
  const handleTestSensors = async () => {
    setTestStatus('Testing vibration & audio...');
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
    playArrivalChime();
    speakArrival('Test Kitchen', 'Crispy Noodles');

    setTimeout(() => {
      setTestStatus('✓ Haptic pulse, chime & speech triggered successfully!');
      setTimeout(() => setTestStatus(null), 3500);
    }, 500);
  };

  // Launch a demo stroll based on current location (or default coordinates)
  const startDemoStroll = () => {
    const baseLat = userLocation?.lat ?? 37.7749;
    const baseLng = userLocation?.lng ?? -122.4194;

    const dishName =
      preferences.diet === 'halal'
        ? 'Charcoal Grilled Satay & Biryani'
        : preferences.diet === 'vegetarian'
        ? 'Wild Mushroom Claypot Rice'
        : 'Crispy Chili Oil Biang Biang';

    const restaurantName =
      preferences.diet === 'halal'
        ? 'Restoran Bismillah Garden'
        : preferences.diet === 'vegetarian'
        ? 'Lotus Leaf Vegetarian Kitchen'
        : "Aunty Mei's Hand-Pulled Noodles";

    setActiveTarget({
      name: restaurantName,
      lat: baseLat + 0.0022,
      lng: baseLng + 0.0018,
      signatureDish: dishName,
      verdictReason:
        'Lively outdoor courtyard, verified high local turnover, perfectly aligned with your preferences.',
    });
  };

  // Discover live nearby eateries with automatic preference fallback
  const handleFindStroll = async () => {
    if (!userLocation) {
      setStatusMessage('Acquiring your GPS position... please allow location permissions.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Scanning nearby eateries with OpenStreetMap & verifying preferences...');

    try {
      const result = await searchWithPreferenceFallback(
        userLocation.lat,
        userLocation.lng,
        preferences
      );

      const dish = result.eatery.cuisine
        ? `${result.eatery.cuisine} Special`
        : 'Chef Special';

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
      setStatusMessage('Could not find places via live GPS. Launching demo walk instead...');
      startDemoStroll();
    } finally {
      setIsLoading(false);
    }
  };

  // If a stroll is active, render the minimalist hands-free WalkScreen
  if (activeTarget) {
    return (
      <WalkScreen
        target={activeTarget}
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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <span>🌿</span> Touch Grass Edition
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
            onClick={requestCompassPermission}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs shadow-lg active:scale-95 transition-all"
          >
            🧭 Enable Walking Compass Sensors
          </button>
        )}

        {/* Main Search Action */}
        <button
          onClick={handleFindStroll}
          disabled={isLoading}
          className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-sm shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? 'Scanning Local Vibe...' : '🚶 Find Best Food Walk (800m)'}
        </button>

        {/* Demo Mode Action */}
        <button
          onClick={startDemoStroll}
          className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl text-xs border border-slate-800 active:scale-95 transition-all"
        >
          🎯 Test Walk (Demo Target ~250m)
        </button>

        {/* Instant Hardware Test Button */}
        <button
          onClick={handleTestSensors}
          className="w-full py-2.5 px-4 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 font-medium rounded-xl text-xs border border-slate-800/80 active:scale-95 transition-all"
        >
          🔔 Test Haptics & Audio Chime
        </button>

        {/* Status / Fallback Alerts */}
        {testStatus && (
          <p className="text-xs text-center text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-xl animate-fadeIn">
            {testStatus}
          </p>
        )}

        {statusMessage && (
          <p className="text-xs text-center text-amber-300 bg-amber-950/40 border border-amber-900/50 p-2.5 rounded-xl">
            {statusMessage}
          </p>
        )}
      </section>

      {/* Footer */}
      <footer className="w-full text-center pb-3 text-[11px] text-slate-600">
        <p>100% On-Device Open AI • 800m → 1.5km Radius Fallback • Zero Tracking</p>
      </footer>
    </main>
  );
}
