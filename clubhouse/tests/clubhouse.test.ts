import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, MockClock } from 'claude-code/testing'

import { appModeFrom } from '../hooks/lib/appColor'
import { pixelFor, shownFrom, toDisplay, toneFor } from '../hooks/lib/tone'
import { nextVersion, subjectsOf } from '../hooks/lib/ship'
import { serifSize } from '../hooks/lib/type'
import { DEFAULT_WATCH_VIEW, stepOf, watchFrom } from '../hooks/lib/watch'

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
const LIGHT_APP = 'theme=light\nsystem=Dark\n'
const DARK_APP = 'theme=system\nsystem=Dark\n'
const BROKER = '0a1b2c3d-1111-2222-3333-444455556666'

type World = {
  open: string[]
  filled: string[]
  stopped: string[]
  toasts: string[]
  registered: { name: string; model?: string }[]
  spawned: { subagentType: string; prompt: string }[]
  appended: string[]
  ran: string[]
  answer: string
  draft: string
  copied: string[]
  forked: string[]
  completed: string[]
  written: { path: string; text: string }[]
  launched: string[]
  appTheme: string
  tools: { name: string; description: string }[]
  verdict: 'allow' | 'ask' | 'deny'
  output: string
  exitCode: number
  replies: Record<string, { stdout: string; exitCode: number }>
  submitted: string[]
  contexts: (readonly string[])[]
  clock: MockClock
}

type Setup = { hasHelper?: boolean; stored?: Record<string, unknown> }

