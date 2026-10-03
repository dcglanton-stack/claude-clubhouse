import type { ColorsView, CommandStats, CommandsView, Limit, Palette, Prefs } from '../../types'

export const DEFAULT_PALETTE: Palette = { accent: '#d97757', clawd: '#e8743b', background: null }

export const DEFAULT_PREFS: Prefs = {
  isEnabled: true,
  window: 'five_hour',
  showHome: true,
  showMeter: true,
  showContext: false,
  showReceipt: false,
  palette: DEFAULT_PALETTE,
  previousTheme: null,
}

export const HOME_PANE = 'clubhouse'
export const COLORS_PANE = 'clubhouse-colors'
export const AGENTS_PANE = 'clubhouse-agents'
export const COMMANDS_PANE = 'clubhouse-commands'
export const COMMANDS_KEY = 'commands'

export type Room = { id: string; title: string; word: string; about: string }

export const ROOMS: readonly Room[] = [
  {
    id: AGENTS_PANE,
    title: 'Agent HQ',
    word: 'agents',
    about: 'Every agent working in this session, in uniform. Stop one from here.',
  },
  {
    id: COMMANDS_PANE,
    title: 'Commands',
    word: 'commands',
    about: 'Everything you can type after a slash, led by the ones you use most.',
  },
  {
    id: COLORS_PANE,
    title: 'Colors',
    word: 'colors',
    about: 'Colors for everything the Clubhouse draws, and a theme for Claude Code.',
  },
]

export const STARTER_COMMANDS: readonly string[] = ['clubhouse', 'clear', 'compact', 'model', 'help']
export const PREFS_KEY = 'prefs'
export const LIMITS_KEY = 'limits'

export const DEFAULT_COLORS_VIEW: ColorsView = { slot: 'accent', note: null }

export const DEFAULT_COMMANDS_VIEW: CommandsView = { filter: '', note: null }

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

export function asCommandStats(saved: unknown): CommandStats {
  if (!isRecord(saved)) return {}
  const stats: CommandStats = {}

  for (const [name, stat] of Object.entries(saved)) {
    if (isRecord(stat) && typeof stat.count === 'number' && typeof stat.lastAt === 'number') {
      stats[name] = { count: stat.count, lastAt: stat.lastAt }
    }
  }

  return stats
}

export function topCommands(stats: CommandStats, size: number): string[] {
  const names = Object.keys(stats)
  const byCount = [...names].sort((one, other) => stats[other]!.count - stats[one]!.count)
  const byRecency = [...names].sort((one, other) => stats[other]!.lastAt - stats[one]!.lastAt)
  const mostUsed = byCount.slice(0, Math.ceil(size / 2))
  const picked = [...mostUsed, ...byRecency.filter(name => !mostUsed.includes(name))].slice(0, size)

  return [...picked, ...STARTER_COMMANDS.filter(name => !picked.includes(name))].slice(0, size)
}
