import { contrast, fromHsl, luminance, mix, normalizeHex, toHex, toHsl, toRgb } from './color'
import type { Pixels } from './png'

export type Triple = readonly [number, number, number]
export type Stage = readonly number[]
type Grid = readonly [Triple, Triple, Triple]
export type Zone = 'session' | 'sidebar'

export type Tone = {
  target: Triple
  toInk: Triple
  targetHex: string
  inkHex: string
  isLightApp: boolean
  stages: readonly Stage[]
  kept: readonly Stage[]
  places: readonly number[]
  floor: number
}

export type ToneSpec = { target: string; ink: string; isLightApp: boolean }

export const HELPER_BOOST = 1.9

const LEVELS = 255
const DARK_APP = {
  session: { surface: 21 / LEVELS, panel: 32 / LEVELS },
  sidebar: { surface: 17 / LEVELS, panel: 28 / LEVELS },
} as const
const LIGHT_APP = {
  session: { surface: 21 / LEVELS, panel: 33 / LEVELS },
  sidebar: { surface: 22 / LEVELS, panel: 33 / LEVELS },
} as const
const LIGHT_APP_FLIP = 273 / LEVELS
const TEXT_LIFT = { from: 62 / LEVELS, full: 110 / LEVELS } as const
const PANELS = { deeperFrom: 0.03, step: 23 / LEVELS, gain: 9, deeper: 0.35, lighter: 16 } as const
const OWN_COLOR = { from: 0.12, full: 0.25 } as const
const CHANNEL_PAIRS: readonly Triple[] = [
  [1, -1, 0],
  [0, 1, -1],
  [-1, 0, 1],
]
const CLOSE_ENOUGH = 0.5 / LEVELS
const SOLVE_STEPS = 6
const NUDGE = 1 / LEVELS
const BRIGHTNESS_WEIGHT = 3
const MOST_STRETCH = 2.5
const LUMA: Triple = [0.2126, 0.7152, 0.0722]
const NO_CHANNELS: Triple = [0, 0, 0]
const SHORTEST_AXIS = 0.0001
const FLATTEST_AXIS = 0.02
const CLEAR_STEPS = 24
const STAGE_DIGITS = 1_000_000
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

function stageOf(
  color: (channel: 0 | 1 | 2) => readonly [Triple, number],
  [weights, kept, bias]: readonly [Triple, number, number],
): Stage {
  const rows = ([0, 1, 2] as const).flatMap(channel => {
    const [mixed, shift] = color(channel)

    return [...mixed, 0, shift]
  })

  return [...rows, ...weights, kept, bias].map(value => Math.round(value * STAGE_DIGITS) / STAGE_DIGITS)
}

function own(channel: 0 | 1 | 2): Triple {
  return each(source => (source === channel ? 1 : 0))
}

function ramp(from: number, full: number): readonly [Triple, number, number] {
  const slope = 1 / (full - from)

  return [each(source => slope * LUMA[source]), 0, -slope * from]
}

function sunk(surface: number, panel: number): Stage {
  return stageOf(channel => [own(channel), -PANELS.step], ramp(surface, panel))
}

function lifted(from: number, full: number): Stage {
  return stageOf(channel => [each(source => own(channel)[source] - LUMA[source]), 1], ramp(from, full))
}

function remapped(target: Triple, toInk: Triple, anchor: number, reach: number): Stage {
  return stageOf(
    channel => [
      each(source => own(channel)[source] + LUMA[source] * (reach * toInk[channel] - 1)),
      target[channel] - reach * anchor * toInk[channel],
    ],
    [NO_CHANNELS, 1, 0],
  )
}

function shaded(target: Triple, toInk: Triple, shade: Triple): Stage {
  const length = Math.max(dot(toInk, toInk), SHORTEST_AXIS)

  return stageOf(
    channel => [NO_CHANNELS, shade[channel]],
    [each(source => (-PANELS.gain * toInk[source]) / length), 0, (PANELS.gain * dot(target, toInk)) / length],
  )
}

function flipped(): Stage {
  return stageOf(channel => [each(source => own(channel)[source] - 2 * LUMA[source]), LIGHT_APP_FLIP], [NO_CHANNELS, 1, 0])
}

export function deepens({ target, ink }: ToneSpec): boolean {
  return luminance(ink) > luminance(target) && luminance(target) >= PANELS.deeperFrom
}

function panelShade(spec: ToneSpec, surface: string): string | null {
  if (luminance(spec.ink) <= luminance(spec.target)) return null
  if (deepens(spec)) return mix(surface, '#000000', PANELS.deeper)
  const { hue, saturation, lightness } = toHsl(surface)

  return fromHsl({ hue, saturation, lightness: lightness + PANELS.lighter })
}