function world(on: On, fiveHourUsed: number, setup: Setup = {}): World {
  const seen: World = {
    open: [],
    filled: [],
    stopped: [],
    toasts: [],
    registered: [],
    spawned: [],
    appended: [],
    ran: [],
    answer: 'Allow once',
    draft: '',
    copied: [],
    forked: [],
    completed: [],
    written: [],
    launched: [],
    appTheme: '',
    tools: [],
    verdict: 'allow',
    output: '',
    exitCode: 0,
    replies: {},
    submitted: [],
    contexts: [],
    clock: mock.clock(on, { now: NOW }),
  }

  on('prompt.submit', (_$, e) => {
    seen.submitted.push(e.text)
    seen.contexts.push(e.context ?? [])

    return { text: e.text }
  })
  mock.store(on, setup.stored ?? {})
  on('fs.exists', () => ({ value: setup.hasHelper === true }))
  on('fs.write', (_$, e) => {
    seen.written.push({ path: e.path, text: e.text })

    return { value: undefined }
  })
  on('process.run', (_$, e) => {
    const line = e.argv.join(' ')
    const isModeCheck = line.includes('userThemeMode')

    const reply = Object.entries(seen.replies).find(([start]) => line.startsWith(start))?.[1]

    if (!isModeCheck) seen.launched.push(line)

    return {
      value: {
        exitCode: isModeCheck ? 0 : (reply?.exitCode ?? seen.exitCode),
        stdout: isModeCheck ? seen.appTheme : (reply?.stdout ?? seen.output),
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
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
  on('tool.register', (_$, e) => {
    seen.tools.push({ name: e.name, description: e.description })

    return { value: { tool: `mcp__clubhouse__${e.name}` } }
  })
  on('tool.check', () => ({ decision: seen.verdict }))
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
  on('ui.copy', (_$, e) => {
    seen.copied.push(e.text)

    return { value: { isCopied: true } }
  })
  on('prompt.read', () => ({ value: { text: seen.draft, cursor: seen.draft.length } }))
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
  on('model.complete', (_$, e) => {
    seen.completed.push(`${e.model}|${e.prompt}`)

    return {
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
    }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('model.fork', (_$, e) => {
    seen.forked.push(e.prompt)

    return {
      value: {
        isAnswered: true,
        text: 'You are fixing the usage tests.',
        usage: {
          input_tokens: 10,
          output_tokens: 10,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    }
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'fix the usage tests', toolUses: [] },
      { role: 'assistant', text: 'I changed three files.', toolUses: [{}, {}] },
    ],
  }))
  on('tool.list', () => ({
    value: [
      { name: 'Bash', description: 'Run a shell command', mcp: false },
      { name: `mcp__${BROKER}__place_equity_order`, description: 'Place a stock order', mcp: true },
      { name: `mcp__${BROKER}__get_portfolio`, description: 'Read the portfolio', mcp: true },
      { name: 'mcp__coinbase__coinbase_orders_create', description: 'Create an order', mcp: true },
      { name: 'mcp__coinbase__coinbase_balance', description: 'Read balances', mcp: true },
    ],
  }))
  on('tool.call', (_$, e) => {
    const call = e as { tool: string; task_id?: string; questions?: { question: string }[] }

    if (call.tool === 'AskUserQuestion') {
      const questions = call.questions ?? []

      return {
        result: {
          questions,
          answers: Object.fromEntries(questions.map(one => [one.question, seen.answer])),
        },
      }
    }

    if (call.tool === 'TaskStop') {
      seen.stopped.push(String(call.task_id))
    } else {
      seen.ran.push(call.tool)
    }

    return { result: 'done', isError: false }
  })

  return seen
}

type Drawing = {
  findAll: (query: { type: string }) => Promise<{ text: string; props: Record<string, unknown> }[]>
}

async function says(ui: Drawing, pattern: RegExp): Promise<boolean> {
  const drawn = [...(await ui.findAll({ type: 'Text' })), ...(await ui.findAll({ type: 'Svg' }))]

  return drawn.some(one => pattern.test(one.text) || pattern.test(String(one.props.alt ?? '')))
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
    expect((await ui.find({ key: 'home' }))?.text).toMatch(surface === 'terminal' ? /Clubhouse/ : /▸/)

    if (surface === 'desktop') {
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    } else {
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
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
    await ui.press({ key: 'room-toolbar' })
    expect(seen.open).toEqual(['clubhouse-agents', 'clubhouse-bar'])

    await ui.press({ key: 'close-agents' })
    expect(seen.open).toEqual(['clubhouse-bar'])
    expect(await ui.find({ key: 'close-agents' })).toBeUndefined()

    await ui.press({ key: 'top-compact' })
    expect(seen.filled).toEqual(['/compact '])

    await ui.press({ key: 'power' })
    expect((await ui.find({ key: 'power' }))?.text).toBe('Off')

    await ui.press({ key: 'tab-more' })
    expect(await ui.find({ type: 'Text', text: /Draw it/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Workshop: recipes/ })).toBeUndefined()
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
      props: { ...PANE, title: 'Toolbar' },
    })
    const rowCount = async () =>
      ((await bar.drawn()) as { children: unknown[] }).children.length

    expect((await ui.find({ key: 'bar-home-zone' }))?.text).toBe('Center')
    expect((await ui.find({ key: 'bar-context-show' }))?.text).toBe('Add to toolbar')
    expect(await ui.find({ key: 'bar-meter-row' })).toBeUndefined()
    expect(await rowCount()).toBe(1)

    await ui.press({ key: 'bar-context-show' })
    expect((await ui.find({ key: 'bar-context-show' }))?.text).toBe('On the toolbar')
    expect(await bar.find({ type: 'Text', text: /context 24k\/200k full/ })).toBeDefined()

    await ui.press({ key: 'bar-add' })
    expect(await ui.find({ type: 'Text', text: /You have 2 bars/ })).toBeDefined()
    await ui.press({ key: 'bar-meter-row' })
    expect((await ui.find({ key: 'bar-meter-row' }))?.text).toBe('Row 2')
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
      props: { ...PANE, title: 'Toolbar' },
    })

    await ui.press({ key: 'shortcut-add' })
    expect(await ui.find({ type: 'Text', text: /needs a label and the text/ })).toBeDefined()

    await ui.input({ key: 'shortcut-label', text: 'Run tests' })
    await ui.input({ key: 'shortcut-text', text: 'run the tests and fix what fails' })
    await ui.press({ key: 'shortcut-add' })
    expect(await says(ui, /Your button: Run tests/)).toBe(true)

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

    expect(await says(ui, /In the field \(1\)/)).toBe(true)
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
    expect(await says(ui, /Your agents \(1\)/)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /picked for you/ })).toBeDefined()

    await ui.press({ key: 'model-test-scout' })
    expect(seen.registered.at(-1)).toEqual({ name: 'test-scout', model: 'sonnet' })

    await ui.press({ key: 'send-test-scout' })
    await ui.input({ key: 'agent-task', text: 'Check the usage tests' })
    await ui.press({ key: 'agent-dispatch' })
    expect(seen.spawned.map(one => one.prompt)).toEqual(['Check the usage tests'])
    expect(await ui.find({ type: 'Text', text: /is on assignment/ })).toBeDefined()

    await ui.press({ key: 'delete-test-scout' })
    expect(await says(ui, /Your agents \(0\)/)).toBe(true)
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
    expect(await says(ui, /Hidden skills \(1\)/)).toBe(true)
    expect(await told()).toBe(
      ['Skills you can use:', '- deploy: Ship the current project', '- vercel:deploy: Deploy to Vercel'].join('\n'),
    )

    const blocked = await $.tool.call({ tool: 'Skill', skill: 'vercel:env' } as Parameters<Engine['tool']['call']>[0])
    expect(JSON.stringify(blocked)).toMatch(/hid the skill/)

    await ui.input({ key: 'preset-name', text: 'coding' })
    await ui.press({ key: 'preset-save' })
    expect(await ui.find({ type: 'Text', text: /coding \(1 hidden\)/ })).toBeDefined()

    await ui.press({ key: 'unhide-vercel:env' })
    expect((await ui.find({ key: 'group-vercel' }))?.text).toBe('▾ Vercel (2)')
    expect(await told()).toBe(listing)

    await ui.press({ key: 'preset-use-coding' })
    expect(await says(ui, /Hidden skills \(1\)/)).toBe(true)
    await ui.press({ key: 'preset-start-coding' })
    expect((await ui.find({ key: 'preset-start-coding' }))?.text).toBe('Every session: on')
    await ui.press({ key: 'unhide-all' })
    expect(await says(ui, /Hidden skills \(0\)/)).toBe(true)
    await ui.press({ key: 'preset-delete-coding' })
    expect(await ui.find({ key: 'preset-use-coding' })).toBeUndefined()

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

  test(`Tool rules group tools, guard money tools, ask first and block on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-tools',
      props: { ...PANE, title: 'Tool rules' },
    })
    const order = 'mcp__coinbase__coinbase_orders_create'
    const balance = 'mcp__coinbase__coinbase_balance'
    const call = (tool: string) =>
      $.tool.call({ tool, product_id: 'BTC-USD' } as Parameters<Engine['tool']['call']>[0])

    expect((await ui.find({ key: 'tgroup-built-in' }))?.text).toBe('▸ Built in (1)')
    expect((await ui.find({ key: 'tgroup-coinbase' }))?.text).toBe('▸ Coinbase (2)')
    expect((await ui.find({ key: `tgroup-${BROKER}` }))?.text).toBe('▸ Connector 1 (2)')
    expect(await ui.find({ type: 'Text', text: /2 connected tools can place/ })).toBeDefined()

    await call(order)
    expect(seen.ran).toEqual([order])

    await ui.press({ key: 'tools-safeguard' })
    expect((await ui.find({ key: 'tools-safeguard' }))?.text).toBe('Safeguard is on')
    expect(await ui.find({ key: `mine-mcp__${BROKER}__place_equity_order` })).toBeDefined()

    await call(order)
    expect(seen.ran).toEqual([order, order])

    seen.answer = 'Deny'
    expect(JSON.stringify(await call(order))).toMatch(/declined/)
    expect(seen.ran).toEqual([order, order])

    await ui.press({ key: 'tgroup-coinbase' })
    await ui.press({ key: `rule-${balance}` })
    await ui.press({ key: `rule-${balance}` })
    expect(JSON.stringify(await call(balance))).toMatch(/blocked the tool/)

    await ui.press({ key: 'rules-clear' })
    await call(balance)
    expect(seen.ran).toEqual([order, order, balance])
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

test('buttons get a backing when the chosen background would hide them', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const drawn = async () => JSON.stringify(await ui.drawn())

  expect(await drawn()).not.toMatch(/#30302e/)

  await ui.press({ key: 'slot-background' })
  await ui.press({ key: 'anthropic-Ivory Light' })
  expect(await drawn()).toMatch(/"backgroundColor":"#30302e"/)

  seen.appTheme = LIGHT_APP
  await ui.press({ key: 'anthropic-Ivory Light' })
  expect(await ui.find({ type: 'Text', text: /light right now/ })).toBeDefined()
  expect(await drawn()).not.toMatch(/#30302e/)

  await ui.press({ key: 'look-slate' })
  expect(await drawn()).toMatch(/"backgroundColor":"#faf9f5"/)
  await ui.unmount()
})

test('without the helper the background paints the rooms and every conversation row', async ($, on) => {
  world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const row = (component: string, props: object) =>
    $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component, props } as Parameters<
      Engine['ui']['mount']
    >[0])
  const mine = await row('UserMessage', { text: 'hello there', origin: { kind: 'sdk' }, isExpanded: false })
  const reply = await row('AssistantMessage', { text: 'A **bold** reply', isFirstOfReply: true })
  const toolRow = await row('ToolUse', {})
  const shown = async (drawing: { drawn: () => Promise<unknown> }) => JSON.stringify(await drawing.drawn())
  const native = JSON.stringify(BLANK)
  const tinted = (background: string, children: unknown[]) =>
    JSON.stringify({
      type: 'Box',
      props: { flexDirection: 'column', backgroundColor: background, marginX: -1, paddingX: 1 },
      children,
    })

  expect(await shown(reply)).toBe(native)
  expect(await ui.find({ type: 'Text', text: /is not installed on this Mac/ })).toBeDefined()

  await ui.press({ key: 'look-slate' })
  for (const drawing of [mine, reply, toolRow]) {
    expect(await shown(drawing)).toBe(tinted('#141413', [BLANK]))
  }
  expect(JSON.stringify(await ui.drawn())).toMatch(/"backgroundColor":"#141413","padding":1/)

  await ui.press({ key: 'reach' })
  expect((await ui.find({ key: 'reach' }))?.text).toBe('Background covers: the conversation')
  expect(await shown(reply)).toBe(tinted('#141413', [BLANK]))

  await ui.press({ key: 'reach' })
  expect((await ui.find({ key: 'reach' }))?.text).toBe('Background covers: the Clubhouse only')
  expect(await shown(reply)).toBe(native)

  await ui.press({ key: 'reach' })
  await ui.press({ key: 'look-ivory' })
  expect(await shown(reply)).toBe(
    tinted('#faf9f5', [
      { type: 'Box', props: { flexDirection: 'column', backgroundColor: '#30302e' }, children: [BLANK] },
    ]),
  )

  expect((await run($, 'clubhouse', 'color reset')).text).toBe('Clubhouse colors are back to their defaults.')
  expect(await shown(reply)).toBe(native)

  await ui.press({ key: 'look-slate' })
  await ui.press({ key: 'reset-colors' })
  expect(await shown(reply)).toBe(native)
  expect(await ui.find({ type: 'Text', text: /app default/ })).toBeDefined()
  await ui.unmount()
  await mine.unmount()
  await reply.unmount()
  await toolRow.unmount()
})

test('with the helper the whole app takes the color and the Clubhouse paints nothing itself', async ($, on) => {
  const seen = world(on, 50, { hasHelper: true })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const reply = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'AssistantMessage',
    props: { text: 'A reply', isFirstOfReply: true },
  } as Parameters<Engine['ui']['mount']>[0])
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const config = () => JSON.parse(seen.written.at(-1)?.text ?? '{}') as Record<string, unknown>
  const painted = async (drawing: { drawn: () => Promise<unknown> }) =>
    ((await drawing.drawn()) as { props: { backgroundColor?: string } }).props.backgroundColor === '#141413'

  expect(seen.written.at(-1)?.path).toBe('/tmp/clubhouse-home/.claude/clubhouse-helper/tint.json')
  expect(config().enabled).toBe(false)
  expect(seen.launched).toEqual([])

  await ui.press({ key: 'look-slate' })
  expect(config()).toEqual({ enabled: true, target: '#141413', ink: '#faf9f5', radius: 18, isLightApp: false, boost: 1.9 })
  expect(seen.launched).toHaveLength(1)
  expect(seen.launched[0]).toMatch(/clubhouse-helper\/window-tint/)
  expect(await painted(ui)).toBe(false)
  expect(await painted(reply)).toBe(false)
  expect(await painted(bar)).toBe(false)

  expect(JSON.stringify(await ui.drawn())).toMatch(/^\{"type":"Box","props":\{"flexDirection":"column","gap":1,"borderStyle":"round","borderColor":"#[0-9a-f]{6}","paddingX":1\}/)
  expect(JSON.stringify(await bar.drawn())).toMatch(/"borderStyle":"round"/)

  seen.appTheme = LIGHT_APP
  await ui.press({ key: 'look-slate' })
  expect(config()).toEqual({ enabled: true, target: '#141413', ink: '#faf9f5', radius: 18, isLightApp: true, boost: 1.9 })
  expect(await ui.find({ type: 'Text', text: /This is a dark color on a light app/ })).toBeDefined()
  seen.appTheme = DARK_APP
  await ui.press({ key: 'look-slate' })
  expect(await ui.find({ type: 'Text', text: /swaps light and dark/ })).toBeUndefined()

  await ui.press({ key: 'look-ivory' })
  expect(config()).toEqual({ enabled: true, target: '#faf9f5', ink: '#141413', radius: 18, isLightApp: false, boost: 1.9 })
  expect(await ui.find({ type: 'Text', text: /This is a light color on a dark app/ })).toBeDefined()
  expect(await painted(ui)).toBe(false)
  await ui.press({ key: 'look-slate' })
  expect(config().enabled).toBe(true)

  await ui.press({ key: 'reach' })
  expect(config().enabled).toBe(false)
  expect(await painted(ui)).toBe(true)
  expect(await painted(reply)).toBe(true)
  expect(await painted(bar)).toBe(true)

  await ui.press({ key: 'reach' })
  await ui.press({ key: 'reach' })
  expect(config().enabled).toBe(true)

  expect((await run($, 'clubhouse', 'off')).text).toMatch(/Clubhouse is off/)
  expect(config().enabled).toBe(false)
  expect((await run($, 'clubhouse', 'on')).text).toBe('Clubhouse is on.')
  expect(config().enabled).toBe(true)

  await ui.press({ key: 'reset-colors' })
  expect(config().enabled).toBe(false)
  await ui.unmount()
  await reply.unmount()
  await bar.unmount()
})

test('the app colors for Developer Mode are copied for the chosen background, with an undo', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })

  expect(await ui.find({ key: 'window-tint' })).toBeUndefined()
  await ui.press({ key: 'advanced' })
  await ui.press({ key: 'window-tint' })
  expect(seen.copied).toEqual([])
  expect(await ui.find({ type: 'Text', text: /Pick a background color first/ })).toBeDefined()

  await ui.press({ key: 'look-slate' })
  await ui.press({ key: 'window-tint' })
  expect(seen.copied).toHaveLength(1)
  expect(seen.copied[0]).toMatch(/clubhouse-window-tint/)
  expect(seen.copied[0]).toMatch(/--bg-100: 60 2\.\d% 7\.\d% !important/)
  expect(seen.copied[0]).toMatch(/--text-000: 48 33\.3% 97\.1% !important/)
  expect(seen.copied[0]).not.toMatch(/fetch|XMLHttpRequest|cookie|localStorage/)

  await ui.press({ key: 'look-ivory' })
  await ui.press({ key: 'window-tint' })
  expect(seen.copied[1]).toMatch(/--text-000: 60 2\.6% 7\.6% !important/)

  await ui.press({ key: 'window-undo' })
  expect(seen.copied[2]).toBe("document.getElementById('clubhouse-window-tint')?.remove()")
  await ui.unmount()
})

test('Second opinion asks Claude here or an outside model without touching the session', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-opinion',
    props: { ...PANE, title: 'Second opinion' },
  })

  expect(await ui.find({ type: 'Text', text: /Nothing asked yet/ })).toBeDefined()

  await ui.press({ key: 'opinion-here' })
  expect(seen.forked).toHaveLength(1)
  expect(seen.forked[0]).toMatch(/Question: Is this session on the right track/)
  expect(await ui.find({ text: /fixing the usage tests/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /From Claude in this session/ })).toBeDefined()

  await ui.input({ key: 'opinion-question', text: 'Was changing three files necessary?' })
  await ui.press({ key: 'opinion-model' })
  expect((await ui.find({ key: 'opinion-outside' }))?.text).toBe('Ask Opus')

  await ui.press({ key: 'opinion-outside' })
  expect(seen.completed).toHaveLength(1)
  expect(seen.completed[0]).toMatch(/^opus\|/)
  expect(seen.completed[0]).toMatch(/User: fix the usage tests/)
  expect(seen.completed[0]).toMatch(/Assistant: I changed three files\. \[used 2 tools\]/)
  expect(seen.completed[0]).toMatch(/The user asks: Was changing three files necessary\?/)
  expect(await ui.find({ type: 'Text', text: /From Opus, which saw only an excerpt/ })).toBeDefined()
  expect(seen.appended).toEqual([])
  await ui.unmount()
})

test('a preset marked for every session is the hidden list a new session starts with', async ($, on) => {
  world(on, 50, {
    stored: {
      hidden: ['deploy'],
      hiddenPlan: { presets: { coding: ['vercel:env', 'vercel:deploy'] }, startWith: 'coding' },
    },
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-commands',
    props: { ...PANE, title: 'Commands' },
  })

  expect(await says(ui, /Hidden skills \(2\)/)).toBe(true)
  expect(await ui.find({ key: 'unhide-vercel:env' })).toBeDefined()
  expect(await ui.find({ key: 'unhide-deploy' })).toBeUndefined()
  expect((await ui.find({ key: 'group-yours' }))?.text).toBe('▸ Your own (1)')
  expect(await ui.find({ key: 'group-vercel' })).toBeUndefined()
  await ui.unmount()
})

test('the hue buttons give a grey color a hue', async ($, on) => {
  world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })

  await ui.press({ key: 'slot-background' })
  await ui.input({ key: 'hex', text: '#1e1e1e' })
  await ui.press({ key: 'hue-on' })
  const first = (await ui.findAll({ type: 'Text' })).map(one => one.text).find(text => /^#[0-9a-f]{6}$/.test(text) && text !== '#d97757' && text !== '#e8743b')

  expect(first).toBeDefined()
  expect(first).not.toBe('#1e1e1e')
  const [red, green, blue] = [1, 3, 5].map(at => Number.parseInt((first ?? '#000000').slice(at, at + 2), 16))
  expect(Math.max(red ?? 0, green ?? 0, blue ?? 0) - Math.min(red ?? 0, green ?? 0, blue ?? 0)).toBeGreaterThan(20)

  await ui.press({ key: 'hue-on' })
  const second = (await ui.findAll({ type: 'Text' })).map(one => one.text).find(text => /^#[0-9a-f]{6}$/.test(text) && text !== '#d97757' && text !== '#e8743b')
  expect(second).not.toBe(first)
  await ui.unmount()
})

test('Tidy rewrites the draft and a second press restores it', async ($, on) => {
  const seen = world(on, 18)
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const original = 'so basically i want you to like run the tests and then fix whatever is broken ok'

  seen.draft = 'short'
  await bar.press({ key: 'tidy' })
  expect(seen.filled).toEqual([])
  expect(seen.toasts.at(-1)).toMatch(/longer draft/)

  seen.draft = original
  await bar.press({ key: 'tidy' })
  expect(seen.filled).toEqual(['- Tests pass.\n- Nothing for you to do.'])

  seen.draft = '- Tests pass.\n- Nothing for you to do.'
  await bar.press({ key: 'tidy' })
  expect(seen.filled.at(-1)).toBe(original)
  await bar.unmount()
})

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

test('colors the Clubhouse draws land where they are wanted under the helper', () => {
  const levels = (...channels: number[]) => channels.map(channel => channel / 255)
  const isNear = (one: readonly number[], other: readonly number[], slack: number) =>
    one.every((level, at) => Math.abs(level - (other[at] ?? 0)) * 255 <= slack)
  const measured = toneFor({ target: '#faf9f5', ink: '#161616', isLightApp: false })
  const grey = (level: number) => [level / 255, level / 255, level / 255] as const

  expect(isNear(toDisplay('#151b27'), levels(22, 27, 38), 1)).toBe(true)
  expect(isNear(shownFrom(measured, [137 / 255, 135 / 255, 130 / 255]), levels(40, 39, 34), 2)).toBe(true)
  expect(isNear(shownFrom(measured, grey(54)), levels(195, 194, 191), 2)).toBe(true)
  expect(isNear(shownFrom(measured, grey(33)), toDisplay('#faf9f5'), 0.5)).toBe(true)
  expect(isNear(shownFrom(measured, grey(21)), toDisplay('#faf9f5'), 0.5)).toBe(true)

  for (const target of ['#0d243d', '#141413', '#faf9f5', '#f5e3c7']) {
    const tone = toneFor({ target, ink: target === '#0d243d' || target === '#141413' ? '#faf9f5' : '#141413', isLightApp: false })

    for (const wanted of ['#d97757', '#e8743b', '#1e8449', '#2f7fd1']) {
      expect(isNear(shownFrom(tone, pixelFor(tone, wanted)), toDisplay(wanted), 3)).toBe(true)
    }
  }

  const lightApp = toneFor({ target: '#faf9f5', ink: '#141413', isLightApp: true })
  expect(isNear(shownFrom(lightApp, pixelFor(lightApp, '#d97757')), toDisplay('#d97757'), 3)).toBe(true)
  expect(isNear(shownFrom(lightApp, grey(240)), toDisplay('#faf9f5'), 0.5)).toBe(true)
})

test('a heading is drawn wide enough for its letters', () => {
  expect(serifSize({ text: 'Commands', size: 24 }).width).toBeGreaterThan(134)
  expect(serifSize({ text: 'Quick commands', size: 17 }).width).toBeGreaterThan(152)
  expect(serifSize({ text: 'Rooms', size: 17 }).width).toBeGreaterThan(62)
})

test('the Clubhouse reads dark or light from the app instead of asking', async ($, on) => {
  const seen = world(on, 50, { hasHelper: true })
  seen.appTheme = LIGHT_APP
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })

  expect(await ui.find({ key: 'app-mode' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /light right now/ })).toBeDefined()
  expect(JSON.parse(seen.written.at(-1)?.text ?? '{}')).toMatchObject({ isLightApp: true })

  expect(appModeFrom('theme=system\nsystem=Dark\n')).toBe('dark')
  expect(appModeFrom('theme=system\nsystem=\n')).toBe('light')
  expect(appModeFrom('theme=dark\nsystem=\n')).toBe('dark')
  expect(appModeFrom('theme=\nsystem=\n')).toBeNull()
  expect(appModeFrom('')).toBeNull()
  await ui.unmount()
})

test('the Text color is what the helper writes with, and each color resets on its own', async ($, on) => {
  const seen = world(on, 50, { hasHelper: true })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const config = () => JSON.parse(seen.written.at(-1)?.text ?? '{}') as Record<string, unknown>

  await ui.press({ key: 'preset-Night' })
  expect(config()).toMatchObject({ enabled: true, target: '#15171c', ink: '#faf9f5' })

  await ui.press({ key: 'slot-text' })
  expect((await ui.find({ key: 'preset-none' }))?.text).toBe('Automatic')
  await ui.press({ key: 'preset-Sun' })
  expect(config().ink).toBe('#f2b632')
  await ui.press({ key: 'preset-none' })
  expect(config().ink).toBe('#faf9f5')
  expect(await ui.find({ type: 'Text', text: /^automatic$/ })).toBeDefined()

  await ui.press({ key: 'preset-Sun' })
  await ui.press({ key: 'reset-text' })
  expect(config().ink).toBe('#faf9f5')

  await ui.press({ key: 'slot-accent' })
  await ui.press({ key: 'preset-Ocean' })
  expect(await ui.find({ type: 'Text', text: /^#2f7fd1$/ })).toBeDefined()
  await ui.press({ key: 'reset-accent' })
  expect(await ui.find({ type: 'Text', text: /^#2f7fd1$/ })).toBeUndefined()
  expect(config().enabled).toBe(true)

  await ui.press({ key: 'reset-background' })
  expect(config().enabled).toBe(false)

  await ui.press({ key: 'slot-text' })
  await ui.press({ key: 'preset-Sun' })
  expect(config()).toMatchObject({ enabled: true, target: '#151515', ink: '#f2b632' })
  await ui.unmount()
})

test('under the helper pictures are redrawn for the screen and your own prompts get a border', async ($, on) => {
  world(on, 50, { hasHelper: true })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const row = (component: string, props: object) =>
    $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component, props } as Parameters<
      Engine['ui']['mount']
    >[0])
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const mine = await row('UserMessage', { text: 'hello there', origin: { kind: 'sdk' }, isExpanded: false })
  const notice = await row('UserMessage', {
    text: 'a task finished',
    origin: { kind: 'task-notification' },
    isExpanded: false,
    task: { id: 'task-1' },
  })
  const reply = await row('AssistantMessage', { text: 'A reply', isFirstOfReply: true })
  const shown = async (drawing: { drawn: () => Promise<unknown> }) => JSON.stringify(await drawing.drawn())
  const native = JSON.stringify(BLANK)

  expect(await shown(bar)).not.toMatch(/display-p3/)
  expect(await shown(mine)).toBe(native)

  await ui.press({ key: 'look-slate' })
  expect(await shown(bar)).toMatch(/display-p3/)
  expect(await shown(ui)).toMatch(/display-p3/)
  expect(await shown(mine)).toMatch(
    /^\{"type":"Box","props":\{"flexDirection":"column","alignItems":"flex-end"\},"children":\[\{"type":"Box","props":\{"borderStyle":"round","borderColor":"#[0-9a-f]{6}","paddingX":1\}/,
  )
  expect(await shown(notice)).toBe(native)
  expect(await shown(reply)).toBe(native)

  await ui.press({ key: 'reach' })
  expect(await shown(bar)).not.toMatch(/display-p3/)
  await ui.unmount()
  await bar.unmount()
  await mine.unmount()
  await notice.unmount()
  await reply.unmount()
})

for (const surface of SURFACES) {
  test(`a recipe becomes a tool Claude can call, with blanks passed as arguments, on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-recipes',
      props: { ...PANE, title: 'Recipes' },
    })
    const call = (tool: string, args: object) =>
      $.tool.call({ tool, ...args } as Parameters<Engine['tool']['call']>[0])

    await ui.press({ key: 'recipe-save' })
    expect(await ui.find({ type: 'Text', text: /Give the recipe a name/ })).toBeDefined()

    await ui.input({ key: 'recipe-name', text: 'Find Word' })
    await ui.input({ key: 'recipe-about', text: 'Finds a word in a file' })
    await ui.input({ key: 'recipe-command', text: "grep -n {word} '{file}' | head -5; echo ${HOME}" })
    await ui.press({ key: 'recipe-save' })
    expect(seen.tools.at(-1)?.name).toBe('find_word')
    expect(seen.tools.at(-1)?.description).toMatch(/Finds a word in a file/)
    expect(await ui.find({ type: 'Text', text: /Claude fills in: word, file\./ })).toBeDefined()
    expect(await ui.find({ key: 'recipe-try-find_word' })).toBeUndefined()

    seen.output = '3:hello there\n'
    const ran = await call('mcp__clubhouse__find_word', { word: 'hello; rm -rf ~', file: 'my notes.txt' })
    expect(seen.launched.at(-1)).toBe(
      '/bin/sh -c grep -n "${1}" \'\'"${2}"\'\' | head -5; echo ${HOME} find_word hello; rm -rf ~ my notes.txt',
    )
    expect(ran.result).toMatch(/find_word finished with exit code 0\.\n3:hello there/)

    seen.verdict = 'ask'
    seen.answer = 'Deny'
    const before = seen.launched.length
    expect((await call('mcp__clubhouse__find_word', { word: 'x', file: 'y' })).deny).toMatch(/declined the recipe/)
    expect(seen.launched).toHaveLength(before)
    seen.verdict = 'allow'

    await ui.input({ key: 'recipe-name', text: 'list' })
    await ui.input({ key: 'recipe-command', text: 'ls' })
    await ui.press({ key: 'recipe-save' })
    seen.output = 'README.md\n'
    await ui.press({ key: 'recipe-try-list' })
    expect(await ui.find({ type: 'Text', text: /README\.md/ })).toBeDefined()

    await ui.press({ key: 'recipe-delete-list' })
    expect(await ui.find({ key: 'recipe-try-list' })).toBeUndefined()
    expect((await call('mcp__clubhouse__list', {})).deny).toMatch(/was deleted/)
    await ui.unmount()
  })
}

