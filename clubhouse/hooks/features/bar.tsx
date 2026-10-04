import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { BarSpot, Prefs } from '../../types'
import {
  BAR_ITEMS,
  DEFAULT_BAR,
  DEFAULT_PREFS,
  MAX_BARS,
  MAX_SHORTCUTS,
  PREFS_KEY,
  PREFS_SHAPE,
  SHORTCUT_SPOT,
  ZONE_LABEL,
  nextZone,
  withBarCount,
} from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  ITEM_SIZE,
  READY_LAYOUTS,
  ROW_CAPACITY,
  TOOLBAR_PRESETS_KEY,
  arranged,
  layoutOf,
  presetFrom,
  rowLoad,
  shortcutSize,
  withReadyLayout,
  withSpot,
  withToolbarPreset,
} from '../lib/toolbar'
import type { ItemKey, ReadyLayout } from '../lib/toolbar'
import { forStore } from '../lib/project'

const barNote = atom({ plugin: 'clubhouse', key: 'barNote' } as const, null)
const toolbarPresets = atom({ plugin: 'clubhouse', key: 'toolbarPresets' } as const, [])
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const sharedPalette = atom({ plugin: 'clubhouse', key: 'sharedPalette' } as const, null)

type ShortcutDraft = { label: string; text: string }

const BLANK_SHORTCUT: ShortcutDraft = { label: '', text: '' }

let draft: ShortcutDraft = BLANK_SHORTCUT

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, forStore(await read($, prefs), await read($, sharedPalette)))
}

async function arrange($: EngineInterface, key: ItemKey, wish: 'toggle' | 'row'): Promise<void> {
  const outcome = arranged(await read($, prefs), key, wish)
  await keep($, () => outcome.prefs)
  await update($, barNote, () => outcome.note)
}

async function useReady($: EngineInterface, layout: ReadyLayout): Promise<void> {
  const hadOwn = (await read($, prefs)).shortcuts.some(one => one.spot.isShown)
  await keep($, held => withReadyLayout(held, layout))
  await update(
    $,
    barNote,
    () => `The toolbar is now "${layout.name}".${hadOwn ? ' Your own buttons are off the toolbar, not deleted: add them back below.' : ''}`,
  )
}

async function saveLayout($: EngineInterface, typed: string): Promise<void> {
  if (typed.trim() === '') {
    await update($, barNote, () => 'Type a name for the layout, then press Save this layout.')

    return
  }

  const made = presetFrom(typed, await read($, prefs))
  await update($, toolbarPresets, held => withToolbarPreset(held, made))
  await $.store.set(TOOLBAR_PRESETS_KEY, await read($, toolbarPresets))
  await update($, barNote, () => `Saved this layout as "${made.name}".`)
}

async function dropLayout($: EngineInterface, name: string): Promise<void> {
  await update($, toolbarPresets, held => held.filter(one => one.name !== name))
  await $.store.set(TOOLBAR_PRESETS_KEY, await read($, toolbarPresets))
  await update($, barNote, () => `Deleted the layout "${name}".`)
}

async function addShortcut($: EngineInterface): Promise<void> {
  const label = draft.label.trim()
  const text = draft.text.trim()
  const { shortcuts } = await read($, prefs)

  if (label === '' || text === '') {
    await update($, barNote, () => 'A button needs a label and the text it types. Press Enter in each box, then Add.')

    return
  }

  if (shortcuts.length >= MAX_SHORTCUTS) {
    await update($, barNote, () => `The toolbar holds up to ${MAX_SHORTCUTS} of your own buttons. Remove one first.`)

    return
  }

  const id = `s${(await $.clock.now()).toString(36)}`
  const held = await read($, prefs)
  const outcome = arranged(
    { ...held, shortcuts: [...held.shortcuts, { id, label, text, spot: { ...SHORTCUT_SPOT, isShown: false } }] },
    { kind: 'shortcut', id },
    'toggle',
  )
  await keep($, () => outcome.prefs)
  draft = BLANK_SHORTCUT
  await update($, barNote, () => outcome.note ?? `"${label}" is on the toolbar.`)
}

