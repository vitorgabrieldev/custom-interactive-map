import type { StyleSpecification } from 'maplibre-gl'

export const GTA_STYLE: StyleSpecification = {
  version: 8,
  name: 'GTA Gray',
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0d0d0d' } },

    // Landcover
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'sand'],
      paint: { 'fill-color': '#161616', 'fill-opacity': 0.9 },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'wood'],
      paint: { 'fill-color': '#131313', 'fill-opacity': 0.9 },
    },

    // Landuse
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'residential'],
      paint: { 'fill-color': '#191919' },
    },
    {
      id: 'landuse-commercial',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'commercial'],
      paint: { 'fill-color': '#1b1b1b' },
    },
    {
      id: 'landuse-industrial',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'industrial'],
      paint: { 'fill-color': '#171717' },
    },
    {
      id: 'landuse-park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'grass', 'pitch', 'cemetery'],
      paint: { 'fill-color': '#1e1e1e' },
    },

    // Water
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#0a0f14' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': '#0a0f14', 'line-width': 1.5 },
    },

    // Buildings — flat (low zoom only)
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      maxzoom: 14,
      paint: {
        'fill-color': '#1e1e1e',
        'fill-outline-color': '#262626',
      },
    },

    // Buildings — 3D extrusion (zoom 14+)
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 4],
          0,   '#141414',
          10,  '#181818',
          30,  '#1c1c1c',
          80,  '#1f1f1f',
          200, '#242424',
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 4],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.92,
      },
    },

    // Roads - minor
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'minor', 'service', 'path', 'track']],
      paint: {
        'line-color': '#242424',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 2.5],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'secondary', 'tertiary']],
      paint: {
        'line-color': '#363636',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4, 18, 9],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'primary', 'trunk']],
      paint: {
        'line-color': '#505050',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 3.5, 18, 13],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['==', 'class', 'motorway']],
      paint: {
        'line-color': '#6e6e6e',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 3.5, 16, 11, 20, 24],
      },
    },
    {
      id: 'road-motorway-center',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['==', 'class', 'motorway']],
      minzoom: 12,
      paint: {
        'line-color': '#a0a0a0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 1.5],
        'line-dasharray': [6, 8],
        'line-opacity': 0.35,
      },
    },

    // Rail
    {
      id: 'railway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      paint: {
        'line-color': '#2a2a2a',
        'line-width': 1.5,
        'line-dasharray': [4, 2],
      },
    },

    // City labels
    {
      id: 'label-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'city'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 17],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
      },
      paint: {
        'text-color': '#c0c0c0',
        'text-halo-color': '#0d0d0d',
        'text-halo-width': 2,
      },
    },
    {
      id: 'label-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', 'class', 'town', 'village'],
      minzoom: 9,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9, 14, 13],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: {
        'text-color': '#888888',
        'text-halo-color': '#0d0d0d',
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'label-road',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'symbol-placement': 'line',
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': '#606060',
        'text-halo-color': '#0d0d0d',
        'text-halo-width': 1,
      },
    },
  ],
}
