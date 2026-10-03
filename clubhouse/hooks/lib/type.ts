export type SerifSpec = { text: string; size: number; color: string; isStrong: boolean }

export const SERIF_STACK = "'Anthropic Serif', ui-serif, Georgia, Cambria, 'Times New Roman', serif"

const WIDEST = 1.02
const CAPITAL = 0.8
const USUAL = 0.63
const NARROW = 0.38
const SPACE = 0.3
const PADDING = 0.5
const LINE_HEIGHT = 1.3

function widthOf(letter: string): number {
  if (letter === ' ') return SPACE
  if ('mwMW'.includes(letter)) return WIDEST
  if ("ijlftrIJ.,:;!'|()/".includes(letter)) return NARROW

  return letter >= 'A' && letter <= 'Z' ? CAPITAL : USUAL
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function serifSize({ text, size }: Pick<SerifSpec, 'text' | 'size'>): { width: number; height: number } {
  return {
    width: Math.ceil(([...text].reduce((total, letter) => total + widthOf(letter), 0) + PADDING) * size),
    height: Math.ceil(size * LINE_HEIGHT),
  }
}

export function serifSvg({ text, size, color, isStrong }: SerifSpec): string {
  const { width, height } = serifSize({ text, size })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="0" y="${Math.round(size * 0.98)}" font-family="${SERIF_STACK}" font-size="${size}" font-weight="${isStrong ? 600 : 400}" fill="${color}">${escapeXml(text)}</text>` +
    '</svg>'
  )
}
