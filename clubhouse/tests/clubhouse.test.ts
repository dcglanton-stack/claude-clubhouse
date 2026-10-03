import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const NOW = Date.UTC(2026, 9, 3, 9)
const SURFACES = ['desktop', 'terminal'] as const
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 8,
  bodyColumns: 160,
  scroll: { offset: 0, bodyRows: 8 },
  view: {},
}
const PANE = { title: 'Clubhouse', isFocused: true, bodyColumns: 60, placement: 'dock' as const }
const BLANK = { type: 'Box', props: {}, children: [] }

type World = { open: string[]; filled: string[]; stopped: string[]; toasts: string[] }

function world(on: On, fiveHourUsed: number): World {
  const seen: World = { open: [], filled: [], stopped: [], toasts: [] }

  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { HOME: '/tmp/clubhouse-home' })
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
  on('ui.render', () => BLANK)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', () => ({ cwd: '/tmp/clubhouse-home' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', (_$, e) => {
    seen.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    if (!seen.open.includes(e.id)) seen.open.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    seen.open = seen.open.filter(id => id !== e.id)

    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: seen.open.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('prompt.fill', (_$, e) => {
    seen.filled.push(e.text)

    return { isFilled: true, box: { text: e.text } }
  })
  on('command.list', () => ({
    value: [
      { name: 'clubhouse', description: 'Open Claude Clubhouse', source: 'plugin' },
      { name: 'compact', description: 'Shrink the conversation', source: 'builtin' },
      { name: 'deploy', description: 'Ship the current project', source: 'skill' },
    ],
  }))
  on('agent.list', () => ({
    value: [
      { id: 'a1', description: 'Scout the test suite', type: 'Explore', status: 'running' },
      { id: 'a2', description: 'Review the diff', type: 'general-purpose', status: 'completed' },
    ],
  }))
  on('tool.call', (_$, e) => {
    seen.stopped.push(String((e as { task_id?: string }).task_id))

    return { result: 'stopped', isError: false }
  })

  return seen
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/tmp/clubhouse-home' } as Parameters<Engine['session']['start']>[0])
}

function run($: Engine, command: string, args: string) {
  return $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  } as Parameters<Engine['command']['run']>[0])
}

for (const surface of SURFACES) {
  test(`band shows the home button and the meter on ${surface}`, async ($, on) => {
    const seen = world(on, 18)
    await start($)
    const ui = await $.ui.mount({ plugin: 'clubhouse', surface, component: 'AbovePrompt', props: BAND })

    expect(await ui.find({ type: 'Text', text: /82%/ })).toBeDefined()
    expect((await ui.find({ key: 'window' }))?.text).toBe('5h')
    expect((await ui.find({ key: 'home' }))?.text).toMatch(/Clubhouse/)

    if (surface === 'desktop') {
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    }

    await ui.press({ key: 'home' })
    expect(seen.open).toEqual(['clubhouse'])

    await ui.press({ key: 'window' })
    expect((await ui.find({ key: 'window' }))?.text).toBe('7d')
    expect(await ui.find({ type: 'Text', text: /60%/ })).toBeDefined()
    await ui.unmount()
  })

  test(`a narrow band still shows the home button and meter on ${surface}`, async ($, on) => {
    world(on, 18)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'AbovePrompt',
      props: { ...BAND, bodyColumns: 70 },
    })

    expect(await ui.find({ key: 'home' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /82%/ })).toBeDefined()
    await ui.unmount()
  })

  test(`home opens and closes rooms and toggles the bar on ${surface}`, async ($, on) => {
    const seen = world(on, 95)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse',
      props: PANE,
    })

    expect(await ui.find({ type: 'Text', text: /5-hour window: 5% left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Context window: 12% full/ })).toBeDefined()

    await ui.press({ key: 'room-agents' })
    expect(seen.open).toEqual(['clubhouse-agents'])
    expect((await ui.find({ key: 'room-agents' }))?.text).toBe('Close Agent HQ')

    await ui.press({ key: 'close-rooms' })
    expect(seen.open).toEqual([])
    expect((await ui.find({ key: 'room-agents' }))?.text).toBe('Agent HQ')

    expect((await ui.find({ key: 'showContext' }))?.text).toBe('Off')
    await ui.press({ key: 'showContext' })
    expect((await ui.find({ key: 'showContext' }))?.text).toBe('On')

    await ui.press({ key: 'top-compact' })
    expect(seen.filled).toEqual(['/compact '])

    await ui.press({ key: 'power' })
    expect((await ui.find({ key: 'power' }))?.text).toBe('Clubhouse is off')

    await ui.press({ key: 'tab-next' })
    expect(await ui.find({ type: 'Text', text: /Workshop: tools/ })).toBeDefined()
    await ui.unmount()
  })

  test(`Agent HQ lists agents and stands one down on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-agents',
      props: { ...PANE, title: 'Agent HQ' },
    })

    expect(await ui.find({ type: 'Text', text: /On assignment \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Scout the test suite/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /mission complete/ })).toBeDefined()
    expect(await ui.find({ key: 'stop-a2' })).toBeUndefined()

    await ui.press({ key: 'stop-a1' })
    expect(seen.stopped).toEqual(['a1'])
    expect(await ui.find({ type: 'Text', text: /told to stand down/ })).toBeDefined()
    await ui.unmount()
  })

  test(`Commands lists, filters and fills the prompt on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-commands',
      props: { ...PANE, title: 'Commands' },
    })

    expect(await ui.find({ type: 'Text', text: /All commands \(3\)/ })).toBeDefined()
    await ui.input({ key: 'filter', text: 'ship' })
    expect(await ui.find({ key: 'run-deploy' })).toBeDefined()
    expect(await ui.find({ key: 'run-compact' })).toBeUndefined()

    await ui.press({ key: 'run-deploy' })
    expect(seen.filled).toEqual(['/deploy '])
    expect(await ui.find({ type: 'Text', text: /is in the prompt box/ })).toBeDefined()
    await ui.unmount()
  })

  test(`colors pane sets, nudges and resets colors on ${surface}`, async ($, on) => {
    world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-colors',
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
  const seen = world(on, 18)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
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
  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0]).toMatch(/5h usage is down to 7%/)
  await ui.unmount()
})

test('/clubhouse off hides the band, on restores it, and room words open rooms', async ($, on) => {
  const seen = world(on, 18)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: BAND,
  })

  expect((await run($, 'clubhouse', 'off')).text).toMatch(/Clubhouse is off/)
  expect(await ui.find({ key: 'home' })).toBeUndefined()

  expect((await run($, 'clubhouse', 'on')).text).toBe('Clubhouse is on.')
  expect(await ui.find({ key: 'home' })).toBeDefined()

  expect((await run($, 'clubhouse', 'agents')).text).toBe('Agent HQ opened.')
  expect((await run($, 'clubhouse', '')).text).toBe('Clubhouse opened.')
  expect(seen.open).toEqual(['clubhouse-agents', 'clubhouse'])
  await ui.unmount()
})

test('other commands are counted and lead the top list without being changed', async ($, on) => {
  world(on, 18)
  on('command.run', (_$, e) => ({ text: `ran ${e.command}` }))
  await start($)

  expect((await run($, 'deploy', '')).text).toBe('ran deploy')
  expect((await run($, 'deploy', 'prod')).text).toBe('ran deploy')

  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-commands',
    props: { ...PANE, title: 'Commands' },
  })

  expect(await ui.find({ key: 'top-deploy' })).toBeDefined()
  await ui.unmount()
})
