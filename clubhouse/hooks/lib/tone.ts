import { contrast, fromHsl, normalizeHex, toHex, toRgb } from './color'

export type Triple = readonly [number, number, number]

export type Tone = {
  target: Triple
  toInk: Triple
  targetHex: string
  inkHex: string
  isLightApp: boolean
  boost: number
}

export type ToneSpec = { target: string; ink: string; isLightApp: boolean }

export const HELPER_BOOST = 1.9

const DARK_SURFACE_LIMIT = 34.5 / 255
const LIGHT_SURFACE_LIMIT = 226 / 255
const KEY_FADE = 10 / 255
const LUMA: Triple = [0.2126, 0.7152, 0.0722]
const SHORTEST_AXIS = 0.0001
const FLATTEST_AXIS = 0.02
const CLEAR_STEPS = 24
const TO_DISPLAY: readonly Triple[] = [
  [0.8224621, 0.177538, 0],
  [0.0331941, 0.9668058, 0],
  [0.0170827, 0.0723974, 0.9105199],
]
const FROM_DISPLAY: readonly Triple[] = [
  [1.2249401, -0.2249404, 0],
  [-0.0420569, 1.0420571, 0],
  [-0.0196376, -0.0786361, 1.0982735],
]
const TAG = /<[a-zA-Z][^<>]*>/g
const PAINTED = /\b(fill|stroke|stop-color)="(#[0-9a-fA-F]{3,6}|hsl\([^)]*\))"/g

function decode(level: number): number {
  return level <= 0.04045 ? level / 12.92 : ((level + 0.055) / 1.055) ** 2.4
}

function encode(level: number): number {
  const bounded = Math.max(0, Math.min(1, level))

  return bounded <= 0.0031308 ? bounded * 12.92 : 1.055 * bounded ** (1 / 2.4) - 0.055
}

function bound(level: number): number {
  return Math.max(0, Math.min(1, level))
}

function dot(one: Triple, other: Triple): number {
  return one[0] * other[0] + one[1] * other[1] + one[2] * other[2]
}

function each(change: (channel: 0 | 1 | 2) => number): Triple {
  return [change(0), change(1), change(2)]
}

function through(matrix: readonly Triple[], color: Triple): Triple {
  return each(channel => dot(matrix[channel]!, color))
}

export function toDisplay(hex: string): Triple {
  const [red, green, blue] = toRgb(hex)
  const linear = through(TO_DISPLAY, [decode(red / 255), decode(green / 255), decode(blue / 255)])

  return each(channel => encode(linear[channel]))
}

export function fromDisplay(color: Triple): string {
  const linear = through(FROM_DISPLAY, each(channel => decode(bound(color[channel]))))

  return toHex(each(channel => encode(linear[channel]) * 255))
}

export function toneFor({ target, ink, isLightApp }: ToneSpec): Tone {
  const shownTarget = toDisplay(target)
  const shownInk = toDisplay(ink)

  return {
    target: shownTarget,
    toInk: each(channel => shownInk[channel] - shownTarget[channel]),
    targetHex: target,
    inkHex: ink,
    isLightApp,
    boost: HELPER_BOOST,
  }
}

function anchorOf(tone: Tone): number {
  return tone.isLightApp ? LIGHT_SURFACE_LIMIT : DARK_SURFACE_LIMIT
}

function spanOf(tone: Tone): number {
  return tone.isLightApp ? LIGHT_SURFACE_LIMIT : 1 - DARK_SURFACE_LIMIT
}

function along(tone: Tone, color: Triple): number {
  const length = Math.max(dot(tone.toInk, tone.toInk), SHORTEST_AXIS)

  return dot(each(channel => color[channel] - tone.target[channel]), tone.toInk) / length
}

function lifted(tone: Tone, place: number): number {
  return place + bound(tone.boost * place) * (1 - place)
}

