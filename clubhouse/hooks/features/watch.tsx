import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Watch, WatchView } from '../../types'
import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'
import { formatSpan } from '../lib/format'
import { makeParts } from '../lib/parts'
import { blanksOf } from '../lib/recipes'
import {
  CHECK_COUNTS,
  DEFAULT_WATCH_VIEW,
  INTERVALS,
  LOW_USAGE_PERCENT,
  TRIGGERS,
  TRIGGER_LABEL,
  WAKES_BEFORE_STOPPING,
  aboutOf,
  nextOf,
  statusOf,
  titleOf,
  watchFrom,
  watchProblem,
  withEntry,
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

const BLANK_DRAFT: WatchDraft = { task: '', command: '' }
const MINUTE_MS = 60_000

let draft: WatchDraft = BLANK_DRAFT

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, watchView, view => ({ ...view, note }))
}

async function start($: EngineInterface): Promise<void> {
  const problem = watchProblem(draft, await read($, watches))

  if (problem !== null) {
    await say($, problem)

    return
  }

  const at = await $.clock.now()
  const made = watchFrom(draft, await read($, watchView), at)
  draft = BLANK_DRAFT
  await update($, watches, held => [...held, made])
  await update($, watchLog, held => withEntry(held, { at, text: `Started · ${titleOf(made)}` }))
  await say($, `Watching. The first check is in ${made.everyMinutes} minutes.`)
}

async function stop($: EngineInterface, watch: Watch): Promise<void> {
  const at = await $.clock.now()
  await update($, watches, held => held.filter(one => one.id !== watch.id))
  await update($, watchLog, held => withEntry(held, { at, text: `Stopped · ${titleOf(watch)}` }))
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
            <Box>
              <Button key="watch-start" label="Start watch" variant="primary" onPress={() => void start($)} />
            </Box>,
          ])

    const running = (one: Watch) =>
      card(titleOf(one), [
        one.task === '' ? null : plain(one.task),
        note(aboutOf(one)),
        plain(statusOf(one, at)),
        <Box gap={1} flexWrap="wrap">
          <Button key={`watch-now-${one.id}`} label="Check now" onPress={() => void checkNow($, one.id)} />
          <Button key={`watch-stop-${one.id}`} label="Stop" onPress={() => void stop($, one)} />
        </Box>,
      ])

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Night watch')}
        {note(
          'Checks on things while you are away. Every so often it wakes Claude with your instruction, or runs a command first and only wakes Claude when something is wrong. /clubhouse watch opens this.',
        )}
        {form}
        {view.note !== null && plain(view.note)}
        {held.map(running)}
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
