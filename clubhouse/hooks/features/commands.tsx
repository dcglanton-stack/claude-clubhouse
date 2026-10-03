import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'
import { inkOn } from '../lib/color'
import {
  COMMANDS_KEY,
  DEFAULT_COMMANDS_VIEW,
  DEFAULT_PREFS,
  HOME_PANE,
  PREFS_KEY,
  ROOMS,
  topCommands,
} from '../lib/defaults'

const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const commandsView = atom({ plugin: 'clubhouse', key: 'commandsView' } as const, DEFAULT_COMMANDS_VIEW)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)

const TOP_SIZE = 5
const LIST_SIZE = 60

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function count($: EngineInterface, name: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, commandStats, stats => ({
      ...stats,
      [name]: { count: (stats[name]?.count ?? 0) + 1, lastAt: at },
    }))
    await $.store.set(COMMANDS_KEY, await read($, commandStats))
  } catch {
    return
  }
}

async function offer($: EngineInterface, name: string): Promise<void> {
  try {
    const { isFilled } = await $.prompt.fill({ text: `/${name} ` })
    await update($, commandsView, view => ({
      ...view,
      note: isFilled
        ? `/${name} is in the prompt box. Press Enter to run it.`
        : `The prompt box is busy. Type /${name} yourself.`,
    }))
  } catch (error) {
    const why = error instanceof Error ? error.message : 'unknown error'
    await update($, commandsView, view => ({
      ...view,
      note: `Could not fill the prompt box (${why}). Type /${name} yourself.`,
    }))
  }
}

async function visit($: EngineInterface, id: string, title: string): Promise<void> {
  await $.ui.open({ id, title, focus: true, closeOnEscape: true })
  await update($, pulse, beat => beat + 1)
}

export function commands(on: On): void {
  on('command.run', async ($, e, next) => {
    await count($, e.command)

    if (e.command !== 'clubhouse') {
      return next(e)
    }

    const wish = e.args.trim().toLowerCase()

    if (wish === 'on' || wish === 'off') {
      await keep($, held => ({ ...held, isEnabled: wish === 'on' }))

      return {
        text:
          wish === 'on'
            ? 'Clubhouse is on.'
            : 'Clubhouse is off. Type /clubhouse on to bring it back.',
      }
    }

    const room = ROOMS.find(one => one.word === wish || (wish === 'hq' && one.word === 'agents'))

    if (room !== undefined) {
      await visit($, room.id, room.title)

      return { text: `${room.title} opened.` }
    }

    await visit($, HOME_PANE, 'Clubhouse')

    return { text: 'Clubhouse opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-commands' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const chosen = await read($, prefs)
    const stats = await read($, commandStats)
    const view = await read($, commandsView)
    const all = await $.command.list()
    const wanted = view.filter.trim().toLowerCase().replace(/^\//, '')
    const matching = all.filter(
      one =>
        wanted === '' ||
        one.name.toLowerCase().includes(wanted) ||
        one.description.toLowerCase().includes(wanted),
    )
    const { accent, background } = chosen.palette
    const ink = background === null ? {} : { color: inkOn(background) }
    const frame = background === null ? {} : { backgroundColor: background, padding: 1 }

    const heading = (title: string) => (
      <Text bold color={accent}>
        {title}
      </Text>
    )
    const note = (text: string) => (
      <Text {...ink} dimColor wrap="wrap">
        {text}
      </Text>
    )
    const setFilter = (typed: string) =>
      void update($, commandsView, held => ({ ...held, filter: typed }))

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {note(
          'Everything you can type after a slash. Click one to put it in the prompt box, then press Enter. /clubhouse commands opens this.',
        )}

        {heading('Most used and most recent')}
        <Box gap={1} flexWrap="wrap">
          {topCommands(stats, TOP_SIZE).map(name => (
            <Button key={`top-${name}`} label={`/${name}`} onPress={() => void offer($, name)} />
          ))}
        </Box>
        {view.note !== null && (
          <Text {...ink} wrap="wrap">
            {view.note}
          </Text>
        )}

        {heading(wanted === '' ? `All commands (${all.length})` : `Matching "${wanted}" (${matching.length})`)}
        {'Input' in elements && (
          <elements.Input
            key="filter"
            label="Find"
            placeholder="part of a name or what it does"
            submitLabel="Find"
            onInput={setFilter}
            onSubmit={setFilter}
          />
        )}
        {matching.slice(0, LIST_SIZE).map(one => (
          <Box flexDirection="column">
            <Box>
              <Button
                key={`run-${one.name}`}
                label={`/${one.name}`}
                onPress={() => void offer($, one.name)}
              />
            </Box>
            {one.description !== '' && (
              <Text {...ink} dimColor wrap="truncate">
                {one.description}
              </Text>
            )}
          </Box>
        ))}
        {matching.length > LIST_SIZE &&
          note(`${matching.length - LIST_SIZE} more. Type in Find to narrow the list.`)}
      </Box>
    )
  })
}
