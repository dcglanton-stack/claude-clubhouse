import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { DEFAULT_PREFS } from '../lib/defaults'
import { cacheNote, receiptNote } from '../lib/format'
import { makeParts } from '../lib/parts'

const contextPercent = atom({ plugin: 'clubhouse', key: 'contextPercent' } as const, null)
const lastReplyAt = atom({ plugin: 'clubhouse', key: 'lastReplyAt' } as const, null)
const limits = atom({ plugin: 'clubhouse', key: 'limits' } as const, [])
const now = atom({ plugin: 'clubhouse', key: 'now' } as const, 0)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)
const receipt = atom({ plugin: 'clubhouse', key: 'receipt' } as const, null)

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
    const { card, frame, meter, note, plain, title } = makeParts(elements, chosen.palette, e.surface)

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Usage')}
        {card('5-hour limit', [
          meter({ kind: 'five_hour', limits: list, at, width: METER_WIDTH, height: METER_HEIGHT }),
          note('Resets on a rolling five hours. Clawd gets unhappier as it drains.'),
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
