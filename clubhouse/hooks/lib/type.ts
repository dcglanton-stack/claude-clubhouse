export type SerifSpec = { text: string; size: number; color: string; isStrong: boolean }

export const SERIF_STACK = "'Anthropic Serif', ui-serif, Georgia, Cambria, 'Times New Roman', serif"

const WIDTH_PER_CHAR = 0.56
const LINE_HEIGHT = 1.3

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function serifSize({ text, size }: Pick<SerifSpec, 'text' | 'size'>): { width: number; height: number } {
  return {
    width: Math.ceil(text.length * size * WIDTH_PER_CHAR + size * 0.5),
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
