import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { HomeTab, Prefs } from '../../types'
import { HELPER_CONFIG, START_HELPER, coversApp, helperConfig } from '../lib/appColor'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE, ROOMS, topCommands } from '../lib/defaults'
import { cacheNote, receiptNote } from '../lib/format'
import { homeIconSvg } from '../lib/icon'
import { makeParts } from '../lib/parts'

const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const tab = atom({ plugin: 'clubhouse', key: 'tab' } as const, 'home')

const METER_WIDTH = 280
const METER_HEIGHT = 40
const LOGO_SIZE = 40
const TOP_SIZE = 5

const TABS: readonly (readonly [HomeTab, string])[] = [
  ['home', 'Home'],
  ['more', 'More'],
]

const PLANNED: readonly (readonly [string, string])[] = [
]

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  const chosen = await read($, prefs)
  await $.store.set(PREFS_KEY, chosen)
  const userFolder = await $.env.get('HOME')

  if (userFolder === undefined) return
  await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(chosen)).catch(() => undefined)

  if (coversApp(chosen)) {
    await $.process.run(['/bin/sh', '-c', START_HELPER]).catch(() => undefined)
  }
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
    const { Box, Text } = elements
    const chosen = await read($, prefs)
    const shown = await read($, tab)
    const at = await read($, now)
    await read($, pulse)
    const { ink, frame, note, title, card, meter, look, picture, Button } = makeParts(elements, chosen, e.surface)

    const header = (
      <Box flexDirection="column" gap={1}>
        <Box gap={1} alignItems="center">
          {picture(homeIconSvg({ size: LOGO_SIZE, accent: look.accent }), 'Claude Clubhouse', LOGO_SIZE, LOGO_SIZE)}
          {title('Claude Clubhouse')}
          <Button
            key="power"
            label={chosen.isEnabled ? 'On' : 'Off'}
            variant={chosen.isEnabled ? 'primary' : 'secondary'}
            onPress={() => void keep($, held => ({ ...held, isEnabled: !held.isEnabled }))}
          />
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
          {ROOMS.filter(room => room.isLook === true).map(room => (
            <Button key={`room-${room.word}`} label={room.title} onPress={() => void visit($, room.id, room.title, false)} />
          ))}
        </Box>
        <Box flexDirection="column">
          <Box>
            <Button
              key="safeguard"
              label={chosen.warnsSafeguards === true ? 'Safeguard warning: on' : 'Safeguard warning: off'}
              variant={chosen.warnsSafeguards === true ? 'primary' : 'secondary'}
              onPress={() => void keep($, held => ({ ...held, warnsSafeguards: held.warnsSafeguards !== true }))}
            />
          </Box>
          {note(
            'When on, each prompt is checked before it is sent. If it looks likely to set off a safety filter (which can stop it or hand it to a more restricted model), you are told why and can edit it or send it anyway. A small model makes the guess, so it adds about a second and a few tokens per prompt.',
          )}
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

      return (
        <Box flexDirection="column" gap={1}>
          {card(
            'Rooms',
            <Box flexDirection="column" gap={1}>
              {ROOMS.filter(room => room.isLook !== true).map(room => {
                const isOpen = openIds.includes(room.id)

                return (
                  <Box flexDirection="column">
                    <Box gap={1}>
                      <Button
                        key={`room-${room.word}`}
                        label={room.title}
                        variant={isOpen ? 'primary' : 'secondary'}
                        onPress={() => void visit($, room.id, room.title, false)}
                      />
                      {isOpen && (
                        <Button
                          key={`close-${room.word}`}
                          label="Close"
                          onPress={() => void visit($, room.id, room.title, true)}
                        />
                      )}
                    </Box>
                    {note(room.about)}
                  </Box>
                )
              })}
            </Box>,
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
            meter({ kind: 'five_hour', limits: list, at, width: METER_WIDTH, height: METER_HEIGHT }),
            meter({ kind: 'seven_day', limits: list, at, width: METER_WIDTH, height: METER_HEIGHT }),
            note(
              `${context === null ? 'Context: no reading yet' : `Context ${context}% full`} · ${cacheNote(last, at)}`,
            ),
            made !== null && note(receiptNote(made)),
          ])}
        </Box>
      )
    }

    const more = () => (
      <Box flexDirection="column" gap={1}>
        {card('How to get here', [
          note('Click the arrow beside the house on the toolbar, or type /clubhouse. Esc closes this screen.'),
          note('/clubhouse off hides everything the Clubhouse adds; /clubhouse on brings it back.'),
          note('/ship releases what is on main: it works out the next version, drafts the notes, asks you, then tags, pushes and publishes on GitHub. /ship minor or /ship v1.2.0 picks the number.'),
          note(`A room opens directly with /clubhouse and its word: ${ROOMS.map(room => room.word).join(', ')}.`),
        ])}
        {card('Changing the Clubhouse', [
          note(
            'Tell Claude in any session: "in the clubhouse, ..." and it edits the code in ~/claude-clubhouse. Saved changes show up on their own.',
          ),
        ])}
        {PLANNED.length > 0 &&
          card(
          'Coming next',
          <Box flexDirection="column" gap={1}>
            {PLANNED.map(([name, about]) => (
              <Box flexDirection="column">
                <Text {...ink}>{name}</Text>
                {note(about)}
              </Box>
            ))}
          </Box>,
        )}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {header}
        {shown === 'more' ? more() : await main()}
      </Box>
    )
  })
}
