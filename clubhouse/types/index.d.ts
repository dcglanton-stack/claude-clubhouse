export type WindowKind = 'five_hour' | 'seven_day'

export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

export type PaletteSlot = 'accent' | 'clawd' | 'background'

export type Palette = { accent: string; clawd: string; background: string | null }

export type HomeTab = 'home' | 'bar' | 'more'

export type BarItemId = 'home' | 'meter' | 'context' | 'receipt'

export type BarZone = 'left' | 'center' | 'right'

export type BarSpot = { isShown: boolean; row: number; zone: BarZone }

export type BarLayout = { home: BarSpot; meter: BarSpot; context: BarSpot; receipt: BarSpot }

export type Prefs = {
  isEnabled: boolean
  window: WindowKind
  bar: BarLayout
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

export type CommandsView = { filter: string; note: string | null }

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
      pulse: number
      agentBank: Blueprint[]
      agentDesk: AgentDesk
    }
  }
}