test('saved recipes are tools again in the next session, and Tool rules still apply to them', async ($, on) => {
  const seen = world(on, 50, {
    stored: {
      recipes: [{ name: 'run_tests', about: 'Runs the tests', command: 'npm test' }, { name: '', command: 'bad' }],
      toolRules: { mcp__clubhouse__run_tests: 'block' },
    },
  })
  await start($)

  expect(seen.tools.map(one => one.name)).toEqual(['run_tests'])
  const blocked = await $.tool.call({ tool: 'mcp__clubhouse__run_tests' } as Parameters<Engine['tool']['call']>[0])
  expect(blocked.deny).toMatch(/blocked the tool/)
  expect(seen.launched).toEqual([])
})

const HALF_HOUR = 30 * 60_000
const WATCH_ID = `watch-${NOW}`

for (const surface of SURFACES) {
  test(`a night watch wakes Claude on its timer, and waits while Claude is still busy, on ${surface}`, async ($, on) => {
    const seen = world(on, 50)
    await start($)
    const ui = await $.ui.mount({
      plugin: 'clubhouse',
      surface,
      component: 'Pane',
      requestId: 'clubhouse-watch',
      props: { ...PANE, title: 'Night watch' },
    })

    await ui.press({ key: 'watch-start' })
    expect(await ui.find({ type: 'Text', text: /Say what Claude should do/ })).toBeDefined()

    await ui.input({ key: 'watch-task', text: 'Check the build is still going' })
    await ui.press({ key: 'watch-start' })
    expect(await ui.find({ type: 'Text', text: /The first check is in 30 minutes/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Wakes Claude every 30 minutes\./ })).toBeDefined()

    await seen.clock.advance(HALF_HOUR - 20_000)
    expect(seen.submitted).toEqual([])

    await seen.clock.advance(20_000)
    expect(seen.submitted).toHaveLength(1)
    expect(seen.submitted[0]).toMatch(/Night watch check 1 of 8\./)
    expect(seen.submitted[0]).toMatch(/Their instruction: Check the build is still going/)
    expect(await ui.find({ type: 'Text', text: /Check 1 of 8 · Check the build is still going: time to check\. Woke Claude\./ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 of 8 checks done · next check in 30m/ })).toBeDefined()

    await seen.clock.advance(HALF_HOUR)
    expect(seen.submitted).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: /still busy with the last wake-up\. Skipped\./ })).toBeDefined()

    expect((await ui.find({ key: `watch-stop-${WATCH_ID}` }))?.text).toBe('End watch')
    await ui.press({ key: `watch-stop-${WATCH_ID}` })
    expect(await ui.find({ key: `watch-stop-${WATCH_ID}` })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Ended · Check the build is still going/ })).toBeDefined()
    await seen.clock.advance(HALF_HOUR)
    expect(seen.submitted).toHaveLength(1)
    await ui.unmount()
  })
}

