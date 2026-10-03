export type WindowKind = 'five_hour' | 'seven_day'

export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

export type PaletteSlot = 'accent' | 'clawd' | 'background'

export type Palette = { accent: string; clawd: string; background: string | null; text: string | null }

export type HomeTab = 'home' | 'more'

export type FontChoice = { name: string; stack: string; weight: number; widen: number }

export type FontPreset = { name: string; font: FontChoice }

export type FontsView = { note: string | null }

export type ColorPreset = { name: string; palette: Palette }

export type ContextSize = { tokens: number; window: number }

export type BarItemId = 'home' | 'meter' | 'summary' | 'tidy' | 'cache' | 'context' | 'receipt' | 'ticker' | 'sports' | 'draw' | 'weather' | 'agi' | 'gaslight' | 'prune'

export type BarZone = 'left' | 'center' | 'right'

export type BarSpot = { isShown: boolean; row: number; zone: BarZone }

export type BarLayout = {
  home: BarSpot
  meter: BarSpot
  summary: BarSpot
  tidy: BarSpot
  cache: BarSpot
  context: BarSpot
  receipt: BarSpot
  ticker: BarSpot
  sports: BarSpot
  draw: BarSpot
  weather: BarSpot
  agi: BarSpot
  gaslight: BarSpot
  prune: BarSpot
}

export type Shortcut = { id: string; label: string; text: string; spot: BarSpot }

export type ToolbarPreset = { name: string; bar: BarLayout; barCount: number; shortcuts: Shortcut[] }

export type Summary = {
  status: 'idle' | 'working' | 'ready' | 'failed'
  text: string
  sourceChars: number
}

export type OpinionModel = 'haiku' | 'sonnet' | 'opus' | 'fable'

export type Opinion = {
  status: 'idle' | 'working' | 'ready' | 'failed'
  text: string
  source: 'here' | 'outside' | null
}

export type Reach = 'rooms' | 'conversation' | 'app'

export type Prefs = {
  isEnabled: boolean
  window: WindowKind
  bar: BarLayout
  barCount: number
  shortcuts: Shortcut[]
  autoSummary: boolean
  spendCap: number
  warnsSafeguards: boolean
  coversSidebar: boolean
  font: FontChoice
  appMode: 'dark' | 'light'
  reach: Reach
  isHelperReady: boolean
  opinionModel: OpinionModel
  palette: Palette
  previousTheme: string | null
}

export type Receipt = {
  seconds: number
  inputTokens: number
  outputTokens: number
  usageDelta: number | null
}

export type ColorsView = { slot: PaletteSlot; note: string | null; isAdvancedOpen: boolean }

export type CommandStat = { count: number; lastAt: number }

export type CommandStats = { [name: string]: CommandStat }

export type CommandsView = { filter: string; note: string | null; open: string[] }

export type HiddenPresets = { [name: string]: string[] }

export type HiddenPlan = { presets: HiddenPresets; startWith: string | null }

export type ToolRule = 'ask' | 'block'

export type ToolRules = { [tool: string]: ToolRule }

export type ToolsView = { filter: string; note: string | null; open: string[] }

export type Recipe = { name: string; about: string; command: string }

export type RecipeTrial = { name: string; text: string }

export type RecipesView = { note: string | null; editing: string | null; trial: RecipeTrial | null }

export type SessionNote = { id: string; text: string; folder: string | null; keep: 'once' | 'always'; at: number }

export type NotesView = { note: string | null; where: 'folder' | 'anywhere'; keep: 'once' | 'always' }

export type Quote = { symbol: string; name: string; price: number; changePercent: number | null; at: number }

export type TickerHit = { symbol: string; name: string; kind: string }

export type TickerPlan = { symbol: string | null; favorites: string[]; isColored: boolean }

export type TickerView = { note: string | null; hits: TickerHit[] }

export type Team = { abbr: string; score: string; logo: string | null; color: string }

export type Game = {
  id: string
  league: string
  startsAt: number
  state: 'pre' | 'in' | 'post'
  clock: string
  home: Team
  away: Team
}

export type SportsPlan = { league: string; gameId: string | null; gameLeague: string | null; gameDay: string | null }

export type SportsView = { note: string | null; isLoading: boolean }

export type WeatherKind = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm' | 'snow'

export type Place = { name: string; latitude: number; longitude: number }

export type WeatherPlan = { place: Place | null; unit: 'f' | 'c' }

export type ForecastDay = { date: string; kind: WeatherKind; high: number; low: number; chance: number | null }

export type Forecast = { at: number; temp: number; kind: WeatherKind; isWet: boolean; chance: number | null; days: ForecastDay[] }

export type WeatherView = { note: string | null; hits: Place[] }

export type WatchTrigger = 'fails' | 'stalls' | 'changes' | 'always'

export type SavedWatch = {
  name: string
  task: string
  command: string
  trigger: WatchTrigger
  isQuiet: boolean
  everyMinutes: number
  maxChecks: number
}

export type Watch = {
  id: string
  name: string
  task: string
  command: string
  trigger: WatchTrigger
  isQuiet: boolean
  everyMinutes: number
  maxChecks: number
  checksDone: number
  nextAt: number
  lastOutput: string | null
  wakesInARow: number
  wokeAt: number | null
}

export type WatchEntry = { at: number; text: string }

export type WatchView = {
  note: string | null
  everyMinutes: number
  maxChecks: number
  trigger: WatchTrigger
  isQuiet: boolean
}

export type AgentModel = 'haiku' | 'sonnet' | 'opus' | 'fable' | 'inherit'

export type Blueprint = {
  name: string
  purpose: string
  prompt: string
  model: AgentModel
  isAuto: boolean
}

export type AgentDesk = {
  mode: 'idle' | 'form' | 'send'
  target: string | null
  note: string | null
  dismissed: string[]
}

declare module 'claude-code' {
  interface PluginState {
    clubhouse: {
      limits: Limit[]
      prefs: Shaped<Prefs>
      contextPercent: number | null
      contextSize: ContextSize | null
      lastReplyAt: number | null
      now: number
      receipt: Receipt | null
      tab: HomeTab
      colorsView: ColorsView
      colorPresets: ColorPreset[]
      fontPresets: FontPreset[]
      fontsView: FontsView
      toolbarPresets: ToolbarPreset[]
      ticker: TickerPlan
      quotes: { [symbol: string]: Quote }
      tickerView: TickerView
      sports: SportsPlan
      games: Game[]
      liveGame: Game | null
      logos: { [key: string]: string }
      sportsView: SportsView
      sportsCheckedAt: number
      handoff: 'idle' | 'armed' | 'sent' | 'dismissed'
      sketchesToClear: { path: string; at: number }[]
      weather: WeatherPlan
      forecast: Forecast | null
      weatherView: WeatherView
      commandStats: CommandStats
      commandsView: CommandsView
      hiddenCommands: string[]
      hiddenPlan: HiddenPlan
      pulse: number
      agentBank: Blueprint[]
      agentDesk: AgentDesk
      lastAnswer: string
      summary: Summary
      barNote: string | null
      toolRules: ToolRules
      toolsView: ToolsView
      opinion: Opinion
      recipes: Recipe[]
      recipesView: RecipesView
      watches: Watch[]
      watchLog: WatchEntry[]
      watchView: WatchView
      savedWatches: SavedWatch[]
      capLiftedUntil: number | null
      notes: SessionNote[]
      receivedNotes: SessionNote[]
      pendingNotes: SessionNote[]
      notesView: NotesView
      sessionFolder: string
      hasBooted: boolean
    }
  }
}
