import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Blueprint, Game, Limit, Prefs, Quote } from '../types'
import {
  HELPER_BINARY,
  HELPER_CONFIG,
  HELPER_FRONT,
  READ_APP_MODE,
  START_HELPER,
  appModeFrom,
  coversApp,
  helperConfig,
  lookOf,
} from './lib/appColor'
import { agents } from './features/agents'
import { band } from './features/band'
import { bar } from './features/bar'
import { colors } from './features/colors'
import { commands } from './features/commands'
import { home } from './features/home'
import { fontsRoom } from './features/fonts'
import { nightWatch } from './features/watch'
import { weatherRoom } from './features/weather'
import { sportsRoom } from './features/sports'
import { tickerRoom } from './features/ticker'
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
  COLOR_PRESETS_KEY,
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
  asColorPresets,
  asCommandStats,
  asHiddenPlan,
  asNames,
  asToolRules,
  asToolbarPresets,
  isLimitList,
  mergePrefs,
  sameSettings,
} from './lib/defaults'
import { FONT_PRESETS_KEY, asFontPresets } from './lib/fonts'
import { percentLeft } from './lib/format'
import {
  DEFAULT_SPORTS,
  LOGO_FOLDER,
  SPORTS_KEY,
  SPORTS_POLL_MS,
  asSportsPlan,
  dayOf,
  gamesFrom,
  isWorthChecking,
  leagueOf,
  logoKey,
  logoSlot,
  logoUrl,
  scoreboardUrl,
  withLogo,
} from './lib/sports'
import { pixelsFrom, pngOf, toBase64 } from './lib/png'
import { PROJECT_COLORS_KEY, asProjectColors, inProject } from './lib/project'
import { front } from './features/front'
import { redrawn } from './lib/tone'
import type { Tone } from './lib/tone'
import {
  DEFAULT_TICKER,
  FEED_HEADERS,
  QUOTES_KEY,
  TICKER_KEY,
  TICKER_POLL_MS,
  asQuotes,
  asTickerPlan,
  isFresh,
  quoteFrom,
  quoteUrl,
  watched,
} from './lib/ticker'
import { TOOLBAR_PRESETS_KEY } from './lib/toolbar'
import { DEFAULT_WEATHER, WEATHER_KEY, WEATHER_POLL_MS, asWeatherPlan, forecastFrom, forecastUrl } from './lib/weather'
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
const colorPresets = atom({ plugin: 'clubhouse', key: 'colorPresets' } as const, [])
const fontPresets = atom({ plugin: 'clubhouse', key: 'fontPresets' } as const, [])
const toolbarPresets = atom({ plugin: 'clubhouse', key: 'toolbarPresets' } as const, [])
const ticker = atom({ plugin: 'clubhouse', key: 'ticker' } as const, DEFAULT_TICKER)
const quotes = atom({ plugin: 'clubhouse', key: 'quotes' } as const, {})
const sports = atom({ plugin: 'clubhouse', key: 'sports' } as const, DEFAULT_SPORTS)
const liveGame = atom({ plugin: 'clubhouse', key: 'liveGame' } as const, null)
const logos = atom({ plugin: 'clubhouse', key: 'logos' } as const, {})
const sportsCheckedAt = atom({ plugin: 'clubhouse', key: 'sportsCheckedAt' } as const, 0)
const weather = atom({ plugin: 'clubhouse', key: 'weather' } as const, DEFAULT_WEATHER)
const forecast = atom({ plugin: 'clubhouse', key: 'forecast' } as const, null)
const receivedNotes = atom({ plugin: 'clubhouse', key: 'receivedNotes' } as const, [])
const pendingNotes = atom({ plugin: 'clubhouse', key: 'pendingNotes' } as const, [])
const sessionFolder = atom({ plugin: 'clubhouse', key: 'sessionFolder' } as const, '')
const hasBooted = atom({ plugin: 'clubhouse', key: 'hasBooted' } as const, false)
const sharedPalette = atom({ plugin: 'clubhouse', key: 'sharedPalette' } as const, null)
const projectRoot = atom({ plugin: 'clubhouse', key: 'projectRoot' } as const, '')

const TICK_MS = 30_000
const PIXELS_TIMEOUT_MS = 5_000

async function appModeNow($: EngineInterface): Promise<Prefs['appMode'] | null> {
  const ran = await $.process.run(['/bin/sh', '-c', READ_APP_MODE]).catch(() => null)

  return ran === null ? null : appModeFrom(ran.stdout)
}

