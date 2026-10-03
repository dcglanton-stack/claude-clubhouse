import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Blueprint, Limit, Prefs } from '../types'
import {
  HELPER_BINARY,
  HELPER_CONFIG,
  READ_APP_MODE,
  START_HELPER,
  appModeFrom,
  coversApp,
  helperConfig,
} from './lib/appColor'
import { agents } from './features/agents'
import { band } from './features/band'
import { bar } from './features/bar'
import { colors } from './features/colors'
import { commands } from './features/commands'
import { home } from './features/home'
import { nightWatch } from './features/watch'
import { notesRoom } from './features/notes'
import { opinionRoom } from './features/opinion'
import { recipesRoom } from './features/recipes'
import { summaryRoom } from './features/summary'
import { tint } from './features/tint'
import { tools } from './features/tools'
import { usage } from './features/usage'
import { usageRoom } from './features/usageRoom'
import {
  AGENTS_KEY,
  COMMANDS_KEY,
  DEFAULT_HIDDEN_PLAN,
  DEFAULT_PREFS,
  HIDDEN_KEY,
  HIDDEN_PLAN_KEY,
  LIMITS_KEY,
  PREFS_KEY,
  PREFS_SHAPE,
  TOOL_RULES_KEY,
  asBlueprints,
  asCommandStats,
  asHiddenPlan,
  asNames,
  asToolRules,
  isLimitList,
  mergePrefs,
} from './lib/defaults'
import { percentLeft } from './lib/format'
import { NOTES_KEY, asNotes, claim } from './lib/notes'
import { RECIPES_KEY, asRecipes, toolSpecOf } from './lib/recipes'
import {
  SAVED_WATCHES_KEY,
  WATCH_COMMAND_MS,
  WATCH_POLL_MS,
  asSavedWatches,
  claimed,
  dueWatches,
  settled,
  stepOf,
  withEntry,
} from './lib/watch'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const contextSize = atom({ plugin: 'clubhouse', key: 'contextSize' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const agentBank = atom({ plugin: 'clubhouse', key: 'agentBank' } as const, [])
const hiddenCommands = atom({ plugin: 'clubhouse', key: 'hiddenCommands' } as const, [])
const hiddenPlan = atom({ plugin: 'clubhouse', key: 'hiddenPlan' } as const, DEFAULT_HIDDEN_PLAN)
const toolRules = atom({ plugin: 'clubhouse', key: 'toolRules' } as const, {})
const recipes = atom({ plugin: 'clubhouse', key: 'recipes' } as const, [])
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const watches = atom({ plugin: 'clubhouse', key: 'watches' } as const, [])
const watchLog = atom({ plugin: 'clubhouse', key: 'watchLog' } as const, [])
const savedWatches = atom({ plugin: 'clubhouse', key: 'savedWatches' } as const, [])
const notes = atom({ plugin: 'clubhouse', key: 'notes' } as const, [])
const receivedNotes = atom({ plugin: 'clubhouse', key: 'receivedNotes' } as const, [])
const pendingNotes = atom({ plugin: 'clubhouse', key: 'pendingNotes' } as const, [])
const sessionFolder = atom({ plugin: 'clubhouse', key: 'sessionFolder' } as const, '')
const hasBooted = atom({ plugin: 'clubhouse', key: 'hasBooted' } as const, false)

const TICK_MS = 30_000

async function appModeNow($: EngineInterface): Promise<Prefs['appMode'] | null> {
  const ran = await $.process.run(['/bin/sh', '-c', READ_APP_MODE]).catch(() => null)

  return ran === null ? null : appModeFrom(ran.stdout)
}

async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
  const mode = await appModeNow($)
  const held = await read($, prefs)

  if (mode === null || mode === held.appMode) return
  const turned = { ...held, appMode: mode }
  await update($, prefs, () => turned)
  const userFolder = await $.env.get('HOME')

  if (userFolder === undefined) return
  await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(turned)).catch(() => undefined)
}