test('a watch with a check command only wakes Claude when the command says something is wrong', async ($, on) => {
  const seen = world(on, 50, {
    stored: { recipes: [{ name: 'bot_alive', about: '', command: 'pgrep -f botfort' }] },
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-watch',
    props: { ...PANE, title: 'Night watch' },
  })

  await ui.press({ key: 'watch-recipe-bot_alive' })
  await ui.press({ key: 'watch-start' })
  expect(
    await ui.find({ type: 'Text', text: /Runs pgrep -f botfort every 30 minutes\. Wakes Claude when the command fails\./ }),
  ).toBeDefined()

  seen.output = '4242\n'
  await seen.clock.advance(HALF_HOUR)
  expect(seen.launched.at(-1)).toBe('/bin/sh -c pgrep -f botfort')
  expect(seen.submitted).toEqual([])
  expect(await ui.find({ type: 'Text', text: /Check 1 of 8 · pgrep -f botfort: all fine\./ })).toBeDefined()

  seen.exitCode = 1
  seen.output = ''
  await ui.press({ key: `watch-now-${WATCH_ID}` })
  await seen.clock.advance(10_000)
  expect(seen.submitted).toHaveLength(1)
  expect(seen.submitted[0]).toMatch(/the check command failed \(exit code 1\)/)
  expect(seen.submitted[0]).toMatch(/It printed nothing\./)
  expect(seen.submitted[0]).toMatch(/Find out what is wrong/)
  await ui.unmount()
})

