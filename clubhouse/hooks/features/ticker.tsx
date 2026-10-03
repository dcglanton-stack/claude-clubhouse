import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Quote, TickerPlan } from '../../types'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  DEFAULT_TICKER,
  FEED_HEADERS,
  TICKER_KEY,
  changeText,
  cleanSymbol,
  hitsFrom,
  priceText,
  quoteFrom,
  quoteUrl,
  searchUrl,
  watched,
  withFavorite,
} from '../lib/ticker'
import { arranged } from '../lib/toolbar'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const ticker = atom({ plugin: 'clubhouse', key: 'ticker' } as const, DEFAULT_TICKER)
const quotes = atom({ plugin: 'clubhouse', key: 'quotes' } as const, {})
const tickerView = atom({ plugin: 'clubhouse', key: 'tickerView' } as const, { note: null, hits: [] })

async function say($: EngineInterface, note: string | null): Promise<void> {
  await update($, tickerView, view => ({ ...view, note }))
}

async function refresh($: EngineInterface, symbols: readonly string[]): Promise<void> {
  const at = await $.clock.now()

  for (const symbol of symbols) {
    const page = await $.http.fetch(quoteUrl(symbol), { headers: FEED_HEADERS }).catch(() => null)
    const quote = page !== null && page.ok ? quoteFrom(page.text, at) : null

    if (quote !== null) {
      await update($, quotes, held => ({ ...held, [symbol]: quote }))
    }
  }
}

async function keep($: EngineInterface, change: (held: TickerPlan) => TickerPlan): Promise<void> {
  await update($, ticker, change)
  const plan = await read($, ticker)
  await $.store.set(TICKER_KEY, plan)
  await refresh($, watched(plan))
}

async function search($: EngineInterface, asked: string): Promise<void> {
  if (asked.trim() === '') return
  await say($, `Looking up "${asked.trim()}"…`)
  const page = await $.http.fetch(searchUrl(asked), { headers: FEED_HEADERS }).catch(() => null)
  const hits = page !== null && page.ok ? hitsFrom(page.text) : []
  const typed = cleanSymbol(asked)
  await update($, tickerView, () => ({
    hits,
    note:
      page === null || !page.ok
        ? 'The price feed could not be reached. Try again in a moment.'
        : hits.length === 0
          ? `Nothing found for "${asked.trim()}".${typed === null ? '' : ' Check the symbol.'}`
          : null,
  }))
}

async function showOnToolbar($: EngineInterface, symbol: string): Promise<void> {
  await keep($, held => ({ ...held, symbol }))
  const chosen = await read($, prefs)

  if (chosen.bar.ticker?.isShown === true) {
    await say($, `${symbol} is on the toolbar.`)

    return
  }

  const outcome = arranged(chosen, { kind: 'item', id: 'ticker' }, 'toggle')
  await update($, prefs, () => outcome.prefs)
  await $.store.set(PREFS_KEY, outcome.prefs)
  await say($, outcome.note ?? `${symbol} is on the toolbar.`)
}

export function tickerRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-ticker' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const plan = await read($, ticker)
    const prices: { [symbol: string]: Quote } = await read($, quotes)
    const view = await read($, tickerView)
    const { frame, rim, note, plain, title, card, Button, Input } = makeParts(elements, chosen, e.surface)
    const line = (symbol: string) => {
      const quote = prices[symbol]

      return quote === undefined
        ? `${symbol} · no price yet`
        : `${symbol} · ${quote.name} · ${priceText(quote.price)} ${changeText(quote.changePercent)}`
    }
    const actions = (symbol: string, prefix: string) => (
      <Box gap={1} flexWrap="wrap">
        <Button
          key={`${prefix}-show-${symbol}`}
          label={plan.symbol === symbol ? 'On the toolbar' : 'Add to toolbar'}
          variant={plan.symbol === symbol ? 'primary' : 'secondary'}
          onPress={() => void showOnToolbar($, symbol)}
        />
        <Button
          key={`${prefix}-favorite-${symbol}`}
          label={plan.favorites.includes(symbol) ? 'Remove favorite' : 'Favorite'}
          onPress={() => void keep($, held => withFavorite(held, symbol))}
        />
      </Box>
    )

    return (
      <Box flexDirection="column" {...rim}>
        <Box flexDirection="column" gap={1} {...frame}>
          {title('Ticker')}
          {note(
            'One stock or coin on the toolbar: its symbol, price and change for the day. Search below, add one to the toolbar, and keep favorites here. /clubhouse ticker opens this.',
          )}
          {card('On the toolbar', [
            plain(plan.symbol === null ? 'Nothing chosen yet.' : line(plan.symbol)),
            <Box gap={1} flexWrap="wrap">
              <Button
                key="ticker-color"
                label={plan.isColored ? 'Change shown in green or red' : 'Change shown in plain text'}
                onPress={() => void keep($, held => ({ ...held, isColored: !held.isColored }))}
              />
              <Button key="ticker-refresh" label="Refresh prices" onPress={() => void refresh($, watched(plan))} />
            </Box>,
            note('Plain text keeps the change in your text color, so it never clashes with your colors.'),
          ])}
          {Input !== null &&
            card('Find a symbol', [
              <Input
                key="ticker-search"
                label="Search"
                placeholder="AAPL, bitcoin, S&P 500"
                submitLabel="Find"
                onSubmit={asked => void search($, asked)}
              />,
              ...view.hits.map(hit => (
                <Box flexDirection="column">
                  {plain(`${hit.symbol} · ${hit.name} · ${hit.kind}`)}
                  {actions(hit.symbol, 'hit')}
                </Box>
              )),
            ])}
          {view.note !== null && plain(view.note)}
          {plan.favorites.length > 0 &&
            card(
              'Favorites',
              plan.favorites.map(symbol => (
                <Box flexDirection="column">
                  {plain(line(symbol))}
                  {actions(symbol, 'fav')}
                </Box>
              )),
            )}
          {note(
            'Prices come from Yahoo\'s free feed, refresh about once a minute while the ticker is on the toolbar, and can run a few minutes behind. It shows prices only; it does not trade.',
          )}
        </Box>
      </Box>
    )
  })
}
