import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { SavedWatch, Watch, WatchView } from '../../types'
import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'
import { formatSpan } from '../lib/format'
import { makeParts } from '../lib/parts'
import { blanksOf } from '../lib/recipes'
import {
  CHECK_COUNTS,
  DEFAULT_WATCH_VIEW,
  INTERVALS,
  LOW_USAGE_PERCENT,
  SAVED_WATCHES_KEY,
  TRIGGERS,
  TRIGGER_LABEL,
  WAKES_BEFORE_STOPPING,
  aboutOf,
  nextOf,
  savedFrom,
  statusOf,
  titleOf,
  watchFrom,
  watchProblem,
  withEntry,
  withSaved,
} from '../lib/watch'
import type { WatchDraft } from '../lib/watch'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const recipes = atom({ plugin: 'clubhouse', key: 'recipes' } as const, [])
const watches = atom({ plugin: 'clubhouse', key: 'watches' } as const, [])
const watchLog = atom({ plugin: 'clubhouse', key: 'watchLog' } as const, [])
const watchView = atom({ plugin: 'clubhouse', key: 'watchView' } as const, DEFAULT_WATCH_VIEW)
const savedWatches = atom({ plugin: 'clubhouse', key: 'savedWatches' } as const, [])

const BLANK_DRAFT: WatchDraft = { name: '', task: '', command: '' }
const MINUTE_MS = 60_000

let draft: WatchDraft = BLANK_DRAFT

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, watchView, view => ({ ...view, note }))
}

async function begin($: EngineInterface, from: SavedWatch): Promise<boolean> {
  const problem = watchProblem(from, await read($, watches))

  if (problem !== null) {
    await say($, problem)

    return false
  }

  const at = await $.clock.now()
  const made = watchFrom(from, from, at)
  await update($, watches, held => [...held, made])
  await update($, watchLog, held => withEntry(held, { at, text: `Started · ${titleOf(made)}` }))
  await say(
    $,
    `Watching. The first check is in ${made.everyMinutes} minutes. On the watch below, Check now tests it straight away and End watch cancels it.`,
  )

  return true
}

async function start($: EngineInterface): Promise<void> {
  const typed = draft

  if (await begin($, { ...savedFrom(typed, await read($, watchView)), name: typed.name })) {
    draft = BLANK_DRAFT
  }
}

async function save($: EngineInterface): Promise<void> {
  const problem = watchProblem(draft, [])

  if (problem !== null) {
    await say($, problem)

    return
  }

  const kept = savedFrom(draft, await read($, watchView))
  await update($, savedWatches, held => withSaved(held, kept))
  await $.store.set(SAVED_WATCHES_KEY, await read($, savedWatches))
  await say($, `Saved "${kept.name}". Start it from Saved watches whenever you want, in any session.`)
}

async function forget($: EngineInterface, name: string): Promise<void> {
  await update($, savedWatches, held => held.filter(one => one.name !== name))
  await $.store.set(SAVED_WATCHES_KEY, await read($, savedWatches))
  await say($, `Deleted the saved watch "${name}".`)
}

async function stop($: EngineInterface, watch: Watch): Promise<void> {
  const at = await $.clock.now()
  await update($, watches, held => held.filter(one => one.id !== watch.id))
  await update($, watchLog, held => withEntry(held, { at, text: `Ended · ${titleOf(watch)}` }))
  await say($, `Ended the watch "${titleOf(watch)}".`)
}

async function checkNow($: EngineInterface, id: string): Promise<void> {
  await update($, watches, held => held.map(one => (one.id === id ? { ...one, nextAt: 0 } : one)))
  await say($, 'Checking in the next few seconds.')
}

