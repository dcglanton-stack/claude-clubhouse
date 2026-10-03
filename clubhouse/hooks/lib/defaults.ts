import type {
  AgentDesk,
  AgentModel,
  BarItemId,
  BarLayout,
  BarZone,
  Blueprint,
  ColorsView,
  CommandStats,
  CommandsView,
  Limit,
  Palette,
  Prefs,
} from '../../types'

export const DEFAULT_PALETTE: Palette = { accent: '#d97757', clawd: '#e8743b', background: null }

export const BAR_ROWS = 2
export const BAR_ZONES: readonly BarZone[] = ['left', 'center', 'right']

export const DEFAULT_BAR: BarLayout = {
  home: { isShown: true, row: 1, zone: 'center' },
  meter: { isShown: true, row: 1, zone: 'right' },
  context: { isShown: false, row: 1, zone: 'left' },
  receipt: { isShown: false, row: 1, zone: 'left' },
}

export const BAR_ITEMS: readonly (readonly [BarItemId, string, string])[] = [
  ['home', 'Home button', 'The house that opens the Clubhouse.'],
  ['meter', 'Usage meter', 'Clawd on a bar that drains as you use your limit.'],
  ['context', 'Context gauge', 'How full this conversation is.'],
  ['receipt', 'Turn receipt', 'Time, tokens and usage of the last turn.'],
]

export const DEFAULT_PREFS: Prefs = {
  isEnabled: true,
  window: 'five_hour',
  bar: DEFAULT_BAR,
  palette: DEFAULT_PALETTE,
  previousTheme: null,
}

export const AGENTS_KEY = 'agents'
export const AGENT_PREFIX = 'clubhouse:'
export const DEFAULT_AGENT_DESK: AgentDesk = { mode: 'idle', target: null, note: null, dismissed: [] }

export const AGENT_MODELS: readonly AgentModel[] = ['haiku', 'sonnet', 'opus', 'inherit']
export const MODEL_LABEL: Record<AgentModel, string> = {
  haiku: 'Haiku (fast, cheapest)',
  sonnet: 'Sonnet (balanced)',
  opus: 'Opus (strongest)',
  inherit: 'Same as this session',
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

function asSpot(saved: unknown, fallback: BarLayout[BarItemId]): BarLayout[BarItemId] {
  if (!isRecord(saved)) return fallback
  const zone = BAR_ZONES.find(one => one === saved.zone) ?? fallback.zone
  const row = typeof saved.row === 'number' && saved.row >= 1 && saved.row <= BAR_ROWS ? saved.row : fallback.row

  return { isShown: typeof saved.isShown === 'boolean' ? saved.isShown : fallback.isShown, row, zone }
}

export function mergePrefs(saved: unknown): Prefs {
  if (!isRecord(saved)) return DEFAULT_PREFS
  const palette = isRecord(saved.palette) ? saved.palette : {}
  const bar = isRecord(saved.bar) ? saved.bar : {}

  return {
    isEnabled: typeof saved.isEnabled === 'boolean' ? saved.isEnabled : DEFAULT_PREFS.isEnabled,
    window: saved.window === 'seven_day' ? 'seven_day' : 'five_hour',
    bar: {
      home: asSpot(bar.home, DEFAULT_BAR.home),
      meter: asSpot(bar.meter, DEFAULT_BAR.meter),
      context: asSpot(bar.context, DEFAULT_BAR.context),
      receipt: asSpot(bar.receipt, DEFAULT_BAR.receipt),
    },
    palette: { ...DEFAULT_PALETTE, ...palette } as Palette,
    previousTheme: typeof saved.previousTheme === 'string' ? saved.previousTheme : null,
  }
}

export function asBlueprints(saved: unknown): Blueprint[] {
  if (!Array.isArray(saved)) return []

  return saved.flatMap(one =>
    isRecord(one) &&
    typeof one.name === 'string' &&
    typeof one.purpose === 'string' &&
    typeof one.prompt === 'string'
      ? [
          {
            name: one.name,
            purpose: one.purpose,
            prompt: one.prompt,
            model: AGENT_MODELS.find(model => model === one.model) ?? 'sonnet',
            isAuto: one.isAuto === true,
          },
        ]
      : [],
  )
}

export function agentSlug(typed: string): string {
  return typed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
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
