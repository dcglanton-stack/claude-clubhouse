import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'
import { DEFAULT_PREFS, PREFS_KEY } from '../lib/defaults'
import {
  DEFAULT_QUESTION,
  IDLE_OPINION,
  OPINION_MODELS,
  OPINION_MODEL_LABEL,
  hereRequest,
  opinionOf,
  outsideRequest,
} from '../lib/opinion'
import { makeParts } from '../lib/parts'

const opinion = atom({ plugin: 'clubhouse', key: 'opinion' } as const, IDLE_OPINION)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)

const MARKDOWN_LIMIT = 9000

let question = ''

function asked(): string {
  return question.trim() === '' ? DEFAULT_QUESTION : question.trim()
}

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function askHere($: EngineInterface): Promise<void> {
  await update($, opinion, () => ({ status: 'working', text: '', source: 'here' }))
  const reply = await $.model.fork(hereRequest(asked())).catch(() => null)
  await update($, opinion, () => opinionOf(reply, 'here'))
}

async function askOutside($: EngineInterface): Promise<void> {
  await update($, opinion, () => ({ status: 'working', text: '', source: 'outside' }))
  const { opinionModel } = await read($, prefs)
  const reply = await $.session
    .messages()
    .then(rows => $.model.complete(outsideRequest(opinionModel, asked(), rows)))
    .catch(() => null)
  await update($, opinion, () => opinionOf(reply, 'outside'))
}

export function opinionRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-opinion' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const held = await read($, opinion)
    const { frame, note, plain, title, card, Button, Input, Markdown } = makeParts(elements, chosen, e.surface)
    const outside = OPINION_MODEL_LABEL[chosen.opinionModel]

    const answer = () => {
      if (held.status === 'working') {
        return plain(held.source === 'here' ? 'Asking Claude in this session…' : `Asking ${outside} for an outside view…`)
      }

      if (held.status === 'failed') return plain(held.text)

      if (held.status === 'ready') {
        return [
          Markdown !== null ? <Markdown text={held.text.slice(0, MARKDOWN_LIMIT)} /> : plain(held.text),
          note(held.source === 'here' ? 'From Claude in this session.' : `From ${outside}, which saw only an excerpt.`),
        ]
      }

      return note('Nothing asked yet.')
    }

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Second opinion')}
        {note(
          'Ask about this session without adding anything to it. Claude never sees the question or the answer in the conversation. /clubhouse opinion opens this.',
        )}

        {Input !== null && (
          <Input
            key="opinion-question"
            label="Question"
            placeholder={DEFAULT_QUESTION}
            submitLabel="Set"
            onInput={typed => {
              question = typed
            }}
            onSubmit={typed => {
              question = typed
            }}
          />
        )}
        {note('Leave it empty to ask whether the session is on the right track.')}

        {card('Ask Claude here', [
          note('The same model, with the whole conversation in view. Best for "what is going on?" and "what did you just change?". Cheap, because the conversation is already cached.'),
          <Box>
            <Button key="opinion-here" label="Ask Claude here" variant="primary" onPress={() => void askHere($)} />
          </Box>,
        ])}

        {card('Ask an outside model', [
          note('A different model with fresh eyes. It sees only the recent conversation and is told not to defer to Claude. Best for "is this the right approach?".'),
          <Box gap={1} flexWrap="wrap">
            <Button key="opinion-outside" label={`Ask ${outside}`} variant="primary" onPress={() => void askOutside($)} />
            <Button
              key="opinion-model"
              label={`Outside model: ${outside}`}
              onPress={() =>
                void keep($, current => ({
                  ...current,
                  opinionModel:
                    OPINION_MODELS[(OPINION_MODELS.indexOf(current.opinionModel) + 1) % OPINION_MODELS.length] ??
                    'sonnet',
                }))
              }
            />
          </Box>,
        ])}

        {card('The answer', answer())}
      </Box>
    )
  })
}
