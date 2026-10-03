import type {
  AgentDesk,
  AgentModel,
  BarItemId,
  BarLayout,
  BarSpot,
  BarZone,
  Blueprint,
  ColorsView,
  CommandStats,
  CommandsView,
  Limit,
  Palette,
  Prefs,
  Shortcut,
  Summary,
  ToolRules,
  ToolsView,
} from '../../types'

export const DEFAULT_PALETTE: Palette = { accent: '#d97757', clawd: '#e8743b', background: null }

export const MAX_BARS = 3
export const MAX_SHORTCUTS = 8
export const BAR_ZONES: readonly BarZone[] = ['left', 'center', 'right']

export const DEFAULT_BAR: BarLayout = {
  home: { isShown: true, row: 1, zone: 'center' },
  meter: { isShown: true, row: 1, zone: 'right' },
  summary: { isShown: true, row: 1, zone: 'left' },
  context: { isShown: false, row: 1, zone: 'left' },
  receipt: { isShown: false, row: 1, zone: 'left' },
}

export const BAR_ITEMS: readonly (readonly [BarItemId, string, string])[] = [
  ['home', 'Home button', 'The house that opens the Clubhouse.'],
  ['meter', 'Usage meter', 'Clawd on a bar that drains as you use your limit.'],
  ['summary', 'Summarize button', 'Shortens the last reply into a few bullet points.'],
  ['context', 'Context gauge', 'How full this conversation is.'],
  ['receipt', 'Turn receipt', 'Time, tokens and usage of the last turn.'],
]

export const DEFAULT_PREFS: Prefs = {
  isEnabled: true,
  window: 'five_hour',
  bar: DEFAULT_BAR,
  barCount: 1,
  shortcuts: [],
  autoSummary: false,
  palette: DEFAULT_PALETTE,
  previousTheme: null,
}

export const SHORTCUT_SPOT: BarSpot = { isShown: true, row: 1, zone: 'left' }
export const ZONE_LABEL: Record<BarZone, string> = { left: 'Left', center: 'Center', right: 'Right' }

export const IDLE_SUMMARY: Summary = { status: 'idle', text: '', sourceChars: 0 }
export const WORKING_SUMMARY: Summary = { status: 'working', text: '', sourceChars: 0 }
export const ANSWER_LIMIT = 24_000
export const AUTO_SUMMARY_CHARS = 1500

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
export const BAR_PANE = 'clubhouse-bar'
export const USAGE_PANE = 'clubhouse-usage'
export const SUMMARY_PANE = 'clubhouse-summary'
export const TOOLS_PANE = 'clubhouse-tools'
export const TOOL_RULES_KEY = 'toolRules'
export const DEFAULT_TOOLS_VIEW: ToolsView = { filter: '', note: null, open: [] }
export const COMMANDS_KEY = 'commands'

export type Room = { id: string; title: string; word: string; about: string }

export const ROOMS: readonly Room[] = [
  {
    id: AGENTS_PANE,
    title: 'Agent HQ',
    word: 'agents',
    about: 'See agents at work, stop them, and build your own.',
  },
  {
    id: SUMMARY_PANE,
    title: 'Summary',
    word: 'summary',
    about: 'The last reply, cut down to the points that matter.',
  },
  {
    id: TOOLS_PANE,
    title: 'Tool rules',
    word: 'tools',
    about: 'Make Claude ask first, or block it, before it uses a tool.',
  },
  {
    id: COMMANDS_PANE,
    title: 'Commands',
    word: 'commands',
    about: 'Everything you can type after a slash, most used first.',
  },
  {
    id: BAR_PANE,
    title: 'Bar layout',
    word: 'bar',
    about: 'Add, remove and move what sits above the prompt.',
  },
  {
    id: USAGE_PANE,
    title: 'Usage',
    word: 'usage',
    about: 'Both limits, context and the cache timer, full size.',
  },
  {
    id: COLORS_PANE,
    title: 'Colors',
    word: 'colors',
    about: 'Colors for everything the Clubhouse draws.',
  },
]

