// src/services/routingService.ts
// Real walking route generation and step-by-step turn guidance via OSRM

export interface RouteStep {
  instruction: string;
  streetName: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: 'depart' | 'turn' | 'new name' | 'continue' | 'end of road' | 'fork' | 'roundabout' | 'arrive';
  modifier?: 'left' | 'right' | 'slight left' | 'slight right' | 'sharp left' | 'sharp right' | 'straight' | 'uturn';
  location: [number, number]; // [lng, lat]
}

export interface NavigationRoute {
  coordinates: [number, number][]; // LineString [[lng, lat], ...]
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  steps: RouteStep[];
  isFallback?: boolean;
}

/**
 * Calculates straight-line distance in meters between two [lng, lat] coordinates
 */
export function calculateDistanceMeters(start: [number, number], end: [number, number]): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(end[1] - start[1]);
  const dLon = toRad(end[0] - start[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(start[1])) * Math.cos(toRad(end[1])) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Generates human-friendly Google-style turn instructions from maneuver details
 */
function formatStepInstruction(
  type: string,
  modifier?: string,
  streetName?: string
): string {
  const road = streetName && streetName.trim() ? streetName : 'path';

  if (type === 'arrive') {
    return 'You have arrived at your destination';
  }
  if (type === 'depart') {
    return `Head out on ${road}`;
  }

  const mod = modifier || 'straight';
  switch (mod) {
    case 'left':
      return `Turn left onto ${road}`;
    case 'right':
      return `Turn right onto ${road}`;
    case 'slight left':
      return `Bear left onto ${road}`;
    case 'slight right':
      return `Bear right onto ${road}`;
    case 'sharp left':
      return `Make a sharp left onto ${road}`;
    case 'sharp right':
      return `Make a sharp right onto ${road}`;
    case 'uturn':
      return `Make a U-turn onto ${road}`;
    case 'straight':
    default:
      return `Continue straight on ${road}`;
  }
}

/**
 * Fetches real pedestrian walking route from OSRM with resilient offline fallback
 */
export async function fetchWalkingRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  targetName = 'Destination'
): Promise<NavigationRoute> {
  // Format: {lng},{lat};{lng},{lat}
  const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates;
        const legs = route.legs && route.legs.length > 0 ? route.legs[0] : null;

        const steps: RouteStep[] = legs && legs.steps ? legs.steps.map((s: any) => {
          const m = s.maneuver || {};
          return {
            instruction: formatStepInstruction(m.type, m.modifier, s.name),
            streetName: s.name || '',
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round(s.duration || 0),
            maneuverType: m.type || 'continue',
            modifier: m.modifier,
            location: m.location || [endLng, endLat],
          };
        }) : [];

        // If no steps returned, construct initial and arrival steps
        if (steps.length === 0) {
          steps.push({
            instruction: `Walk toward ${targetName}`,
            streetName: targetName,
            distanceMeters: Math.round(route.distance),
            durationSeconds: Math.round(route.duration),
            maneuverType: 'depart',
            location: [startLng, startLat],
          });
          steps.push({
            instruction: `Arrive at ${targetName}`,
            streetName: targetName,
            distanceMeters: 0,
            durationSeconds: 0,
            maneuverType: 'arrive',
            location: [endLng, endLat],
          });
        }

        return {
          coordinates,
          totalDistanceMeters: Math.round(route.distance),
          totalDurationSeconds: Math.round(route.duration),
          steps,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM walking route service unavailable, generating fallback path:', err);
  }

  // Fallback: Direct walking line with intermediate waypoints
  const directDistance = calculateDistanceMeters([startLng, startLat], [endLng, endLat]);
  const estimatedSeconds = Math.round(directDistance / 1.2); // ~1.2 m/s average walking speed

  // Generate a smooth 3-point line so 3D camera renders cleanly
  const midLng = (startLng + endLng) / 2;
  const midLat = (startLat + endLat) / 2;
  const fallbackCoordinates: [number, number][] = [
    [startLng, startLat],
    [midLng, midLat],
    [endLng, endLat],
  ];

  return {
    coordinates: fallbackCoordinates,
    totalDistanceMeters: directDistance,
    totalDurationSeconds: estimatedSeconds,
    isFallback: true,
    steps: [
      {
        instruction: `Walk toward ${targetName}`,
        streetName: targetName,
        distanceMeters: directDistance,
        durationSeconds: estimatedSeconds,
        maneuverType: 'depart',
        modifier: 'straight',
        location: [startLng, startLat],
      },
      {
        instruction: `Arrive at ${targetName}`,
        streetName: targetName,
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverType: 'arrive',
        location: [endLng, endLat],
      },
    ],
  };
}
