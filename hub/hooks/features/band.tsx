import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'

import { DEFAULT_PREFS, PREFS_KEY } from '../lib/defaults'
import { meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import {
  WINDOW_LABEL,
  cacheNote,
  formatSpan,
  percentLeft,
  receiptNote,
  resetIn,
  textBar,
} from '../lib/format'

const contextPercent = atom({ plugin: 'hub', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'hub', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'hub', key: 'limits' } as const, [])
const now = atom({ plugin: 'hub', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'hub', key: 'prefs' } as const, DEFAULT_PREFS)
const receipt = atom({ plugin: 'hub', key: 'receipt' } as const, null)

const METER_WIDTH = 210
const METER_HEIGHT = 30
const TEXT_CELLS = 16
const ROOMY_COLUMNS = 70

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

export function band(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const chosen = await read($, prefs)
    const isEmpty = !chosen.showMeter && !chosen.showContext && !chosen.showReceipt

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
    const isRoomy = e.props.bodyColumns >= ROOMY_COLUMNS
    const { background } = chosen.palette
    const ink = background === null ? {} : { color: inkOn(background) }
    const frame = background === null ? {} : { backgroundColor: background, paddingX: 1 }
    const flipWindow = () =>
      void keep($, held => ({
        ...held,
        window: held.window === 'five_hour' ? 'seven_day' : 'five_hour',
      }))
    const windowButton = (
      <Button key="window" label={WINDOW_LABEL[chosen.window]} onPress={flipWindow} />
    )

    const meter = () => {
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
          {isRoomy && (
            <Text {...ink} dimColor>
              {details}
            </Text>
          )}
        </Box>
      )
    }

    return (
      <Box width={e.props.bodyColumns} justifyContent="flex-end">
        <Box gap={3} alignItems="center" {...frame}>
          {chosen.showReceipt && made !== null && (
            <Text {...ink} dimColor>
              {receiptNote(made)}
            </Text>
          )}
          {chosen.showContext && context !== null && (
            <Text {...ink} dimColor>
              context {context}% full
            </Text>
          )}
          {chosen.showMeter && meter()}
        </Box>
      </Box>
    )
  })
}
