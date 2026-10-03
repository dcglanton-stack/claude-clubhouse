import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { BarItemId, BarSpot, Prefs } from '../../types'
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

const barNote = atom({ plugin: 'clubhouse', key: 'barNote' } as const, null)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})

type ShortcutDraft = { label: string; text: string }

const BLANK_SHORTCUT: ShortcutDraft = { label: '', text: '' }

let draft: ShortcutDraft = BLANK_SHORTCUT

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
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
  await keep($, held => ({
    ...held,
    shortcuts: [...held.shortcuts, { id, label, text, spot: SHORTCUT_SPOT }],
  }))
  draft = BLANK_SHORTCUT
  await update($, barNote, () => `"${label}" is on the toolbar.`)
}

export function bar(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-bar' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const said = await read($, barNote)
    const { card, frame, note, plain, title, Button, Input } = makeParts(elements, chosen, e.surface)
    const hasBars = chosen.barCount > 1

    const moveItem = (id: BarItemId, change: (spot: BarSpot) => BarSpot) =>
      void keep($, held => ({ ...held, bar: { ...held.bar, [id]: change(held.bar[id]) } }))
    const moveShortcut = (id: string, change: (spot: BarSpot) => BarSpot) =>
      void keep($, held => ({
        ...held,
        shortcuts: held.shortcuts.map(one => (one.id === id ? { ...one, spot: change(one.spot) } : one)),
      }))
    const controls = (prefix: string, spot: BarSpot, move: (change: (held: BarSpot) => BarSpot) => void) => [
      <Button
        key={`${prefix}-show`}
        label={spot.isShown ? 'On the toolbar' : 'Add to toolbar'}
        variant={spot.isShown ? 'primary' : 'secondary'}
        onPress={() => move(held => ({ ...held, isShown: !held.isShown }))}
      />,
      hasBars && (
        <Button
          key={`${prefix}-row`}
          label={`Row ${spot.row}`}
          onPress={() => move(held => ({ ...held, row: (held.row % chosen.barCount) + 1 }))}
        />
      ),
      <Button
        key={`${prefix}-zone`}
        label={ZONE_LABEL[spot.zone]}
        onPress={() => move(held => ({ ...held, zone: nextZone(held.zone) }))}
      />,
    ]

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Toolbar')}
        {note(
          'The toolbar is the strip above the box you type in. Each item has buttons to add or remove it, pick its row, and place it left, center or right. /clubhouse toolbar opens this.',
        )}

        {card('Bars', [
          plain(chosen.barCount === 1 ? 'You have 1 bar.' : `You have ${chosen.barCount} bars. Bar 1 is on top.`),
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
                label={`Remove bar ${chosen.barCount}`}
                onPress={() => void keep($, held => withBarCount(held, held.barCount - 1))}
              />
            )}
          </Box>,
          note('A row only shows once something is placed on it.'),
        ])}

        {BAR_ITEMS.map(([id, title, about]) =>
          card(title, [
            note(about),
            <Box gap={1} flexWrap="wrap">
              {controls(`bar-${id}`, chosen.bar[id], change => moveItem(id, change))}
            </Box>,
          ]),
        )}

        {chosen.shortcuts.map(one =>
          card(`Your button: ${one.label}`, [
            note(`Types: ${one.text}`),
            <Box gap={1} flexWrap="wrap">
              {controls(`sc-${one.id}`, one.spot, change => moveShortcut(one.id, change))}
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
