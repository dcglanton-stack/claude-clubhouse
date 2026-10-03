import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Forecast, Place, WeatherPlan } from '../../types'
import { backdropOf } from '../lib/appColor'
import { DEFAULT_PREFS, PREFS_KEY, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import { arranged } from '../lib/toolbar'
import {
  DEFAULT_WEATHER,
  KIND_WORD,
  LOCATE_URL,
  WEATHER_KEY,
  dayName,
  forecastFrom,
  forecastUrl,
  placeFrom,
  placesFrom,
  searchUrl,
  weatherSvg,
} from '../lib/weather'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const weather = atom({ plugin: 'clubhouse', key: 'weather' } as const, DEFAULT_WEATHER)
const forecast = atom({ plugin: 'clubhouse', key: 'forecast' } as const, null)
const weatherView = atom({ plugin: 'clubhouse', key: 'weatherView' } as const, { note: null, hits: [] })

const DAY_ICON = 26

async function say($: EngineInterface, note: string | null): Promise<void> {
  await update($, weatherView, view => ({ ...view, note }))
}

async function load($: EngineInterface): Promise<void> {
  const plan = await read($, weather)

  if (plan.place === null) return
  const page = await $.http.fetch(forecastUrl(plan)).catch(() => null)
  const found = page !== null && page.ok ? forecastFrom(page.text, await $.clock.now()) : null

  await (found === null
    ? say($, 'The weather service could not be reached. Try Refresh in a moment.')
    : update($, forecast, () => found))
}

async function keep($: EngineInterface, change: (held: WeatherPlan) => WeatherPlan): Promise<void> {
  await update($, weather, change)
  await $.store.set(WEATHER_KEY, await read($, weather))
  await load($)
}

async function setPlace($: EngineInterface, place: Place): Promise<void> {
  await update($, weatherView, () => ({ note: `Showing the weather for ${place.name}.`, hits: [] }))
  await keep($, held => ({ ...held, place }))
}

async function locate($: EngineInterface): Promise<void> {
  await say($, 'Finding where you are…')
  const page = await $.http.fetch(LOCATE_URL).catch(() => null)
  const place = page !== null && page.ok ? placeFrom(page.text) : null

  await (place === null
    ? say($, 'Your location could not be worked out. Type your town in the box instead.')
    : setPlace($, place))
}

async function search($: EngineInterface, asked: string): Promise<void> {
  if (asked.trim() === '') return
  const page = await $.http.fetch(searchUrl(asked)).catch(() => null)
  const hits = page !== null && page.ok ? placesFrom(page.text) : []
  await update($, weatherView, () => ({
    hits,
    note: hits.length === 0 ? `No place found for "${asked.trim()}".` : 'Pick your place below.',
  }))
}

async function showOnToolbar($: EngineInterface): Promise<void> {
  const outcome = arranged(await read($, prefs), { kind: 'item', id: 'weather' }, 'toggle')
  await update($, prefs, () => outcome.prefs)
  await $.store.set(PREFS_KEY, outcome.prefs)
  await say($, outcome.note)
}

export function weatherRoom(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-weather' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const plan = await read($, weather)
    const sky: Forecast | null = await read($, forecast)
    const view = await read($, weatherView)
    const { look, frame, note, plain, title, card, picture, Button, Input } = makeParts(elements, chosen, e.surface)
    const mark = plan.unit === 'c' ? '°C' : '°F'
    const isShown = chosen.bar.weather?.isShown === true

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Weather')}
        {note(
          'The weather where you are: the temperature, a picture of the sky and the chance of rain on the toolbar, and the next 7 days here. /clubhouse weather opens this.',
        )}
        {card('Where', [
          plain(plan.place === null ? 'No place set yet.' : plan.place.name),
          <Box gap={1} flexWrap="wrap">
            <Button key="weather-locate" label="Use my location" variant="primary" onPress={() => void locate($)} />
            <Button
              key="weather-unit"
              label={plan.unit === 'c' ? 'Celsius' : 'Fahrenheit'}
              onPress={() => void keep($, held => ({ ...held, unit: held.unit === 'c' ? 'f' : 'c' }))}
            />
            <Button key="weather-refresh" label="Refresh" onPress={() => void load($)} />
            <Button
              key="weather-show"
              label={isShown ? 'On the toolbar' : 'Add to toolbar'}
              variant={isShown ? 'primary' : 'secondary'}
              onPress={() => void showOnToolbar($)}
            />
          </Box>,
          Input !== null && (
            <Input
              key="weather-search"
              label="Or type a town"
              placeholder="Austin"
              submitLabel="Find"
              onSubmit={asked => void search($, asked)}
            />
          ),
          ...view.hits.map(hit => (
            <Box>
              <Button key={`weather-place-${hit.name}`} label={hit.name} onPress={() => void setPlace($, hit)} />
            </Box>
          )),
          note('"Use my location" asks a lookup service where your internet connection is, which is usually right to the nearest town. Typing a town is exact.'),
        ])}
        {view.note !== null && plain(view.note)}
        {sky !== null &&
          card('Now', [
            <Box gap={1} alignItems="center">
              {picture(weatherSvg(sky.kind, look.ink, backdropOf(chosen), DAY_ICON + 8), KIND_WORD[sky.kind], DAY_ICON + 8, DAY_ICON + 8)}
              {plain(
                `${sky.temp}${mark} · ${KIND_WORD[sky.kind]}${sky.isWet || sky.chance === null ? '' : ` · ${sky.chance}% chance of rain today`}`,
              )}
            </Box>,
          ])}
        {sky !== null &&
          sky.days.length > 0 &&
          card(
            'Next 7 days',
            sky.days.map(day => (
              <Box gap={1} alignItems="center">
                {picture(weatherSvg(day.kind, look.ink, backdropOf(chosen), DAY_ICON), KIND_WORD[day.kind], DAY_ICON, DAY_ICON)}
                {plain(
                  `${dayName(day.date)} · ${day.high}° / ${day.low}° · ${KIND_WORD[day.kind]}${day.chance === null ? '' : ` · ${day.chance}% rain`}`,
                )}
              </Box>
            )),
          )}
        {note('Forecasts come from Open-Meteo, a free weather service, and refresh every 15 minutes.')}
      </Box>
    )
  })
}