test('a quiet watch only notes trouble, and no watch wakes Claude when the limit is nearly gone', async ($, on) => {
  const seen = world(on, 95)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-watch',
    props: { ...PANE, title: 'Night watch' },
  })

  seen.exitCode = 1
  await ui.input({ key: 'watch-command', text: 'false' })
  await ui.press({ key: 'watch-start' })
  await seen.clock.advance(HALF_HOUR)
  expect(seen.submitted).toEqual([])
  expect(await ui.find({ type: 'Text', text: /under 10% of your 5-hour limit is left, so Claude was not woken/ })).toBeDefined()

  await ui.press({ key: `watch-stop-${WATCH_ID}` })
  await ui.input({ key: 'watch-command', text: 'false' })
  await ui.press({ key: 'watch-quiet' })
  expect((await ui.find({ key: 'watch-quiet' }))?.text).toBe('Just note it here')
  await ui.press({ key: 'watch-start' })
  await seen.clock.advance(HALF_HOUR)
  expect(seen.submitted).toEqual([])
  expect(seen.toasts.some(text => /Night watch: the check command failed \(false\)/.test(text))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /Noted here; Claude was not woken\./ })).toBeDefined()
  await ui.unmount()
})

test('a watch step tells stalled from changed output, gives up after three wake-ups and ends on its last check', () => {
  const ran = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: '' })
  const facts = { at: 2000, percentLeft: 50, lastReplyAt: 9000 }
  const stalls = watchFrom({ name: '', task: '', command: 'tail -1 log' }, { ...DEFAULT_WATCH_VIEW, trigger: 'stalls' }, 1000)
  const first = stepOf(stalls, { ...facts, ran: ran('a') })
  expect(first.prompt).toBeNull()
  expect(stepOf(first.watch ?? stalls, { ...facts, ran: ran('b') }).prompt).toBeNull()
  expect(stepOf(first.watch ?? stalls, { ...facts, ran: ran('a') }).prompt).toMatch(/has not changed since the last check/)

  const changes = { ...stalls, trigger: 'changes' as const, lastOutput: 'a' }
  expect(stepOf(changes, { ...facts, ran: ran('a') }).prompt).toBeNull()
  expect(stepOf(changes, { ...facts, ran: ran('b') }).prompt).toMatch(/its output changed since the last check/)
  expect(stepOf(changes, { ...facts, ran: ran('b') }).prompt).toMatch(/<output>\nb\n<\/output>/)

  const fails = { ...stalls, trigger: 'fails' as const, wakesInARow: 2 }
  const third = stepOf(fails, { ...facts, ran: ran('', 1) })
  expect(third.watch).toBeNull()
  expect(third.prompt).not.toBeNull()
  expect(third.entry).toMatch(/Stopped the watch: that is 3 wake-ups in a row/)
  expect(stepOf({ ...fails, wakesInARow: 1 }, { ...facts, ran: ran('', 0) }).watch?.wakesInARow).toBe(0)
  expect(stepOf(fails, { ...facts, ran: null }).prompt).toMatch(/could not run or took over a minute/)

  const woken = { ...fails, wakesInARow: 0, wokeAt: 1000 }
  expect(stepOf(woken, { ...facts, lastReplyAt: null, ran: ran('', 1) }).entry).toMatch(/still busy/)
  expect(stepOf(woken, { ...facts, at: 1000 + 3 * 3_600_000, lastReplyAt: null, ran: ran('', 1) }).prompt).not.toBeNull()

  const last = stepOf({ ...stalls, checksDone: stalls.maxChecks - 1 }, { ...facts, ran: ran('a') })
  expect(last.watch).toBeNull()
  expect(last.entry).toMatch(/all fine\. That was the last check\./)
  expect(last.toast).toMatch(/Night watch finished/)
})

