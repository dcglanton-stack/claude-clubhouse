import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Blueprint, Limit } from '../types'
import { agents } from './features/agents'
import { band } from './features/band'
import { colors } from './features/colors'
import { commands } from './features/commands'
import { home } from './features/home'
import { usage } from './features/usage'
import {
  AGENTS_KEY,
  COMMANDS_KEY,
  DEFAULT_PREFS,
  LIMITS_KEY,
  PREFS_KEY,
  asBlueprints,
  asCommandStats,
  isLimitList,
  mergePrefs,
} from './lib/defaults'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const agentBank = atom({ plugin: 'clubhouse', key: 'agentBank' } as const, [])

const TICK_MS = 30_000

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = mergePrefs(await $.store.get(PREFS_KEY))
    await update($, prefs, () => saved)

    const savedCommands = asCommandStats(await $.store.get(COMMANDS_KEY))
    await update($, commandStats, () => savedCommands)

    const savedAgents: Blueprint[] = asBlueprints(await $.store.get(AGENTS_KEY))
    await update($, agentBank, () => savedAgents)

    for (const one of savedAgents) {
      const base = { name: one.name, description: one.purpose, prompt: one.prompt }
      await $.agent
        .register(one.model === 'inherit' ? base : { ...base, model: one.model })
        .catch(() => undefined)
    }

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
      name: 'clubhouse',
      description: 'Open Claude Clubhouse. Also: /clubhouse off, on, agents, commands, colors',
      argumentHint: '[on|off|agents|commands|colors]',
      immediate: true,
    })

    return next(e)
  })

  usage(on)
  band(on)
  home(on)
  commands(on)
  agents(on)
  colors(on)
}
