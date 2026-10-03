import type { ElementConstructor, Elements, RenderElement } from 'claude-code'

import type { Limit, Prefs, WindowKind } from '../../types'
import { lookOf } from './appColor'
import { meterSvg, moodFor, moodName, swatchSvg } from './clawd'
import { isLight, rampColor, surfaceFor } from './color'
import { DEFAULT_FONT } from './fonts'
import { WINDOW_NAME, formatSpan, percentLeft, resetIn, textBar } from './format'
import { recolor } from './tone'
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
const SWATCH_WIDTH = 30
const SWATCH_HEIGHT = 16
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

export function frameRow(kit: Kit, edge: string, drawing: RenderElement) {
  const { Box } = kit

  return (
    <Box flexDirection="column" alignItems="flex-end">
      <Box borderStyle="round" borderColor={edge}>
        {drawing}
      </Box>
    </Box>
  )
}

export function makeParts(kit: Kit, prefs: Prefs, surface: string) {
  const { Box, Text } = kit
  const { appMode } = prefs
  const look = lookOf(prefs, surface)
  const { background } = look
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
  const canDraw = surface !== 'terminal' && 'Svg' in kit
  const ink = background === null ? {} : { color: look.ink }
  const frame =
    look.edge !== null
      ? { borderStyle: 'round', borderColor: look.edge, paddingX: 1 }
      : background === null
        ? {}
        : { backgroundColor: background, padding: 1 }
  const rim = look.edge !== null ? { borderStyle: 'round', borderColor: look.edge } : {}
  const picture = (source: string, alt: string, width: number, height: number) =>
    canDraw && 'Svg' in kit ? (
      <kit.Svg source={recolor(source, look.tone)} alt={alt} width={width} height={height} />
    ) : null
  const swatch = (color: string) =>
    picture(
      swatchSvg({ color, rim: look.ink, width: SWATCH_WIDTH, height: SWATCH_HEIGHT }),
      `A swatch of ${color}`,
      SWATCH_WIDTH,
      SWATCH_HEIGHT,
    ) ?? <Text backgroundColor={color}>{'    '}</Text>

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
  const font = prefs.font ?? DEFAULT_FONT
  const serif = (text: string, size: number) =>
    picture(
      serifSvg({ text, size, color: look.accent, isStrong: true, stack: font.stack, weight: font.weight, widen: font.widen }),
      text,
      serifSize({ text, size, widen: font.widen }).width,
      serifSize({ text, size, widen: font.widen }).height,
    ) ?? (
      <Text bold color={look.accent}>
        {text}
      </Text>
    )
  const title = (text: string) => serif(text, TITLE_SIZE)
  const heading = (text: string) => serif(text, HEADING_SIZE)
  const card = (heading: string, body: unknown) => (
    <Box flexDirection="column" gap={1} borderStyle="round" borderColor={look.hairline} paddingX={1}>
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
        {picture(
          meterSvg({
            left,
            barColor: rampColor(left),
            clawdColor: look.clawd,
            trackColor: look.track,
            width,
            height,
          }),
          `${left}% left; Clawd looks ${moodName(moodFor(left))}`,
          width,
          height,
        ) ?? (
          <Box>
            {filled !== '' && <Text color={rampColor(left)}>{filled}</Text>}
            {empty !== '' && <Text dimColor>{empty}</Text>}
          </Box>
        )}
      </Box>
    )
  }

  return {
    look,
    ink,
    frame,
    rim,
    note,
    plain,
    title,
    heading,
    card,
    meter,
    picture,
    swatch,
    Button,
    Input,
    Select,
    Markdown,
  }
}