export const STARTER_COMMANDS: readonly string[] = ['clubhouse', 'clear', 'compact', 'model', 'help']
export const PREFS_KEY = 'prefs'
export const LIMITS_KEY = 'limits'

export const DEFAULT_COLORS_VIEW: ColorsView = { slot: 'accent', note: null }

export const DEFAULT_COMMANDS_VIEW: CommandsView = { filter: '', note: null, open: [] }
export const HIDDEN_KEY = 'hidden'

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

function asSpot(saved: unknown, fallback: BarSpot, barCount: number): BarSpot {
  if (!isRecord(saved)) return fallback
  const zone = BAR_ZONES.find(one => one === saved.zone) ?? fallback.zone
  const row = typeof saved.row === 'number' && saved.row >= 1 && saved.row <= barCount ? saved.row : 1

  return { isShown: typeof saved.isShown === 'boolean' ? saved.isShown : fallback.isShown, row, zone }
}

function asShortcuts(saved: unknown, barCount: number): Shortcut[] {
  if (!Array.isArray(saved)) return []

  return saved
    .flatMap(one =>
      isRecord(one) &&
      typeof one.id === 'string' &&
      typeof one.label === 'string' &&
      typeof one.text === 'string'
        ? [
            {
              id: one.id,
              label: one.label,
              text: one.text,
              spot: asSpot(one.spot, SHORTCUT_SPOT, barCount),
            },
          ]
        : [],
    )
    .slice(0, MAX_SHORTCUTS)
}

export function mergePrefs(saved: unknown): Prefs {
  if (!isRecord(saved)) return DEFAULT_PREFS
  const palette = isRecord(saved.palette) ? saved.palette : {}
  const bar = isRecord(saved.bar) ? saved.bar : {}
  const barCount =
    typeof saved.barCount === 'number' && saved.barCount >= 1 && saved.barCount <= MAX_BARS
      ? Math.round(saved.barCount)
      : 1

  return {
    isEnabled: typeof saved.isEnabled === 'boolean' ? saved.isEnabled : DEFAULT_PREFS.isEnabled,
    window: saved.window === 'seven_day' ? 'seven_day' : 'five_hour',
    bar: {
      home: asSpot(bar.home, DEFAULT_BAR.home, barCount),
      meter: asSpot(bar.meter, DEFAULT_BAR.meter, barCount),
      summary: asSpot(bar.summary, DEFAULT_BAR.summary, barCount),
      context: asSpot(bar.context, DEFAULT_BAR.context, barCount),
      receipt: asSpot(bar.receipt, DEFAULT_BAR.receipt, barCount),
    },
    barCount,
    shortcuts: asShortcuts(saved.shortcuts, barCount),
    autoSummary: saved.autoSummary === true,
    palette: { ...DEFAULT_PALETTE, ...palette } as Palette,
    previousTheme: typeof saved.previousTheme === 'string' ? saved.previousTheme : null,
  }
}

export function withBarCount(held: Prefs, barCount: number): Prefs {
  const fit = (spot: BarSpot): BarSpot => ({ ...spot, row: Math.min(spot.row, barCount) })

  return {
    ...held,
    barCount,
    bar: {
      home: fit(held.bar.home),
      meter: fit(held.bar.meter),
      summary: fit(held.bar.summary),
      context: fit(held.bar.context),
      receipt: fit(held.bar.receipt),
    },
    shortcuts: held.shortcuts.map(one => ({ ...one, spot: fit(one.spot) })),
  }
}

export function nextZone(zone: BarZone): BarZone {
  return BAR_ZONES[(BAR_ZONES.indexOf(zone) + 1) % BAR_ZONES.length] ?? 'left'
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

export function asNames(saved: unknown): string[] {
  return Array.isArray(saved) ? saved.filter(one => typeof one === 'string') : []
}

export function asToolRules(saved: unknown): ToolRules {
  if (!isRecord(saved)) return {}
  const rules: ToolRules = {}

  for (const [tool, rule] of Object.entries(saved)) {
    if (rule === 'ask' || rule === 'block') rules[tool] = rule
  }

  return rules
}
