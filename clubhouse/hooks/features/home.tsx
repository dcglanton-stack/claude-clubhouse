import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { BarItemId, HomeTab, Prefs, WindowKind } from '../../types'
import { agentSvg, meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import {
  BAR_ITEMS,
  BAR_ROWS,
  BAR_ZONES,
  DEFAULT_BAR,
  DEFAULT_PREFS,
  PREFS_KEY,
  ROOMS,
  topCommands,
} from '../lib/defaults'
import {
  WINDOW_NAME,
  cacheNote,
  formatSpan,
  percentLeft,
  receiptNote,
  resetIn,
  textBar,
} from '../lib/format'
import { homeIconSvg } from '../lib/icon'

const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const tab = atom({ plugin: 'clubhouse', key: 'tab' } as const, 'home')

const BIG_METER_WIDTH = 280
const BIG_METER_HEIGHT = 40
const LOGO_SIZE = 40
const BADGE_UNIT = 2
const BADGE_WIDTH = Math.ceil(17.4 * BADGE_UNIT)
const BADGE_HEIGHT = Math.ceil(12 * BADGE_UNIT)
const TEXT_CELLS = 28
const TOP_SIZE = 5
const BUTTON_COLUMN = 20
const NAME_COLUMN = 16

const TABS: readonly (readonly [HomeTab, string])[] = [
  ['home', 'Home'],
  ['bar', 'Bar layout'],
  ['more', 'More'],
]

const ZONE_LABEL = { left: 'Left', center: 'Center', right: 'Right' } as const

const PLANNED: readonly (readonly [string, string])[] = [
  ['Workshop: tools', 'Set any tool to Allow, Ask first or Block. Trade safeguards live here.'],
  ['Workshop: recipes', 'Turn a shell command into a tool without writing code.'],
  ['Prompt tidy', 'Spell-fix or shorten the draft in the prompt box before you send it.'],
  ['Second opinion', 'Ask an outside model about the session without touching it.'],
  ['Prompt shortcuts', 'One-click buttons for prompts you send often; add your own.'],
  ['Night watch', 'Timers that check on work while you are away and report back.'],
  ['Zen mode', 'Hide tool rows while work runs; show progress and the answer only.'],
  ['Spend cap', 'Pause new subagents below a usage level, with a continue button.'],
  ['Session notes', 'A note you leave for the next session.'],
  ['Release helper', 'A /ship command for tag plus GitHub Release.'],
]

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function visit($: EngineInterface, id: string, title: string, isOpen: boolean): Promise<void> {
  if (isOpen) {
    await $.ui.close({ id })
  } else {
    await $.ui.open({ id, title, focus: true, closeOnEscape: true })
  }

  await update($, pulse, beat => beat + 1)
}

async function offer($: EngineInterface, name: string): Promise<void> {
  try {
    const { isFilled } = await $.prompt.fill({ text: `/${name} ` })

    if (!isFilled) {
      $.ui.toast(`The prompt box is busy. Type /${name} yourself.`)
    }
  } catch {
    $.ui.toast(`Type /${name} in the prompt box`)
  }
}

export function home(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const chosen = await read($, prefs)
    const shown = await read($, tab)
    const at = await read($, now)
    await read($, pulse)
    const { accent, background, clawd } = chosen.palette
    const ink = background === null ? {} : { color: inkOn(background) }
    const frame = background === null ? {} : { backgroundColor: background, padding: 1 }

    const note = (text: string) => (
      <Text {...ink} dimColor wrap="wrap">
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
    const moveSpot = (id: BarItemId, change: (spot: Prefs['bar'][BarItemId]) => Prefs['bar'][BarItemId]) =>
      void keep($, held => ({ ...held, bar: { ...held.bar, [id]: change(held.bar[id]) } }))

    const header = (
      <Box flexDirection="column" gap={1}>
        <Box gap={1} alignItems="center">
          {'Svg' in elements && (
            <elements.Svg
              source={homeIconSvg({ size: LOGO_SIZE, accent })}
              alt="Claude Clubhouse"
              width={LOGO_SIZE}
              height={LOGO_SIZE}
            />
          )}
          <Text {...ink} bold>
            Claude Clubhouse
          </Text>
          <Button
            key="power"
            hotkey="0"
            label={chosen.isEnabled ? 'On' : 'Off'}
            variant={chosen.isEnabled ? 'primary' : 'secondary'}
            onPress={() => void keep($, held => ({ ...held, isEnabled: !held.isEnabled }))}
          />
        </Box>
        <Box gap={1}>
          {TABS.map(([id, label]) => (
            <Button
              key={`tab-${id}`}
              label={label}
              variant={shown === id ? 'primary' : 'secondary'}
              onPress={() => void update($, tab, () => id)}
            />
          ))}
        </Box>
      </Box>
    )

    const main = async () => {
      const list = await read($, limits)
      const context = await read($, contextPercent)
      const made = await read($, receipt)
      const last = await read($, lastReplyAt)
      const stats = await read($, commandStats)
      const openIds = (await $.ui.panes()).map(one => one.id)

      const bigMeter = (kind: WindowKind) => {
        const limit = list.find(one => one.kind === kind)

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
            {'Svg' in elements ? (
              <elements.Svg
                source={meterSvg({
                  left,
                  barColor: rampColor(left),
                  clawdColor: clawd,
                  width: BIG_METER_WIDTH,
                  height: BIG_METER_HEIGHT,
                })}
                alt={`${left}% left; Clawd looks ${moodName(moodFor(left))}`}
                width={BIG_METER_WIDTH}
                height={BIG_METER_HEIGHT}
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

      return (
        <Box flexDirection="column" gap={1}>
          {card(
            'Rooms',
            ROOMS.map(room => {
              const isOpen = openIds.includes(room.id)

              return (
                <Box gap={1} alignItems="center">
                  <Box width={BUTTON_COLUMN} gap={1} alignItems="center">
                    {room.word === 'agents' && 'Svg' in elements && (
                      <elements.Svg
                        source={agentSvg({ color: clawd, unit: BADGE_UNIT, status: 'running' })}
                        alt="A Clawd agent in a suit and sunglasses"
                        width={BADGE_WIDTH}
                        height={BADGE_HEIGHT}
                      />
                    )}
                    <Button
                      key={`room-${room.word}`}
                      label={isOpen ? `Close ${room.title}` : room.title}
                      variant={isOpen ? 'primary' : 'secondary'}
                      onPress={() => void visit($, room.id, room.title, isOpen)}
                    />
                  </Box>
                  <Text {...ink} dimColor wrap="truncate">
                    {room.about}
                  </Text>
                </Box>
              )
            }),
          )}

          {card('Quick commands', [
            <Box gap={1} flexWrap="wrap">
              {topCommands(stats, TOP_SIZE).map(name => (
                <Button key={`top-${name}`} label={`/${name}`} onPress={() => void offer($, name)} />
              ))}
            </Box>,
            note('Your most used and most recent. A click puts one in the prompt box.'),
          ])}

          {card('Usage', [
            bigMeter('five_hour'),
            bigMeter('seven_day'),
            note(
              `${context === null ? 'Context: no reading yet' : `Context ${context}% full`} · ${cacheNote(last, at)}${made === null ? '' : ` · ${receiptNote(made)}`}`,
            ),
          ])}
        </Box>
      )
    }

    const bar = () => (
      <Box flexDirection="column" gap={1}>
        {note(
          'Choose what sits on the bar above the prompt and where. Each item has three buttons: show or hide it, which bar it is on, and left, center or right.',
        )}
        {BAR_ITEMS.map(([id, title, about]) => {
          const spot = chosen.bar[id]

          return card(title, [
            <Box gap={1}>
              <Button
                key={`bar-${id}-show`}
                label={spot.isShown ? 'Shown' : 'Hidden'}
                variant={spot.isShown ? 'primary' : 'secondary'}
                onPress={() => moveSpot(id, held => ({ ...held, isShown: !held.isShown }))}
              />
              <Button
                key={`bar-${id}-row`}
                label={`Bar ${spot.row}`}
                onPress={() => moveSpot(id, held => ({ ...held, row: (held.row % BAR_ROWS) + 1 }))}
              />
              <Button
                key={`bar-${id}-zone`}
                label={ZONE_LABEL[spot.zone]}
                onPress={() =>
                  moveSpot(id, held => ({
                    ...held,
                    zone: BAR_ZONES[(BAR_ZONES.indexOf(held.zone) + 1) % BAR_ZONES.length] ?? 'left',
                  }))
                }
              />
            </Box>,
            note(about),
          ])
        })}
        <Box>
          <Button
            key="bar-reset"
            label="Reset the bar"
            onPress={() => void keep($, held => ({ ...held, bar: DEFAULT_BAR }))}
          />
        </Box>
        {note('Bar 2 appears above the prompt as a second row as soon as something is placed on it.')}
      </Box>
    )

    const more = () => (
      <Box flexDirection="column" gap={1}>
        {card('How to get here', [
          note('Click Clubhouse on the bar, or type /clubhouse. Esc closes this screen.'),
          note('/clubhouse off hides everything the Clubhouse adds; /clubhouse on brings it back.'),
          note('/clubhouse agents, /clubhouse commands and /clubhouse colors open a room directly.'),
        ])}
        {card('Changing the Clubhouse', [
          note(
            'Tell Claude in any session: "in the clubhouse, ..." and it edits the code in ~/claude-clubhouse. Saved changes show up on their own.',
          ),
        ])}
        {card(
          'Coming next',
          PLANNED.map(([name, about]) => (
            <Box gap={1}>
              <Box width={NAME_COLUMN + 4}>
                <Text {...ink}>{name}</Text>
              </Box>
              <Text {...ink} dimColor wrap="truncate">
                {about}
              </Text>
            </Box>
          )),
        )}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {header}
        {shown === 'bar' ? bar() : shown === 'more' ? more() : await main()}
      </Box>
    )
  })
}
