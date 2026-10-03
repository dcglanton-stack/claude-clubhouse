import type {
  AgentDesk,
  AgentModel,
  BarItemId,
  BarLayout,
  BarSpot,
  BarZone,
  Blueprint,
  ColorPreset,
  ColorsView,
  CommandStats,
  CommandsView,
  HiddenPlan,
  Limit,
  Palette,
  Prefs,
  RecipesView,
  Shortcut,
  Summary,
  ToolRules,
  ToolbarPreset,
  ToolsView,
} from '../../types'

export const DEFAULT_PALETTE: Palette = { accent: '#d97757', clawd: '#e8743b', background: null, text: null }

export const MAX_BARS = 4
export const MAX_SHORTCUTS = 8
export const BAR_ZONES: readonly BarZone[] = ['left', 'center', 'right']

export const DEFAULT_BAR: BarLayout = {
  home: { isShown: true, row: 1, zone: 'center' },
  meter: { isShown: true, row: 1, zone: 'right' },
  summary: { isShown: true, row: 1, zone: 'left' },
  tidy: { isShown: true, row: 1, zone: 'left' },
  cache: { isShown: false, row: 1, zone: 'left' },
  context: { isShown: false, row: 1, zone: 'left' },
  receipt: { isShown: false, row: 1, zone: 'left' },
  ticker: { isShown: false, row: 1, zone: 'left' },
  sports: { isShown: false, row: 1, zone: 'left' },
  draw: { isShown: false, row: 1, zone: 'left' },
}

export const BAR_ITEMS: readonly (readonly [BarItemId, string, string])[] = [
  ['home', 'Clubhouse button', 'The house that opens the Clubhouse.'],
  ['meter', 'Usage meter', 'Clawd on a bar that drains as you use your limit.'],
  ['summary', 'Summarize button', 'Shortens the last reply into a few bullet points.'],
  ['tidy', 'Tidy button', 'Fixes spelling and trims the draft in the prompt box before you send it.'],
  ['cache', 'Cache timer', 'Counts one hour down from the last reply; after that the next turn costs more.'],
  ['context', 'Context gauge', 'How full this conversation is, in tokens.'],
  ['receipt', 'Turn receipt', 'Time, tokens and usage of the last turn.'],
  ['draw', 'Draw it button', 'Opens a sketch pad so you can draw what you want instead of describing it; the sketch goes into your prompt.'],
  ['sports', 'Live score', 'One game: both teams, the score and the clock. Pick the game in the Live sports room.'],
  ['ticker', 'Ticker', 'One stock or coin: symbol, price and the day\'s change. Pick it in the Ticker room.'],
]

export const PREFS_SHAPE = 'prefs-4'

