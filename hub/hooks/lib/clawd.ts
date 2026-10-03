export type Mood = 'happy' | 'content' | 'uneasy' | 'worried' | 'wiped'

export type ClawdSpec = { x: number; y: number; unit: number; color: string; mood: Mood }

export type MeterSpec = {
  left: number
  barColor: string
  clawdColor: string
  width: number
  height: number
}

export type WheelSpec = { hue: number; color: string; size: number }

export const CLAWD_COLUMNS = 15
export const CLAWD_ROWS = 9.6

const EYE = '#1b1b1b'
const BLUSH = '#ff8fa3'
const DROP = '#8fd3ff'
const OUTLINE = '#000000'
const LEFT_EYE = 4
const RIGHT_EYE = 9.3
const EYE_TOP = 3.3
const EYE_SIZE = 1.7

export function moodFor(left: number): Mood {
  if (left > 75) return 'happy'
  if (left > 50) return 'content'
  if (left > 25) return 'uneasy'
  if (left > 10) return 'worried'

  return 'wiped'
}

export function moodName(mood: Mood): string {
  const names: Record<Mood, string> = {
    happy: 'happy',
    content: 'content',
    uneasy: 'a little uneasy',
    worried: 'worried',
    wiped: 'wiped out',
  }

  return names[mood]
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

function eyes(mood: Mood, unit: number, color: string): string {
  const at = (cells: number) => round(cells * unit)
  const square = (left: number, top: number, height: number) =>
    `<rect x="${at(left)}" y="${at(top)}" width="${at(EYE_SIZE)}" height="${at(height)}" rx="${at(0.15)}" fill="${EYE}"/>`
  const stroke = `fill="none" stroke="${EYE}" stroke-width="${at(0.62)}" stroke-linecap="round" stroke-linejoin="round"`
  const drop = (left: number, top: number, size: number) =>
    `<path d="M ${at(left)} ${at(top)} q ${at(size)} ${at(size * 1.5)} 0 ${at(size * 2.1)} q ${at(-size)} ${at(-size * 0.6)} 0 ${at(-size * 2.1)} z" fill="${DROP}"/>`

  if (mood === 'happy') {
    const arc = (left: number) =>
      `<path d="M ${at(left)} ${at(4.9)} L ${at(left + 0.85)} ${at(3.5)} L ${at(left + 1.7)} ${at(4.9)}" ${stroke}/>`
    const blush = (left: number) =>
      `<ellipse cx="${at(left)}" cy="${at(6.1)}" rx="${at(0.85)}" ry="${at(0.45)}" fill="${BLUSH}" opacity="0.8"/>`

    return arc(LEFT_EYE) + arc(RIGHT_EYE) + blush(3.6) + blush(11.4)
  }

  if (mood === 'content') {
    return square(LEFT_EYE, EYE_TOP, EYE_SIZE) + square(RIGHT_EYE, EYE_TOP, EYE_SIZE)
  }

  if (mood === 'uneasy') {
    return square(LEFT_EYE, 3.7, 1.3) + square(RIGHT_EYE, 3.7, 1.3) + drop(11.8, 0.6, 0.55)
  }

  if (mood === 'worried') {
    const brow = (points: readonly (readonly [number, number])[]) =>
      `<polygon points="${points.map(([left, top]) => `${at(left)},${at(top)}`).join(' ')}" fill="${color}"/>`

    return (
      square(LEFT_EYE, EYE_TOP, EYE_SIZE) +
      square(RIGHT_EYE, EYE_TOP, EYE_SIZE) +
      brow([
        [3.8, 3.1],
        [5.9, 3.1],
        [3.8, 4.4],
      ]) +
      brow([
        [9.1, 3.1],
        [11.2, 3.1],
        [11.2, 4.4],
      ]) +
      drop(4.5, 5.4, 0.45)
    )
  }

  const cross = (left: number) =>
    `<path d="M ${at(left)} ${at(EYE_TOP)} l ${at(EYE_SIZE)} ${at(EYE_SIZE)} M ${at(left + EYE_SIZE)} ${at(EYE_TOP)} l ${at(-EYE_SIZE)} ${at(EYE_SIZE)}" ${stroke}/>`

  return cross(LEFT_EYE) + cross(RIGHT_EYE)
}

export function clawdMarkup({ x, y, unit, color, mood }: ClawdSpec): string {
  const at = (cells: number) => round(cells * unit)
  const part =
    (outline: boolean) =>
    ([left, top, width, height, corner]: readonly [number, number, number, number, number]) =>
      `<rect x="${at(left)}" y="${at(top)}" width="${at(width)}" height="${at(height)}" rx="${at(corner)}" fill="${color}"${
        outline ? ` stroke="${OUTLINE}" stroke-opacity="0.38" stroke-width="${round(Math.max(1, unit * 0.45))}"` : ''
      }/>`
  const parts: readonly (readonly [number, number, number, number, number])[] = [
    [0, 3.2, CLAWD_COLUMNS, 2.3, 0.75],
    [2, 0, 11, 8.2, 1],
    ...[2, 4.9, 7.8, 10.7].map(left => [left, 7, 2.3, 2.6, 0.6] as const),
  ]

  return (
    `<g transform="translate(${round(x)} ${round(y)})">` +
    parts.map(part(true)).join('') +
    parts.map(part(false)).join('') +
    eyes(mood, unit, color) +
    '</g>'
  )
}

export function clawdSvg(mood: Mood, color: string, unit: number): string {
  const width = Math.ceil(CLAWD_COLUMNS * unit)
  const height = Math.ceil(CLAWD_ROWS * unit)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    clawdMarkup({ x: 0, y: 0, unit, color, mood }) +
    '</svg>'
  )
}

