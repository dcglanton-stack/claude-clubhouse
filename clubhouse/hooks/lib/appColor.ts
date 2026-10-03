import type { Prefs } from '../../types'
import { inkOn, isLight, mix } from './color'

const HELPER_FOLDER = '.claude/clubhouse-helper'
const APP_SURFACE = { dark: '#151515', light: '#f0eee6' } as const
const CORNER_RADIUS = 18
const EDGE_SHARE = 0.4

export const HELPER_CONFIG = `${HELPER_FOLDER}/tint.json`
export const HELPER_BINARY = `${HELPER_FOLDER}/window-tint`
export const START_HELPER = `[ -x "$HOME/${HELPER_BINARY}" ] && (nohup "$HOME/${HELPER_BINARY}" >/dev/null 2>&1 &)`

export function fitsApp(prefs: Prefs): boolean {
  const { background } = prefs.palette

  return background === null || isLight(background) === (prefs.appMode === 'light')
}

export function coversApp(prefs: Prefs): boolean {
  return (
    prefs.isEnabled &&
    prefs.isHelperReady &&
    prefs.reach === 'app' &&
    prefs.palette.background !== null &&
    fitsApp(prefs)
  )
}

export function paintOf(prefs: Prefs): string | null {
  return coversApp(prefs) ? null : prefs.palette.background
}

export function edgeOf(prefs: Prefs): string | null {
  const { background } = prefs.palette

  return coversApp(prefs) && background !== null ? mix(background, inkOn(background), EDGE_SHARE) : null
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
    target: prefs.palette.background ?? APP_SURFACE[prefs.appMode],
    radius: CORNER_RADIUS,
    isLightApp: prefs.appMode === 'light',
  })}\n`
}
