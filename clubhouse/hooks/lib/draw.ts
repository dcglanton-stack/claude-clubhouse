export const DRAW_BINARY = '.claude/clubhouse-helper/draw-pad'
export const DRAW_TIMEOUT_MS = 600_000
export const DRAW_MISSING = 'Draw it needs its small helper window, which is not built on this Mac yet. Open Colors and press Build the helper.'
export const DRAW_OPEN = 'The sketch pad is open. Draw what you want, then press Send to Claude.'
export const DRAW_DONE = 'Your sketch is in the prompt box. Say what it is for, then send. It is deleted once Claude has answered, unless you say to keep it.'

export function sketchPrompt(draft: string, path: string): string {
  const before = draft.trim() === '' ? '' : `${draft.trimEnd()}\n`

  return `${before}I drew what I want. Look at my sketch at ${path} and `
}

export type SketchToClear = { path: string; at: number }

export const SKETCH_FOLDER = '.claude/clubhouse-helper/sketches'
export const TURN_START_SLACK_MS = 3000

const SKETCH = /[^\s"'`]*\/sketch-\d+\.png/g
const KEEP = /\bkeep\b[^.\n]*\b(sketch|drawing|picture)\b|\b(do not|don't|dont) delete\b/i

export function sketchesIn(text: string, userFolder: string): string[] {
  const folder = `${userFolder}/${SKETCH_FOLDER}/`

  return [...new Set(text.match(SKETCH) ?? [])].filter(path => path.startsWith(folder) && !path.includes('..'))
}

export function keepsSketch(text: string): boolean {
  return KEEP.test(text)
}

export function dueSketches(held: readonly SketchToClear[], turnStartedAt: number): SketchToClear[] {
  return held.filter(one => one.at <= turnStartedAt + TURN_START_SLACK_MS)
}
