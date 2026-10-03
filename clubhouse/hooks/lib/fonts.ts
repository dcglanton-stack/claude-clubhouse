import type { FontChoice, FontPreset } from '../../types'

export const FONT_PRESETS_KEY = 'fontPresets'
export const MAX_FONT_PRESETS = 8
export const FONT_MODEL = 'haiku'
export const DESIGN_FILE_CHARS = 40_000
export const FONTS: readonly FontChoice[] = [
  { name: 'Anthropic Serif', stack: "'Anthropic Serif', ui-serif, Georgia, Cambria, 'Times New Roman', serif", weight: 600, widen: 1 },
  { name: 'New York', stack: "'New York', ui-serif, Georgia, serif", weight: 600, widen: 1 },
  { name: 'Georgia', stack: 'Georgia, serif', weight: 700, widen: 1.02 },
  { name: 'Palatino', stack: "Palatino, 'Palatino Linotype', serif", weight: 700, widen: 1 },
  { name: 'Didot', stack: "Didot, 'Bodoni 72', serif", weight: 700, widen: 1.02 },
  { name: 'American Typewriter', stack: "'American Typewriter', Courier, serif", weight: 600, widen: 1.08 },
  { name: 'San Francisco', stack: "-apple-system, system-ui, 'Helvetica Neue', sans-serif", weight: 700, widen: 0.98 },
  { name: 'SF Rounded', stack: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif", weight: 700, widen: 1 },
  { name: 'Avenir Next', stack: "'Avenir Next', Avenir, sans-serif", weight: 600, widen: 1 },
  { name: 'Futura', stack: 'Futura, sans-serif', weight: 500, widen: 1.04 },
  { name: 'Menlo', stack: 'ui-monospace, Menlo, monospace', weight: 700, widen: 1.18 },
  { name: 'Marker Felt', stack: "'Marker Felt', 'Chalkboard SE', cursive", weight: 400, widen: 1 },
]
export const DEFAULT_FONT: FontChoice = FONTS[0]!

const NAME_CHARS = 24
const SYSTEM =
  'You choose a heading font for a small app panel on a Mac. You may only pick one of these installed fonts, by its exact name: ' +
  `${FONTS.map(font => font.name).join(', ')}. ` +
  'Reply with one JSON object and nothing else: {"font":"<exact name>","weight":400|500|600|700|800}. ' +
  'When the request names a font that is not in the list, pick the listed font that looks most like it.'

export function fontNamed(name: string): FontChoice | undefined {
  return FONTS.find(font => font.name.toLowerCase() === name.trim().toLowerCase())
}

export function fontRequest(wish: string): { model: string; system: string; prompt: string; maxTokens: number } {
  return { model: FONT_MODEL, system: SYSTEM, prompt: wish.slice(0, DESIGN_FILE_CHARS), maxTokens: 60 }
}

export function designRequest(file: string): { model: string; system: string; prompt: string; maxTokens: number } {
  return fontRequest(
    `This is a design guide. Find the font it uses for headings or display text and choose the closest match.\n\n${file}`,
  )
}

export function fontFrom(reply: string): FontChoice | null {
  try {
    const found = JSON.parse(reply.match(/\{[^{}]*\}/)?.[0] ?? 'null') as { font?: unknown; weight?: unknown } | null
    const font = typeof found?.font === 'string' ? fontNamed(found.font) : undefined
    const weight = typeof found?.weight === 'number' && found.weight >= 300 && found.weight <= 900 ? found.weight : null

    return font === undefined ? null : { ...font, weight: weight ?? font.weight }
  } catch {
    return null
  }
}

export function asFont(stored: unknown): FontChoice {
  const font = stored as Partial<FontChoice> | null
  const known = typeof font?.name === 'string' ? fontNamed(font.name) : undefined

  return known === undefined
    ? DEFAULT_FONT
    : { ...known, weight: typeof font?.weight === 'number' && font.weight >= 300 && font.weight <= 900 ? font.weight : known.weight }
}

export function withFontPreset(held: readonly FontPreset[], name: string, font: FontChoice): FontPreset[] {
  const label = name.trim().slice(0, NAME_CHARS)

  return [{ name: label, font }, ...held.filter(one => one.name !== label)].slice(0, MAX_FONT_PRESETS)
}

export function asFontPresets(stored: unknown): FontPreset[] {
  if (!Array.isArray(stored)) return []

  return stored
    .flatMap(one => {
      const preset = one as { name?: unknown; font?: unknown } | null

      return typeof preset?.name === 'string' && preset.name.trim() !== ''
        ? [{ name: preset.name, font: asFont(preset.font) }]
        : []
    })
    .slice(0, MAX_FONT_PRESETS)
}
