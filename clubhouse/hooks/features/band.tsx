import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { BarItemId, BarZone, Prefs, Shortcut } from '../../types'
import { paintOf } from '../lib/appColor'
import { meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import {
  BAR_ITEMS,
  DEFAULT_PREFS,
  IDLE_SUMMARY,
  PREFS_KEY,
  WORKING_SUMMARY,
} from '../lib/defaults'
import {
  WINDOW_LABEL,
  cacheNote,
  formatSpan,
  percentLeft,
  receiptNote,
  resetIn,
  textBar,
} from '../lib/format'
import { homeIconSvg } from '../lib/icon'
import { makeParts } from '../lib/parts'
import { summaryOf, summaryRequest } from '../lib/summary'
import { TIDY_MIN_CHARS, tidyRequest } from '../lib/tidy'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const lastAnswer = atom({ plugin: 'clubhouse', key: 'lastAnswer' } as const, '')
const summary = atom({ plugin: 'clubhouse', key: 'summary' } as const, IDLE_SUMMARY)

const BAR_HEIGHT = 32
const WIDE_METER = 210
const SLIM_METER = 150
const TEXT_CELLS = 16
const COLUMNS_FOR_WIDE_METER = 110
const COLUMNS_FOR_DETAILS = 150

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
    const canDraw = e.surface !== 'terminal'
    const { Box, Text } = elements
    const { Button } = makeParts(elements, chosen, e.surface)
    const at = await read($, now)
    const list = await read($, limits)
    const context = await read($, contextPercent)
    const made = await read($, receipt)
    const last = await read($, lastReplyAt)
    const limit = list.find(one => one.kind === chosen.window)
    const columns = e.props.bodyColumns
    const meterWidth = columns >= COLUMNS_FOR_WIDE_METER ? WIDE_METER : SLIM_METER
    const { accent } = chosen.palette
    const background = paintOf(chosen)
    const ink = background === null ? {} : { color: inkOn(background) }
    const frame = background === null ? {} : { backgroundColor: background }
    const flipWindow = () =>
      void keep($, held => ({
        ...held,
        window: held.window === 'five_hour' ? 'seven_day' : 'five_hour',
      }))
    const openHome = () =>
      void $.ui.open({ id: 'clubhouse', title: 'Clubhouse', focus: true, closeOnEscape: true })

    const home = () => (
      <Box gap={1} alignItems="center" flexShrink={0}>
        {canDraw && 'Svg' in elements && (
          <elements.Svg
            source={homeIconSvg({ size: BAR_HEIGHT, accent })}
            alt="Claude Clubhouse"
            width={BAR_HEIGHT}
            height={BAR_HEIGHT}
          />
        )}
        <Button
          key="home"
          label={canDraw && 'Svg' in elements ? 'Clubhouse' : '⌂ Clubhouse'}
          onPress={openHome}
        />
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
        cacheNote(last, at),
      ]
        .filter(one => one !== null)
        .join(' · ')
      const { filled, empty } = textBar(left, TEXT_CELLS)

      return (
        <Box gap={1} alignItems="center" flexShrink={0}>
          {windowButton}
          {canDraw && 'Svg' in elements ? (
            <elements.Svg
              source={meterSvg({
                left,
                barColor: rampColor(left),
                clawdColor: chosen.palette.clawd,
                width: meterWidth,
                height: BAR_HEIGHT,
              })}
              alt={`${left}% of the ${WINDOW_LABEL[chosen.window]} limit left; Clawd looks ${moodName(moodFor(left))}`}
              width={meterWidth}
              height={BAR_HEIGHT}
            />
          ) : (
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

      if (id === 'context') {
        return (
          <Text {...ink} dimColor wrap="truncate">
            {context === null ? 'context: no reading yet' : `context ${context}% full`}
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
          <Box width={columns} alignItems="center">
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
