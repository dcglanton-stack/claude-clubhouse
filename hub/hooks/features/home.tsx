import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { HubTab, Prefs, WindowKind } from '../../types'
import { COLORS_PANE, DEFAULT_PREFS, HOME_PANE, PREFS_KEY } from '../lib/defaults'
import { meterSvg, moodFor, moodName } from '../lib/clawd'
import { inkOn, rampColor } from '../lib/color'
import {
  WINDOW_NAME,
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
const tab = atom({ plugin: 'hub', key: 'tab' } as const, 'home')

const BIG_METER_WIDTH = 300
const BIG_METER_HEIGHT = 44
const TEXT_CELLS = 28

const TABS: readonly (readonly [HubTab, string])[] = [
  ['home', 'Home'],
  ['next', 'Coming next'],
]

type BandToggle = 'showMeter' | 'showContext' | 'showReceipt'

const BAND_TOGGLES: readonly (readonly [BandToggle, string, string, string])[] = [
  [
    'showMeter',
    '1',
    'Usage meter',
    'Clawd rides a bar that drains as you use your limit: green and happy when full, red and wiped out near empty. Its 5h/7d button switches windows.',
  ],
  [
    'showContext',
    '2',
    'Context gauge',
    'How full this conversation is. A fuller context makes every turn cost more.',
  ],
  [
    'showReceipt',
    '3',
    'Turn receipt',
    'After each turn: how long it took, tokens in and out, and the share of your 5-hour limit it used.',
  ],
]

const PLANNED: readonly (readonly [string, string])[] = [
  ['Workshop: tools', 'Set any tool to Allow, Ask first or Block. Trade safeguards live here.'],
  ['Workshop: agents', 'Create, save, reuse and re-model subagents from a form; a stop button if the engine allows it.'],
  ['Workshop: recipes', 'Turn a shell command into a tool without writing code.'],
  ['Command picker', 'Every slash command, led by your most used and most recent.'],
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

export function home(on: On): void {
  on('command.run', { command: 'hub' }, async ($, e) => {
    const wish = e.args.trim().toLowerCase()

    if (wish === 'on' || wish === 'off') {
      await keep($, held => ({ ...held, isEnabled: wish === 'on' }))

      return {
        text: wish === 'on' ? 'Hub is on.' : 'Hub is off. Type /hub on to bring it back.',
      }
    }

    if (wish === 'colors') {
      await $.ui.open({ id: COLORS_PANE, title: 'Colors', focus: true, closeOnEscape: true })

      return { text: 'Hub colors opened.' }
    }

    await $.ui.open({ id: HOME_PANE, title: 'Hub', focus: true, closeOnEscape: true })

    return { text: 'Hub opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: 'hub' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const chosen = await read($, prefs)
    const shown = await read($, tab)
    const at = await read($, now)
    const { accent, background } = chosen.palette
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
          key="open-colors"
          hotkey="c"
          label="Colors"
          onPress={() =>
            void $.ui.open({ id: COLORS_PANE, title: 'Colors', focus: true, closeOnEscape: true })
          }
        />
        <Button
          key="power"
          hotkey="0"
          label={chosen.isEnabled ? 'Hub is on' : 'Hub is off'}
          variant={chosen.isEnabled ? 'primary' : 'secondary'}
          onPress={() => void keep($, held => ({ ...held, isEnabled: !held.isEnabled }))}
        />
      </Box>
    )

    const main = async () => {
      const list = await read($, limits)
      const context = await read($, contextPercent)
      const made = await read($, receipt)
      const last = await read($, lastReplyAt)

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
                  clawdColor: chosen.palette.clawd,
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
            'Everything the Hub adds is listed here. Type /hub to come back, /hub off to hide it all, /hub on to bring it back. Press a number or click a button; Esc closes.',
          )}
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

          {heading('Shown above the prompt')}
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

          {heading('Changing the Hub')}
          {note(
            'To add or change anything, tell Claude in any session: "in the Hub, ..." and it edits the code in ~/the-hub. Saved changes show up on their own.',
          )}
        </Box>
      )
    }

    const planned = () => (
      <Box flexDirection="column" gap={1}>
        {note('Planned features. Each becomes a switch on the Home tab once it is built.')}
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
