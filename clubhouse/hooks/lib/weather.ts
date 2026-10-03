import type { Forecast, Place, WeatherKind, WeatherPlan } from '../../types'

export const WEATHER_KEY = 'weather'
export const WEATHER_POLL_MS = 15 * 60_000
export const LOCATE_URL = 'https://ipwho.is/?fields=success,city,region,latitude,longitude'
export const DEFAULT_WEATHER: WeatherPlan = { place: null, unit: 'f' }

const SUN = '#f2c230'
const WATER = '#4d8fd6'
const DAYS = 7

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function placeOf(name: unknown, region: unknown, latitude: unknown, longitude: unknown): Place | null {
  return typeof name === 'string' && typeof latitude === 'number' && typeof longitude === 'number'
    ? { name: typeof region === 'string' && region !== '' ? `${name}, ${region}` : name, latitude, longitude }
    : null
}

export function placeFrom(text: string): Place | null {
  try {
    const found = record(JSON.parse(text))

    return found === null || found.success === false ? null : placeOf(found.city, found.region, found.latitude, found.longitude)
  } catch {
    return null
  }
}

export function searchUrl(name: string): string {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=4`
}

export function placesFrom(text: string): Place[] {
  try {
    const results = record(JSON.parse(text))?.results

    return (Array.isArray(results) ? results : []).flatMap(one => {
      const hit = record(one)
      const place = hit === null ? null : placeOf(hit.name, hit.admin1, hit.latitude, hit.longitude)

      return place === null ? [] : [place]
    })
  } catch {
    return []
  }
}

export function forecastUrl(plan: WeatherPlan): string {
  const { latitude, longitude } = plan.place ?? { latitude: 0, longitude: 0 }

  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,weather_code,precipitation' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&temperature_unit=${plan.unit === 'c' ? 'celsius' : 'fahrenheit'}&timezone=auto&forecast_days=${DAYS}`
  )
}

export function kindOf(code: number): WeatherKind {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 51) return 'rain'
  if (code === 3 || code === 45 || code === 48) return 'cloud'

  return code === 0 ? 'sun' : 'partly'
}

export function forecastFrom(text: string, at: number): Forecast | null {
  try {
    const found = record(JSON.parse(text))
    const current = record(found?.current)
    const daily = record(found?.daily)
    const list = (key: string) => (Array.isArray(daily?.[key]) ? (daily[key] as unknown[]) : [])

    if (current === null || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') return null
    const chances = list('precipitation_probability_max')

    return {
      at,
      temp: Math.round(current.temperature_2m),
      kind: kindOf(current.weather_code),
      isWet: typeof current.precipitation === 'number' && current.precipitation > 0,
      chance: typeof chances[0] === 'number' ? chances[0] : null,
      days: list('time').flatMap((date, index) => {
        const code = list('weather_code')[index]
        const high = list('temperature_2m_max')[index]
        const low = list('temperature_2m_min')[index]
        const chance = chances[index]

        return typeof date === 'string' && typeof code === 'number' && typeof high === 'number' && typeof low === 'number'
          ? [{ date, kind: kindOf(code), high: Math.round(high), low: Math.round(low), chance: typeof chance === 'number' ? chance : null }]
          : []
      }),
    }
  } catch {
    return null
  }
}

export function dayName(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

export const KIND_WORD: Record<WeatherKind, string> = {
  sun: 'Sunny',
  partly: 'Partly cloudy',
  cloud: 'Cloudy',
  rain: 'Rain',
  storm: 'Thunderstorm',
  snow: 'Snow',
}

export function asWeatherPlan(stored: unknown): WeatherPlan {
  const plan = record(stored)
  const place = record(plan?.place)

  return {
    place: place === null ? null : placeOf(place.name, '', place.latitude, place.longitude),
    unit: plan?.unit === 'c' ? 'c' : 'f',
  }
}

function sun(cx: number, cy: number, radius: number): string {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4
    const [near, far] = [radius + 2.5, radius + 6]
    const at = (reach: number) => `${(cx + Math.cos(angle) * reach).toFixed(1)} ${(cy + Math.sin(angle) * reach).toFixed(1)}`

    return `M ${at(near)} L ${at(far)}`
  }).join(' ')

  return (
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${SUN}"/>` +
    `<path d="${rays}" fill="none" stroke="${SUN}" stroke-width="2.4" stroke-linecap="round"/>`
  )
}

function cloud(top: number, ink: string, paper: string): string {
  return `<path d="M 9 ${top + 17} a 6 6 0 0 1 1.5 -11.8 a 8 8 0 0 1 15 -2 a 6.5 6.5 0 0 1 5.5 13.8 Z" fill="${paper}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`
}

export function weatherSvg(kind: WeatherKind, ink: string, paper: string, size: number): string {
  const drops = [12, 20, 28]
  const art: Record<WeatherKind, string> = {
    sun: sun(20, 20, 8),
    partly: sun(27, 13, 6.5) + cloud(12, ink, paper),
    cloud: cloud(9, ink, paper),
    rain:
      cloud(4, ink, paper) +
      `<path d="${drops.map(x => `M ${x} 27 l -2 6`).join(' ')}" fill="none" stroke="${WATER}" stroke-width="2.6" stroke-linecap="round"/>`,
    storm: cloud(4, ink, paper) + `<path d="M 22 23 L 15 31 H 20 L 17 38 L 27 28 H 21 Z" fill="${SUN}"/>`,
    snow:
      cloud(4, ink, paper) +
      `<path d="${drops.map(x => `M ${x - 3} 31 h 6 M ${x} 28 v 6 M ${x - 2} 29 l 4 4 M ${x + 2} 29 l -4 4`).join(' ')}" fill="none" stroke="${WATER}" stroke-width="1.5" stroke-linecap="round"/>`,
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${art[kind]}</svg>`
}