export function bar(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-bar' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const said = await read($, barNote)
    const { card, frame, note, plain, title, Button, Input } = makeParts(elements, chosen, e.surface)
    const hasBars = chosen.barCount > 1

    const kept = await read($, toolbarPresets)
    const controls = (prefix: string, spot: BarSpot, key: ItemKey) => [
      <Button
        key={`${prefix}-show`}
        label={spot.isShown ? 'On the toolbar' : 'Add to toolbar'}
        variant={spot.isShown ? 'primary' : 'secondary'}
        onPress={() => void arrange($, key, 'toggle')}
      />,
      hasBars && <Button key={`${prefix}-row`} label={`Row ${spot.row}`} onPress={() => void arrange($, key, 'row')} />,
      <Button
        key={`${prefix}-zone`}
        label={ZONE_LABEL[spot.zone]}
        onPress={() => void keep($, held => withSpot(held, key, { ...spot, zone: nextZone(spot.zone) }))}
      />,
    ]
    const rows = Array.from({ length: chosen.barCount }, (_, index) => index + 1)

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Toolbar')}
        {note(
          'The toolbar is the strip above the box you type in. Each item has buttons to add or remove it, pick its row, and place it left, center or right. /clubhouse toolbar opens this.',
        )}

        {card('Rows', [
          plain(rows.map(row => `Row ${row}: ${rowLoad(chosen, row)} of ${ROW_CAPACITY} used`).join(' · ')),
          note(
            `Every item has a size, and a row holds ${ROW_CAPACITY}, so nothing overlaps: a few big items or many small ones. When a row is full, the next item goes on another row. You can have up to ${MAX_BARS} rows; row 1 is on top.`,
          ),
          <Box gap={1}>
            {chosen.barCount < MAX_BARS && (
              <Button
                key="bar-add"
                label="Add a row"
                variant="primary"
                onPress={() => void keep($, held => withBarCount(held, held.barCount + 1))}
              />
            )}
            {hasBars && (
              <Button
                key="bar-remove"
                label={`Remove row ${chosen.barCount}`}
                onPress={() => void keep($, held => withBarCount(held, held.barCount - 1))}
              />
            )}
          </Box>,
          note('A row only shows once something is placed on it.'),
        ])}

        {card('Ready-made layouts', [
          note(
            'One press sets the whole toolbar. It replaces what is on the toolbar now, so save your own layout first (Saved layouts, at the bottom) if you want it back.',
          ),
          <Box flexDirection="column" gap={1}>
            {READY_LAYOUTS.map(one => (
              <Box flexDirection="column">
                <Box>
                  <Button key={`ready-${one.name}`} label={one.name} onPress={() => void useReady($, one)} />
                </Box>
                {note(one.about)}
              </Box>
            ))}
          </Box>,
        ])}

        {BAR_ITEMS.map(([id, title, about]) =>
          card(title, [
            note(`${about} Size ${ITEM_SIZE[id]}.`),
            <Box gap={1} flexWrap="wrap">
              {controls(`bar-${id}`, chosen.bar[id] ?? DEFAULT_BAR[id], { kind: 'item', id })}
            </Box>,
          ]),
        )}

        {chosen.shortcuts.map(one =>
          card(`Your button: ${one.label}`, [
            note(`Types: ${one.text} Size ${shortcutSize(one)}.`),
            <Box gap={1} flexWrap="wrap">
              {controls(`sc-${one.id}`, one.spot, { kind: 'shortcut', id: one.id })}
              <Button
                key={`sc-${one.id}-remove`}
                label="Delete"
                onPress={() =>
                  void keep($, held => ({
                    ...held,
                    shortcuts: held.shortcuts.filter(other => other.id !== one.id),
                  }))
                }
              />
            </Box>,
          ]),
        )}

        {Input !== null &&
          card('Make your own button', [
            note('A button that types a prompt or command into the prompt box for you. Press Enter in each box, then Add.'),
            <Input
              key="shortcut-label"
              label="Label"
              placeholder="Run tests"
              onInput={typed => {
                draft = { ...draft, label: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, label: typed }
              }}
            />,
            <Input
              key="shortcut-text"
              label="What it types"
              placeholder="run the tests and fix what fails"
              onInput={typed => {
                draft = { ...draft, text: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, text: typed }
              }}
            />,
            <Box>
              <Button key="shortcut-add" label="Add to toolbar" variant="primary" onPress={() => void addShortcut($)} />
            </Box>,
          ])}

        {said !== null && plain(said)}

        {card('Saved layouts', [
          note('Keep the toolbar as it is now under a name, and switch back to it with one press. Example: one for work, one for game day.'),
          Input !== null && (
            <Input
              key="layout-name"
              label="Name"
              placeholder="Game day"
              submitLabel="Save this layout"
              onSubmit={typed => void saveLayout($, typed)}
            />
          ),
          ...kept.map(one => (
            <Box gap={1} flexWrap="wrap">
              <Button
                key={`layout-${one.name}`}
                label={`Use ${one.name}`}
                variant="primary"
                onPress={() => void keep($, held => ({ ...held, ...layoutOf(one) }))}
              />
              <Button key={`layout-delete-${one.name}`} label="Delete" onPress={() => void dropLayout($, one.name)} />
            </Box>
          )),
        ])}

        <Box>
          <Button
            key="bar-reset"
            label="Reset the toolbar"
            onPress={() => void keep($, held => ({ ...held, bar: DEFAULT_BAR, barCount: 1, shortcuts: [] }))}
          />
        </Box>
        {note('New toolbar features built later show up here as items you can add.')}
      </Box>
    )
  })
}
