import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Limit, Receipt, WindowKind } from '../../types'
import { DEFAULT_PREFS, LIMITS_KEY } from '../lib/defaults'
import { LOW_PERCENT, WINDOW_LABEL, formatSpan, percentLeft, resetIn, usedOf } from '../lib/format'

const contextPercent = atom({ plugin: 'hub', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'hub', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'hub', key: 'limits' } as const, [])
const now = atom({ plugin: 'hub', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'hub', key: 'prefs' } as const, DEFAULT_PREFS)
const receipt = atom({ plugin: 'hub', key: 'receipt' } as const, null)

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

export function usage(on: On): void {
  let turnBase: number | null = null

  on('prompt.submit', async ($, e, next) => {
    turnBase = usedOf(await read($, limits), 'five_hour')

    return next(e)
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
      await update($, contextPercent, () => percent)
    }

    return next(e)
  })
}
