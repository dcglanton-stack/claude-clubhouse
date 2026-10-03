export type WindowKind = 'five_hour' | 'seven_day'

export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

export type PaletteSlot = 'accent' | 'clawd' | 'background'

export type Palette = { accent: string; clawd: string; background: string | null }

export type HubTab = 'home' | 'next'

export type Prefs = {
  isEnabled: boolean
  window: WindowKind
  showMeter: boolean
  showContext: boolean
  showReceipt: boolean
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

declare module 'claude-code' {
  interface PluginState {
    hub: {
      limits: Limit[]
      prefs: Prefs
      contextPercent: number | null
      lastReplyAt: number | null
      now: number
      receipt: Receipt | null
      tab: HubTab
      colorsView: ColorsView
    }
  }
}
