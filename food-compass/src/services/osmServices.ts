// fetch nearby restaurants based on GPS coordinates without requiring proprietary map API keys

export interface NearbyEatery {
  id: number;
  name: string;
  cuisine: string;
  outdoor_seating: boolean;
  lat: number;
  lon: number;
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
    out center 25;
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
  }));
}