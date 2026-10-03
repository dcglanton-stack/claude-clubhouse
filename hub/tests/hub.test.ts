import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const NOW = Date.UTC(2026, 9, 3, 9)
const SURFACES = ['desktop', 'terminal'] as const
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 8,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 8 },
  view: {},
}
const PANE = { title: 'Hub', isFocused: true, bodyColumns: 60, placement: 'dock' as const }

function world(on: On, fiveHourUsed: number): void {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { HOME: '/tmp/hub-home' })
  on('session.usage', () => ({
    value: {
    startedAt: NOW,
    context: { window: 200_000, tokens: 24_000, percent: 12 },
    rateLimits: [
      {
        kind: 'five_hour',
        percentUsed: fiveHourUsed,
        resetsAt: new Date(NOW + 2 * 3_600_000).toISOString(),
      },
      {
        kind: 'seven_day',
        percentUsed: 40,
        resetsAt: new Date(NOW + 3 * 86_400_000).toISOString(),
      },
    ],
    },
  }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', () => ({ cwd: '/tmp/hub-home' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/tmp/hub-home' } as Parameters<Engine['session']['start']>[0])
}

for (const surface of SURFACES) {
  test(`band shows the meter and flips windows on ${surface}`, async ($, on) => {
    world(on, 18)
    await start($)
    const ui = await $.ui.mount({ plugin: 'hub', surface, component: 'AbovePrompt', props: BAND })

    expect(await ui.find({ type: 'Text', text: /82%/ })).toBeDefined()
    expect((await ui.find({ key: 'window' }))?.text).toBe('5h')

    if (surface === 'desktop') {
      expect(await ui.find({ type: 'Svg' })).toBeDefined()
    }

    await ui.press({ key: 'window' })
    expect((await ui.find({ key: 'window' }))?.text).toBe('7d')
    expect(await ui.find({ type: 'Text', text: /60%/ })).toBeDefined()
    await ui.unmount()
  })

  test(`hub pane toggles the band and the master switch on ${surface}`, async ($, on) => {
    world(on, 95)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'hub',
      surface,
      component: 'Pane',
      requestId: 'hub',
      props: PANE,
    })

    expect(await ui.find({ type: 'Text', text: /5-hour window: 5% left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Context window: 12% full/ })).toBeDefined()
    expect((await ui.find({ key: 'showContext' }))?.text).toBe('Off')
    await ui.press({ key: 'showContext' })
    expect((await ui.find({ key: 'showContext' }))?.text).toBe('On')

    await ui.press({ key: 'power' })
    expect((await ui.find({ key: 'power' }))?.text).toBe('Hub is off')

    await ui.press({ key: 'tab-next' })
    expect(await ui.find({ type: 'Text', text: /Workshop: tools/ })).toBeDefined()
    await ui.unmount()
  })

  test(`colors pane sets, nudges and resets colors on ${surface}`, async ($, on) => {
    world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'hub',
      surface,
      component: 'Pane',
      requestId: 'hub-colors',
      props: { ...PANE, title: 'Colors' },
    })

    await ui.press({ key: 'slot-background' })
    await ui.press({ key: 'preset-Paper' })
    expect(await ui.find({ type: 'Text', text: /#f6f3ea/ })).toBeDefined()

    await ui.input({ key: 'hex', text: 'not a color' })
    expect(await ui.find({ type: 'Text', text: /not a hex color/ })).toBeDefined()

    await ui.input({ key: 'hex', text: '#123456' })
    expect(await ui.find({ type: 'Text', text: /#123456/ })).toBeDefined()

    await ui.press({ key: 'reset-colors' })
    expect(await ui.find({ type: 'Text', text: /app default/ })).toBeDefined()
    await ui.unmount()
  })
}

test('a measurement updates the band and warns once when a window runs low', async ($, on) => {
  world(on, 18)
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'hub',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: BAND,
  })
  const low = {
    context: { window: 200_000, tokens: 90_000, percent: 45 },
    rateLimits: [
      {
        kind: 'five_hour',
        percentUsed: 93,
        resetsAt: new Date(NOW + 3_600_000).toISOString(),
      },
    ],
    changed: ['rateLimits' as const],
  }

  await $.session.measure(low)
  await $.session.measure(low)

  expect(await ui.find({ type: 'Text', text: /7%/ })).toBeDefined()
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/5h usage is down to 7%/)
  await ui.unmount()
})

test('/hub off hides the band and /hub on brings it back', async ($, on) => {
  world(on, 18)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'hub',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: BAND,
  })
  const run = (args: string) =>
    $.command.run({
      command: 'hub',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    } as Parameters<Engine['command']['run']>[0])

  expect((await run('off')).text).toMatch(/Hub is off/)
  expect(await ui.find({ key: 'window' })).toBeUndefined()

  expect((await run('on')).text).toBe('Hub is on.')
  expect(await ui.find({ key: 'window' })).toBeDefined()
  await ui.unmount()
})
