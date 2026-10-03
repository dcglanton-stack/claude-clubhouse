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

type World = {
  open: string[]
  filled: string[]
  stopped: string[]
  toasts: string[]
  registered: { name: string; model?: string }[]
  spawned: { subagentType: string; prompt: string }[]
  appended: string[]
}

function world(on: On, fiveHourUsed: number): World {
  const seen: World = {
    open: [],
    filled: [],
    stopped: [],
    toasts: [],
    registered: [],
    spawned: [],
    appended: [],
  }

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
      { name: 'clubhouse', description: 'Open Claude Clubhouse', source: 'plugin', plugin: 'clubhouse' },
      { name: 'compact', description: 'Shrink the conversation', source: 'builtin' },
      { name: 'deploy', description: 'Ship the current project', source: 'user' },
      { name: 'vercel:deploy', description: 'Deploy to Vercel', source: 'plugin', plugin: 'vercel' },
      { name: 'vercel:env', description: 'Manage environment variables', source: 'plugin', plugin: 'vercel' },
    ],
  }))
  on('prompt.attachment', (_$, e) => ({ text: e.text }))
  on('agent.list', () => ({
    value: [
      { id: 'a1', description: 'Scout the test suite', type: 'Explore', status: 'running' },
      { id: 'a2', description: 'Review the diff', type: 'general-purpose', status: 'completed' },
    ],
  }))
  on('agent.register', (_$, e) => {
    seen.registered.push({ name: e.name, model: e.model })

    return { value: { agent: `clubhouse:${e.name}` } }
  })
  on('agent.offer', () => ({ isOffered: true }))
  on('agent.spawn', (_$, e) => {
    seen.spawned.push({ subagentType: e.subagentType, prompt: e.prompt })

    return { model: 'claude-haiku-4-5', agentId: 'spawned-1' }
  })
  on('session.append', (_$, e, next) => {
    seen.appended.push(JSON.stringify(e.message.content))

    return next(e)
  })
  on('model.classify', () => ({ value: 'quick lookup or formatting' }))
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: '- Tests pass.\n- Nothing for you to do.',
      usage: {
        input_tokens: 10,
        output_tokens: 10,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
  }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
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

  test(`home opens rooms, offers commands and switches off on ${surface}`, async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /Context 12% full/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /See agents at work/ })).toBeDefined()
    expect(await ui.find({ key: 'close-agents' })).toBeUndefined()

    await ui.press({ key: 'room-agents' })
    await ui.press({ key: 'room-bar' })
    expect(seen.open).toEqual(['clubhouse-agents', 'clubhouse-bar'])

    await ui.press({ key: 'close-agents' })
    expect(seen.open).toEqual(['clubhouse-bar'])
    expect(await ui.find({ key: 'close-agents' })).toBeUndefined()

    await ui.press({ key: 'top-compact' })
    expect(seen.filled).toEqual(['/compact '])

    await ui.press({ key: 'power' })
    expect((await ui.find({ key: 'power' }))?.text).toBe('Off')

    await ui.press({ key: 'tab-more' })
    expect(await ui.find({ type: 'Text', text: /Workshop: tools/ })).toBeDefined()
    await ui.unmount()
  })

  test(`bar layout adds bars, moves, hides and resets items on ${surface}`, async ($, on) => {
    world(on, 18)
    await start($)
    const bar = await $.ui.mount({ plugin: 'clubhouse', surface, component: 'AbovePrompt', props: BAND })
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-bar',
      props: { ...PANE, title: 'Bar layout' },
    })
    const rowCount = async () =>
      ((await bar.drawn()) as { children: unknown[] }).children.length

    expect((await ui.find({ key: 'bar-home-zone' }))?.text).toBe('Center')
    expect((await ui.find({ key: 'bar-context-show' }))?.text).toBe('Add to bar')
    expect(await ui.find({ key: 'bar-meter-row' })).toBeUndefined()
    expect(await rowCount()).toBe(1)

    await ui.press({ key: 'bar-context-show' })
    expect((await ui.find({ key: 'bar-context-show' }))?.text).toBe('On the bar')
    expect(await bar.find({ type: 'Text', text: /context 12% full/ })).toBeDefined()

    await ui.press({ key: 'bar-add' })
    expect(await ui.find({ type: 'Text', text: /You have 2 bars/ })).toBeDefined()
    await ui.press({ key: 'bar-meter-row' })
    expect((await ui.find({ key: 'bar-meter-row' }))?.text).toBe('Bar 2')
    expect(await rowCount()).toBe(2)

    await ui.press({ key: 'bar-remove' })
    expect(await rowCount()).toBe(1)
    expect(await bar.find({ key: 'window' })).toBeDefined()

    await ui.press({ key: 'bar-home-zone' })
    expect((await ui.find({ key: 'bar-home-zone' }))?.text).toBe('Right')

    await ui.press({ key: 'bar-home-show' })
    expect(await bar.find({ key: 'home' })).toBeUndefined()

    await ui.press({ key: 'bar-reset' })
    expect(await bar.find({ key: 'home' })).toBeDefined()
    expect(await rowCount()).toBe(1)
    await ui.unmount()
    await bar.unmount()
  })

  test(`a button you make appears on the bar, types its text and can be deleted on ${surface}`, async ($, on) => {
    const seen = world(on, 18)
    await start($)
    const bar = await $.ui.mount({ plugin: 'clubhouse', surface, component: 'AbovePrompt', props: BAND })
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-bar',
      props: { ...PANE, title: 'Bar layout' },
    })

    await ui.press({ key: 'shortcut-add' })
    expect(await ui.find({ type: 'Text', text: /needs a label and the text/ })).toBeDefined()

    await ui.input({ key: 'shortcut-label', text: 'Run tests' })
    await ui.input({ key: 'shortcut-text', text: 'run the tests and fix what fails' })
    await ui.press({ key: 'shortcut-add' })
    expect(await ui.find({ type: 'Text', text: /Your button: Run tests/ })).toBeDefined()

    const made = (await bar.findAll({ type: 'Button' })).find(one => one.text === 'Run tests')
    expect(made).toBeDefined()
    await bar.press({ key: made?.key ?? '' })
    expect(seen.filled).toEqual(['run the tests and fix what fails'])

    await ui.press({ key: `sc-${(made?.key ?? '').replace('shortcut-', '')}-remove` })
    expect((await bar.findAll({ type: 'Button' })).some(one => one.text === 'Run tests')).toBe(false)
    await ui.unmount()
    await bar.unmount()
  })

  test(`Summary shortens the last reply from the room and from the bar on ${surface}`, async ($, on) => {
    const seen = world(on, 18)
    await start($)
    const bar = await $.ui.mount({ plugin: 'clubhouse', surface, component: 'AbovePrompt', props: BAND })
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-summary',
      props: { ...PANE, title: 'Summary' },
    })

    expect(await ui.find({ type: 'Text', text: /Nothing to summarize yet/ })).toBeDefined()

    await $.turn.complete({
      answer: 'A long reply about tests. '.repeat(20),
      durationMs: 4000,
      isAborted: false,
      turnId: 't1',
      reason: 'answer',
    } as Parameters<Engine['turn']['complete']>[0])
    expect(await ui.find({ type: 'Text', text: /Press Summarize last reply/ })).toBeDefined()

    await ui.press({ key: 'summary-run' })
    expect(await ui.find({ text: /Tests pass/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Cut from 520 characters/ })).toBeDefined()

    await ui.press({ key: 'summary-auto' })
    expect((await ui.find({ key: 'summary-auto' }))?.text).toBe('Auto: on')

    await bar.press({ key: 'summarize' })
    expect(seen.open).toEqual(['clubhouse-summary'])
    await ui.unmount()
    await bar.unmount()
  })

  test(`Usage room shows both limits full size on ${surface}`, async ($, on) => {
    world(on, 18)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-usage',
      props: { ...PANE, title: 'Usage' },
    })

    expect(await ui.find({ type: 'Text', text: /5-hour window: 82% left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Weekly window: 60% left/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Context window: 12% full/ })).toBeDefined()
    await ui.unmount()
  })

  test(`Agent HQ lists agents, stands one down and dismisses one on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-agents',
      props: { ...PANE, title: 'Agent HQ' },
    })

    expect(await ui.find({ type: 'Text', text: /In the field \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Scout the test suite/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /mission complete/ })).toBeDefined()
    expect(await ui.find({ key: 'stop-a2' })).toBeUndefined()

    await ui.press({ key: 'stop-a1' })
    expect(seen.stopped).toEqual(['a1'])
    expect(await ui.find({ type: 'Text', text: /told to stand down/ })).toBeDefined()

    await ui.press({ key: 'dismiss-a2' })
    expect(await ui.find({ type: 'Text', text: /Review the diff/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`Agent HQ saves, re-models, sends and deletes an agent on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-agents',
      props: { ...PANE, title: 'Agent HQ' },
    })

    await ui.press({ key: 'agent-new' })
    await ui.press({ key: 'agent-save' })
    expect(await ui.find({ type: 'Text', text: /needs a name, a purpose and instructions/ })).toBeDefined()

    await ui.input({ key: 'agent-name', text: 'Test Scout' })
    await ui.input({ key: 'agent-purpose', text: 'Finds which tests cover a change' })
    await ui.input({ key: 'agent-prompt', text: 'Read code and report file paths.' })
    await ui.press({ key: 'agent-save' })

    expect(seen.registered).toEqual([{ name: 'test-scout', model: 'haiku' }])
    expect(await ui.find({ type: 'Text', text: /Your agents \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /picked for you/ })).toBeDefined()

    await ui.press({ key: 'model-test-scout' })
    expect(seen.registered.at(-1)).toEqual({ name: 'test-scout', model: 'sonnet' })

    await ui.press({ key: 'send-test-scout' })
    await ui.input({ key: 'agent-task', text: 'Check the usage tests' })
    await ui.press({ key: 'agent-dispatch' })
    expect(seen.spawned.map(one => one.prompt)).toEqual(['Check the usage tests'])
    expect(await ui.find({ type: 'Text', text: /is on assignment/ })).toBeDefined()

    await ui.press({ key: 'delete-test-scout' })
    expect(await ui.find({ type: 'Text', text: /Your agents \(0\)/ })).toBeDefined()
    await ui.unmount()
  })

  test(`Commands groups, filters, fills the prompt and hides skills on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-commands',
      props: { ...PANE, title: 'Commands' },
    })
    const listing = [
      'Skills you can use:',
      '- deploy: Ship the current project',
      '- vercel:env: Manage environment variables',
      '  across every environment',
      '- vercel:deploy: Deploy to Vercel',
    ].join('\n')
    const told = async () =>
      (
        await $.prompt.attachment({
          type: 'skill_listing',
          text: listing,
          origin: { kind: 'engine' },
        })
      ).text

    expect((await ui.find({ key: 'group-vercel' }))?.text).toBe('▸ Vercel (2)')
    expect((await ui.find({ key: 'group-yours' }))?.text).toBe('▸ Your own (1)')
    expect((await ui.find({ key: 'group-built-in' }))?.text).toBe('▸ Built in (1)')
    expect(await ui.find({ key: 'run-vercel:env' })).toBeUndefined()
    expect(await told()).toBe(listing)

    await ui.press({ key: 'group-vercel' })
    expect(await ui.find({ key: 'run-vercel:env' })).toBeDefined()

    await ui.press({ key: 'hide-vercel:env' })
    expect((await ui.find({ key: 'group-vercel' }))?.text).toBe('▾ Vercel (1)')
    expect((await ui.find({ key: 'group-hidden' }))?.text).toBe('▸ Hidden (1)')
    expect(await told()).toBe(
      ['Skills you can use:', '- deploy: Ship the current project', '- vercel:deploy: Deploy to Vercel'].join('\n'),
    )

    const blocked = await $.tool.call({ tool: 'Skill', skill: 'vercel:env' } as Parameters<Engine['tool']['call']>[0])
    expect(JSON.stringify(blocked)).toMatch(/hid the skill/)

    await ui.press({ key: 'group-hidden' })
    await ui.press({ key: 'unhide-vercel:env' })
    expect((await ui.find({ key: 'group-vercel' }))?.text).toBe('▾ Vercel (2)')
    expect(await told()).toBe(listing)

    await ui.press({ key: 'group-built-in' })
    expect(await ui.find({ key: 'hide-compact' })).toBeUndefined()

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
