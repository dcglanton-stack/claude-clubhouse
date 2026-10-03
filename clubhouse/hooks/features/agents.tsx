import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { AgentModel, Blueprint } from '../../types'
import { agentStatus, agentSvg } from '../lib/clawd'
import {
  AGENTS_KEY,
  AGENT_MODELS,
  AGENT_PREFIX,
  DEFAULT_AGENT_DESK,
  DEFAULT_PREFS,
  MODEL_LABEL,
  PREFS_SHAPE,
  agentSlug,
} from '../lib/defaults'
import {
  DO_NOT_START,
  START_ALL,
  START_ONE,
  capQuestion,
  capRefusal,
  fiveHourLeft,
  isCapped,
  liftUntil,
} from '../lib/cap'
import { makeParts } from '../lib/parts'

const agentBank = atom({ plugin: 'clubhouse', key: 'agentBank' } as const, [])
const agentDesk = atom({ plugin: 'clubhouse', key: 'agentDesk' } as const, DEFAULT_AGENT_DESK)
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const capLiftedUntil = atom({ plugin: 'clubhouse', key: 'capLiftedUntil' } as const, null)

const ROW_UNIT = 2
const HEAD_UNIT = 3
const ROW_WIDTH = Math.ceil(17.4 * ROW_UNIT)
const ROW_HEIGHT = Math.ceil(12 * ROW_UNIT)
const HEAD_WIDTH = Math.ceil(17.4 * HEAD_UNIT)
const HEAD_HEIGHT = Math.ceil(12 * HEAD_UNIT)
const PAST_SHOWN = 6
const AUTO = 'auto'

const STATUS_WORD: Record<string, string> = {
  running: 'on assignment',
  completed: 'mission complete',
  failed: 'mission failed',
  killed: 'stood down',
}

const EFFORT_LABELS = [
  'quick lookup or formatting',
  'everyday coding or research',
  'deep reasoning or careful review',
] as const

const EFFORT_MODEL: Record<string, AgentModel> = {
  'quick lookup or formatting': 'haiku',
  'everyday coding or research': 'sonnet',
  'deep reasoning or careful review': 'opus',
}

type Draft = { name: string; purpose: string; prompt: string; model: string }

const BLANK_DRAFT: Draft = { name: '', purpose: '', prompt: '', model: AUTO }

let draft: Draft = BLANK_DRAFT
let task = ''
let ownDispatches = 0

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

function spec(one: Blueprint) {
  const base = { name: one.name, description: one.purpose, prompt: one.prompt }

  return one.model === 'inherit' ? base : { ...base, model: one.model }
}

async function tell($: EngineInterface, note: string): Promise<void> {
  await update($, agentDesk, desk => ({ ...desk, note }))
  await update($, pulse, beat => beat + 1)
}

async function saveBank($: EngineInterface, change: (bank: Blueprint[]) => Blueprint[]): Promise<void> {
  await update($, agentBank, change)
  await $.store.set(AGENTS_KEY, await read($, agentBank))
}

async function saveDraft($: EngineInterface): Promise<void> {
  const name = agentSlug(draft.name)
  const purpose = draft.purpose.trim()
  const prompt = draft.prompt.trim()

  if (name === '' || purpose === '' || prompt === '') {
    await tell($, 'An agent needs a name, a purpose and instructions. Press Enter in each box to set it.')

    return
  }

  try {
    const isAuto = draft.model === AUTO
    const picked = isAuto
      ? EFFORT_MODEL[(await $.model.classify(`${purpose}\n${prompt}`, EFFORT_LABELS)) ?? '']
      : AGENT_MODELS.find(model => model === draft.model)
    const made: Blueprint = { name, purpose, prompt, model: picked ?? 'sonnet', isAuto }

    await $.agent.register(spec(made))
    await saveBank($, bank => [...bank.filter(one => one.name !== name), made])
    draft = BLANK_DRAFT
    await update($, agentDesk, desk => ({ ...desk, mode: 'idle', target: null }))
    await tell(
      $,
      `Saved ${name} on ${MODEL_LABEL[made.model]}${isAuto ? ' (picked for you)' : ''}. Claude can now send it out, or press Send.`,
    )
  } catch (error) {
    await tell($, `Could not save the agent: ${reason(error)}`)
  }
}

