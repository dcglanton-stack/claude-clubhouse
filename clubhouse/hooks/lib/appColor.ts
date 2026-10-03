import type { Prefs } from '../../types'
import { inkOn, isLight, luminance, mix, standOut } from './color'
import { HELPER_BOOST, clearOn, deepens, drawnFor, helperStages, toneFor } from './tone'
import type { Tone } from './tone'

export type Look = {
  tone: Tone | null
  background: string | null
  ink: string
  accent: string
  clawd: string
  track: string | null
  edge: string | null
  hairline: string
}

const HELPER_FOLDER = '.claude/clubhouse-helper'
const APP_CONFIG = 'Library/Application Support/Claude/config.json'
const APP_SURFACE = { dark: '#151515', light: '#f0eee6' } as const
const CORNER_RADIUS = 18
const HAIRLINE = '#87867f'
const EDGE_CONTRAST = 4.5
const HAIRLINE_CONTRAST = 2.5
const TRACK_CONTRAST = 1.25
const SIDEBAR_SHADE = { light: 0.07, dark: 0.28, deeper: 0.55 } as const
const HEADING_CONTRAST = 3
const MASCOT_CONTRAST = 1.5

export const HELPER_CONFIG = `${HELPER_FOLDER}/tint.json`
export const HELPER_BINARY = `${HELPER_FOLDER}/window-tint`
export const START_HELPER = `[ -x "$HOME/${HELPER_BINARY}" ] && (nohup "$HOME/${HELPER_BINARY}" >/dev/null 2>&1 &)`
export const READ_APP_MODE =
  `printf 'theme=%s\\n' "$(plutil -extract userThemeMode raw -o - "$HOME/${APP_CONFIG}" 2>/dev/null)"; ` +
  `printf 'system=%s\\n' "$(defaults read -g AppleInterfaceStyle 2>/dev/null)"`

export function appModeFrom(output: string): Prefs['appMode'] | null {
  const theme = output.match(/^theme=(.*)$/m)?.[1]?.trim()
  const system = output.match(/^system=(.*)$/m)?.[1]?.trim()

  if (theme === undefined || system === undefined || (theme === '' && system === '')) return null
  if (theme === 'light' || theme === 'dark') return theme

  return system === 'Dark' ? 'dark' : 'light'
}

export function backdropOf(prefs: Prefs): string {
  return prefs.palette.background ?? APP_SURFACE[prefs.appMode]
}

export function inkOf(prefs: Prefs): string {
  return prefs.palette.text ?? inkOn(backdropOf(prefs))
}

export function coversApp(prefs: Prefs): boolean {
  const { background, text } = prefs.palette
  const hasOwnColor = background !== null || (text ?? null) !== null

  return prefs.isEnabled && prefs.isHelperReady && prefs.reach === 'app' && hasOwnColor
}

export function swapsLightAndDark(prefs: Prefs): boolean {
  const isInkDarker = luminance(inkOf(prefs)) < luminance(backdropOf(prefs))

  return coversApp(prefs) && isInkDarker === (prefs.appMode === 'dark')
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

export function lookOf(prefs: Prefs, surface: string): Look {
  const backdrop = backdropOf(prefs)
  const ink = inkOf(prefs)
  const { accent, clawd } = prefs.palette

  if (!coversApp(prefs) || surface === 'terminal') {
    return {
      tone: null,
      background: paintOf(prefs),
      ink,
      accent: standOut(accent, backdrop, ink, HEADING_CONTRAST),
      clawd: standOut(clawd, backdrop, ink, MASCOT_CONTRAST),
      track: null,
      edge: null,
      hairline: HAIRLINE,
    }
  }

  const tone = toneFor({ target: backdrop, ink, isLightApp: prefs.appMode === 'light' })

  return {
    tone,
    background: null,
    ink,
    accent: clearOn(tone, accent, HEADING_CONTRAST),
    clawd: clearOn(tone, clawd, MASCOT_CONTRAST),
    track: clearOn(tone, backdrop, TRACK_CONTRAST),
    edge: drawnFor(tone, clearOn(tone, backdrop, EDGE_CONTRAST)),
    hairline: drawnFor(tone, clearOn(tone, backdrop, HAIRLINE_CONTRAST)),
  }
}

export function helperConfig(prefs: Prefs): string {
  const target = backdropOf(prefs)
  const ink = inkOf(prefs)
  const isLightApp = prefs.appMode === 'light'
  const shade = deepens({ target, ink, isLightApp }) ? 'deeper' : isLight(target) ? 'light' : 'dark'
  const sidebar = mix(target, '#000000', SIDEBAR_SHADE[shade])

  return `${JSON.stringify({
    enabled: coversApp(prefs),
    target,
    ink,
    radius: CORNER_RADIUS,
    isLightApp,
    boost: HELPER_BOOST,
    coverSidebar: prefs.coversSidebar === true,
    sidebar,
    ...helperStages({ target, ink, isLightApp }, sidebar),
  })}\n`
}
