import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'
import { meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import { DEFAULT_PREFS, PREFS_KEY } from '../lib/defaults'
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

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)

const METER_WIDTH = 210
const METER_HEIGHT = 30
const ICON_SIZE = 26
const TEXT_CELLS = 16
const HOME_CELLS = 18
const SIDE_FOR_DETAILS = 62
const SIDE_FOR_CENTER = 38

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

export function band(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const chosen = await read($, prefs)
    const isEmpty =
      !chosen.showHome && !chosen.showMeter && !chosen.showContext && !chosen.showReceipt

    if (e.props.hasSurvey || !chosen.isEnabled || isEmpty) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const at = await read($, now)
    const list = await read($, limits)
    const context = await read($, contextPercent)
    const made = await read($, receipt)
    const last = await read($, lastReplyAt)
    const limit = list.find(one => one.kind === chosen.window)
    const columns = e.props.bodyColumns
    const side = Math.floor((columns - HOME_CELLS) / 2)
    const isCentered = chosen.showHome && side >= SIDE_FOR_CENTER
    const hasDetails = chosen.showHome ? side >= SIDE_FOR_DETAILS : columns >= SIDE_FOR_DETAILS + 8
    const { accent, background } = chosen.palette
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
      <Box gap={1} alignItems="center">
        {'Svg' in elements && (
          <elements.Svg
            source={homeIconSvg({ size: ICON_SIZE, accent })}
            alt="Claude Clubhouse"
            width={ICON_SIZE}
            height={ICON_SIZE}
          />
        )}
        <Button
          key="home"
          label={'Svg' in elements ? 'Clubhouse' : '⌂ Clubhouse'}
          onPress={openHome}
        />
      </Box>
    )

    const extras = () => (
      <Box gap={2} alignItems="center">
        {chosen.showContext && context !== null && (
          <Text {...ink} dimColor wrap="truncate">
            context {context}% full
          </Text>
        )}
        {chosen.showReceipt && made !== null && (
          <Text {...ink} dimColor wrap="truncate">
            {receiptNote(made)}
          </Text>
        )}
      </Box>
    )

    const meter = () => {
      const windowButton = (
        <Button key="window" label={WINDOW_LABEL[chosen.window]} onPress={flipWindow} />
      )

      if (limit === undefined) {
        return (
          <Box gap={1} alignItems="center">
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
        <Box gap={1} alignItems="center">
          {windowButton}
          {'Svg' in elements ? (
            <elements.Svg
              source={meterSvg({
                left,
                barColor: rampColor(left),
                clawdColor: chosen.palette.clawd,
                width: METER_WIDTH,
                height: METER_HEIGHT,
              })}
              alt={`${left}% of the ${WINDOW_LABEL[chosen.window]} limit left; Clawd looks ${moodName(moodFor(left))}`}
              width={METER_WIDTH}
              height={METER_HEIGHT}
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
          {hasDetails && (
            <Text {...ink} dimColor>
              {details}
            </Text>
          )}
        </Box>
      )
    }

    if (isCentered) {
      return (
        <Box width={columns} alignItems="center" {...frame}>
          <Box width={side} overflow="hidden">
            {extras()}
          </Box>
          <Box width={columns - side * 2} justifyContent="center">
            {home()}
          </Box>
          <Box width={side} justifyContent="flex-end">
            {chosen.showMeter && meter()}
          </Box>
        </Box>
      )
    }

    return (
      <Box width={columns} justifyContent="space-between" alignItems="center" {...frame}>
        <Box gap={2} alignItems="center">
          {chosen.showHome && home()}
          {extras()}
        </Box>
        {chosen.showMeter && meter()}
      </Box>
    )
  })
}