async function nextModel($: EngineInterface, name: string): Promise<void> {
  try {
    const held = (await read($, agentBank)).find(one => one.name === name)

    if (held === undefined) return
    const model = AGENT_MODELS[(AGENT_MODELS.indexOf(held.model) + 1) % AGENT_MODELS.length] ?? 'sonnet'
    const made: Blueprint = { ...held, model, isAuto: false }

    await $.agent.register(spec(made))
    await saveBank($, bank => bank.map(one => (one.name === name ? made : one)))
    await tell($, `${name} now runs on ${MODEL_LABEL[model]}.`)
  } catch (error) {
    await tell($, `Could not change the model: ${reason(error)}`)
  }
}

async function removeBlueprint($: EngineInterface, name: string): Promise<void> {
  await saveBank($, bank => bank.filter(one => one.name !== name))
  await tell($, `${name} was removed from your agents. Claude can no longer send it out.`)
}

async function dispatch($: EngineInterface, name: string): Promise<void> {
  const orders = task.trim()
  const held = (await read($, agentBank)).find(one => one.name === name)

  if (held === undefined || orders === '') {
    await tell($, 'Type the task and press Enter, then press Dispatch.')

    return
  }

  try {
    ownDispatches += 1
    const send = () =>
      $.agent.spawn({
        subagentType: `${AGENT_PREFIX}${name}`,
        prompt: orders,
        description: `${name}: ${orders.slice(0, 48)}`,
      })
    const started = await send()
      .then(
        first => (held.model === 'fable' && first.deny !== undefined ? null : first),
        error => {
          if (held.model === 'fable') return null
          throw error
        },
      )
      .then(async first => {
        if (first !== null) return first
        await $.agent.register(spec({ ...held, model: 'opus' }))
        await tell($, `Fable was not available, so ${name} runs on Opus this time.`)

        return send()
      })
      .finally(() => {
        ownDispatches -= 1
      })

    if (started.deny !== undefined) {
      await tell($, `${name} was not sent: ${started.deny}`)

      return
    }

    task = ''
    await update($, agentDesk, desk => ({ ...desk, mode: 'idle', target: null }))
    const isTold = await $.session
      .append({
        message: {
          type: 'user',
          content: [
            {
              type: 'text',
              text:
                `Claude Clubhouse notice: the user dispatched the agent "${AGENT_PREFIX}${name}" from Agent HQ. ` +
                `It runs in the background on ${MODEL_LABEL[held.model]}. Purpose: ${held.purpose} ` +
                `Its instructions: ${held.prompt} Its task: ${orders} ` +
                'Do not start a duplicate of this work; its result arrives when it finishes.',
            },
          ],
        },
      })
      .then(
        () => true,
        () => false,
      )
    await tell(
      $,
      isTold
        ? `${name} is on assignment, and Claude has been told.`
        : `${name} is on assignment. Claude could not be told automatically, so mention it yourself.`,
    )
  } catch (error) {
    await tell($, `Something went wrong sending ${name}: ${reason(error)}`)
  }
}

async function standDown($: EngineInterface, id: string, label: string): Promise<void> {
  try {
    const stopped = await $.tool.call({ tool: 'TaskStop', task_id: id })
    const refusal = stopped.deny ?? (stopped.isError === true ? 'the engine could not stop it' : null)
    await tell(
      $,
      refusal === null ? `${label} was told to stand down.` : `Could not stop ${label}: ${refusal}`,
    )
  } catch (error) {
    await tell($, `Could not stop ${label}: ${reason(error)}`)
  }
}

