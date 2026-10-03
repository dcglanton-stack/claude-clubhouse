import type { Prefs } from '../../types'

const HELPER_FOLDER = '.claude/clubhouse-helper'
const APP_BASE = { dark: '#151515', light: '#f0eee6' } as const
const MAX_ALPHA = 0.45
const CORNER_RADIUS = 18

export const HELPER_CONFIG = `${HELPER_FOLDER}/tint.json`
export const HELPER_BINARY = `${HELPER_FOLDER}/window-tint`
export const START_HELPER = `[ -x "$HOME/${HELPER_BINARY}" ] && (nohup "$HOME/${HELPER_BINARY}" >/dev/null 2>&1 &)`

export function coversApp(prefs: Prefs): boolean {
  return (
    prefs.isEnabled &&
    prefs.isHelperReady &&
    prefs.reach === 'app' &&
    prefs.palette.background !== null
  )
}

export function paintOf(prefs: Prefs): string | null {
  return coversApp(prefs) ? null : prefs.palette.background
}

export function tintsRows(prefs: Prefs): boolean {
  return (
    prefs.isEnabled &&
    prefs.reach !== 'rooms' &&
    prefs.palette.background !== null &&
    !coversApp(prefs)
  )
}

export function helperConfig(prefs: Prefs): string {
  return `${JSON.stringify({
    enabled: coversApp(prefs),
    target: prefs.palette.background ?? APP_BASE[prefs.appMode],
    base: APP_BASE[prefs.appMode],
    maxAlpha: MAX_ALPHA,
    radius: CORNER_RADIUS,
  })}\n`
}
