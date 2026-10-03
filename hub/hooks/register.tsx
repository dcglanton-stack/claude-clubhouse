import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'
import { band } from './features/band'
import { colors } from './features/colors'
import { home } from './features/home'
import { usage } from './features/usage'
import { DEFAULT_PREFS, LIMITS_KEY, PREFS_KEY, isLimitList, mergePrefs } from './lib/defaults'

const contextPercent = atom({ plugin: 'hub', key: 'contextPercent' } as const, null)
const limits = atom({ plugin: 'hub', key: 'limits' } as const, [])
const now = atom({ plugin: 'hub', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'hub', key: 'prefs' } as const, DEFAULT_PREFS)

const TICK_MS = 30_000

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = mergePrefs(await $.store.get(PREFS_KEY))
    await update($, prefs, () => saved)

    const measured = await $.session.usage()
    const savedLimits = await $.store.get(LIMITS_KEY)
    const live: Limit[] = measured.rateLimits.map(one => ({
      kind: one.kind,
      percentUsed: one.percentUsed,
      resetsAt: one.resetsAt ?? null,
    }))
    const known = live.length > 0 ? live : isLimitList(savedLimits) ? savedLimits : []
    await update($, limits, () => known)
    await update($, contextPercent, () => measured.context.percent ?? null)

    const startedAt = await $.clock.now()
    await update($, now, () => startedAt)
    $.clock.every(TICK_MS, () => void $.clock.now().then(at => update($, now, () => at)))

    await $.command.register({
      name: 'hub',
      description: 'Open the Hub. /hub off hides everything it adds, /hub on brings it back',
      argumentHint: '[on|off|colors]',
      immediate: true,
    })

    return next(e)
  })

  usage(on)
  band(on)
  home(on)
  colors(on)
}
