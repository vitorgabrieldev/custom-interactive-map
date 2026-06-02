// Seeded LCG pseudo-random number generator
function seededRng(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// FNV-1a hash — converts a string ID to a stable integer seed
export function hashStr(s: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

// Chaikin curve smoothing for a closed polygon ring.
// Each iteration doubles the number of points and rounds corners.
function chaikin(pts: [number, number][], iterations: number): [number, number][] {
  let ring = pts
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = []
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % n]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    ring = next
  }
  return ring
}

/**
 * Generate an organic, irregular polygon that simulates an infection/contamination zone.
 *
 * Uses power-law radius variation to produce "tentacles" extending outward —
 * mimicking how an infection spreads unevenly into streets — combined with
 * Chaikin curve smoothing for smooth organic edges.
 *
 * @param center   Geographic center [lng, lat] in WGS84
 * @param radiusKm Base radius in kilometres
 * @param seed     Integer seed — same seed always produces the same shape
 * @returns Closed GeoJSON polygon ring: array of [lng, lat] coordinate pairs
 */
export function generateZonePolygon(
  center: [number, number],
  radiusKm: number,
  seed: number,
): [number, number][] {
  const rng = seededRng(seed)
  const N = 24 // base vertex count before smoothing
  const [lng, lat] = center

  // Geographic conversion factors (approximate, valid for mid-latitudes)
  const kmToLat = 1 / 111.32
  const kmToLng = 1 / (111.32 * Math.cos((lat * Math.PI) / 180))

  // Build raw radii: mix of shallow valleys and sharp spikes.
  // Spikes (28% of vertices) simulate infection tendrils extending along streets.
  // Valleys (72%) create the inward pull between tendrils.
  const radii: number[] = Array.from({ length: N }, () => {
    if (rng() < 0.28) {
      // Spike: 130–230% of base radius
      return 1.3 + rng() * 1.0
    }
    // Valley: 25–85% of base radius (power-law biases toward the lower end)
    return 0.25 + Math.pow(rng(), 0.7) * 0.6
  })

  // Smooth radii with a 3-tap weighted average (preserves spike sharpness)
  const smoothed = radii.map((r, i) => {
    const prev = radii[(i - 1 + N) % N]
    const next = radii[(i + 1) % N]
    return prev * 0.2 + r * 0.6 + next * 0.2
  })

  // Convert polar coordinates to geographic [lng, lat]
  const pts: [number, number][] = smoothed.map((r, i) => {
    const angle = (i / N) * Math.PI * 2
    const d = radiusKm * r
    return [
      lng + Math.cos(angle) * d * kmToLng,
      lat + Math.sin(angle) * d * kmToLat,
    ]
  })

  // Apply 3 iterations of Chaikin smoothing: 24 → 48 → 96 → 192 vertices
  const smooth = chaikin(pts, 3)

  // Close the GeoJSON ring
  smooth.push(smooth[0])
  return smooth
}
