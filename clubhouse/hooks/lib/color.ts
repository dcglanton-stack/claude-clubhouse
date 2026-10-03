export type Rgb = readonly [number, number, number]
export type Hsl = { hue: number; saturation: number; lightness: number }

const DARK_INK = '#161616'
const LIGHT_INK = '#f4f4f4'
const DARK_SURFACE = '#30302e'
const LIGHT_SURFACE = '#faf9f5'

const RAMP: readonly (readonly [number, Rgb])[] = [
  [0, [214, 48, 49]],
  [50, [240, 180, 41]],
  [100, [30, 132, 73]],
]

export function normalizeHex(input: string): string | null {
  const body = input.trim().replace(/^#/, '').toLowerCase()

  if (/^[0-9a-f]{3}$/.test(body)) {
    return `#${[...body].map(digit => digit + digit).join('')}`
  }

  return /^[0-9a-f]{6}$/.test(body) ? `#${body}` : null
}

export function toRgb(hex: string): Rgb {
  const value = Number.parseInt((normalizeHex(hex) ?? '#808080').slice(1), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function toHex([red, green, blue]: Rgb): string {
  const channel = (level: number) =>
    Math.max(0, Math.min(255, Math.round(level)))
      .toString(16)
      .padStart(2, '0')

  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

export function rgbString(hex: string): string {
  const [red, green, blue] = toRgb(hex)

  return `rgb(${red},${green},${blue})`
}

export function mix(from: string, to: string, share: number): string {
  const start = toRgb(from)
  const end = toRgb(to)

  return toHex([
    start[0] + (end[0] - start[0]) * share,
    start[1] + (end[1] - start[1]) * share,
    start[2] + (end[2] - start[2]) * share,
  ])
}

export function luminance(hex: string): number {
  const [red, green, blue] = toRgb(hex).map(level => {
    const share = level / 255

    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.4
}

export function surfaceFor(isLightMode: boolean): string {
  return isLightMode ? LIGHT_SURFACE : DARK_SURFACE
}

export function inkOn(background: string): string {
  return isLight(background) ? DARK_INK : LIGHT_INK
}

export function toHsl(hex: string): Hsl {
  const [red, green, blue] = toRgb(hex).map(level => level / 255) as [number, number, number]
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const spread = high - low
  const lightness = (high + low) / 2

  if (spread === 0) {
    return { hue: 0, saturation: 0, lightness: lightness * 100 }
  }

  const saturation = spread / (1 - Math.abs(2 * lightness - 1))
  const sector =
    high === red
      ? ((green - blue) / spread) % 6
      : high === green
        ? (blue - red) / spread + 2
        : (red - green) / spread + 4

  return { hue: (sector * 60 + 360) % 360, saturation: saturation * 100, lightness: lightness * 100 }
}

export function fromHsl({ hue, saturation, lightness }: Hsl): string {
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100)
  const sector = (((hue % 360) + 360) % 360) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const base = lightness / 100 - chroma / 2
  const [red, green, blue] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]

  return toHex([(red + base) * 255, (green + base) * 255, (blue + base) * 255])
}

export function shift(hex: string, change: Partial<Hsl>): string {
  const current = toHsl(hex)
  const clamp = (level: number) => Math.max(0, Math.min(100, level))

  return fromHsl({
    hue: current.hue + (change.hue ?? 0),
    saturation: clamp(current.saturation + (change.saturation ?? 0)),
    lightness: clamp(current.lightness + (change.lightness ?? 0)),
  })
}

export function rampColor(left: number): string {
  const at = Math.max(0, Math.min(100, left))
  const upper = Math.max(1, RAMP.findIndex(([stop]) => at <= stop))
  const [highStop, high] = RAMP[upper]!
  const [lowStop, low] = RAMP[upper - 1]!

  return mix(toHex(low), toHex(high), (at - lowStop) / (highStop - lowStop))
}