export function meterSvg({ left, barColor, clawdColor, width, height }: MeterSpec): string {
  const share = Math.max(0, Math.min(100, left)) / 100
  const mood = moodFor(left)
  const unit = (height - 2) / CLAWD_ROWS
  const clawdWidth = CLAWD_COLUMNS * unit
  const barHeight = Math.round(height * 0.5)
  const barTop = Math.round((height - barHeight) / 2) + 1
  const radius = barHeight / 2
  const inner = width - 2
  const fill = share === 0 ? 0 : Math.max(barHeight, inner * share)
  const clawdLeft = Math.max(1, Math.min(inner - clawdWidth, 1 + fill - clawdWidth * 0.62))
  const sparkle = (cx: number, cy: number, size: number) =>
    `<path d="M ${round(cx)} ${round(cy - size)} L ${round(cx + size * 0.3)} ${round(cy - size * 0.3)} L ${round(cx + size)} ${round(cy)} L ${round(cx + size * 0.3)} ${round(cy + size * 0.3)} L ${round(cx)} ${round(cy + size)} L ${round(cx - size * 0.3)} ${round(cy + size * 0.3)} L ${round(cx - size)} ${round(cy)} L ${round(cx - size * 0.3)} ${round(cy - size * 0.3)} Z" fill="#ffd66b"/>`
  const sparkles =
    mood === 'happy'
      ? sparkle(clawdLeft - 5, barTop - 1, 3) + sparkle(clawdLeft + clawdWidth + 4, barTop + 2, 2.2)
      : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    '<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">' +
    `<stop offset="0" stop-color="${barColor}" stop-opacity="0.72"/>` +
    `<stop offset="1" stop-color="${barColor}"/>` +
    '</linearGradient></defs>' +
    `<rect x="1" y="${barTop}" width="${inner}" height="${barHeight}" rx="${radius}" fill="#808080" fill-opacity="0.28"/>` +
    (fill > 0
      ? `<rect x="1" y="${barTop}" width="${round(fill)}" height="${barHeight}" rx="${radius}" fill="url(#fill)"/>` +
        `<rect x="${round(1 + radius)}" y="${barTop + 2}" width="${round(Math.max(0, fill - radius * 2))}" height="2" rx="1" fill="#ffffff" fill-opacity="0.35"/>`
      : '') +
    sparkles +
    clawdMarkup({ x: clawdLeft, y: 1, unit, color: clawdColor, mood }) +
    '</svg>'
  )
}

export function wheelSvg({ hue, color, size }: WheelSpec): string {
  const center = size / 2
  const outer = center - 2
  const inner = outer * 0.62
  const point = (radius: number, degrees: number) => {
    const angle = ((degrees - 90) * Math.PI) / 180

    return `${round(center + radius * Math.cos(angle))} ${round(center + radius * Math.sin(angle))}`
  }
  const steps = Array.from({ length: 36 }, (_, index) => index * 10)
  const ring = steps
    .map(
      start =>
        `<path d="M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, start + 10.6)} L ${point(inner, start + 10.6)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z" fill="hsl(${start + 5} 85% 55%)"/>`,
    )
    .join('')
  const marker = `<circle cx="${point((outer + inner) / 2, hue).split(' ')[0]}" cy="${point((outer + inner) / 2, hue).split(' ')[1]}" r="${round((outer - inner) / 2 - 1)}" fill="none" stroke="#ffffff" stroke-width="3"/><circle cx="${point((outer + inner) / 2, hue).split(' ')[0]}" cy="${point((outer + inner) / 2, hue).split(' ')[1]}" r="${round((outer - inner) / 2 - 1)}" fill="none" stroke="#1b1b1b" stroke-width="1"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    ring +
    `<circle cx="${center}" cy="${center}" r="${round(inner - 5)}" fill="${color}" stroke="#808080" stroke-opacity="0.4"/>` +
    marker +
    '</svg>'
  )
}
