import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { SessionNote } from '../../types'
import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  DEFAULT_NOTES_VIEW,
  NOTES_KEY,
  aboutNote,
  asNotes,
  contextOf,
  folderName,
  noteFrom,
  noteProblem,
} from '../lib/notes'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const notes = atom({ plugin: 'clubhouse', key: 'notes' } as const, [])
const receivedNotes = atom({ plugin: 'clubhouse', key: 'receivedNotes' } as const, [])
const notesView = atom({ plugin: 'clubhouse', key: 'notesView' } as const, DEFAULT_NOTES_VIEW)
const sessionFolder = atom({ plugin: 'clubhouse', key: 'sessionFolder' } as const, '')

let draft = ''

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, notesView, view => ({ ...view, note }))
}

async function keep($: EngineInterface, change: (held: SessionNote[]) => SessionNote[], note: string): Promise<void> {
  const listed = change(asNotes(await $.store.get(NOTES_KEY)))
  await $.store.set(NOTES_KEY, listed)
  await update($, notes, () => listed)
  await say($, note)
}

async function save($: EngineInterface): Promise<void> {
  const problem = noteProblem(draft, await read($, notes))

  if (problem !== null) {
    await say($, problem)

    return
  }

  const made = noteFrom(draft, await read($, notesView), await read($, sessionFolder), await $.clock.now())
  draft = ''
  await keep($, held => [...held, made], `Saved. ${aboutNote(made)} Sessions already running will not see it.`)
}

async function showNow($: EngineInterface, shown: SessionNote): Promise<void> {
  const isTold = await $.session
    .append({ message: { type: 'user', content: [{ type: 'text', text: contextOf([shown]) }] } })
    .then(
      () => true,
      () => false,
    )

  if (!isTold) {
    await say($, 'Could not hand the note to Claude in this session.')

    return
  }

  await update($, receivedNotes, held => [...held, shown])
  await keep(
    $,
    held => held.filter(one => one.id !== shown.id || one.keep === 'always'),
    'Claude in this session has the note now, and reads it with your next message.',
  )
}

export function notesRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-notes' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const view = await read($, notesView)
    const waiting = await read($, notes)
    const received = await read($, receivedNotes)
    const folder = await read($, sessionFolder)
    const { frame, note, plain, title, card, Button, Input } = makeParts(elements, chosen, e.surface)

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Session notes')}
        {note(
          'Leave a note for a later session, so you do not have to explain where you left off. Example: "Pick up at the Stripe webhook; the two red tests are expected." /clubhouse notes opens this.',
        )}
        {Input === null
          ? card('New note', [note('Writing a note needs a text box, which this screen does not have.')])
          : card('New note', [
              note('Press Enter in the box to set it, then Save note.'),
              <Input
                key="note-text"
                label="Note"
                placeholder="Where to pick up next time"
                value={draft}
                onInput={typed => {
                  draft = typed
                }}
                onSubmit={typed => {
                  draft = typed
                }}
              />,
              <Box gap={1} flexWrap="wrap">
                <Button
                  key="note-where"
                  label={view.where === 'folder' ? `For: sessions in ${folderName(folder)}` : 'For: sessions in any folder'}
                  onPress={() =>
                    void update($, notesView, shown => ({ ...shown, where: shown.where === 'folder' ? 'anywhere' : 'folder' }))
                  }
                />
                <Button
                  key="note-keep"
                  label={view.keep === 'once' ? 'Shown once' : 'Shown to every new session'}
                  onPress={() =>
                    void update($, notesView, shown => ({ ...shown, keep: shown.keep === 'once' ? 'always' : 'once' }))
                  }
                />
              </Box>,
              <Box>
                <Button key="note-save" label="Save note" variant="primary" onPress={() => void save($)} />
              </Box>,
            ])}
        {view.note !== null && plain(view.note)}
        {waiting.length > 0 &&
          card(
            'Waiting',
            waiting.map(one => (
              <Box flexDirection="column">
                {plain(one.text)}
                {note(aboutNote(one))}
                <Box gap={1} flexWrap="wrap">
                  <Button key={`note-now-${one.id}`} label="Give to this session" onPress={() => void showNow($, one)} />
                  <Button
                    key={`note-delete-${one.id}`}
                    label="Delete"
                    onPress={() => void keep($, held => held.filter(other => other.id !== one.id), 'Deleted the note.')}
                  />
                </Box>
              </Box>
            )),
          )}
        {received.length > 0 &&
          card(
            'This session was given',
            received.map(one => plain(one.text)),
          )}
        {note(
          'Who reads a note: only a session that starts after you save it. Sessions already running never pick one up on their own, so two open sessions cannot both grab it. A once-note goes to the first new session that fits and is then gone; "Give to this session" hands one to the session you are in.',
        )}
      </Box>
    )
  })
}
