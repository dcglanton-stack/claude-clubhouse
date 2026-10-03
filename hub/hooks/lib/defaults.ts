import type { ColorsView, Limit, Palette, Prefs } from '../../types'

export const DEFAULT_PALETTE: Palette = { accent: '#d97757', clawd: '#e8743b', background: null }

export const DEFAULT_PREFS: Prefs = {
  isEnabled: true,
  window: 'five_hour',
  showMeter: true,
  showContext: false,
  showReceipt: false,
  palette: DEFAULT_PALETTE,
  previousTheme: null,
}

export const HOME_PANE = 'hub'
export const COLORS_PANE = 'hub-colors'
export const PREFS_KEY = 'prefs'
export const LIMITS_KEY = 'limits'

export const DEFAULT_COLORS_VIEW: ColorsView = { slot: 'accent', note: null }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isLimitList(value: unknown): value is Limit[] {
  return (
    Array.isArray(value) &&
    value.every(
      one => isRecord(one) && typeof one.kind === 'string' && typeof one.percentUsed === 'number',
    )
  )
}

export function mergePrefs(saved: unknown): Prefs {
  if (!isRecord(saved)) return DEFAULT_PREFS
  const palette = isRecord(saved.palette) ? saved.palette : {}

  return {
    ...DEFAULT_PREFS,
    ...saved,
    palette: { ...DEFAULT_PALETTE, ...palette },
  } as Prefs
}
