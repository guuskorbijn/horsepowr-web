'use client';

import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StyleSpecification } from 'maplibre-gl';
import type { RoutePoint } from '@/types/view';

/** Free, keyless OSM raster tiles — no Mapbox, no vendor lock. */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function RouteMap({ route }: { route: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || route.length === 0) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // Dynamic import keeps maplibre out of the server bundle.
    void import('maplibre-gl').then((maplibre) => {
      if (cancelled || !container) return;
      const coords = route.map((p) => [p.lng, p.lat] as [number, number]);

      const map = new maplibre.Map({
        container,
        style: OSM_STYLE,
        attributionControl: { compact: true },
        interactive: true,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#0058A2', 'line-width': 4 },
        });

        // Start / end markers.
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first) new maplibre.Marker({ color: '#1FA971' }).setLngLat(first).addTo(map);
        if (last) new maplibre.Marker({ color: '#E23D3D' }).setLngLat(last).addTo(map);

        // Fit to the track.
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibre.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
      });

      cleanup = () => map.remove();
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [route]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-lg border border-line"
      aria-label="Session route map"
    />
  );
}