test('a watch can be saved, started with one press in a later session, and deleted', async ($, on) => {
  const seen = world(on, 50, {
    stored: {
      savedWatches: [
        { name: 'BOTfort check', task: 'Restart it', command: 'pgrep -f botfort', trigger: 'fails', isQuiet: false, everyMinutes: 15, maxChecks: 4 },
        { name: 'broken', task: 'x', command: '', everyMinutes: 7, maxChecks: 4 },
      ],
    },
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-watch',
    props: { ...PANE, title: 'Night watch' },
  })

  expect(await ui.find({ key: 'watch-saved-start-broken' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Runs pgrep -f botfort every 15 minutes\. Wakes Claude when the command fails\. 4 checks\./ })).toBeDefined()

  await ui.press({ key: 'watch-saved-start-BOTfort check' })
  expect(await ui.find({ key: `watch-now-${WATCH_ID}` })).toBeDefined()
  seen.exitCode = 1
  await seen.clock.advance(15 * 60_000)
  expect(seen.submitted[0]).toMatch(/Their instruction: Restart it/)
  expect(await ui.find({ type: 'Text', text: /Check 1 of 4 · BOTfort check: the check command failed\. Woke Claude\./ })).toBeDefined()

  await ui.input({ key: 'watch-name', text: 'Deploy watch' })
  await ui.input({ key: 'watch-task', text: 'Say whether the deploy finished' })
  await ui.press({ key: 'watch-every' })
  await ui.press({ key: 'watch-save' })
  expect(await ui.find({ key: 'watch-saved-start-Deploy watch' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Wakes Claude every 60 minutes\. 8 checks\./ })).toBeDefined()
  expect(await ui.find({ key: 'watch-stop-watch-' + String(NOW + 15 * 60_000) })).toBeUndefined()

  await ui.press({ key: 'watch-saved-delete-BOTfort check' })
  expect(await ui.find({ key: 'watch-saved-start-BOTfort check' })).toBeUndefined()
  await ui.unmount()
})

