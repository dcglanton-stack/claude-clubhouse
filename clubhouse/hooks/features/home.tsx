import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { HomeTab, Prefs, WindowKind } from '../../types'
import { agentSvg, meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import { DEFAULT_PREFS, PREFS_KEY, ROOMS, topCommands } from '../lib/defaults'
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

const BIG_METER_WIDTH = 300
const BIG_METER_HEIGHT = 44
const LOGO_SIZE = 44
const BADGE_UNIT = 2.6
const BADGE_WIDTH = Math.ceil(17.4 * BADGE_UNIT)
const BADGE_HEIGHT = Math.ceil(12 * BADGE_UNIT)
const TEXT_CELLS = 28
const TOP_SIZE = 5

const TABS: readonly (readonly [HomeTab, string])[] = [
  ['home', 'Home'],
  ['next', 'Coming next'],
]

type BandToggle = 'showHome' | 'showMeter' | 'showContext' | 'showReceipt'

const BAND_TOGGLES: readonly (readonly [BandToggle, string, string, string])[] = [
  [
    'showHome',
    '1',
    'Home button',
    'The house in the middle of the bar. It opens this screen. With it off, type /clubhouse.',
  ],
  [
    'showMeter',
    '2',
    'Usage meter',
    'Clawd rides a bar that drains as you use your limit: green and happy when full, red and wiped out near empty. Its 5h/7d button switches windows.',
  ],
  [
    'showContext',
    '3',
    'Context gauge',
    'How full this conversation is. A fuller context makes every turn cost more.',
  ],
  [
    'showReceipt',
    '4',
    'Turn receipt',
    'After each turn: how long it took, tokens in and out, and the share of your 5-hour limit it used.',
  ],
]

const PLANNED: readonly (readonly [string, string])[] = [
  ['Workshop: tools', 'Set any tool to Allow, Ask first or Block. Trade safeguards live here.'],
  ['Workshop: agents', 'Create, save and reuse your own agent types from a form, and pick the model each one runs on.'],
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

async function closeRooms($: EngineInterface): Promise<void> {
  for (const room of ROOMS) {
    await $.ui.close({ id: room.id })
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

    const heading = (title: string) => (
      <Text bold color={accent}>
        {title}
      </Text>
    )
    const note = (text: string) => (
      <Text {...ink} dimColor wrap="wrap">
        {text}
      </Text>
    )

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
        </Box>
        <Box gap={1} flexWrap="wrap">
          {TABS.map(([id, label]) => (
            <Button
              key={`tab-${id}`}
              label={label}
              variant={shown === id ? 'primary' : 'secondary'}
              onPress={() => void update($, tab, () => id)}
            />
          ))}
          <Button
            key="power"
            hotkey="0"
            label={chosen.isEnabled ? 'Clubhouse is on' : 'Clubhouse is off'}
            variant={chosen.isEnabled ? 'primary' : 'secondary'}
            onPress={() => void keep($, held => ({ ...held, isEnabled: !held.isEnabled }))}
          />
        </Box>
      </Box>
    )

    const main = async () => {
      const list = await read($, limits)
      const context = await read($, contextPercent)
      const made = await read($, receipt)
      const last = await read($, lastReplyAt)
      const stats = await read($, commandStats)
      const open = await $.ui.panes()
      const openIds = open.map(one => one.id)
      const isAnyRoomOpen = ROOMS.some(room => openIds.includes(room.id))

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
            <Text {...ink} bold>
              {WINDOW_NAME[kind]}: {left}% left
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
            {note(`${limit.percentUsed}% used${reset}`)}
          </Box>
        )
      }

      return (
        <Box flexDirection="column" gap={1}>
          {note(
            'Everything the Clubhouse adds starts here. Click the house on the bar or type /clubhouse to come back; /clubhouse off hides it all, /clubhouse on brings it back. Esc closes.',
          )}

          {heading('Rooms')}
          {ROOMS.map(room => {
            const isOpen = openIds.includes(room.id)

            return (
              <Box flexDirection="column">
                <Box gap={1} alignItems="center">
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
                    variant={room.word === 'agents' && !isOpen ? 'primary' : 'secondary'}
                    onPress={() => void visit($, room.id, room.title, isOpen)}
                  />
                  {isOpen && <Text {...ink}>open</Text>}
                </Box>
                {note(`${room.about} /clubhouse ${room.word}`)}
              </Box>
            )
          })}
          {isAnyRoomOpen && (
            <Box>
              <Button key="close-rooms" label="Close all rooms" onPress={() => void closeRooms($)} />
            </Box>
          )}

          {heading('Your commands')}
          <Box gap={1} flexWrap="wrap">
            {topCommands(stats, TOP_SIZE).map(name => (
              <Button key={`top-${name}`} label={`/${name}`} onPress={() => void offer($, name)} />
            ))}
          </Box>
          {note('Your most used and most recent. Clicking one puts it in the prompt box. The Commands room has the full list.')}

          {heading('On the bar')}
          {BAND_TOGGLES.map(([key, hotkey, title, about]) => (
            <Box flexDirection="column">
              <Box gap={1}>
                <Button
                  key={key}
                  hotkey={hotkey}
                  label={chosen[key] ? 'On' : 'Off'}
                  variant={chosen[key] ? 'primary' : 'secondary'}
                  onPress={() => void keep($, held => ({ ...held, [key]: !held[key] }))}
                />
                <Text {...ink} bold>
                  {title}
                </Text>
              </Box>
              {note(about)}
            </Box>
          ))}

          {heading('Usage')}
          {bigMeter('five_hour')}
          {bigMeter('seven_day')}
          {note(
            `${context === null ? 'Context: no reading yet' : `Context window: ${context}% full`} · ${cacheNote(last, at)}`,
          )}
          {note(
            'The cache timer counts one hour down from the last reply. After it runs out, the next turn re-reads the whole conversation at full price.',
          )}
          {made !== null && note(receiptNote(made))}

          {heading('Changing the Clubhouse')}
          {note(
            'To add or change anything, tell Claude in any session: "in the clubhouse, ..." and it edits the code in ~/claude-clubhouse. Saved changes show up on their own.',
          )}
        </Box>
      )
    }

    const planned = () => (
      <Box flexDirection="column" gap={1}>
        {note('Planned features. Each becomes a room or a switch on the Home tab once it is built.')}
        {PLANNED.map(([name, about]) => (
          <Box flexDirection="column">
            <Text {...ink} bold>
              {name}
            </Text>
            {note(about)}
          </Box>
        ))}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {header}
        {shown === 'next' ? planned() : await main()}
      </Box>
    )
  })
}
