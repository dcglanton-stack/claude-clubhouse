export const DRAW_BINARY = '.claude/clubhouse-helper/draw-pad'
export const DRAW_TIMEOUT_MS = 600_000
export const DRAW_MISSING = 'Draw it needs its small helper window, which is not installed on this Mac. Ask Claude to build it.'
export const DRAW_OPEN = 'The sketch pad is open. Draw what you want, then press Send to Claude.'
export const DRAW_DONE = 'Your sketch is in the prompt box. Say what it is for, then send.'

export function sketchPrompt(draft: string, path: string): string {
  const before = draft.trim() === '' ? '' : `${draft.trimEnd()}\n`

  return `${before}I drew what I want. Look at my sketch at ${path} and `
}