export const DEFAULT_PREFS: Prefs = {
  isEnabled: true,
  window: 'five_hour',
  bar: DEFAULT_BAR,
  barCount: 1,
  shortcuts: [],
  autoSummary: false,
  spendCap: 0,
  warnsSafeguards: false,
  coversSidebar: false,
  appMode: 'dark',
  reach: 'app',
  isHelperReady: false,
  opinionModel: 'sonnet',
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

export const AGENT_MODELS: readonly AgentModel[] = ['haiku', 'sonnet', 'opus', 'fable', 'inherit']
export const MODEL_LABEL: Record<AgentModel, string> = {
  haiku: 'Haiku (fast, cheapest)',
  sonnet: 'Sonnet (balanced)',
  opus: 'Opus (strong)',
  fable: 'Fable (most capable; Opus steps in if you cannot use it)',
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
export const RECIPES_PANE = 'clubhouse-recipes'
export const WATCH_PANE = 'clubhouse-watch'
export const NOTES_PANE = 'clubhouse-notes'
export const TICKER_PANE = 'clubhouse-ticker'
export const SPORTS_PANE = 'clubhouse-sports'
export const OPINION_PANE = 'clubhouse-opinion'
export const TOOL_RULES_KEY = 'toolRules'
export const DEFAULT_TOOLS_VIEW: ToolsView = { filter: '', note: null, open: [] }
export const DEFAULT_RECIPES_VIEW: RecipesView = { note: null, editing: null, trial: null }
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
    id: OPINION_PANE,
    title: 'Second opinion',
    word: 'opinion',
    about: 'Ask about this session without adding to it.',
  },
  {
    id: TOOLS_PANE,
    title: 'Tool rules',
    word: 'tools',
    about: 'Make Claude ask first, or block it, before it uses a tool.',
  },
  {
    id: RECIPES_PANE,
    title: 'Recipes',
    word: 'recipes',
    about: 'Turn a terminal command into a tool Claude can call.',
  },
  {
    id: WATCH_PANE,
    title: 'Night watch',
    word: 'watch',
    about: 'Check on things while you are away, and wake Claude when needed.',
  },
  {
    id: NOTES_PANE,
    title: 'Session notes',
    word: 'notes',
    about: 'Leave a note for a later session to read.',
  },
  {
    id: TICKER_PANE,
    title: 'Ticker',
    word: 'ticker',
    about: 'A stock or coin price on the toolbar, and your favorites.',
  },
  {
    id: SPORTS_PANE,
    title: 'Live sports',
    word: 'sports',
    about: 'Games on now and this week; put one score on the toolbar.',
  },
  {
    id: COMMANDS_PANE,
    title: 'Commands',
    word: 'commands',
    about: 'Everything you can type after a slash, most used first.',
  },
  {
    id: BAR_PANE,
    title: 'Toolbar',
    word: 'toolbar',
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

export const DEFAULT_COLORS_VIEW: ColorsView = { slot: 'background', note: null, isAdvancedOpen: false }

export const DEFAULT_COMMANDS_VIEW: CommandsView = { filter: '', note: null, open: [] }
export const HIDDEN_KEY = 'hidden'
export const HIDDEN_PLAN_KEY = 'hiddenPlan'
export const DEFAULT_HIDDEN_PLAN: HiddenPlan = { presets: {}, startWith: null }

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

export function asBarLayout(bar: Record<string, unknown>, barCount: number): BarLayout {
  return Object.fromEntries(BAR_ITEMS.map(([id]) => [id, asSpot(bar[id], DEFAULT_BAR[id], barCount)])) as BarLayout
}

export function asToolbarPresets(stored: unknown): ToolbarPreset[] {
  if (!Array.isArray(stored)) return []

  return stored.flatMap(one => {
    if (!isRecord(one) || typeof one.name !== 'string' || one.name.trim() === '') return []
    const barCount =
      typeof one.barCount === 'number' && one.barCount >= 1 && one.barCount <= MAX_BARS ? Math.round(one.barCount) : 1

    return [
      {
        name: one.name,
        barCount,
        bar: asBarLayout(isRecord(one.bar) ? one.bar : {}, barCount),
        shortcuts: asShortcuts(one.shortcuts, barCount),
      },
    ]
  })
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
    bar: asBarLayout(bar, barCount),
    barCount,
    shortcuts: asShortcuts(saved.shortcuts, barCount),
    autoSummary: saved.autoSummary === true,
    warnsSafeguards: saved.warnsSafeguards === true,
    coversSidebar: saved.coversSidebar === true,
    spendCap: typeof saved.spendCap === 'number' && saved.spendCap > 0 && saved.spendCap <= 90 ? Math.round(saved.spendCap) : 0,
    appMode: saved.appMode === 'light' ? 'light' : 'dark',
    reach: 'app',
    isHelperReady: saved.isHelperReady === true,
    opinionModel:
      saved.opinionModel === 'haiku' || saved.opinionModel === 'opus' || saved.opinionModel === 'fable'
        ? saved.opinionModel
        : 'sonnet',
    palette: { ...DEFAULT_PALETTE, ...palette, text: null } as Palette,
    previousTheme: typeof saved.previousTheme === 'string' ? saved.previousTheme : null,
  }
}

export function withBarCount(held: Prefs, barCount: number): Prefs {
  const fit = (spot: BarSpot): BarSpot => ({ ...spot, row: Math.min(spot.row, barCount) })

  return {
    ...held,
    barCount,
    bar: Object.fromEntries(BAR_ITEMS.map(([id]) => [id, fit(held.bar[id])])) as BarLayout,
    shortcuts: held.shortcuts.map(one => ({ ...one, spot: fit(one.spot) })),
  }
}

export function resetLook(held: Prefs): Prefs {
  return { ...held, palette: DEFAULT_PALETTE, reach: 'app' }
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

export function asHiddenPlan(saved: unknown): HiddenPlan {
  if (!isRecord(saved) || !isRecord(saved.presets)) return DEFAULT_HIDDEN_PLAN
  const presets = Object.fromEntries(
    Object.entries(saved.presets).map(([name, names]) => [name, asNames(names)] as const),
  )
  const startWith = typeof saved.startWith === 'string' && saved.startWith in presets ? saved.startWith : null

  return { presets, startWith }
}

export const COLOR_PRESETS_KEY = 'colorPresets'
export const MAX_COLOR_PRESETS = 12

export function withPreset(held: readonly ColorPreset[], preset: ColorPreset): ColorPreset[] {
  return [preset, ...held.filter(one => one.name !== preset.name)].slice(0, MAX_COLOR_PRESETS)
}

export function asColorPresets(stored: unknown): ColorPreset[] {
  if (!Array.isArray(stored)) return []
  const hex = /^#[0-9a-f]{6}$/

  return stored
    .flatMap(one => {
      const palette = isRecord(one) && isRecord(one.palette) ? one.palette : null

      return isRecord(one) &&
        typeof one.name === 'string' &&
        one.name.trim() !== '' &&
        palette !== null &&
        typeof palette.accent === 'string' &&
        typeof palette.clawd === 'string' &&
        hex.test(palette.accent) &&
        hex.test(palette.clawd) &&
        (palette.background === null || (typeof palette.background === 'string' && hex.test(palette.background)))
        ? [
            {
              name: one.name,
              palette: { accent: palette.accent, clawd: palette.clawd, background: palette.background, text: null },
            },
          ]
        : []
    })
    .slice(0, MAX_COLOR_PRESETS)
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sorted(value[key])]),
  )
}

export function sameSettings(one: Prefs, other: Prefs): boolean {
  const comparable = (prefs: Prefs) => JSON.stringify(sorted({ ...prefs, isHelperReady: null, appMode: null }))

  return comparable(one) === comparable(other)
}