function appStages(spec: ToneSpec, zone: Zone, shade: string | null): Stage[] {
  const target = toDisplay(spec.target)
  const shownInk = toDisplay(spec.ink)
  const toInk = each(channel => shownInk[channel] - target[channel])
  const { surface, panel } = (spec.isLightApp ? LIGHT_APP : DARK_APP)[zone]
  const step = shade === null ? 0 : PANELS.step

  return [
    ...(spec.isLightApp ? [flipped()] : []),
    ...(shade === null ? [] : [sunk(surface, panel)]),
    lifted(TEXT_LIFT.from - step, TEXT_LIFT.full - step),
    remapped(target, toInk, surface, 1 / (1 - surface)),
    ...(shade === null ? [] : [shaded(target, toInk, toDisplay(shade))]),
  ]
}

function keptStages(): Stage[] {
  const slope = 1 / (OWN_COLOR.full - OWN_COLOR.from)

  return CHANNEL_PAIRS.map(pair =>
    stageOf(channel => [own(channel), 0], [each(source => slope * pair[source]), 0, -slope * OWN_COLOR.from]),
  )
}

export function helperStages(
  spec: ToneSpec,
  sidebar: string,
): { stages: Stage[]; sidebarStages: Stage[]; kept: Stage[] } {
  return {
    stages: appStages(spec, 'session', panelShade(spec, spec.target)),
    sidebarStages: appStages({ ...spec, target: sidebar }, 'sidebar', panelShade(spec, sidebar)),
    kept: keptStages(),
  }
}

function shareOf(stage: Stage, pixel: Triple): number {
  return bound(dot([stage[15]!, stage[16]!, stage[17]!], pixel) + stage[18]! + stage[19]!)
}

function staged(stages: readonly Stage[], pixel: Triple): Triple {
  return stages.reduce<Triple>((seen, stage) => {
    const share = shareOf(stage, seen)

    return each(channel => {
      const at = channel * 5
      const painted = bound(dot([stage[at]!, stage[at + 1]!, stage[at + 2]!], seen) + stage[at + 3]! + stage[at + 4]!)

      return share * painted + (1 - share) * seen[channel]
    })
  }, pixel)
}

function along(tone: Pick<Tone, 'target' | 'toInk'>, color: Triple): number {
  const length = Math.max(dot(tone.toInk, tone.toInk), SHORTEST_AXIS)

  return dot(each(channel => color[channel] - tone.target[channel]), tone.toInk) / length
}

function amountOf(tone: Pick<Tone, 'target' | 'toInk'>, color: Triple): number {
  const rise = dot(LUMA, tone.toInk)

  return Math.abs(rise) > FLATTEST_AXIS
    ? dot(LUMA, each(channel => color[channel] - tone.target[channel])) / rise
    : along(tone, color)
}

export function toneFor(spec: ToneSpec): Tone {
  const target = toDisplay(spec.target)
  const shownInk = toDisplay(spec.ink)
  const toInk = each(channel => shownInk[channel] - target[channel])
  const stages = appStages(spec, 'session', panelShade(spec, spec.target))

  return {
    target,
    toInk,
    targetHex: spec.target,
    inkHex: spec.ink,
    isLightApp: spec.isLightApp,
    stages,
    kept: keptStages(),
    places: Array.from({ length: LEVELS + 1 }, (_, level) =>
      amountOf({ target, toInk }, staged(stages, [level / LEVELS, level / LEVELS, level / LEVELS])),
    ),
    floor: 0,
  }
}

function towardInk(tone: Tone, color: Triple, share: number): Triple {
  return each(channel => color[channel] + (tone.target[channel] + tone.toInk[channel] - color[channel]) * share)
}

function onInkSide(tone: Tone, color: Triple): Triple {
  const place = along(tone, color)

  return place >= tone.floor ? color : towardInk(tone, color, (tone.floor - place) / (1 - place))
}

function levelFor(tone: Tone, amount: number): number {
  const first = tone.isLightApp ? 0 : LEVELS
  const stride = tone.isLightApp ? 1 : -1

  for (let level = first; level >= 0 && level <= LEVELS; level += stride) {
    const here = tone.places[level]!

    if (here > amount + SHORTEST_AXIS) continue
    if (level === first) return level / LEVELS
    const before = tone.places[level - stride]!

    return (level - stride * bound((amount - here) / Math.max(before - here, SHORTEST_AXIS))) / LEVELS
  }

  const nearest = tone.places.reduce(
    (best, place, level) => (Math.abs(place - amount) < Math.abs(tone.places[best]! - amount) ? level : best),
    0,
  )

  return nearest / LEVELS
}

