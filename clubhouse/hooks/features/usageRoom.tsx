import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Prefs } from '../../types'
import { CAP_LEVELS, capLabel, fiveHourLeft, isCapped } from '../lib/cap'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE } from '../lib/defaults'
import { cacheNote, formatSpan, receiptNote } from '../lib/format'
import { nextOf } from '../lib/watch'
import { makeParts } from '../lib/parts'
import { forStore } from '../lib/project'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const sharedPalette = atom({ plugin: 'clubhouse', key: 'sharedPalette' } as const, null)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)
const capLiftedUntil = atom({ plugin: 'clubhouse', key: 'capLiftedUntil' } as const, null)

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, forStore(await read($, prefs), await read($, sharedPalette)))
}

const METER_WIDTH = 360
const METER_HEIGHT = 56

export function usageRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-usage' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const at = await read($, now)
    const list = await read($, limits)
    const context = await read($, contextPercent)
    const made = await read($, receipt)
    const last = await read($, lastReplyAt)
    const { card, frame, meter, note, plain, title, Button } = makeParts(elements, chosen, e.surface)
    const cap = chosen.spendCap ?? 0
    const lifted = await read($, capLiftedUntil)
    const left = fiveHourLeft(list, at)
    const isLifted = lifted !== null && lifted > at

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Usage')}
        {card('5-hour limit', [
          meter({ kind: 'five_hour', limits: list, at, width: METER_WIDTH, height: METER_HEIGHT }),
          note('Resets on a rolling five hours. Clawd gets unhappier as it drains.'),
        ])}
        {card('Spend cap', [
          <Box gap={1} flexWrap="wrap">
            <Button
              key="spend-cap"
              label={capLabel(cap)}
              variant={cap > 0 ? 'primary' : 'secondary'}
              onPress={() => void keep($, held => ({ ...held, spendCap: nextOf(CAP_LEVELS, held.spendCap ?? 0) }))}
            />
            {isLifted && (
              <Button key="spend-cap-restore" label="Put the cap back" onPress={() => void update($, capLiftedUntil, () => null)} />
            )}
          </Box>,
          note(
            'Helper agents use your limit quickly. With a cap set, Claude has to ask you before starting one once your 5-hour limit drops under that level. You can allow one, allow them all until the limit resets, or say no. Agents you send yourself from Agent HQ are never stopped.',
          ),
          cap === 0
            ? null
            : plain(
                isLifted
                  ? `You lifted the cap for the next ${formatSpan(lifted - at)}.`
                  : isCapped({ cap, left, liftedUntil: lifted, at })
                    ? 'You are under the cap now: Claude will ask before starting a helper agent.'
                    : 'You are above the cap: helper agents start as usual.',
              ),
        ])}
        {card('Weekly limit', [
          meter({ kind: 'seven_day', limits: list, at, width: METER_WIDTH, height: METER_HEIGHT }),
          note('Resets once a week.'),
        ])}
        {card('This conversation', [
          plain(context === null ? 'Context: no reading yet' : `Context window: ${context}% full`),
          note('A fuller context makes every turn cost more. /compact shrinks it.'),
          plain(cacheNote(last, at)),
          note('Counts one hour down from the last reply. After it runs out, the next turn re-reads the whole conversation at full price.'),
        ])}
        {card('Last turn', [
          made === null ? note('No turn has finished yet.') : plain(receiptNote(made)),
          note('Time taken, tokens read and written, and the share of the 5-hour limit it used.'),
        ])}
        {note('/clubhouse usage opens this room.')}
      </Box>
    )
  })
}
