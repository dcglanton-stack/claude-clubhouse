import type { Elements } from 'claude-code'

import type { Limit, Palette, WindowKind } from '../../types'
import { meterSvg, moodFor, moodName } from './clawd'
import { inkOn, rampColor } from './color'
import { WINDOW_NAME, formatSpan, percentLeft, resetIn, textBar } from './format'

type Kit = Elements[keyof Elements]

export type MeterBlock = {
  kind: WindowKind
  limits: readonly Limit[]
  at: number
  width: number
  height: number
}

const TEXT_CELLS = 28

export function makeParts(kit: Kit, palette: Palette) {
  const { Box, Text } = kit
  const { accent, background, clawd } = palette
  const ink = background === null ? {} : { color: inkOn(background) }
  const frame = background === null ? {} : { backgroundColor: background, padding: 1 }

  const note = (text: string) => (
    <Text {...ink} dimColor wrap="wrap">
      {text}
    </Text>
  )
  const plain = (text: string) => (
    <Text {...ink} wrap="wrap">
      {text}
    </Text>
  )
  const card = (title: string, body: unknown) => (
    <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1}>
      <Text bold color={accent}>
        {title}
      </Text>
      {body}
    </Box>
  )
  const meter = ({ kind, limits, at, width, height }: MeterBlock) => {
    const limit = limits.find(one => one.kind === kind)

    if (limit === undefined) {
      return note(`${WINDOW_NAME[kind]}: no reading yet`)
    }

    const left = percentLeft(limit, at)
    const untilReset = resetIn(limit, at)
    const reset =
      untilReset !== null && untilReset > 0 ? ` · resets in ${formatSpan(untilReset)}` : ''
    const { filled, empty } = textBar(left, TEXT_CELLS)

    return (
      <Box flexDirection="column">
        <Text {...ink}>
          {WINDOW_NAME[kind]}: {left}% left{reset}
        </Text>
        {'Svg' in kit ? (
          <kit.Svg
            source={meterSvg({ left, barColor: rampColor(left), clawdColor: clawd, width, height })}
            alt={`${left}% left; Clawd looks ${moodName(moodFor(left))}`}
            width={width}
            height={height}
          />
        ) : (
          <Box>
            {filled !== '' && <Text color={rampColor(left)}>{filled}</Text>}
            {empty !== '' && <Text dimColor>{empty}</Text>}
          </Box>
        )}
      </Box>
    )
  }

  return { ink, frame, note, plain, card, meter }
}