export function shownFrom(tone: Tone, pixel: Triple): Triple {
  return tone.kept.reduce<Triple>((seen, stage) => {
    const share = shareOf(stage, pixel)

    return each(channel => share * pixel[channel] + (1 - share) * seen[channel])
  }, staged(tone.stages, pixel))
}

function recolored(tone: Tone, goal: Triple): Triple {
  const reachable = onInkSide(tone, goal)
  const offset = each(channel => reachable[channel] - tone.target[channel])
  const amount = amountOf(tone, reachable)
  const rough = each(channel => offset[channel] - amount * tone.toInk[channel])
  const stray = dot(LUMA, rough)
  const level = levelFor(tone, amount)

  return each(channel => bound(level + rough[channel] - stray))
}

function missBy(tone: Tone, pixel: Triple, goal: Triple): Triple {
  const shown = shownFrom(tone, pixel)

  return each(channel => shown[channel] - goal[channel])
}

function sizeOfMiss(miss: Triple): number {
  return Math.hypot(...miss) + BRIGHTNESS_WEIGHT * Math.abs(dot(LUMA, miss))
}

function cross(one: Triple, other: Triple): Triple {
  return [
    one[1] * other[2] - one[2] * other[1],
    one[2] * other[0] - one[0] * other[2],
    one[0] * other[1] - one[1] * other[0],
  ]
}

function grid(cell: (row: 0 | 1 | 2, column: 0 | 1 | 2) => number): Grid {
  return [each(column => cell(0, column)), each(column => cell(1, column)), each(column => cell(2, column))]
}

function sizeOf([first, second, third]: Grid): number {
  return dot(first, cross(second, third))
}

function solved(rows: Grid, right: Triple): Triple | null {
  const size = sizeOf(rows)

  if (Math.abs(size) < SHORTEST_AXIS) return null

  return each(channel => sizeOf(grid((row, column) => (column === channel ? right[row] : rows[row][column]))) / size)
}

function closer(tone: Tone, start: Triple, goal: Triple): readonly [Triple, number] {
  let pixel = start
  let best: readonly [Triple, number] = [start, sizeOfMiss(missBy(tone, start, goal))]

  for (let step = 0; step < SOLVE_STEPS && best[1] > CLOSE_ENOUGH; step += 1) {
    const miss = missBy(tone, pixel, goal)
    const nudged = grid((channel, row) => {
      const tried = missBy(tone, each(at => pixel[at] + (at === channel ? NUDGE : 0)), goal)

      return (tried[row] - miss[row]) / NUDGE
    })
    const move = solved(
      grid((row, channel) => nudged[channel][row]),
      miss,
    )

    if (move === null) break
    const tried = each(channel => bound(pixel[channel] - move[channel]))
    const off = sizeOfMiss(missBy(tone, tried, goal))

    pixel = tried
    if (off < best[1]) best = [tried, off]
  }

  return best
}

function vivid(goal: Triple): Triple {
  const spread = Math.max(...CHANNEL_PAIRS.map(pair => dot(pair, goal)))
  const stretch = (OWN_COLOR.full + NUDGE) / Math.max(spread, SHORTEST_AXIS)
  const level = dot(LUMA, goal)

  return stretch <= 1 || stretch > MOST_STRETCH
    ? goal
    : each(channel => bound(level + (goal[channel] - level) * stretch))
}

export function pixelFor(tone: Tone, wanted: string): Triple {
  const goal = toDisplay(wanted)
  const moved = recolored(tone, goal)
  const level = dot(LUMA, moved)
  const starts: readonly Triple[] = [goal, moved, [level, level, level], vivid(goal)]

  return starts.map(start => closer(tone, start, goal)).reduce((best, one) => (one[1] < best[1] ? one : best))[0]
}

export function redrawn(tone: Tone, { width, height, rgba }: Pixels): Pixels {
  const known = new Map<number, Triple>()
  const drawn = [...rgba]

  for (let at = 0; at < rgba.length; at += 4) {
    if (rgba[at + 3] === 0) continue
    const key = (rgba[at]! << 16) | (rgba[at + 1]! << 8) | rgba[at + 2]!
    const found = known.get(key) ?? toRgb(drawnFor(tone, toHex([rgba[at]!, rgba[at + 1]!, rgba[at + 2]!])))

    known.set(key, found)
    drawn[at] = found[0]
    drawn[at + 1] = found[1]
    drawn[at + 2] = found[2]
  }

  return { width, height, rgba: drawn }
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
