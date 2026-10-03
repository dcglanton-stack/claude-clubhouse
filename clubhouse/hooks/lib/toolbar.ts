import type { BarItemId, BarLayout, BarSpot, Prefs, Shortcut, ToolbarPreset } from '../../types'

export type ItemKey = { kind: 'item'; id: BarItemId } | { kind: 'shortcut'; id: string }

export type Arranged = { prefs: Prefs; note: string | null }

export const MAX_ROWS = 4
export const ROW_CAPACITY = 14
export const TOOLBAR_PRESETS_KEY = 'toolbarPresets'
export const MAX_TOOLBAR_PRESETS = 8
export const ITEM_SIZE: Record<BarItemId, number> = {
  home: 2,
  meter: 6,
  summary: 2,
  tidy: 1,
  cache: 2,
  context: 3,
  receipt: 8,
  ticker: 4,
  sports: 5,
  draw: 2,
  weather: 3,
  agi: 2,
}

const LETTERS_PER_UNIT = 8
const LARGEST_SHORTCUT = 3
const PRESET_NAME_CHARS = 24

export function shortcutSize(one: Pick<Shortcut, 'label'>): number {
  return Math.min(LARGEST_SHORTCUT, 1 + Math.floor(one.label.length / LETTERS_PER_UNIT))
}

export function sizeOf(prefs: Prefs, key: ItemKey): number {
  if (key.kind === 'item') return ITEM_SIZE[key.id]
  const found = prefs.shortcuts.find(one => one.id === key.id)

  return found === undefined ? 1 : shortcutSize(found)
}

export function spotOf(prefs: Prefs, key: ItemKey): BarSpot | undefined {
  return key.kind === 'item' ? prefs.bar[key.id] : prefs.shortcuts.find(one => one.id === key.id)?.spot
}

export function rowLoad(prefs: Prefs, row: number, except?: ItemKey): number {
  const isCounted = (key: ItemKey, spot: BarSpot | undefined) =>
    spot !== undefined &&
    spot.isShown &&
    spot.row === row &&
    !(except !== undefined && except.kind === key.kind && except.id === key.id)
  const items = (Object.keys(ITEM_SIZE) as BarItemId[])
    .filter(id => isCounted({ kind: 'item', id }, prefs.bar[id]))
    .reduce((total, id) => total + ITEM_SIZE[id], 0)
  const own = prefs.shortcuts
    .filter(one => isCounted({ kind: 'shortcut', id: one.id }, one.spot))
    .reduce((total, one) => total + shortcutSize(one), 0)

  return items + own
}

export function withSpot(prefs: Prefs, key: ItemKey, spot: BarSpot): Prefs {
  return key.kind === 'item'
    ? { ...prefs, bar: { ...prefs.bar, [key.id]: spot } }
    : { ...prefs, shortcuts: prefs.shortcuts.map(one => (one.id === key.id ? { ...one, spot } : one)) }
}

function roomyRow(prefs: Prefs, key: ItemKey, rows: readonly number[]): number | undefined {
  const size = sizeOf(prefs, key)

  return rows.find(row => rowLoad(prefs, row, key) + size <= ROW_CAPACITY)
}

export function arranged(prefs: Prefs, key: ItemKey, wish: 'toggle' | 'row'): Arranged {
  const spot = spotOf(prefs, key)

  if (spot === undefined) return { prefs, note: null }
  const rows = Array.from({ length: prefs.barCount }, (_, index) => index + 1)
  const after = [...rows.filter(row => row > spot.row), ...rows.filter(row => row < spot.row)]

  if (wish === 'row') {
    const next = spot.isShown ? roomyRow(prefs, key, after) : after[0]

    return next === undefined
      ? { prefs, note: 'No other row has room for it. Remove something from a row, or add a row.' }
      : { prefs: withSpot(prefs, key, { ...spot, row: next }), note: null }
  }

  if (spot.isShown) return { prefs: withSpot(prefs, key, { ...spot, isShown: false }), note: null }
  const fits = roomyRow(prefs, key, [spot.row, ...after])

  if (fits !== undefined) {
    return {
      prefs: withSpot(prefs, key, { ...spot, isShown: true, row: fits }),
      note: fits === spot.row ? null : `Row ${spot.row} is full, so it went on row ${fits}.`,
    }
  }

  if (prefs.barCount >= MAX_ROWS) {
    return { prefs, note: `All ${MAX_ROWS} rows are full. Remove something from the toolbar first.` }
  }

  const added = prefs.barCount + 1

  return {
    prefs: withSpot({ ...prefs, barCount: added }, key, { ...spot, isShown: true, row: added }),
    note: `Every row was full, so a new row ${added} was added for it.`,
  }
}

export function presetFrom(name: string, prefs: Prefs): ToolbarPreset {
  return {
    name: name.trim().slice(0, PRESET_NAME_CHARS),
    bar: prefs.bar,
    barCount: prefs.barCount,
    shortcuts: prefs.shortcuts,
  }
}

export function withToolbarPreset(held: readonly ToolbarPreset[], preset: ToolbarPreset): ToolbarPreset[] {
  return [preset, ...held.filter(one => one.name !== preset.name)].slice(0, MAX_TOOLBAR_PRESETS)
}

export function layoutOf(preset: ToolbarPreset): { bar: BarLayout; barCount: number; shortcuts: Shortcut[] } {
  return { bar: preset.bar, barCount: preset.barCount, shortcuts: preset.shortcuts }
}