export function nightWatch(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-watch' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const view = await read($, watchView)
    const held = await read($, watches)
    const log = await read($, watchLog)
    const kept = await read($, savedWatches)
    const at = await read($, now)
    const ready = (await read($, recipes)).filter(one => blanksOf(one.command).length === 0)
    const { frame, note, plain, title, card, Button, Input } = makeParts(elements, chosen, e.surface)
    const choose = (change: (shown: WatchView) => WatchView) => void update($, watchView, change)
    const ago = (then: number) => (at - then < MINUTE_MS ? 'just now' : `${formatSpan(at - then)} ago`)

    const form =
      Input === null
        ? card('New watch', [
            note('Setting a watch needs a text box, which this screen does not have. Use the desktop app or a terminal.'),
          ])
        : card('New watch', [
            note('Press Enter in each box to set it, then Start.'),
            <Input
              key="watch-name"
              label="Name (optional)"
              placeholder="Server check"
              value={draft.name}
              onInput={typed => {
                draft = { ...draft, name: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, name: typed }
              }}
            />,
            <Input
              key="watch-task"
              label="Tell Claude"
              placeholder="Check the build is still going; restart it if it stopped"
              value={draft.task}
              onInput={typed => {
                draft = { ...draft, task: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, task: typed }
              }}
            />,
            <Input
              key="watch-command"
              label="Check command (optional)"
              placeholder="pgrep -f my-script"
              value={draft.command}
              onInput={typed => {
                draft = { ...draft, command: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, command: typed }
              }}
            />,
            note(
              'With no check command, Claude is woken at every check. With one, the command runs first, which costs nothing, and Claude is only woken when the command says something is wrong.',
            ),
            ready.length === 0 ? null : (
              <Box gap={1} flexWrap="wrap">
                {ready.map(one => (
                  <Button
                    key={`watch-recipe-${one.name}`}
                    label={`Use recipe ${one.name}`}
                    onPress={() => {
                      draft = { ...draft, command: one.command }
                      void say($, `The check command is now your recipe ${one.name}: ${one.command}`)
                    }}
                  />
                ))}
              </Box>
            ),
            <Box gap={1} flexWrap="wrap">
              <Button
                key="watch-every"
                label={`Every ${view.everyMinutes} min`}
                onPress={() => choose(shown => ({ ...shown, everyMinutes: nextOf(INTERVALS, shown.everyMinutes) }))}
              />
              <Button
                key="watch-count"
                label={`${view.maxChecks} checks`}
                onPress={() => choose(shown => ({ ...shown, maxChecks: nextOf(CHECK_COUNTS, shown.maxChecks) }))}
              />
            </Box>,
            note(`That watches for about ${formatSpan(view.everyMinutes * view.maxChecks * MINUTE_MS)}, then stops.`),
            <Box gap={1} flexWrap="wrap">
              <Button
                key="watch-trigger"
                label={`When ${TRIGGER_LABEL[view.trigger]}`}
                onPress={() => choose(shown => ({ ...shown, trigger: nextOf(TRIGGERS, shown.trigger) }))}
              />
              <Button
                key="watch-quiet"
                label={view.isQuiet ? 'Just note it here' : 'Wake Claude'}
                onPress={() => choose(shown => ({ ...shown, isQuiet: !shown.isQuiet }))}
              />
            </Box>,
            note('These two only matter with a check command: what counts as something wrong, and what happens then.'),
            <Box gap={1} flexWrap="wrap">
              <Button key="watch-start" label="Start watch" variant="primary" onPress={() => void start($)} />
              <Button key="watch-save" label="Save for later" onPress={() => void save($)} />
            </Box>,
            note('Save for later keeps this watch, with these settings, to start with one press in any session.'),
          ])

    const savedList =
      kept.length === 0
        ? null
        : card(
            'Saved watches',
            kept.map(one => (
              <Box flexDirection="column">
                <Box gap={1} flexWrap="wrap">
                  <Button
                    key={`watch-saved-start-${one.name}`}
                    label={`Start ${one.name}`}
                    variant="primary"
                    onPress={() => void begin($, one)}
                  />
                  <Button key={`watch-saved-delete-${one.name}`} label="Delete" onPress={() => void forget($, one.name)} />
                </Box>
                {one.task === '' ? null : note(one.task)}
                {note(`${aboutOf(one)} ${one.maxChecks} checks.`)}
              </Box>
            )),
          )

    const running = (one: Watch) =>
      card(`Running: ${titleOf(one)}`, [
        one.task === '' ? null : plain(one.task),
        note(aboutOf(one)),
        plain(statusOf(one, at)),
        <Box gap={1} flexWrap="wrap">
          <Button key={`watch-now-${one.id}`} label="Check now" onPress={() => void checkNow($, one.id)} />
          <Button key={`watch-stop-${one.id}`} label="End watch" onPress={() => void stop($, one)} />
        </Box>,
      ])

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Night watch')}
        {note(
          'Checks on things while you are away. Every so often it wakes Claude with your instruction, or runs a command first and only wakes Claude when something is wrong. /clubhouse watch opens this.',
        )}
        {view.note !== null && plain(view.note)}
        {held.map(running)}
        {savedList}
        {form}
        {log.length > 0 &&
          card(
            'What happened',
            log.map(entry => note(`${ago(entry.at)} · ${entry.text}`)),
          )}
        {note(
          `A watch belongs to this session, so keep the Claude app open and your Mac awake. Waking Claude is a full turn and uses your limit: a watch will not wake Claude when under ${LOW_USAGE_PERCENT}% of your 5-hour limit is left, and one with a check command stops itself after ${WAKES_BEFORE_STOPPING} wake-ups in a row. In a permission mode that asks, Claude waits for you at the first thing that needs approval.`,
        )}
      </Box>
    )
  })
}