async function patrol($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  const due = dueWatches(await read($, watches), at)

  if (due.length === 0) return
  await update($, watches, held => claimed(held, due, at))
  const fiveHour = (await read($, limits)).find(one => one.kind === 'five_hour')
  const facts = {
    at,
    percentLeft: fiveHour === undefined ? null : percentLeft(fiveHour, at),
    lastReplyAt: await read($, lastReplyAt),
  }

  for (const watch of due) {
    const ran =
      watch.command === ''
        ? null
        : await $.process
            .run(['/bin/sh', '-c', watch.command], { timeoutMs: WATCH_COMMAND_MS })
            .catch(() => null)
    const step = stepOf(watch, { ...facts, ran })
    await update($, watches, held => settled(held, watch.id, step))
    await update($, watchLog, held => withEntry(held, { at, text: step.entry }))

    if (step.toast !== null) $.ui.toast(step.toast)
    if (step.prompt !== null) void $.prompt.submit({ text: step.prompt }).catch(() => undefined)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const userFolder = await $.env.get('HOME')
    const isHelperReady =
      userFolder !== undefined && (await $.fs.exists(`${userFolder}/${HELPER_BINARY}`).catch(() => false))
    const merged = mergePrefs(await $.store.get(PREFS_KEY))
    const saved = { ...merged, isHelperReady, appMode: (await appModeNow($)) ?? merged.appMode }
    await update($, prefs, () => saved)

    if (userFolder !== undefined) {
      await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(saved)).catch(() => undefined)

      if (coversApp(saved)) {
        await $.process.run(['/bin/sh', '-c', START_HELPER]).catch(() => undefined)
      }
    }

    const savedCommands = asCommandStats(await $.store.get(COMMANDS_KEY))
    await update($, commandStats, () => savedCommands)

    const savedPlan = asHiddenPlan(await $.store.get(HIDDEN_PLAN_KEY))
    const startPreset = savedPlan.startWith === null ? undefined : savedPlan.presets[savedPlan.startWith]
    const savedHidden = startPreset ?? asNames(await $.store.get(HIDDEN_KEY))
    await update($, hiddenPlan, () => savedPlan)
    await update($, hiddenCommands, () => savedHidden)

    const savedRules = asToolRules(await $.store.get(TOOL_RULES_KEY))
    await update($, toolRules, () => savedRules)

    const savedRecipes = asRecipes(await $.store.get(RECIPES_KEY))
    await update($, recipes, () => savedRecipes)

    for (const one of savedRecipes) {
      await $.tool.register(toolSpecOf(one)).catch(() => undefined)
    }

    await update($, sessionFolder, () => e.cwd)
    const keptNotes = asNotes(await $.store.get(NOTES_KEY))
    const isNewSession = !(await read($, hasBooted))
    const { taken, left } = isNewSession ? claim(keptNotes, e.cwd) : { taken: [], left: keptNotes }
    await update($, hasBooted, () => true)
    await update($, notes, () => left)

    if (taken.length > 0) {
      await $.store.set(NOTES_KEY, left)
      await update($, pendingNotes, () => taken)
      await update($, receivedNotes, () => taken)
      $.ui.toast(
        `${taken.length === 1 ? 'A session note is' : `${taken.length} session notes are`} waiting: Claude reads ${taken.length === 1 ? 'it' : 'them'} with your first message.`,
        { timeoutMs: 8000 },
      )
    }

    const keptWatches = asSavedWatches(await $.store.get(SAVED_WATCHES_KEY))
    await update($, savedWatches, () => keptWatches)

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
    const { tokens, window } = measured.context
    await update($, contextSize, () => (tokens === undefined || window === undefined ? null : { tokens, window }))

    const startedAt = await $.clock.now()
    await update($, now, () => startedAt)
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    $.clock.every(WATCH_POLL_MS, () => void patrol($).catch(() => undefined))

    await $.command.register({
      name: 'clubhouse',
      description: 'Open Claude Clubhouse. Add a room to open it: agents, summary, opinion, tools, recipes, watch, notes, commands, toolbar, usage, colors; or on, off, color reset',
      argumentHint: '[on|off|agents|summary|opinion|tools|recipes|watch|notes|commands|toolbar|usage|colors|color reset]',
      immediate: true,
    })
    await $.command
      .register({
        name: 'ship',
        description: 'Release what is on main: tag the next version, push, and publish a GitHub release with notes. Asks before it does anything.',
        argumentHint: '[patch|minor|major|v1.2.3]',
        immediate: true,
      })
      .catch(() => undefined)

    return next(e)
  })

  usage(on)
  band(on)
  home(on)
  bar(on)
  summaryRoom(on)
  opinionRoom(on)
  tools(on)
  recipesRoom(on)
  nightWatch(on)
  notesRoom(on)
  usageRoom(on)
  commands(on)
  agents(on)
  colors(on)
  tint(on)
}