async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
  const mode = await appModeNow($)
  const held = await read($, prefs)

  if (coversApp(held)) {
    await $.process.run(['/bin/sh', '-c', START_HELPER]).catch(() => undefined)
  }

  const own = asProjectColors(await $.store.get(PROJECT_COLORS_KEY))[await read($, projectRoot)]
  const wanted = inProject(mergePrefs(await $.store.get(PREFS_KEY)), own)
  const isChangedElsewhere = !sameSettings(wanted.prefs, held)
  await update($, sharedPalette, () => wanted.shared)

  if (!isChangedElsewhere && (mode === null || mode === held.appMode)) return
  const turned = {
    ...(isChangedElsewhere ? wanted.prefs : held),
    isHelperReady: held.isHelperReady,
    appMode: mode ?? held.appMode,
  }
  await update($, prefs, () => turned)
  const userFolder = await $.env.get('HOME')

  if (userFolder === undefined || !(await isInFront($, userFolder))) return
  await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(turned)).catch(() => undefined)
}

async function isInFront($: EngineInterface, userFolder: string): Promise<boolean> {
  const holder = await $.fs.read(`${userFolder}/${HELPER_FRONT}`).then(
    text => text.trim(),
    () => '',
  )

  return holder === '' || holder === (await $.session.id().catch(() => ''))
}

async function redrawnLogo($: EngineInterface, helper: string, path: string, tone: Tone): Promise<string | null> {
  const ran = await $.process.run([helper, '--pixels', path], { timeoutMs: PIXELS_TIMEOUT_MS }).catch(() => null)
  const pixels = ran !== null && ran.exitCode === 0 ? pixelsFrom(ran.stdout) : null

  return pixels === null ? null : toBase64(pngOf(redrawn(tone, pixels)))
}

async function loadLogos($: EngineInterface, game: Game): Promise<void> {
  const userFolder = await $.env.get('HOME')
  const held: { [key: string]: string } = await read($, logos)

  if (userFolder === undefined) return
  const { tone } = lookOf(await read($, prefs), 'desktop')

  for (const team of [game.home, game.away]) {
    const key = logoKey(game.league, team)
    const slot = logoSlot(key, tone)

    if (team.logo === null || held[slot] !== undefined) continue
    const path = `${userFolder}/${LOGO_FOLDER}/${key}.png`

    if (!(await $.fs.exists(path).catch(() => false))) {
      await $.process
        .run(['/bin/sh', '-c', 'mkdir -p "$(dirname "$1")" && curl -s -m 10 -o "$1" "$2"', 'sh', path, logoUrl(team.logo)])
        .catch(() => undefined)
    }

    const drawn = tone === null ? null : await redrawnLogo($, `${userFolder}/${HELPER_BINARY}`, path, tone)
    const picture = drawn ?? (await $.fs.read(path, { as: 'bytes' }).catch(() => null))?.base64 ?? ''

    if (picture.length > 0) {
      await update($, logos, known => withLogo(known, key, slot, picture))
    }
  }
}

async function scoreCheck($: EngineInterface): Promise<void> {
  const held = await read($, prefs)
  const plan = await read($, sports)

  if (!held.isEnabled || plan.gameId === null || held.bar.sports?.isShown !== true) return
  const at = await $.clock.now()
  const shown: Game | null = await read($, liveGame)
  const current = shown !== null && shown.id === plan.gameId ? shown : null

  if (current !== null) await loadLogos($, current)
  if (!isWorthChecking(current, at, await read($, sportsCheckedAt))) return
  await update($, sportsCheckedAt, () => at)
  const league = leagueOf(plan.gameLeague)
  const days = [undefined, ...(plan.gameDay === null ? [] : [plan.gameDay, dayOf(Date.parse(`${plan.gameDay.slice(0, 4)}-${plan.gameDay.slice(4, 6)}-${plan.gameDay.slice(6)}`) - 86_400_000)])]

  for (const day of days) {
    const page = await $.http.fetch(scoreboardUrl(league, day), { headers: FEED_HEADERS }).catch(() => null)
    const found = page !== null && page.ok ? gamesFrom(page.text, league).find(game => game.id === plan.gameId) : undefined

    if (found !== undefined) {
      await update($, liveGame, () => found)
      await loadLogos($, found)

      return
    }
  }
}

