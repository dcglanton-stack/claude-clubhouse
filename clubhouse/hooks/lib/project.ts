import type { Palette, Prefs } from '../../types'

export const PROJECT_COLORS_KEY = 'projectColors'

export type ProjectColors = { [folder: string]: Palette }

const HEX = /^#[0-9a-f]{6}$/

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function asProjectColors(stored: unknown): ProjectColors {
  return Object.fromEntries(
    Object.entries(record(stored) ?? {}).flatMap(([folder, one]) => {
      const palette = record(one)

      return palette !== null &&
        typeof palette.accent === 'string' &&
        typeof palette.clawd === 'string' &&
        HEX.test(palette.accent) &&
        HEX.test(palette.clawd) &&
        (palette.background === null || (typeof palette.background === 'string' && HEX.test(palette.background)))
        ? [[folder, { accent: palette.accent, clawd: palette.clawd, background: palette.background, text: null }]]
        : []
    }),
  )
}

export function forStore(prefs: Prefs, shared: Palette | null): Prefs {
  return shared === null ? prefs : { ...prefs, palette: shared }
}

export function inProject(shared: Prefs, own: Palette | undefined): { prefs: Prefs; shared: Palette | null } {
  return own === undefined ? { prefs: shared, shared: null } : { prefs: { ...shared, palette: own }, shared: shared.palette }
}

export function withoutProject(projects: ProjectColors, folder: string): ProjectColors {
  return Object.fromEntries(Object.entries(projects).filter(([one]) => one !== folder))
}

export function projectName(folder: string): string {
  return folder.split('/').filter(part => part !== '').at(-1) ?? 'This project'
}
