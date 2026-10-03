export type WindowKind = 'five_hour' | 'seven_day'

export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

export type PaletteSlot = 'accent' | 'clawd' | 'background'

export type Palette = { accent: string; clawd: string; background: string | null }

export type HomeTab = 'home' | 'more'

export type BarItemId = 'home' | 'meter' | 'summary' | 'context' | 'receipt'

export type BarZone = 'left' | 'center' | 'right'

export type BarSpot = { isShown: boolean; row: number; zone: BarZone }

export type BarLayout = {
  home: BarSpot
  meter: BarSpot
  summary: BarSpot
  context: BarSpot
  receipt: BarSpot
}

export type Shortcut = { id: string; label: string; text: string; spot: BarSpot }

export type Summary = {
  status: 'idle' | 'working' | 'ready' | 'failed'
  text: string
  sourceChars: number
}

export type Prefs = {
  isEnabled: boolean
  window: WindowKind
  bar: BarLayout
  barCount: number
  shortcuts: Shortcut[]
  autoSummary: boolean
  palette: Palette
  previousTheme: string | null
}

export type Receipt = {
  seconds: number
  inputTokens: number
  outputTokens: number
  usageDelta: number | null
}

export type ColorsView = { slot: PaletteSlot; note: string | null }

export type CommandStat = { count: number; lastAt: number }

export type CommandStats = { [name: string]: CommandStat }

export type CommandsView = { filter: string; note: string | null; open: string[] }

export type AgentModel = 'haiku' | 'sonnet' | 'opus' | 'inherit'

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
      prefs: Prefs
      contextPercent: number | null
      lastReplyAt: number | null
      now: number
      receipt: Receipt | null
      tab: HomeTab
      colorsView: ColorsView
      commandStats: CommandStats
      commandsView: CommandsView
      hiddenCommands: string[]
      pulse: number
      agentBank: Blueprint[]
      agentDesk: AgentDesk
      lastAnswer: string
      summary: Summary
      barNote: string | null
    }
  }
}
