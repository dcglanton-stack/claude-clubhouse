import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { BarItemId, BarZone, Game, Prefs, Quote, Shortcut } from '../../types'
import { meterSvg, moodFor, moodName } from '../lib/clawd'
import { rampColor } from '../lib/color'
import {
  BAR_ITEMS,
  DEFAULT_PREFS,
  IDLE_SUMMARY,
  PREFS_KEY,
  PREFS_SHAPE,
  WORKING_SUMMARY,
} from '../lib/defaults'
import {
  WINDOW_LABEL,
  cacheNote,
  contextNote,
  formatSpan,
  percentLeft,
  receiptNote,
  resetIn,
  textBar,
} from '../lib/format'
import { homeIconSvg } from '../lib/icon'
import { makeParts } from '../lib/parts'
import { DRAW_BINARY, DRAW_DONE, DRAW_MISSING, DRAW_OPEN, DRAW_TIMEOUT_MS, sketchPrompt } from '../lib/draw'
import { DEFAULT_SPORTS, gameLine, logoKey, scoreSvg } from '../lib/sports'
import { summaryOf, summaryRequest } from '../lib/summary'
import { DEFAULT_TICKER, DOWN_COLOR, UP_COLOR, changeText, priceText } from '../lib/ticker'
import { clearOn, drawnFor } from '../lib/tone'
import { TIDY_MIN_CHARS, tidyRequest } from '../lib/tidy'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const contextSize = atom({ plugin: 'clubhouse', key: 'contextSize' } as const, null)
const ticker = atom({ plugin: 'clubhouse', key: 'ticker' } as const, DEFAULT_TICKER)
const sports = atom({ plugin: 'clubhouse', key: 'sports' } as const, DEFAULT_SPORTS)
const liveGame = atom({ plugin: 'clubhouse', key: 'liveGame' } as const, null)
const logos = atom({ plugin: 'clubhouse', key: 'logos' } as const, {})
const quotes = atom({ plugin: 'clubhouse', key: 'quotes' } as const, {})
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const lastAnswer = atom({ plugin: 'clubhouse', key: 'lastAnswer' } as const, '')
const summary = atom({ plugin: 'clubhouse', key: 'summary' } as const, IDLE_SUMMARY)

const BAR_HEIGHT = 32
const HOME_ICON = 40
const SCORE_WIDTH = 150
const WIDE_METER = 210
const SLIM_METER = 150
const TEXT_CELLS = 16
const COLUMNS_FOR_WIDE_METER = 110
const COLUMNS_FOR_DETAILS = 150
const FRAME_CELLS = 4

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function summarize($: EngineInterface): Promise<void> {
  const answer = await read($, lastAnswer)
  await $.ui.open({ id: 'clubhouse-summary', title: 'Summary', focus: true, closeOnEscape: true })

  if (answer.trim() === '') return
  await update($, summary, () => WORKING_SUMMARY)
  const reply = await $.model.complete(summaryRequest(answer)).catch(() => null)
  await update($, summary, () => summaryOf(reply, answer))
}

type Tidied = { before: string; after: string }

let lastTidy: Tidied | null = null

async function tidy($: EngineInterface): Promise<void> {
  try {
    const draft = (await $.prompt.read()).text

    if (lastTidy !== null && draft === lastTidy.after) {
      await $.prompt.fill({ text: lastTidy.before })
      lastTidy = null
      $.ui.toast('Your original draft is back.')

      return
    }

    if (draft.trim().length < TIDY_MIN_CHARS) {
      $.ui.toast('Type a longer draft first, then press Tidy.')

      return
    }

    $.ui.toast('Tidying your draft…')
    const reply = await $.model.complete(tidyRequest(draft))

    if (!reply.isAnswered || reply.text.trim() === '') {
      $.ui.toast('The tidy model did not answer. Your draft is unchanged.')

      return
    }

    const after = reply.text.trim()
    const { isFilled } = await $.prompt.fill({ text: after })

    if (!isFilled) {
      $.ui.toast('The prompt box changed while tidying. Your draft is unchanged.')

      return
    }

    lastTidy = { before: draft, after }
    $.ui.toast(`Tidied: ${draft.length} to ${after.length} characters. Press Tidy again to undo.`, {
      timeoutMs: 7000,
    })
  } catch {
    $.ui.toast('Could not tidy the draft. It is unchanged.')
  }
}

