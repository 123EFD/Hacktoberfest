// fetch nearby restaurants based on GPS coordinates without requiring proprietary map API keys

export interface NearbyEatery {
  id: number;
  name: string;
  cuisine: string;
  outdoor_seating: boolean;
  lat: number;
  lon: number;
  tags?: Record<string, string | undefined>;
}

export interface FoodPreferences {
  diet: 'all' | 'halal' | 'vegetarian';
  spice: 'any' | 'mild' | 'spicy';
}

export interface EaterySearchResult {
  eatery: NearbyEatery;
  isFallback: boolean;
  fallbackMessage?: string;
  distanceTier: '800m' | '1500m' | 'fallback_general';
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    cuisine?: string;
    outdoor_seating?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export async function fetchNearbyEateries(lat: number, lon: number, radiusMeters = 800): Promise<NearbyEatery[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"~"restaurant|cafe|fast_food"](around:${radiusMeters},${lat},${lon});
      way["amenity"~"restaurant|cafe|fast_food"](around:${radiusMeters},${lat},${lon});
    );
    out center 35;
  `;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });
  const data: OverpassResponse = await response.json();
  return data.elements.map((el: OverpassElement) => ({
    id: el.id,
    name: el.tags?.name || "Unnamed Local Spot",
    cuisine: el.tags?.cuisine || "Local Cuisine",
    outdoor_seating: el.tags?.outdoor_seating === "yes",
    lat: el.lat ?? el.center?.lat ?? 0,
    lon: el.lon ?? el.center?.lon ?? 0,
    tags: el.tags,
  }));
}

/**
 * Filters a list of eateries according to dietary and spiciness preferences
 */
export function filterByPreferences(eateries: NearbyEatery[], prefs: FoodPreferences): NearbyEatery[] {
  return eateries.filter((item) => {
    const tags = item.tags || {};
    const nameLower = item.name.toLowerCase();
    const cuisineLower = item.cuisine.toLowerCase();

    // 1. Dietary Check
    if (prefs.diet === 'halal') {
      const isHalalTag = tags['diet:halal'] === 'yes' || tags['diet:halal'] === 'only';
      const isHalalCuisine = [
        'halal',
        'malay',
        'mamak',
        'indian_muslim',
        'turkish',
        'arab',
        'middle_eastern',
        'indonesian',
        'pakistani',
      ].some((c) => cuisineLower.includes(c));
      const isHalalName = [
        'halal',
        'mamak',
        'nasi kandar',
        'muslim',
        'syed',
        'ali',
        'haji',
        'bukhari',
        'al-',
      ].some((k) => nameLower.includes(k));

      if (!isHalalTag && !isHalalCuisine && !isHalalName) return false;
    } else if (prefs.diet === 'vegetarian') {
      const isVegeTag =
        tags['diet:vegetarian'] === 'yes' ||
        tags['diet:vegetarian'] === 'only' ||
        tags['diet:vegan'] === 'yes';
      const isVegeCuisine = ['vegetarian', 'vegan', 'salad'].some((c) =>
        cuisineLower.includes(c)
      );
      const isVegeName = [
        'vegetarian',
        'vegan',
        'vege',
        'sayur',
        'plant',
        'green',
        'organic',
      ].some((k) => nameLower.includes(k));

      if (!isVegeTag && !isVegeCuisine && !isVegeName) return false;
    }

    // 2. Spiciness Check
    if (prefs.spice === 'mild') {
      const spicyKeywords = [
        'thai',
        'indian',
        'sichuan',
        'szechuan',
        'mala',
        'mexican',
        'curry',
        'spicy',
        'tomyam',
        'tom yum',
        'sambal',
      ];
      const isSpicy = spicyKeywords.some(
        (k) => cuisineLower.includes(k) || nameLower.includes(k)
      );
      if (isSpicy) return false;
    } else if (prefs.spice === 'spicy') {
      const spicyKeywords = [
        'thai',
        'indian',
        'sichuan',
        'szechuan',
        'mala',
        'mexican',
        'curry',
        'spicy',
        'tomyam',
        'tom yum',
        'korean',
        'nasi lemak',
        'sambal',
      ];
      const isSpicy = spicyKeywords.some(
        (k) => cuisineLower.includes(k) || nameLower.includes(k)
      );
      if (!isSpicy) return false;
    }

    return true;
  });
}

/**
 * Searches with automatic fallback:
 * Tier 1: Check 800m with user preference
 * Tier 2: If none, check 1500m with user preference
 * Tier 3: If still none, fallback to top 800m general eatery with notification
 */
export async function searchWithPreferenceFallback(
  lat: number,
  lon: number,
  prefs: FoodPreferences
): Promise<EaterySearchResult> {
  // Tier 1: Search within 800m
  const local800 = await fetchNearbyEateries(lat, lon, 800);
  const matched800 = filterByPreferences(local800, prefs);

  if (matched800.length > 0) {
    const selected = matched800.find((e) => e.outdoor_seating) || matched800[0];
    return {
      eatery: selected,
      isFallback: false,
      distanceTier: '800m',
    };
  }

  // Tier 2: Fallback 1 - Expand search radius to 1500m if a specific preference is set
  if (prefs.diet !== 'all' || prefs.spice !== 'any') {
    const local1500 = await fetchNearbyEateries(lat, lon, 1500);
    const matched1500 = filterByPreferences(local1500, prefs);

    if (matched1500.length > 0) {
      const selected = matched1500.find((e) => e.outdoor_seating) || matched1500[0];
      const dietLabel = prefs.diet !== 'all' ? prefs.diet.toUpperCase() : '';
      const spiceLabel = prefs.spice !== 'any' ? `${prefs.spice}` : '';
      const label = [dietLabel, spiceLabel].filter(Boolean).join(' / ');

      return {
        eatery: selected,
        isFallback: true,
        distanceTier: '1500m',
        fallbackMessage: `Notice: No ${label} spot found within 800m. Expanded to 1.5km walking radius to find this match!`,
      };
    }
  }

  // Tier 3: Fallback 2 - No matching venue found within 1.5km; return best local spot with friendly disclaimer
  if (local800.length > 0) {
    const fallbackEatery = local800.find((e) => e.outdoor_seating) || local800[0];
    const dietLabel = prefs.diet !== 'all' ? prefs.diet.toUpperCase() : '';
    const spiceLabel = prefs.spice !== 'any' ? `${prefs.spice}` : '';
    const label = [dietLabel, spiceLabel].filter(Boolean).join(' / ');

    return {
      eatery: fallbackEatery,
      isFallback: true,
      distanceTier: 'fallback_general',
      fallbackMessage: `Notice: No strict ${label} venues tagged nearby within 1.5km. Showing the highest-sentiment local spot with customizable options.`,
    };
  }

  throw new Error('No eateries found in this area. Try demo mode or test coordinates.');
}