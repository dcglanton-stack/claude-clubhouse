import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'
import {
  AUTO_SUMMARY_CHARS,
  DEFAULT_PREFS,
  IDLE_SUMMARY,
  PREFS_KEY,
  PREFS_SHAPE,
  WORKING_SUMMARY,
} from '../lib/defaults'
import { makeParts } from '../lib/parts'
import { summaryOf, summaryRequest } from '../lib/summary'
import { forStore } from '../lib/project'

const lastAnswer = atom({ plugin: 'clubhouse', key: 'lastAnswer' } as const, '')
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const sharedPalette = atom({ plugin: 'clubhouse', key: 'sharedPalette' } as const, null)
const summary = atom({ plugin: 'clubhouse', key: 'summary' } as const, IDLE_SUMMARY)

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, forStore(await read($, prefs), await read($, sharedPalette)))
}

async function summarize($: EngineInterface): Promise<void> {
  const answer = await read($, lastAnswer)

  if (answer.trim() === '') return
  await update($, summary, () => WORKING_SUMMARY)
  const reply = await $.model.complete(summaryRequest(answer)).catch(() => null)
  await update($, summary, () => summaryOf(reply, answer))
}

export function summaryRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-summary' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const made = await read($, summary)
    const answer = await read($, lastAnswer)
    const { card, frame, note, plain, title, Button, Markdown } = makeParts(elements, chosen, e.surface)
    const hasAnswer = answer.trim() !== ''

    const body = () => {
      if (made.status === 'working') return plain('Summarizing the last reply…')
      if (made.status === 'failed') return plain(made.text)

      if (made.status === 'ready') {
        return [
          Markdown !== null ? <Markdown text={made.text.slice(0, 9000)} /> : plain(made.text),
          note(`Cut from ${made.sourceChars.toLocaleString('en-US')} characters to ${made.text.length.toLocaleString('en-US')}.`),
        ]
      }

      return note(
        hasAnswer
          ? 'Press Summarize last reply for the short version.'
          : 'Nothing to summarize yet. It works on the reply that follows your next prompt.',
      )
    }

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Summary')}
        <Box gap={1} flexWrap="wrap">
          <Button
            key="summary-run"
            label="Summarize last reply"
            variant="primary"
            onPress={() => void summarize($)}
          />
          <Button
            key="summary-auto"
            label={chosen.autoSummary ? 'Auto: on' : 'Auto: off'}
            variant={chosen.autoSummary ? 'primary' : 'secondary'}
            onPress={() => void keep($, held => ({ ...held, autoSummary: !held.autoSummary }))}
          />
        </Box>
        {card('The short version', body())}
        {note(
          `A small, cheap model writes the summary; the full reply stays in the conversation. Auto summarizes every reply longer than ${AUTO_SUMMARY_CHARS.toLocaleString('en-US')} characters. /clubhouse summary opens this.`,
        )}
      </Box>
    )
  })
}
