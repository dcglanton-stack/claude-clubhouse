import type { ElementConstructor, Elements, RenderElement } from 'claude-code'

import type { Limit, Prefs, WindowKind } from '../../types'
import { paintOf } from './appColor'
import { meterSvg, moodFor, moodName } from './clawd'
import { inkOn, isLight, rampColor, surfaceFor } from './color'
import { WINDOW_NAME, formatSpan, percentLeft, resetIn, textBar } from './format'
import { serifSize, serifSvg } from './type'

type Kit = Elements[keyof Elements]

export type MeterBlock = {
  kind: WindowKind
  limits: readonly Limit[]
  at: number
  width: number
  height: number
}

const TEXT_CELLS = 28
const TITLE_SIZE = 24
const HEADING_SIZE = 17
const HAIRLINE = '#87867f'
const ROW_BLEED = 1

export function tintRow(kit: Kit, prefs: Prefs, drawing: RenderElement) {
  const { Box } = kit
  const isLightApp = prefs.appMode === 'light'
  const background = prefs.palette.background ?? surfaceFor(isLightApp)

  return (
    <Box flexDirection="column" backgroundColor={background} marginX={-ROW_BLEED} paddingX={ROW_BLEED}>
      {isLight(background) === isLightApp ? (
        drawing
      ) : (
        <Box flexDirection="column" backgroundColor={surfaceFor(isLightApp)}>
          {drawing}
        </Box>
      )}
    </Box>
  )
}

export function makeParts(kit: Kit, prefs: Prefs, surface: string) {
  const { Box, Text } = kit
  const { appMode } = prefs
  const { accent, clawd } = prefs.palette
  const background = paintOf(prefs)
  const needsChip = background !== null && isLight(background) !== (appMode === 'light')
  const chipColor = surfaceFor(appMode === 'light')
  const chipped =
    <P extends object>(Native: ElementConstructor<P>) =>
    (props: P) =>
      needsChip ? (
        <Box backgroundColor={chipColor} flexShrink={0}>
          <Native {...props} />
        </Box>
      ) : (
        <Native {...props} />
      )
  const Button = chipped(kit.Button)
  const Input = 'Input' in kit ? chipped(kit.Input) : null
  const Select = 'Select' in kit ? chipped(kit.Select) : null
  const Markdown = 'Markdown' in kit ? chipped(kit.Markdown) : null
  const canDraw = surface !== 'terminal'
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
  const serif = (text: string, size: number) =>
    canDraw && 'Svg' in kit ? (
      <kit.Svg
        source={serifSvg({ text, size, color: accent, isStrong: true })}
        alt={text}
        width={serifSize({ text, size }).width}
        height={serifSize({ text, size }).height}
      />
    ) : (
      <Text bold color={accent}>
        {text}
      </Text>
    )
  const title = (text: string) => serif(text, TITLE_SIZE)
  const heading = (text: string) => serif(text, HEADING_SIZE)
  const card = (heading: string, body: unknown) => (
    <Box flexDirection="column" borderStyle="round" borderColor={HAIRLINE} paddingX={1}>
      {serif(heading, HEADING_SIZE)}
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
        {canDraw && 'Svg' in kit ? (
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

  return { ink, frame, note, plain, title, heading, card, meter, Button, Input, Select, Markdown }
}