async function drawIt($: EngineInterface): Promise<void> {
  const userFolder = await $.env.get('HOME')
  const pad = `${userFolder ?? ''}/${DRAW_BINARY}`

  if (userFolder === undefined || !(await $.fs.exists(pad).catch(() => false))) {
    $.ui.toast(DRAW_MISSING, { timeoutMs: 8000 })

    return
  }

  $.ui.toast(DRAW_OPEN)
  const ran = await $.process.run([pad], { timeoutMs: DRAW_TIMEOUT_MS }).catch(() => null)
  const path = ran !== null && ran.exitCode === 0 ? ran.stdout.trim() : ''

  if (path === '') return
  const draft = await $.prompt.read().then(
    box => box.text,
    () => '',
  )
  const isFilled = await $.prompt.fill({ text: sketchPrompt(draft, path) }).then(
    filled => filled.isFilled,
    () => false,
  )
  $.ui.toast(isFilled ? DRAW_DONE : `Your sketch is saved at ${path}. Tell Claude to look at it.`, { timeoutMs: 8000 })
}

async function offer($: EngineInterface, text: string): Promise<void> {
  try {
    const { isFilled } = await $.prompt.fill({ text })

    if (!isFilled) {
      $.ui.toast('The prompt box is busy. Clear it and press the button again.')
    }
  } catch {
    $.ui.toast('Could not reach the prompt box.')
  }
}