async function skyCheck($: EngineInterface): Promise<void> {
  const held = await read($, prefs)
  const plan = await read($, weather)
  const isRoomOpen = (await $.ui.panes().catch(() => [])).some(pane => pane.id === 'clubhouse-weather')

  if (!held.isEnabled || plan.place === null || !(held.bar.weather?.isShown === true || isRoomOpen)) return
  const page = await $.http.fetch(forecastUrl(plan)).catch(() => null)
  const found = page !== null && page.ok ? forecastFrom(page.text, await $.clock.now()) : null

  if (found !== null) {
    await update($, forecast, () => found)
  }
}

async function priceCheck($: EngineInterface): Promise<void> {
  const held = await read($, prefs)
  const isRoomOpen = (await $.ui.panes().catch(() => [])).some(pane => pane.id === 'clubhouse-ticker')

  if (!held.isEnabled || !(held.bar.ticker?.isShown === true || isRoomOpen)) return
  const at = await $.clock.now()
  const plan = await read($, ticker)
  const symbols = isRoomOpen ? watched(plan) : plan.symbol === null ? [] : [plan.symbol]
  const shared = asQuotes(await $.store.get(QUOTES_KEY).catch(() => null), at)
  const fetched: { [symbol: string]: Quote } = {}

  for (const symbol of symbols) {
    const kept = shared[symbol]

    if (isFresh(kept, at)) {
      await update($, quotes, known => ({ ...known, [symbol]: kept }))
      continue
    }

    const page = await $.http.fetch(quoteUrl(symbol), { headers: FEED_HEADERS }).catch(() => null)
    const quote = page !== null && page.ok ? quoteFrom(page.text, at) : null

    if (quote !== null) {
      fetched[symbol] = quote
      await update($, quotes, known => ({ ...known, [symbol]: quote }))
    }
  }

  if (Object.keys(fetched).length > 0) {
    await $.store.set(QUOTES_KEY, { ...shared, ...fetched }).catch(() => undefined)
  }
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
    const root = (await $.session.repo().catch(() => null))?.root ?? e.cwd
    const mine = inProject(merged, asProjectColors(await $.store.get(PROJECT_COLORS_KEY))[root])
    const saved = { ...mine.prefs, isHelperReady, appMode: (await appModeNow($)) ?? merged.appMode }
    const isStarting = !(await read($, hasBooted))
    await update($, prefs, () => saved)
    await update($, sharedPalette, () => mine.shared)
    await update($, projectRoot, () => root)

    if (userFolder !== undefined) {
      const id = await $.session.id().catch(() => '')

      if (isStarting && id !== '') {
        await $.fs.write(`${userFolder}/${HELPER_FRONT}`, id).catch(() => undefined)
      }

      if (isStarting || (await isInFront($, userFolder))) {
        await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(saved)).catch(() => undefined)
      }

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

    const keptFonts = asFontPresets(await $.store.get(FONT_PRESETS_KEY))
    await update($, fontPresets, () => keptFonts)
    const keptPresets = asColorPresets(await $.store.get(COLOR_PRESETS_KEY))
    const keptWeather = asWeatherPlan(await $.store.get(WEATHER_KEY))
    await update($, weather, () => keptWeather)
    const keptSports = asSportsPlan(await $.store.get(SPORTS_KEY))
    await update($, sports, () => keptSports)
    const keptTicker = asTickerPlan(await $.store.get(TICKER_KEY))
    await update($, ticker, () => keptTicker)
    const keptLayouts = asToolbarPresets(await $.store.get(TOOLBAR_PRESETS_KEY))
    await update($, toolbarPresets, () => keptLayouts)
    await update($, colorPresets, () => keptPresets)
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
    $.clock.every(TICKER_POLL_MS, () => void priceCheck($).catch(() => undefined))
    void priceCheck($).catch(() => undefined)
    $.clock.every(SPORTS_POLL_MS, () => void scoreCheck($).catch(() => undefined))
    void scoreCheck($).catch(() => undefined)
    $.clock.every(WEATHER_POLL_MS, () => void skyCheck($).catch(() => undefined))
    void skyCheck($).catch(() => undefined)

    await $.command.register({
      name: 'clubhouse',
      description: 'Open Claude Clubhouse. Add a room to open it: agents, summary, opinion, tools, recipes, watch, notes, ticker, sports, weather, commands, toolbar, usage, colors, fonts; or on, off, color reset',
      argumentHint: '[on|off|agents|summary|opinion|tools|recipes|watch|notes|ticker|sports|weather|commands|toolbar|usage|colors|fonts|color reset]',
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
  tickerRoom(on)
  sportsRoom(on)
  fontsRoom(on)
  weatherRoom(on)
  usageRoom(on)
  commands(on)
  agents(on)
  colors(on)
  tint(on)
  front(on)
}