export function agents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const at = await $.clock.now()
    const list = await read($, limits)
    const cap = (await read($, prefs)).spendCap ?? 0
    const left = fiveHourLeft(list, at)

    if (ownDispatches === 0 && left !== null && isCapped({ cap, left, liftedUntil: await read($, capLiftedUntil), at })) {
      const answer = await $.ui
        .ask(capQuestion(left, cap, e.description), {
          header: 'Spend cap',
          options: [START_ONE, START_ALL, DO_NOT_START],
        })
        .catch(() => DO_NOT_START)

      if (answer === START_ALL) {
        await update($, capLiftedUntil, () => liftUntil(list, at))
      } else if (answer !== START_ONE) {
        return { deny: capRefusal(left, cap) }
      }
    }

    const started = await next(e)

    try {
      await update($, pulse, beat => beat + 1)
    } catch {
      return started
    }

    return started
  })

  on('agent.offer', async ($, e, next) => {
    if (!e.agent.startsWith(AGENT_PREFIX)) {
      return next(e)
    }

    const bank = await read($, agentBank)

    return bank.some(one => `${AGENT_PREFIX}${one.name}` === e.agent)
      ? next(e)
      : { isOffered: false }
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-agents' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const chosen = await read($, prefs)
    await read($, pulse)
    await read($, now)
    const desk = await read($, agentDesk)
    const bank = await read($, agentBank)
    const roster = (await $.agent.list()).filter(one => !desk.dismissed.includes(one.id))
    const working = roster.filter(one => agentStatus(one.status) === 'running')
    const past = roster
      .filter(one => agentStatus(one.status) !== 'running')
      .slice(-PAST_SHOWN)
      .reverse()
    const { ink, frame, rim, note, plain, title, card, look, picture, Button, Input, Select } = makeParts(
      elements,
      chosen,
      e.surface,
    )
    const target = bank.find(one => one.name === desk.target)

    const setDesk = (mode: 'idle' | 'form' | 'send', name: string | null) =>
      void update($, agentDesk, held => ({ ...held, mode, target: name, note: null }))
    const openForm = (one: Blueprint | null) => {
      draft =
        one === null
          ? BLANK_DRAFT
          : { name: one.name, purpose: one.purpose, prompt: one.prompt, model: one.isAuto ? AUTO : one.model }
      setDesk('form', one?.name ?? null)
    }
    const dismiss = (id: string) =>
      void update($, agentDesk, held => ({ ...held, dismissed: [...held.dismissed, id] }))

    const fieldRow = (one: (typeof roster)[number]) => {
      const status = agentStatus(one.status)
      const label = one.name ?? one.description

      return (
        <Box gap={1} alignItems="center">
          {picture(
            agentSvg({ color: look.clawd, unit: ROW_UNIT, status }),
            `Agent ${label}, ${STATUS_WORD[one.status] ?? one.status}`,
            ROW_WIDTH,
            ROW_HEIGHT,
          ) ?? <Text {...ink}>{status === 'running' ? '[■_■]' : status === 'completed' ? '[■_■]✓' : '[■_■]✗'}</Text>}
          <Box flexDirection="column">
            <Text {...ink} wrap="truncate">
              {one.description}
            </Text>
            <Box gap={1} alignItems="center">
              <Text {...ink} dimColor>
                {one.type} · {STATUS_WORD[one.status] ?? one.status}
              </Text>
              {status === 'running' ? (
                <Button
                  key={`stop-${one.id}`}
                  label="Stand down"
                  onPress={() => void standDown($, one.id, label)}
                />
              ) : (
                <Button key={`dismiss-${one.id}`} label="Dismiss" onPress={() => dismiss(one.id)} />
              )}
            </Box>
          </Box>
        </Box>
      )
    }

    const bankRow = (one: Blueprint) => (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text {...ink} bold>
            {one.name}
          </Text>
          <Text {...ink} dimColor wrap="truncate">
            {one.purpose}
          </Text>
        </Box>
        <Box gap={1} flexWrap="wrap">
          <Button key={`send-${one.name}`} label="Send" variant="primary" onPress={() => setDesk('send', one.name)} />
          <Button key={`edit-${one.name}`} label="Edit" onPress={() => openForm(one)} />
          <Button
            key={`model-${one.name}`}
            label={MODEL_LABEL[one.model].split(' ')[0] ?? one.model}
            onPress={() => void nextModel($, one.name)}
          />
          <Button key={`delete-${one.name}`} label="Delete" onPress={() => void removeBlueprint($, one.name)} />
        </Box>
      </Box>
    )

    const form = () =>
      Input !== null && Select !== null
        ? card(target === undefined ? 'New agent' : `Edit ${target.name}`, [
            note('Press Enter in each box to set it, then Save.'),
            <Input
              key="agent-name"
              label="Name"
              placeholder="test-scout"
              value={draft.name}
              onInput={typed => {
                draft = { ...draft, name: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, name: typed }
              }}
            />,
            <Input
              key="agent-purpose"
              label="When to use it"
              placeholder="Finds which tests cover a change"
              value={draft.purpose}
              onInput={typed => {
                draft = { ...draft, purpose: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, purpose: typed }
              }}
            />,
            <Input
              key="agent-prompt"
              label="Instructions"
              placeholder="You read code and report file paths. Never edit files."
              value={draft.prompt}
              onInput={typed => {
                draft = { ...draft, prompt: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, prompt: typed }
              }}
            />,
            <Select
              key="agent-model"
              label="Model"
              value={draft.model}
              options={[
                { value: AUTO, label: 'Auto (cheapest that fits the job)' },
                ...AGENT_MODELS.map(model => ({ value: model, label: MODEL_LABEL[model] })),
              ]}
              onSelect={picked => {
                draft = { ...draft, model: picked }
              }}
            />,
            <Box gap={1}>
              <Button key="agent-save" label="Save agent" variant="primary" onPress={() => void saveDraft($)} />
              <Button key="agent-cancel" label="Cancel" onPress={() => setDesk('idle', null)} />
            </Box>,
          ])
        : card('New agent', [note('Adding agents needs a text box, which this screen does not have. Use the desktop app or terminal.')])

    const send = (one: Blueprint) =>
      Input !== null
        ? card(`Send ${one.name}`, [
            note(`Runs on ${MODEL_LABEL[one.model]}. Claude is told what it was sent to do.`),
            <Input
              key="agent-task"
              label="Task"
              placeholder="What should it do right now?"
              onInput={typed => {
                task = typed
              }}
              onSubmit={typed => {
                task = typed
              }}
            />,
            <Box gap={1}>
              <Button key="agent-dispatch" label="Dispatch" variant="primary" onPress={() => void dispatch($, one.name)} />
              <Button key="agent-cancel" label="Cancel" onPress={() => setDesk('idle', null)} />
            </Box>,
          ])
        : card(`Send ${one.name}`, [note('Sending needs a text box, which this screen does not have.')])

    return (
      <Box flexDirection="column" {...rim}>
        <Box flexDirection="column" gap={1} {...frame}>
          <Box gap={1} alignItems="center">
            {picture(
              agentSvg({ color: look.clawd, unit: HEAD_UNIT, status: 'running' }),
              'A Clawd agent in a suit and sunglasses',
              HEAD_WIDTH,
              HEAD_HEIGHT,
            )}
            {title('Agent HQ')}
            {desk.mode === 'idle' && (
              <Button key="agent-new" label="+ New agent" variant="primary" onPress={() => openForm(null)} />
            )}
          </Box>

          {desk.mode === 'form' && form()}
          {desk.mode === 'send' && target !== undefined && send(target)}
          {desk.note !== null && plain(desk.note)}

          {card(`In the field (${working.length})`, [
            working.length === 0 && note('No agents out right now.'),
            ...working.map(fieldRow),
          ])}

          {card(
            `Your agents (${bank.length})`,
            bank.length === 0
              ? [note('None saved yet. Press + New agent to make one you can reuse in any session.')]
              : bank.map(bankRow),
          )}

          {past.length > 0 && card('Back from the field', past.map(fieldRow))}

          {note('An agent can be stood down but not paused: Claude Code has no pause. /clubhouse agents opens this room.')}
        </Box>
      </Box>
    )
  })
}