export function band(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const chosen = await read($, prefs)
    const spots = [
      ...BAR_ITEMS.map(([id]) => chosen.bar[id]),
      ...chosen.shortcuts.map(one => one.spot),
    ]
    const rows = Array.from({ length: chosen.barCount }, (_, index) => index + 1).filter(row =>
      spots.some(spot => spot.isShown && spot.row === row),
    )

    if (e.props.hasSurvey || !chosen.isEnabled || rows.length === 0) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    const canDraw = e.surface !== 'terminal' && 'Svg' in elements
    const { Box, Text } = elements
    const { Button, look, picture } = makeParts(elements, chosen, e.surface)
    const at = await read($, now)
    const list = await read($, limits)
    const context = await read($, contextPercent)
    const size = await read($, contextSize)
    const plan = await read($, ticker)
    const game: Game | null = await read($, liveGame)
    const marks: { [key: string]: string } = await read($, logos)
    const wanted = (await read($, sports)).gameId
    const prices: { [symbol: string]: Quote } = await read($, quotes)
    const made = await read($, receipt)
    const last = await read($, lastReplyAt)
    const limit = list.find(one => one.kind === chosen.window)
    const columns = e.props.bodyColumns
    const meterWidth = columns >= COLUMNS_FOR_WIDE_METER ? WIDE_METER : SLIM_METER
    const { background, edge } = look
    const ink = background === null ? {} : { color: look.ink }
    const frame =
      edge !== null
        ? { borderStyle: 'round', borderColor: edge, paddingX: 1 }
        : background === null
          ? {}
          : { backgroundColor: background }
    const flipWindow = () =>
      void keep($, held => ({
        ...held,
        window: held.window === 'five_hour' ? 'seven_day' : 'five_hour',
      }))
    const openHome = () =>
      void $.ui.open({ id: 'clubhouse', title: 'Clubhouse', focus: true, closeOnEscape: true })

    const home = () => (
      <Box gap={1} alignItems="center" flexShrink={0}>
        {picture(homeIconSvg({ size: HOME_ICON, accent: look.accent }), 'Claude Clubhouse', HOME_ICON, HOME_ICON)}
        <Button key="home" label={canDraw ? '→' : '⌂ Clubhouse'} onPress={openHome} />
      </Box>
    )

    const meter = () => {
      const windowButton = (
        <Button key="window" label={WINDOW_LABEL[chosen.window]} onPress={flipWindow} />
      )

      if (limit === undefined) {
        return (
          <Box gap={1} alignItems="center" flexShrink={0}>
            {windowButton}
            <Text {...ink} dimColor>
              usage shows after the first reply
            </Text>
          </Box>
        )
      }

      const left = percentLeft(limit, at)
      const untilReset = resetIn(limit, at)
      const details = [
        untilReset !== null && untilReset > 0 ? `resets ${formatSpan(untilReset)}` : null,
        chosen.bar.cache?.isShown === true ? null : cacheNote(last, at),
      ]
        .filter(one => one !== null)
        .join(' · ')
      const { filled, empty } = textBar(left, TEXT_CELLS)

      return (
        <Box gap={1} alignItems="center" flexShrink={0}>
          {windowButton}
          {picture(
            meterSvg({
              left,
              barColor: rampColor(left),
              clawdColor: look.clawd,
              trackColor: look.track,
              width: meterWidth,
              height: BAR_HEIGHT,
            }),
            `${left}% of the ${WINDOW_LABEL[chosen.window]} limit left; Clawd looks ${moodName(moodFor(left))}`,
            meterWidth,
            BAR_HEIGHT,
          ) ?? (
            <Box>
              {filled !== '' && <Text color={rampColor(left)}>{filled}</Text>}
              {empty !== '' && <Text dimColor>{empty}</Text>}
            </Box>
          )}
          <Text {...ink} bold>
            {left}%
          </Text>
          {columns >= COLUMNS_FOR_DETAILS && (
            <Text {...ink} dimColor>
              {details}
            </Text>
          )}
        </Box>
      )
    }

    const piece = (id: BarItemId) => {
      if (id === 'home') return home()
      if (id === 'meter') return meter()

      if (id === 'summary') {
        return <Button key="summarize" label="Summarize" onPress={() => void summarize($)} />
      }

      if (id === 'tidy') {
        return <Button key="tidy" label="Tidy" onPress={() => void tidy($)} />
      }

      if (id === 'draw') {
        return <Button key="draw" label="Draw it" onPress={() => void drawIt($)} />
      }

      if (id === 'sports') {

        if (game === null || game.id !== wanted) {
          return (
            <Text {...ink} dimColor wrap="truncate">
              {wanted === null ? 'live score: pick a game in the Clubhouse' : 'live score …'}
            </Text>
          )
        }

        return (
          picture(
            scoreSvg({
              game,
              ink: look.ink,
              homeLogo: marks[logoKey(game.league, game.home)] ?? null,
              awayLogo: marks[logoKey(game.league, game.away)] ?? null,
              width: SCORE_WIDTH,
              height: HOME_ICON,
            }),
            gameLine(game),
            SCORE_WIDTH,
            HOME_ICON,
          ) ?? (
            <Text {...ink} wrap="truncate">
              {gameLine(game)}
            </Text>
          )
        )
      }

      if (id === 'ticker') {
        const quote = plan.symbol === null ? undefined : prices[plan.symbol]

        if (plan.symbol === null || quote === undefined) {
          return (
            <Text {...ink} dimColor wrap="truncate">
              {plan.symbol === null ? 'ticker: pick one in the Clubhouse' : `${plan.symbol} …`}
            </Text>
          )
        }

        const isUp = (quote.changePercent ?? 0) >= 0
        const wanted = isUp ? UP_COLOR : DOWN_COLOR
        const shown = look.tone === null ? wanted : drawnFor(look.tone, clearOn(look.tone, wanted, 3))

        return (
          <Box gap={1} flexShrink={0}>
            <Text {...ink} bold>
              {quote.symbol}
            </Text>
            <Text {...ink}>{priceText(quote.price)}</Text>
            <Text {...(plan.isColored ? { color: shown } : ink)}>{changeText(quote.changePercent)}</Text>
          </Box>
        )
      }

      if (id === 'cache') {
        return (
          <Text {...ink} dimColor wrap="truncate">
            {cacheNote(last, at)}
          </Text>
        )
      }

      if (id === 'context') {
        return (
          <Text {...ink} dimColor wrap="truncate">
            {contextNote(size, context)}
          </Text>
        )
      }

      return (
        <Text {...ink} dimColor wrap="truncate">
          {made === null ? 'last turn: none yet' : receiptNote(made)}
        </Text>
      )
    }

    const shortcut = (one: Shortcut) => (
      <Button key={`shortcut-${one.id}`} label={one.label} onPress={() => void offer($, one.text)} />
    )

    const zone = (row: number, where: BarZone) => [
      ...BAR_ITEMS.filter(
        ([id]) =>
          chosen.bar[id].isShown && chosen.bar[id].row === row && chosen.bar[id].zone === where,
      ).map(([id]) => piece(id)),
      ...chosen.shortcuts
        .filter(one => one.spot.isShown && one.spot.row === row && one.spot.zone === where)
        .map(shortcut),
    ]

    return (
      <Box flexDirection="column" width={columns} {...frame}>
        {rows.map(row => (
          <Box width={edge === null ? columns : columns - FRAME_CELLS} alignItems="center">
            <Box width={0} flexGrow={1} gap={2} alignItems="center">
              {zone(row, 'left')}
            </Box>
            <Box flexShrink={0} gap={2} alignItems="center" justifyContent="center">
              {zone(row, 'center')}
            </Box>
            <Box width={0} flexGrow={1} gap={2} alignItems="center" justifyContent="flex-end">
              {zone(row, 'right')}
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
