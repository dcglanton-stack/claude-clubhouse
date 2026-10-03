import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { agentStatus, agentSvg } from '../lib/clawd'
import { inkOn } from '../lib/color'
import { DEFAULT_PREFS } from '../lib/defaults'

const agentNote = atom({ plugin: 'clubhouse', key: 'agentNote' } as const, null)
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)

const CARD_UNIT = 5
const HERO_UNIT = 9
const PAST_SHOWN = 8
const CARD_WIDTH = Math.ceil(17.4 * CARD_UNIT)
const CARD_HEIGHT = Math.ceil(12 * CARD_UNIT)
const HERO_WIDTH = Math.ceil(17.4 * HERO_UNIT)
const HERO_HEIGHT = Math.ceil(12 * HERO_UNIT)

const STATUS_WORD: Record<string, string> = {
  running: 'on assignment',
  completed: 'mission complete',
  failed: 'mission failed',
  killed: 'stood down',
}

async function standDown($: EngineInterface, id: string, label: string): Promise<void> {
  try {
    const stopped = await $.tool.call({ tool: 'TaskStop', task_id: id })
    const refusal = stopped.deny ?? (stopped.isError === true ? 'the engine could not stop it' : null)
    await update($, agentNote, () =>
      refusal === null ? `${label} was told to stand down.` : `Could not stop ${label}: ${refusal}`,
    )
  } catch (error) {
    const why = error instanceof Error ? error.message : 'unknown error'
    await update($, agentNote, () => `Could not stop ${label}: ${why}`)
  }

  await update($, pulse, beat => beat + 1)
}

export function agents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)

    try {
      await update($, pulse, beat => beat + 1)
    } catch {
      return started
    }

    return started
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-agents' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const chosen = await read($, prefs)
    await read($, pulse)
    await read($, now)
    const said = await read($, agentNote)
    const roster = await $.agent.list()
    const working = roster.filter(one => agentStatus(one.status) === 'running')
    const past = roster
      .filter(one => agentStatus(one.status) !== 'running')
      .slice(-PAST_SHOWN)
      .reverse()
    const { accent, background, clawd } = chosen.palette
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
    const card = (one: (typeof roster)[number]) => {
      const status = agentStatus(one.status)
      const label = one.name ?? one.description

      return (
        <Box gap={2} alignItems="center">
          {'Svg' in elements ? (
            <elements.Svg
              source={agentSvg({ color: clawd, unit: CARD_UNIT, status })}
              alt={`Agent ${label}, ${STATUS_WORD[one.status] ?? one.status}`}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            />
          ) : (
            <Text {...ink}>{status === 'running' ? '[■_■]' : status === 'completed' ? '[■_■]✓' : '[■_■]✗'}</Text>
          )}
          <Box flexDirection="column">
            <Text {...ink} bold wrap="wrap">
              {one.description}
            </Text>
            {note(`${one.type} · ${STATUS_WORD[one.status] ?? one.status}`)}
            {status === 'running' && (
              <Box>
                <Button
                  key={`stop-${one.id}`}
                  label="Stand down"
                  onPress={() => void standDown($, one.id, label)}
                />
              </Box>
            )}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {note(
          'Agent HQ. Every helper Claude sends out in this session reports here. Stand down stops one. /clubhouse agents opens this.',
        )}
        {roster.length === 0 && (
          <Box flexDirection="column" gap={1}>
            {'Svg' in elements && (
              <elements.Svg
                source={agentSvg({ color: clawd, unit: HERO_UNIT, status: 'running' })}
                alt="A Clawd agent in a suit and sunglasses, waiting for orders"
                width={HERO_WIDTH}
                height={HERO_HEIGHT}
              />
            )}
            {note('No agents in the field yet. They show up here the moment one is sent out.')}
          </Box>
        )}
        {working.length > 0 && heading(`On assignment (${working.length})`)}
        {working.map(card)}
        {past.length > 0 && heading('Back from the field')}
        {past.map(card)}
        {said !== null && (
          <Text {...ink} wrap="wrap">
            {said}
          </Text>
        )}
      </Box>
    )
  })
}
