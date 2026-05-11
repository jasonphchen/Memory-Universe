import exifr from 'exifr'

export type GpsCoordinate = { lat: number; lon: number }

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'

export async function readImageGps(file: File): Promise<GpsCoordinate | null> {
  try {
    const result = await exifr.gps(file)
    if (!result) {
      console.debug('[exif] no GPS in file', file.name)
      return null
    }
    const { latitude, longitude } = result
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      (latitude === 0 && longitude === 0)
    ) {
      console.debug('[exif] invalid GPS values', file.name, result)
      return null
    }
    console.debug('[exif] GPS found', file.name, latitude, longitude)
    return { lat: latitude, lon: longitude }
  } catch (error) {
    console.debug('[exif] read error', file.name, error)
    return null
  }
}

type NominatimAddress = {
  suburb?: string
  city_district?: string
  county?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  state_district?: string
  province?: string
  state?: string
  region?: string
  country?: string
}

const PROVINCE_SUFFIXES = ['自治区', '特别行政区', '直辖市', '省']

function findInDisplayName(displayName: string | undefined, predicate: (segment: string) => boolean): string {
  if (!displayName) return ''
  const segments = displayName.split(',').map((s) => s.trim()).filter(Boolean)
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) continue
    if (predicate(segment)) return segment
  }
  return ''
}

function endsWithAny(value: string, suffixes: string[]): boolean {
  return suffixes.some((suffix) => value.endsWith(suffix))
}

function buildShortLocation(
  address: NominatimAddress | undefined,
  displayName: string | undefined,
): string | null {
  const a = address ?? {}

  let district = a.city_district ?? a.suburb ?? a.county ?? ''
  let city = a.city ?? a.state_district ?? a.municipality ?? a.town ?? a.village ?? ''
  let province = a.province ?? a.state ?? a.region ?? ''
  let country = a.country ?? ''

  if (!city || !endsWithAny(city, ['市'])) {
    const fromDisplay = findInDisplayName(
      displayName,
      (s) => s.endsWith('市') && s !== province && s !== country,
    )
    if (fromDisplay) city = fromDisplay
  }
  if (!district || !district.endsWith('区')) {
    const fromDisplay = findInDisplayName(
      displayName,
      (s) => s.endsWith('区') && !endsWithAny(s, PROVINCE_SUFFIXES) && s !== city,
    )
    if (fromDisplay) district = fromDisplay
  }
  if (!province) {
    province = findInDisplayName(displayName, (s) => endsWithAny(s, PROVINCE_SUFFIXES))
  }
  if (!country) {
    const segments = displayName?.split(',').map((s) => s.trim()).filter((s) => s && !/^\d+$/.test(s)) ?? []
    country = segments.length > 0 ? segments[segments.length - 1] : ''
  }

  const seen = new Set<string>()
  const parts: string[] = []
  for (const candidate of [district, city, province, country]) {
    const value = candidate.trim()
    if (value && !seen.has(value)) {
      seen.add(value)
      parts.push(value)
    }
  }
  return parts.length > 0 ? parts.join(', ') : null
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = `${NOMINATIM_REVERSE_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&accept-language=zh-CN`
    const response = await fetch(url, { signal })
    if (!response.ok) {
      console.debug('[reverseGeocode] HTTP', response.status)
      return null
    }
    const data = (await response.json()) as { address?: NominatimAddress; display_name?: string }
    const shortName = buildShortLocation(data.address, data.display_name)
    if (shortName) return shortName
    const fallback = data.display_name?.trim()
    if (!fallback) {
      console.debug('[reverseGeocode] empty result', data)
      return null
    }
    return fallback
  } catch (error) {
    console.debug('[reverseGeocode] fetch error', error)
    return null
  }
}

export async function extractLocationFromPhotos(
  files: File[],
  signal?: AbortSignal,
): Promise<string | null> {
  for (const file of files) {
    if (signal?.aborted) return null
    const gps = await readImageGps(file)
    if (!gps) continue
    const location = await reverseGeocode(gps.lat, gps.lon, signal)
    if (location) return location
  }
  return null
}