function unlifted(tone: Tone, place: number): number {
  const { boost } = tone

  if (boost < SHORTEST_AXIS) return place
  const root = (1 + boost) ** 2 - 4 * boost * Math.min(1, place)

  return (1 + boost - Math.sqrt(Math.max(0, root))) / (2 * boost)
}

function floorOf(tone: Tone): number {
  return lifted(tone, KEY_FADE / spanOf(tone))
}

function towardInk(tone: Tone, color: Triple, share: number): Triple {
  return each(channel => color[channel] + (tone.target[channel] + tone.toInk[channel] - color[channel]) * share)
}

function onInkSide(tone: Tone, color: Triple): Triple {
  const place = along(tone, color)
  const floor = floorOf(tone)

  return place >= floor ? color : towardInk(tone, color, (floor - place) / (1 - place))
}

function placeOf(tone: Tone, pixel: Triple): number {
  const level = dot(LUMA, pixel)

  return (tone.isLightApp ? anchorOf(tone) - level : level - anchorOf(tone)) / spanOf(tone)
}

export function shownFrom(tone: Tone, pixel: Triple): Triple {
  const start = placeOf(tone, pixel)
  const push = bound(tone.boost * start) * (1 - start) * spanOf(tone) * (tone.isLightApp ? -1 : 1)
  const raised = each(channel => bound(pixel[channel] + push))
  const level = dot(LUMA, raised)
  const place = placeOf(tone, raised)
  const moved = each(channel => bound(raised[channel] - level + tone.target[channel] + place * tone.toInk[channel]))
  const kept = bound(along(tone, moved) / floorOf(tone))

  return each(channel => tone.target[channel] + kept * (moved[channel] - tone.target[channel]))
}

export function pixelFor(tone: Tone, wanted: string): Triple {
  const reachable = onInkSide(tone, toDisplay(wanted))
  const offset = each(channel => reachable[channel] - tone.target[channel])
  const rise = dot(LUMA, tone.toInk)
  const amount = Math.abs(rise) > FLATTEST_AXIS ? dot(LUMA, offset) / rise : along(tone, reachable)
  const rough = each(channel => offset[channel] - amount * tone.toInk[channel])
  const stray = dot(LUMA, rough)
  const place = unlifted(tone, amount)
  const level = anchorOf(tone) + (tone.isLightApp ? -place : place) * spanOf(tone)

  return each(channel => bound(level + rough[channel] - stray))
}

export function drawnFor(tone: Tone, wanted: string): string {
  return fromDisplay(pixelFor(tone, wanted))
}

export function wideFor(tone: Tone, wanted: string): string {
  const [red, green, blue] = pixelFor(tone, wanted).map(level => Math.round(level * 10000) / 10000)

  return `color(display-p3 ${red} ${green} ${blue})`
}

export function clearOn(tone: Tone, wanted: string, ratio: number): string {
  const start = onInkSide(tone, toDisplay(wanted))

  for (let step = 0; step <= CLEAR_STEPS; step += 1) {
    const tried = fromDisplay(towardInk(tone, start, step / CLEAR_STEPS))

    if (contrast(tried, tone.targetHex) >= ratio) return tried
  }

  return tone.inkHex
}

function asHex(color: string): string | null {
  if (color.startsWith('#')) return normalizeHex(color)
  const [hue, saturation, lightness] = (color.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

  return hue === undefined || saturation === undefined || lightness === undefined
    ? null
    : fromHsl({ hue, saturation, lightness })
}

export function recolor(svg: string, tone: Tone | null): string {
  if (tone === null) return svg

  return svg.replace(TAG, tag => {
    const wide: string[] = []
    const body = tag.replace(PAINTED, (whole: string, name: string, color: string) => {
      const hex = asHex(color)

      if (hex === null) return whole
      wide.push(`${name}:${wideFor(tone, hex)}`)

      return `${name}="${drawnFor(tone, hex)}"`
    })

    if (wide.length === 0) return tag
    const close = body.endsWith('/>') ? '/>' : '>'

    return `${body.slice(0, -close.length)} style="${wide.join(';')}"${close}`
  })
}
