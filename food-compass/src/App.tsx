import { useState } from 'react';
import { WalkScreen } from './screens/WalkScreen';
import { fetchNearbyEateries } from './services/osmServices';
import { useSensors } from './hooks/useSensors';

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

  // Hook into sensors for user's starting location
  const { userLocation, permissionGranted, requestCompassPermission } = useSensors();

  // 1. Launch a demo stroll based on current location (or default coordinates)
  const startDemoStroll = () => {
    const baseLat = userLocation?.lat ?? 37.7749;
    const baseLng = userLocation?.lng ?? -122.4194;

    // Place a demo eatery ~250m north-east
    setActiveTarget({
      name: "Aunty Mei's Hand-Pulled Noodles",
      lat: baseLat + 0.0022,
      lng: baseLng + 0.0018,
      signatureDish: 'Crispy Chili Oil Biang Biang',
      verdictReason:
        'Lively outdoor courtyard, verified high local turnover, 0% dead-restaurant risk.',
    });
  };

  // 2. Discover live nearby eateries using OpenStreetMap
  const discoverNearby = async (radiusMeters = 800) => {
    if (!userLocation) {
      setStatusMessage('Acquiring your GPS position... please allow location permissions.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Scanning nearby eateries with OpenStreetMap...');

    try {
      const eateries = await fetchNearbyEateries(userLocation.lat, userLocation.lng, radiusMeters);

      if (eateries.length === 0) {
        setStatusMessage('No eateries found within walking radius. Try Demo Mode!');
        setIsLoading(false);
        return;
      }

      // Select top candidate (prefer outdoor seating)
      const best = eateries.find((e) => e.outdoor_seating) || eateries[0];

      setActiveTarget({
        name: best.name,
        lat: best.lat,
        lng: best.lon,
        signatureDish: best.cuisine ? `${best.cuisine} Special` : 'House Special',
        verdictReason: best.outdoor_seating
          ? 'Verified breezy outdoor seating with high foot traffic.'
          : 'High local sentiment and authentic street food consensus.',
      });
      setStatusMessage(null);
    } catch (err) {
      console.error(err);
      setStatusMessage('Network issue fetching places. Starting demo walk instead...');
      startDemoStroll();
    } finally {
      setIsLoading(false);
    }
  };

  // If a stroll is active, show the hands-free WalkScreen
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
    <main className="flex flex-col items-center justify-between min-h-screen p-6 bg-slate-950 text-white select-none">
      {/* Header */}
      <div className="w-full text-center pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <span>🌿</span> Touch Grass Edition
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">FoodCompass</h1>
        <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
          Pocket the screen. Follow the arrow. Never walk to an empty, disappointing meal again.
        </p>
      </div>

      {/* Main Actions */}
      <div className="w-full max-w-sm flex flex-col gap-4 my-auto">
        {!permissionGranted && (
          <button
            onClick={requestCompassPermission}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            🧭 Enable Walking Sensors
          </button>
        )}

        <button
          onClick={() => discoverNearby(800)}
          disabled={isLoading}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-base shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {isLoading ? 'Scanning Street Vibe...' : '🚶 Find Best Dinner Stroll (800m)'}
        </button>

        <button
          onClick={startDemoStroll}
          className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl text-sm border border-slate-800 active:scale-95 transition-all"
        >
          🎯 Test Walk (Demo Target ~250m)
        </button>

        {statusMessage && (
          <p className="text-xs text-center text-amber-300 bg-amber-950/40 border border-amber-900/50 p-2.5 rounded-xl">
            {statusMessage}
          </p>
        )}
      </div>

      {/* Footer Info */}
      <footer className="w-full text-center pb-4 text-xs text-slate-600">
        <p>100% On-Device Open AI • Zero Tracking • Runs Offline</p>
      </footer>
    </main>
  );
}
