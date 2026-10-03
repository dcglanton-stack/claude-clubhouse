import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Blueprint, Limit } from '../types'
import { agents } from './features/agents'
import { band } from './features/band'
import { bar } from './features/bar'
import { colors } from './features/colors'
import { commands } from './features/commands'
import { home } from './features/home'
import { opinionRoom } from './features/opinion'
import { summaryRoom } from './features/summary'
import { tint } from './features/tint'
import { tools } from './features/tools'
import { usage } from './features/usage'
import { usageRoom } from './features/usageRoom'
import {
  AGENTS_KEY,
  COMMANDS_KEY,
  DEFAULT_PREFS,
  HIDDEN_KEY,
  LIMITS_KEY,
  PREFS_KEY,
  TOOL_RULES_KEY,
  asBlueprints,
  asCommandStats,
  asNames,
  asToolRules,
  isLimitList,
  mergePrefs,
} from './lib/defaults'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const agentBank = atom({ plugin: 'clubhouse', key: 'agentBank' } as const, [])
const hiddenCommands = atom({ plugin: 'clubhouse', key: 'hiddenCommands' } as const, [])
const toolRules = atom({ plugin: 'clubhouse', key: 'toolRules' } as const, {})

const TICK_MS = 30_000

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = mergePrefs(await $.store.get(PREFS_KEY))
    await update($, prefs, () => saved)

    const savedCommands = asCommandStats(await $.store.get(COMMANDS_KEY))
    await update($, commandStats, () => savedCommands)

    const savedHidden = asNames(await $.store.get(HIDDEN_KEY))
    await update($, hiddenCommands, () => savedHidden)

    const savedRules = asToolRules(await $.store.get(TOOL_RULES_KEY))
    await update($, toolRules, () => savedRules)

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
      description: 'Open Claude Clubhouse. Add a room to open it: agents, summary, opinion, tools, commands, bar, usage, colors; or on, off, reset',
      argumentHint: '[on|off|agents|summary|opinion|tools|commands|bar|usage|colors|reset]',
      immediate: true,
    })

    return next(e)
  })

  usage(on)
  band(on)
  home(on)
  bar(on)
  summaryRoom(on)
  opinionRoom(on)
  tools(on)
  usageRoom(on)
  commands(on)
  agents(on)
  colors(on)
  tint(on)
}