test('the spend cap makes Claude ask before starting a helper agent when the limit is low', async ($, on) => {
  const seen = world(on, 85)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-usage',
    props: { ...PANE, title: 'Usage' },
  })
  const spawn = () =>
    $.agent.spawn({ subagentType: 'Explore', prompt: 'Look around', description: 'map the repo' } as Parameters<
      Engine['agent']['spawn']
    >[0])

  expect((await ui.find({ key: 'spend-cap' }))?.text).toBe('Spend cap: off')
  expect((await spawn()).deny).toBeUndefined()
  expect(seen.spawned).toHaveLength(1)

  await ui.press({ key: 'spend-cap' })
  expect((await ui.find({ key: 'spend-cap' }))?.text).toBe('Spend cap: ask under 10% left')
  expect(await ui.find({ type: 'Text', text: /You are above the cap/ })).toBeDefined()
  expect((await spawn()).deny).toBeUndefined()

  await ui.press({ key: 'spend-cap' })
  expect((await ui.find({ key: 'spend-cap' }))?.text).toBe('Spend cap: ask under 20% left')
  expect(await ui.find({ type: 'Text', text: /You are under the cap now/ })).toBeDefined()

  seen.answer = 'Do not start it'
  const refused = await spawn()
  expect(refused.deny).toMatch(/spend cap in Claude Clubhouse stopped this helper agent: 15% of the 5-hour limit is left/)
  expect(seen.spawned).toHaveLength(2)

  seen.answer = 'Start this one'
  expect((await spawn()).deny).toBeUndefined()
  expect(seen.spawned).toHaveLength(3)

  seen.answer = 'Start them until the limit resets'
  expect((await spawn()).deny).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /You lifted the cap for the next 2h 0m\./ })).toBeDefined()
  seen.answer = 'Do not start it'
  expect((await spawn()).deny).toBeUndefined()
  expect(seen.spawned).toHaveLength(5)

  await ui.press({ key: 'spend-cap-restore' })
  expect((await spawn()).deny).toMatch(/spend cap/)
  await ui.unmount()
})

