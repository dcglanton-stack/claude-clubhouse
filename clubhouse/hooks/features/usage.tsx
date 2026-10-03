import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Limit, Receipt, WindowKind } from '../../types'
import {
  ANSWER_LIMIT,
  AUTO_SUMMARY_CHARS,
  DEFAULT_PREFS,
  IDLE_SUMMARY,
  LIMITS_KEY,
  PREFS_SHAPE,
  WORKING_SUMMARY,
} from '../lib/defaults'
import { LOW_PERCENT, WINDOW_LABEL, formatSpan, percentLeft, resetIn, usedOf } from '../lib/format'
import {
  GUARD_DROPPED,
  GUARD_EDIT,
  GUARD_SEND,
  HANDOFF_PERCENT,
  HANDOFF_PROMPT,
  guardQuestion,
  guardRequest,
  isWorthGuarding,
  verdictFrom,
} from '../lib/guard'
import { contextOf } from '../lib/notes'
import { summaryOf, summaryRequest } from '../lib/summary'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const contextSize = atom({ plugin: 'clubhouse', key: 'contextSize' } as const, null)
const pendingNotes = atom({ plugin: 'clubhouse', key: 'pendingNotes' } as const, [])
const handoff = atom({ plugin: 'clubhouse', key: 'handoff' } as const, 'idle')
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)
const lastAnswer = atom({ plugin: 'clubhouse', key: 'lastAnswer' } as const, '')
const summary = atom({ plugin: 'clubhouse', key: 'summary' } as const, IDLE_SUMMARY)

const warned = new Set<string>()

function warnWhenLow($: EngineInterface, list: readonly Limit[], at: number): void {
  for (const one of list) {
    const left = percentLeft(one, at)
    const mark = `${one.kind}:${one.resetsAt}`
    const label = WINDOW_LABEL[one.kind as WindowKind]

    if (label !== undefined && left <= LOW_PERCENT && !warned.has(mark)) {
      warned.add(mark)
      const untilReset = resetIn(one, at)
      const reset = untilReset === null ? '' : `, resets in ${formatSpan(untilReset)}`
      $.ui.toast(`${label} usage is down to ${left}%${reset}`, { timeoutMs: 8000 })
    }
  }
}

async function stamp($: EngineInterface): Promise<number> {
  const at = await $.clock.now()
  await update($, now, () => at)

  return at
}

async function summarize($: EngineInterface, answer: string): Promise<void> {
  await update($, summary, () => WORKING_SUMMARY)
  const reply = await $.model.complete(summaryRequest(answer)).catch(() => null)
  await update($, summary, () => summaryOf(reply, answer))
  $.ui.toast('Summary ready: /clubhouse summary')
}

export function usage(on: On): void {
  let turnBase: number | null = null

  on('prompt.submit', async ($, e, next) => {
    turnBase = usedOf(await read($, limits), 'five_hour')
    const chosen = await read($, prefs)

    if (chosen.isEnabled && chosen.warnsSafeguards === true && isWorthGuarding(e.text, e.origin?.kind ?? 'composer')) {
      const reply = await $.model.complete(guardRequest(e.text)).catch(() => null)
      const verdict = reply !== null && reply.isAnswered ? verdictFrom(reply.text) : null

      if (verdict !== null && verdict.risk !== 'none') {
        const answer = await $.ui
          .ask(guardQuestion(verdict), { header: 'Safeguard warning', options: [GUARD_EDIT, GUARD_SEND] })
          .catch(() => GUARD_SEND)

        if (answer === GUARD_EDIT) {
          await $.prompt.fill({ text: e.text }).catch(() => undefined)

          return { drop: GUARD_DROPPED }
        }
      }
    }

    const waiting = await read($, pendingNotes)

    if (waiting.length === 0) {
      return next(e)
    }

    await update($, pendingNotes, () => [])

    return next({ ...e, context: [...(e.context ?? []), contextOf(waiting)] })
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await stamp($)
      const used = usedOf(await read($, limits), 'five_hour')
      const made: Receipt = {
        seconds: Math.round(e.durationMs / 1000),
        inputTokens:
          (e.usage?.input_tokens ?? 0) +
          (e.usage?.cache_read_input_tokens ?? 0) +
          (e.usage?.cache_creation_input_tokens ?? 0),
        outputTokens: e.usage?.output_tokens ?? 0,
        usageDelta: turnBase === null || used === null ? null : Math.max(0, used - turnBase),
      }
      await update($, lastReplyAt, () => at)
      await update($, receipt, () => made)

      if ((await read($, handoff)) === 'armed') {
        await update($, handoff, () => 'sent')
        void $.prompt.submit({ text: HANDOFF_PROMPT }).catch(() => undefined)
      }

      if (e.answer.trim() !== '') {
        const answer = e.answer.slice(0, ANSWER_LIMIT)
        await update($, lastAnswer, () => answer)
        await update($, summary, () => IDLE_SUMMARY)
        const chosen = await read($, prefs)

        if (chosen.isEnabled && chosen.autoSummary && answer.length >= AUTO_SUMMARY_CHARS) {
          void summarize($, answer)
        }
      }
    } else {
      await update($, pulse, beat => beat + 1)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const at = await stamp($)

    if (e.rateLimits.length > 0) {
      const list: Limit[] = e.rateLimits.map(one => ({
        kind: one.kind,
        percentUsed: one.percentUsed,
        resetsAt: one.resetsAt ?? null,
      }))
      await update($, limits, () => list)
      await $.store.set(LIMITS_KEY, list)

      if ((await read($, prefs)).isEnabled) {
        warnWhenLow($, list, at)
      }

      const used = usedOf(list, 'five_hour')
      if (turnBase !== null && used !== null) {
        const delta = Math.max(0, used - turnBase)
        await update($, receipt, made => (made === null ? made : { ...made, usageDelta: delta }))
      }
    }

    if (e.context.percent !== undefined) {
      const percent = e.context.percent
      const before = (await read($, contextPercent)) ?? 0
      await update($, contextPercent, () => percent)

      if (percent >= HANDOFF_PERCENT && before < HANDOFF_PERCENT && (await read($, handoff)) === 'idle' && (await read($, prefs)).isEnabled) {
        $.ui.toast(`This conversation is ${percent}% full. The toolbar has a button to write a handoff file for a fresh session.`, {
          timeoutMs: 10_000,
        })
      }
    }

    const { tokens, window } = e.context

    if (tokens !== undefined && window !== undefined) {
      await update($, contextSize, () => ({ tokens, window }))
    }

    return next(e)
  })
}
