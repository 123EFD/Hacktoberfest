// src/components/Navigation3DMap.tsx
// Full 3D Photorealistic Google Maps Navigation Engine
// Features: Esri High-Res Satellite Imagery, Street Labels, Default Street Map, Dark 3D Mode,
// Surrounding Restaurant POI Markers, Directional User Cone, and Route Polyline

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, MapMouseEvent, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Coordinates } from '../hooks/useSensors';
import type { NearbyEatery } from '../services/osmServices';
import type { MapLayerType } from './NavigationLayersControl';

export interface Navigation3DMapRef {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface Navigation3DMapProps {
  userLocation: Coordinates;
  targetLocation: Coordinates;
  targetName: string;
  signatureDish: string;
  heading: number; // 0-360° phone heading
  routeCoordinates: [number, number][]; // [[lng, lat], ...]
  is3D: boolean;
  mapLayer: MapLayerType;
  nearbyEateries?: NearbyEatery[];
  onSelectEatery?: (eatery: NearbyEatery) => void;
  isPinMode: boolean;
  onSetLocation: (coords: Coordinates) => void;
  isAutoFollow: boolean;
  onUserPan: () => void;
}

export const Navigation3DMap = forwardRef<Navigation3DMapRef, Navigation3DMapProps>(
  (
    {
      userLocation,
      targetLocation,
      targetName,
      signatureDish,
      heading,
      routeCoordinates,
      is3D,
      mapLayer,
      nearbyEateries = [],
      onSelectEatery,
      isPinMode,
      onSetLocation,
      isAutoFollow,
      onUserPan,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const userMarkerRef = useRef<Marker | null>(null);
    const userPuckElementRef = useRef<HTMLDivElement | null>(null);
    const targetMarkerRef = useRef<Marker | null>(null);
    const nearbyMarkersRef = useRef<Marker[]>([]);

    // Expose zoom controls to parent component
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (mapRef.current) mapRef.current.zoomIn({ duration: 300 });
      },
      zoomOut: () => {
        if (mapRef.current) mapRef.current.zoomOut({ duration: 300 });
      },
    }));

    // 1. Build bulletproof multi-layer map style (Satellite Hybrid + Default Street + Dark)
    // Avoids external style JSON failures or empty PBF vector tile issues
    const buildMapStyle = (): StyleSpecification => ({
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
        },
        'satellite-labels': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          maxzoom: 20,
        },
        'street-tiles': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          maxzoom: 20,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
        'dark-tiles': {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          maxzoom: 20,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [
        // Base Satellite Aerial Layer
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite-tiles',
          layout: {
            visibility: mapLayer === 'satellite' ? 'visible' : 'none',
          },
        },
        // Default Street / Block Layer
        {
          id: 'street-layer',
          type: 'raster',
          source: 'street-tiles',
          layout: {
            visibility: mapLayer === 'street' ? 'visible' : 'none',
          },
        },
        // Night 3D Dark Mode
        {
          id: 'dark-layer',
          type: 'raster',
          source: 'dark-tiles',
          layout: {
            visibility: mapLayer === 'dark' ? 'visible' : 'none',
          },
        },
        // Overlay Street & Landmark Labels (applied on Satellite)
        {
          id: 'satellite-labels-layer',
          type: 'raster',
          source: 'satellite-labels',
          layout: {
            visibility: mapLayer === 'satellite' ? 'visible' : 'none',
          },
        },
      ],
    });

    // 2. Initialize MapLibre Canvas
    useEffect(() => {
      if (!mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: buildMapStyle(),
        center: [userLocation.lng, userLocation.lat],
        zoom: 17.8,
        pitch: is3D ? 60 : 0,
        bearing: is3D ? heading : 0,
        attributionControl: false,
        maxPitch: 75,
      });

      mapRef.current = map;

      // Detect user pan/drag to temporarily pause auto-follow
      map.on('dragstart', () => {
        onUserPan();
      });

      // Interactive Pin Placement for GPS fix
      map.on('click', (e: MapMouseEvent) => {
        onSetLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      map.on('load', () => {
        // Add Walking Route GeoJSON Source & Layers
        map.addSource('walking-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoordinates,
            },
          },
        });

        // Route Casing / Glow
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'walking-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#1d4ed8',
            'line-width': 10,
            'line-opacity': 0.8,
          },
        });

        // Primary Google Navigation Blue Walking Ribbon
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'walking-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 6,
            'line-opacity': 0.95,
          },
        });
      });

      // 3. Setup Custom Destination Marker (Google Maps Red Pin)
      const targetEl = document.createElement('div');
      targetEl.className = 'destination-marker flex flex-col items-center cursor-pointer select-none';
      targetEl.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.95); border: 2px solid #ef4444; padding: 4px 10px; border-radius: 9999px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); text-align: center; white-space: nowrap;">
          <span style="font-weight: 800; font-size: 11px; color: #ffffff;">${targetName}</span>
          <span style="font-size: 9px; color: #f87171; display: block; font-weight: 700;">★ ${signatureDish}</span>
        </div>
        <div style="position: relative; width: 26px; height: 32px; display: flex; align-items: center; justify-content: center; margin-top: 2px;">
          <div style="position: absolute; width: 24px; height: 24px; background: #ef4444; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 12px rgba(239,68,68,0.7);"></div>
          <div style="position: absolute; width: 8px; height: 8px; background: white; border-radius: 50%; z-index: 2; top: 8px;"></div>
        </div>
      `;

      targetMarkerRef.current = new maplibregl.Marker({ element: targetEl, anchor: 'bottom' })
        .setLngLat([targetLocation.lng, targetLocation.lat])
        .addTo(map);

      // 4. Setup Custom Google Navigation User Puck with 3D Direction Cone
      const puckContainer = document.createElement('div');
      puckContainer.className = 'user-puck-container relative flex items-center justify-center';
      puckContainer.style.width = '70px';
      puckContainer.style.height = '70px';
      puckContainer.innerHTML = `
        <!-- Directional 3D Field-of-View Cone -->
        <div id="puck-cone" style="position: absolute; width: 0; height: 0; border-left: 24px solid transparent; border-right: 24px solid transparent; border-top: 50px solid rgba(56, 189, 248, 0.45); top: -18px; left: 11px; pointer-events: none; transform-origin: 24px 53px; filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));"></div>
        <!-- Accuracy Pulsing Ring -->
        <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background: rgba(59, 130, 246, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <!-- Blue Location Core Dot -->
        <div style="position: relative; width: 22px; height: 22px; border-radius: 9999px; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 3px 12px rgba(0,0,0,0.6); z-index: 5;"></div>
      `;

      userPuckElementRef.current = puckContainer;
      userMarkerRef.current = new maplibregl.Marker({ element: puckContainer, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);

      return () => {
        map.remove();
        mapRef.current = null;
      };
    }, []); // Run once on mount

    // 5. Dynamic Map Layer Switcher (Satellite vs Street vs Dark)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      const setVisibility = (layerId: string, visible: boolean) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      };

      if (mapLayer === 'satellite') {
        setVisibility('satellite-layer', true);
        setVisibility('satellite-labels-layer', true);
        setVisibility('street-layer', false);
        setVisibility('dark-layer', false);
      } else if (mapLayer === 'street') {
        setVisibility('satellite-layer', false);
        setVisibility('satellite-labels-layer', false);
        setVisibility('street-layer', true);
        setVisibility('dark-layer', false);
      } else if (mapLayer === 'dark') {
        setVisibility('satellite-layer', false);
        setVisibility('satellite-labels-layer', false);
        setVisibility('street-layer', false);
        setVisibility('dark-layer', true);
      }
    }, [mapLayer]);

    // 6. Render Nearby Eateries & Restaurants (Google Maps POIs)
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      // Clear existing markers
      nearbyMarkersRef.current.forEach((m) => m.remove());
      nearbyMarkersRef.current = [];

      // Filter out target eatery
      const filtered = nearbyEateries.filter(
        (e) =>
          Math.abs(e.lat - targetLocation.lat) > 0.0001 ||
          Math.abs(e.lon - targetLocation.lng) > 0.0001
      );

      filtered.forEach((eatery) => {
        const poiEl = document.createElement('div');
        poiEl.className = 'nearby-poi group cursor-pointer select-none flex items-center gap-1';
        poiEl.innerHTML = `
          <div style="background: #ea580c; width: 22px; height: 22px; border-radius: 9999px; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 11px;">
            🍴
          </div>
          <div style="background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(234, 88, 12, 0.6); padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; color: #f1f5f9; box-shadow: 0 2px 6px rgba(0,0,0,0.4); max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${eatery.name}
          </div>
        `;

        poiEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (onSelectEatery) onSelectEatery(eatery);
        });

        const marker = new maplibregl.Marker({ element: poiEl, anchor: 'left' })
          .setLngLat([eatery.lon, eatery.lat])
          .addTo(map);

        nearbyMarkersRef.current.push(marker);
      });
    }, [nearbyEateries, targetLocation.lat, targetLocation.lng, onSelectEatery]);

    // 7. Update Route Polyline whenever routeCoordinates change
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const source = map.getSource('walking-route') as GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        });
      }
    }, [routeCoordinates]);

    // 8. Update User Location Marker & Puck Direction Cone
    useEffect(() => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }

      if (userPuckElementRef.current) {
        const cone = userPuckElementRef.current.querySelector('#puck-cone') as HTMLElement | null;
        if (cone) {
          cone.style.transform = `rotate(${heading}deg)`;
        }
      }
    }, [userLocation.lng, userLocation.lat, heading]);

    // 9. Auto-Follow Camera Engine
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isAutoFollow) return;

      map.easeTo({
        center: [userLocation.lng, userLocation.lat],
        bearing: is3D ? heading : 0,
        pitch: is3D ? 60 : 0,
        zoom: 17.8,
        duration: 500,
      });
    }, [userLocation.lng, userLocation.lat, heading, is3D, isAutoFollow]);

    // 10. Update Destination Marker
    useEffect(() => {
      if (targetMarkerRef.current) {
        targetMarkerRef.current.setLngLat([targetLocation.lng, targetLocation.lat]);
      }
    }, [targetLocation.lng, targetLocation.lat]);

    return (
      <div className="relative w-full h-full overflow-hidden">
        {/* Subtle 3D Horizon Atmosphere Gradient */}
        {is3D && (
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none z-10" />
        )}

        <div
          ref={mapContainerRef}
          className={`w-full h-full ${isPinMode ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );
  }
);

Navigation3DMap.displayName = 'Navigation3DMap';