test('the toolbar can show the cache timer, and /clubhouse bar still opens the Toolbar room', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-bar',
    props: { ...PANE, title: 'Toolbar' },
  })
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  expect(await bar.find({ type: 'Text', text: /cache —$/ })).toBeDefined()
  await ui.press({ key: 'bar-cache-show' })
  expect(await bar.find({ type: 'Text', text: /^cache —$/ })).toBeDefined()
  expect(await bar.find({ type: 'Text', text: /resets 2h 0m$/ })).toBeDefined()

  expect((await run($, 'clubhouse', 'bar')).text).toBe('Toolbar opened.')
  expect((await run($, 'clubhouse', 'toolbar')).text).toBe('Toolbar opened.')
  expect(seen.open).toContain('clubhouse-bar')
  await ui.unmount()
  await bar.unmount()
})

test('a session note goes to the next new session that fits, once, and never to a reload', async ($, on) => {
  const seen = world(on, 50, {
    stored: {
      notes: [
        { id: 'note-1', text: 'Pick up at the Stripe webhook', folder: '/tmp/clubhouse-home', keep: 'once', at: 1 },
        { id: 'note-2', text: 'Other project only', folder: '/somewhere/else', keep: 'once', at: 2 },
        { id: 'note-3', text: 'Always use British spelling', folder: null, keep: 'always', at: 3 },
        { id: 'note-4', text: '', folder: null, keep: 'once', at: 4 },
      ],
    },
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-notes',
    props: { ...PANE, title: 'Session notes' },
  })

  expect(seen.toasts.some(text => /2 session notes are waiting/.test(text))).toBe(true)
  expect(await ui.find({ key: 'note-delete-note-1' })).toBeUndefined()
  expect(await ui.find({ key: 'note-delete-note-2' })).toBeDefined()
  expect(await ui.find({ key: 'note-delete-note-3' })).toBeDefined()

  await $.prompt.submit({ text: 'hello' })
  expect(seen.contexts.at(-1)?.join('\n')).toMatch(/- Pick up at the Stripe webhook\n- Always use British spelling/)
  expect(seen.contexts.at(-1)?.join('\n')).not.toMatch(/Other project only/)

  await $.prompt.submit({ text: 'again' })
  expect(seen.contexts.at(-1)).toEqual([])

  await start($)
  await $.prompt.submit({ text: 'after a reload' })
  expect(seen.contexts.at(-1)).toEqual([])

  await ui.press({ key: 'note-save' })
  expect(await ui.find({ type: 'Text', text: /Type the note and press Enter/ })).toBeDefined()
  await ui.input({ key: 'note-text', text: 'Tests are red on purpose' })
  expect((await ui.find({ key: 'note-where' }))?.text).toBe('For: sessions in clubhouse-home')
  await ui.press({ key: 'note-keep' })
  await ui.press({ key: 'note-save' })
  expect(await ui.find({ type: 'Text', text: /Goes to every session that starts in the folder clubhouse-home, until you delete it\. Sessions already running/ })).toBeDefined()

  await ui.press({ key: 'note-now-note-2' })
  expect(await ui.find({ type: 'Text', text: /Could not hand the note to Claude/ })).toBeDefined()
  expect(await ui.find({ key: 'note-delete-note-2' })).toBeDefined()

  await ui.press({ key: `note-delete-note-${NOW}` })
  expect(await ui.find({ key: `note-delete-note-${NOW}` })).toBeUndefined()
  await ui.unmount()
})

test('/ship works out the version, asks, then tags, pushes and publishes, and only from a clean main', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const done = (stdout: string) => ({ stdout, exitCode: 0 })

  expect(nextVersion('v0.15.0', '')).toBe('v0.15.1')
  expect(nextVersion('v0.15.0', 'minor')).toBe('v0.16.0')
  expect(nextVersion('v0.15.0', 'major')).toBe('v1.0.0')
  expect(nextVersion('v0.15.0', '2.0.0')).toBe('v2.0.0')
  expect(nextVersion(null, '')).toBe('v0.1.0')
  expect(nextVersion('v0.15.0', 'soon')).toBeNull()
  expect(subjectsOf('Add notes\nMerge feature/x: y\n\nFix a typo\n')).toEqual(['Add notes', 'Fix a typo'])

  seen.replies = { 'git rev-parse': { stdout: '', exitCode: 128 } }
  expect((await run($, 'ship', '')).text).toMatch(/not a git repository/)

  seen.replies = { 'git rev-parse': done('feature/notes\n') }
  expect((await run($, 'ship', '')).text).toMatch(/You are on the branch feature\/notes\. Releases go out from main/)

  seen.replies = { 'git rev-parse': done('main\n'), 'git status': done(' M README.md\n') }
  expect((await run($, 'ship', '')).text).toMatch(/not committed yet/)

  seen.replies = {
    'git rev-parse': done('main\n'),
    'git status': done(''),
    'git describe': done('v0.15.0\n'),
    'git log': done('Add session notes\nMerge feature/notes: notes\n'),
    'git tag': done(''),
    'git push': done(''),
    'gh release create': done('https://github.com/me/repo/releases/tag/v0.16.0\n'),
  }
  seen.answer = 'Cancel'
  expect((await run($, 'ship', 'minor')).text).toBe('Nothing was shipped.')
  expect(seen.launched.some(line => line.startsWith('git tag'))).toBe(false)

  seen.answer = 'Ship it'
  expect((await run($, 'clubhouse', 'ship minor')).text).toBe(
    'Shipped v0.16.0: https://github.com/me/repo/releases/tag/v0.16.0',
  )
  expect(seen.launched).toContain('git log --pretty=%s -n 60 v0.15.0..HEAD')
  expect(seen.launched).toContain('git tag v0.16.0')
  expect(seen.launched).toContain('git push origin main v0.16.0')
  expect(seen.launched.at(-1)).toMatch(/^gh release create v0\.16\.0 --title v0\.16\.0 --notes /)

  expect((await run($, 'ship', 'soon')).text).toMatch(/"soon" is not a version/)
})
