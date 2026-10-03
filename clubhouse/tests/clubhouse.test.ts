import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, MockClock } from 'claude-code/testing'

import { appModeFrom } from '../hooks/lib/appColor'
import { mergePrefs, sameSettings } from '../hooks/lib/defaults'
import { pixelFor, shownFrom, toDisplay, toneFor } from '../hooks/lib/tone'
import { nextVersion, subjectsOf } from '../hooks/lib/ship'
import { arranged, rowLoad } from '../hooks/lib/toolbar'
import { serifSize } from '../hooks/lib/type'
import { LEAGUES, gamesFrom, listed } from '../hooks/lib/sports'
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
const codesOf = async (drawing: { drawn: () => Promise<unknown> }) =>
  [...JSON.stringify(await drawing.drawn()).matchAll(/"value":"(#[0-9a-f]{6})"/g)].map(found => found[1] ?? '')
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
  pages: Record<string, string>
  modelReply: string | null
  fetched: string[]
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
    pages: {},
    modelReply: null,
    fetched: [],
    submitted: [],
    contexts: [],
    clock: mock.clock(on, { now: NOW }),
  }

  on('http.fetch', (_$, e) => {
    const page = Object.entries(seen.pages).find(([part]) => e.url.includes(part))?.[1]
    seen.fetched.push(e.url)

    return { value: { status: page === undefined ? 404 : 200, ok: page !== undefined, headers: {}, text: page ?? '' } }
  })
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
        text: seen.modelReply ?? '- Tests pass.\n- Nothing for you to do.',
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
    expect((await ui.find({ key: 'home' }))?.text).toMatch(surface === 'terminal' ? /Clubhouse/ : /→/)

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
    expect(await ui.find({ type: 'Text', text: /\/ship releases what is on main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Ticker$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^Live sports$/ })).toBeUndefined()
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
    expect(await ui.find({ type: 'Text', text: /Row 1: 14 of 14 used · Row 2: 0 of 14 used/ })).toBeDefined()
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
    expect(await codesOf(ui)).toContain('#f6f3ea')

    await ui.input({ key: 'hex-background', text: 'not a color' })
    expect(await ui.find({ type: 'Text', text: /not a hex color/ })).toBeDefined()

    await ui.input({ key: 'hex-background', text: '#123456' })
    expect(await codesOf(ui)).toContain('#123456')

    await ui.press({ key: 'reset-colors' })
    expect(await codesOf(ui)).toEqual(['#d97757', '#e8743b'])
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

  expect(await ui.find({ key: 'reach' })).toBeUndefined()
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
  expect(config()).toEqual({ enabled: true, target: '#141413', ink: '#faf9f5', radius: 18, isLightApp: false, boost: 1.9, coverSidebar: false, sidebar: expect.any(String), stages: expect.any(Array), sidebarStages: expect.any(Array), kept: expect.any(Array) })
  expect(seen.launched).toHaveLength(1)
  expect(seen.launched[0]).toMatch(/clubhouse-helper\/window-tint/)
  expect(await painted(ui)).toBe(false)
  expect(await painted(reply)).toBe(false)
  expect(await painted(bar)).toBe(false)

  expect(JSON.stringify(await ui.drawn())).toMatch(/^\{"type":"Box","props":\{"flexDirection":"column","borderStyle":"round","borderColor":"#[0-9a-f]{6}"\},"children":\[\{"type":"Box","props":\{"flexDirection":"column","gap":1,"borderStyle":"round","borderColor":"#[0-9a-f]{6}","paddingX":1\}/)
  expect(JSON.stringify(await bar.drawn())).toMatch(/"borderStyle":"round"/)

  seen.appTheme = LIGHT_APP
  await ui.press({ key: 'look-slate' })
  expect(config()).toEqual({ enabled: true, target: '#141413', ink: '#faf9f5', radius: 18, isLightApp: true, boost: 1.9, coverSidebar: false, sidebar: expect.any(String) })
  expect(await ui.find({ type: 'Text', text: /This is a dark color on a light app/ })).toBeDefined()
  seen.appTheme = DARK_APP
  await ui.press({ key: 'look-slate' })
  expect(await ui.find({ type: 'Text', text: /swaps light and dark/ })).toBeUndefined()

  await ui.press({ key: 'look-ivory' })
  expect(config()).toEqual({ enabled: true, target: '#faf9f5', ink: '#141413', radius: 18, isLightApp: false, boost: 1.9, coverSidebar: false, sidebar: expect.any(String), stages: expect.any(Array), sidebarStages: expect.any(Array), kept: expect.any(Array) })
  expect(await ui.find({ type: 'Text', text: /This is a light color on a dark app/ })).toBeDefined()
  expect(await painted(ui)).toBe(false)
  await ui.press({ key: 'look-slate' })
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
  await ui.input({ key: 'hex-background', text: '#1e1e1e' })
  await ui.press({ key: 'hue-on' })
  const first = (await codesOf(ui))[0]

  expect(first).toBeDefined()
  expect(first).not.toBe('#1e1e1e')
  const [red, green, blue] = [1, 3, 5].map(at => Number.parseInt((first ?? '#000000').slice(at, at + 2), 16))
  expect(Math.max(red ?? 0, green ?? 0, blue ?? 0) - Math.min(red ?? 0, green ?? 0, blue ?? 0)).toBeGreaterThan(20)

  await ui.press({ key: 'hue-on' })
  const second = (await codesOf(ui))[0]
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
  const grey = (level: number) => [level / 255, level / 255, level / 255] as const
  const navy = toneFor({ target: '#0a0e27', ink: '#faf9f5', isLightApp: false })
  const blue = toneFor({ target: '#2563eb', ink: '#faf9f5', isLightApp: false })
  const cream = toneFor({ target: '#f3ead8', ink: '#141413', isLightApp: false })
  const grape = toneFor({ target: '#2a1b4a', ink: '#faf9f5', isLightApp: false })

  expect(isNear(toDisplay('#151b27'), levels(22, 27, 38), 1)).toBe(true)
  expect(isNear(shownFrom(navy, grey(21)), levels(11, 14, 37), 2)).toBe(true)
  expect(isNear(shownFrom(navy, levels(26, 26, 25)), levels(11, 14, 47), 2)).toBe(true)
  expect(isNear(shownFrom(navy, grey(33)), levels(12, 17, 58), 2)).toBe(true)
  expect(isNear(shownFrom(navy, grey(55)), levels(22, 25, 47), 2)).toBe(true)
  expect(isNear(shownFrom(navy, levels(195, 194, 184)), levels(250, 249, 237), 2)).toBe(true)
  expect(isNear(shownFrom(navy, levels(249, 217, 73)), levels(249, 217, 73), 2)).toBe(true)
  expect(isNear(shownFrom(blue, grey(21)), levels(54, 98, 227), 2)).toBe(true)
  expect(isNear(shownFrom(blue, levels(26, 26, 25)), levels(45, 87, 208), 2)).toBe(true)
  expect(isNear(shownFrom(blue, grey(33)), levels(40, 79, 193), 2)).toBe(true)
  expect(isNear(shownFrom(blue, grey(55)), levels(64, 105, 228), 2)).toBe(true)
  expect(isNear(shownFrom(blue, levels(239, 137, 51)), levels(239, 137, 51), 2)).toBe(true)
  expect(isNear(shownFrom(grape, grey(21)), levels(40, 28, 71), 2)).toBe(true)
  expect(isNear(shownFrom(grape, grey(33)), levels(48, 31, 91), 2)).toBe(true)
  expect(isNear(shownFrom(grape, grey(55)), levels(50, 38, 80), 2)).toBe(true)
  expect(isNear(shownFrom(cream, grey(21)), levels(241, 234, 218), 2)).toBe(true)
  expect(isNear(shownFrom(cream, grey(33)), levels(230, 223, 208), 2)).toBe(true)
  expect(isNear(shownFrom(cream, grey(55)), levels(209, 203, 189), 2)).toBe(true)
  expect(isNear(shownFrom(cream, levels(195, 194, 184)), levels(21, 21, 11), 2)).toBe(true)

  for (const target of ['#0d243d', '#141413', '#faf9f5', '#f5e3c7', '#2563eb', '#7c3aed', '#c2185b']) {
    const tone = toneFor({ target, ink: target === '#faf9f5' || target === '#f5e3c7' ? '#141413' : '#faf9f5', isLightApp: false })

    for (const wanted of ['#d97757', '#e8743b', '#1e8449', '#2f7fd1']) {
      expect(isNear(shownFrom(tone, pixelFor(tone, wanted)), toDisplay(wanted), 3)).toBe(true)
    }

    expect(isNear(shownFrom(tone, pixelFor(tone, tone.inkHex)), toDisplay(tone.inkHex), 3)).toBe(true)
    expect(isNear(shownFrom(tone, pixelFor(tone, target)), toDisplay(target), 3)).toBe(true)
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

test('a preset sets all three colors, your own presets save and return them, and each color resets alone', async ($, on) => {
  const seen = world(on, 50, {
    hasHelper: true,
    stored: { colorPresets: [{ name: 'Old one', palette: { accent: '#112233', clawd: '#445566', background: '#778899' } }, { name: '', palette: {} }] },
  })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-colors',
    props: { ...PANE, title: 'Colors' },
  })
  const config = () => JSON.parse(seen.written.at(-1)?.text ?? '{}') as Record<string, unknown>
  const hexes = () => codesOf(ui)

  expect(await ui.find({ key: 'slot-text' })).toBeUndefined()
  await ui.press({ key: 'preset-Forest' })
  expect(await hexes()).toEqual(['#0b3d2c', '#ffb81c', '#db7037'])
  expect(config()).toMatchObject({ enabled: true, target: '#0b3d2c', ink: '#faf9f5' })

  await ui.press({ key: 'slot-accent' })
  await ui.press({ key: 'anthropic-Clay' })
  await ui.input({ key: 'preset-name', text: '' })
  expect(await ui.find({ type: 'Text', text: /Type a name for the preset/ })).toBeDefined()
  await ui.input({ key: 'preset-name', text: 'Game day' })
  expect(await ui.find({ key: 'mine-Game day' })).toBeDefined()

  await ui.press({ key: 'mine-Old one' })
  expect(await hexes()).toEqual(['#778899', '#112233', '#445566'])
  await ui.press({ key: 'mine-Game day' })
  expect(await hexes()).toEqual(['#0b3d2c', '#d97757', '#db7037'])

  await ui.press({ key: 'reset-accent' })
  expect(await hexes()).toEqual(['#0b3d2c', '#d97757', '#db7037'])
  await ui.press({ key: 'reset-clawd' })
  expect(await hexes()).toEqual(['#0b3d2c', '#d97757', '#e8743b'])
  await ui.press({ key: 'reset-background' })
  expect(config().enabled).toBe(false)

  await ui.press({ key: 'mine-delete-Old one' })
  expect(await ui.find({ key: 'mine-Old one' })).toBeUndefined()
  await ui.unmount()
})

test('settings count as changed elsewhere only when something the user set differs', () => {
  const held = mergePrefs({ palette: { accent: '#d97757', clawd: '#e8743b', background: '#141413' } })
  const reordered = { ...held, palette: { background: '#141413', clawd: '#e8743b', text: null, accent: '#d97757' } }

  expect(sameSettings(held, reordered)).toBe(true)
  expect(sameSettings(held, { ...held, isHelperReady: true, appMode: 'light' })).toBe(true)
  expect(sameSettings(held, { ...held, palette: { ...held.palette, background: '#faf9f5' } })).toBe(false)
  expect(mergePrefs({ reach: 'rooms', palette: { text: '#ff0000' } }).reach).toBe('app')
  expect(mergePrefs({ palette: { text: '#ff0000' } }).palette.text).toBeNull()
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
    /^\{"type":"Box","props":\{"flexDirection":"column","alignItems":"flex-end"\},"children":\[\{"type":"Box","props":\{"borderStyle":"round","borderColor":"#[0-9a-f]{6}"\}/,
  )
  expect(await shown(notice)).toBe(native)
  expect(await shown(reply)).toBe(native)

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

test('toolbar rows have a capacity: a full row sends the next item to another row, and layouts can be saved', async ($, on) => {
  world(on, 50, { stored: { toolbarPresets: [{ name: 'Old layout', barCount: 2, bar: { meter: { isShown: true, row: 2, zone: 'left' } }, shortcuts: [] }] } })
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-bar',
    props: { ...PANE, title: 'Toolbar' },
  })
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const rowCount = async () => ((await bar.drawn()) as { children: unknown[] }).children.length

  expect(await ui.find({ type: 'Text', text: /Row 1: 11 of 14 used/ })).toBeDefined()
  await ui.press({ key: 'bar-context-show' })
  await ui.press({ key: 'bar-receipt-show' })
  expect(await ui.find({ type: 'Text', text: /Every row was full, so a new row 2 was added for it\./ })).toBeDefined()
  expect((await ui.find({ key: 'bar-receipt-row' }))?.text).toBe('Row 2')
  expect(await rowCount()).toBe(2)

  await ui.press({ key: 'bar-cache-show' })
  expect(await ui.find({ type: 'Text', text: /Row 1 is full, so it went on row 2\./ })).toBeDefined()
  await ui.press({ key: 'bar-receipt-row' })
  expect(await ui.find({ type: 'Text', text: /No other row has room for it/ })).toBeDefined()

  await ui.input({ key: 'layout-name', text: 'Busy' })
  await ui.press({ key: 'layout-Old layout' })
  expect(await ui.find({ type: 'Text', text: /Row 1: 5 of 14 used · Row 2: 6 of 14 used/ })).toBeDefined()
  await ui.press({ key: 'layout-Busy' })
  expect(await ui.find({ type: 'Text', text: /Row 1: 14 of 14 used · Row 2: 10 of 14 used/ })).toBeDefined()
  await ui.press({ key: 'layout-delete-Busy' })
  expect(await ui.find({ key: 'layout-Busy' })).toBeUndefined()

  const full = mergePrefs({ barCount: 4, bar: Object.fromEntries(['home', 'meter', 'summary', 'tidy', 'context'].map(id => [id, { isShown: true, row: 1, zone: 'left' }])) })
  const packed = [2, 3, 4].reduce(
    (held, row) => ({ ...held, shortcuts: [...held.shortcuts, ...Array.from({ length: 5 }, (_, at) => ({ id: `s${row}${at}`, label: 'A long label for a button', text: 'x', spot: { isShown: true, row, zone: 'left' as const } }))] }),
    full,
  )
  expect(rowLoad(packed, 2)).toBe(15)
  expect(arranged(packed, { kind: 'item', id: 'receipt' }, 'toggle').note).toMatch(/All 4 rows are full/)
  await ui.unmount()
  await bar.unmount()
})

const chartPage = (symbol: string, name: string, price: number, before: number) =>
  JSON.stringify({ chart: { result: [{ meta: { symbol, shortName: name, regularMarketPrice: price, chartPreviousClose: before } }] } })

test('the Ticker finds a symbol, shows it on the toolbar with the day change, and keeps favorites', async ($, on) => {
  const seen = world(on, 50)
  seen.pages = {
    'finance/search?q=apple': JSON.stringify({ quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc.', quoteType: 'EQUITY' }, { symbol: 'bad symbol!' }] }),
    'chart/AAPL': chartPage('AAPL', 'Apple Inc.', 333.69, 330.32),
    'chart/BTC-USD': chartPage('BTC-USD', 'Bitcoin USD', 61234.5, 62000),
  }
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-ticker',
    props: { ...PANE, title: 'Ticker' },
  })
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const barTexts = async () => (await bar.findAll({ type: 'Text' })).map(one => one.text)

  await ui.input({ key: 'ticker-search', text: 'nothing' })
  expect(await ui.find({ type: 'Text', text: /could not be reached/ })).toBeDefined()

  await ui.input({ key: 'ticker-search', text: 'apple' })
  expect(await ui.find({ type: 'Text', text: /AAPL · Apple Inc\. · Stock/ })).toBeDefined()
  expect(await barTexts()).not.toContain('AAPL')

  await ui.press({ key: 'hit-show-AAPL' })
  expect(await barTexts()).toEqual(expect.arrayContaining(['AAPL', '333.69', '+1.02%']))
  expect(JSON.stringify(await bar.drawn())).toMatch(/"color":"#2e9e5b","wrap":"truncate"\},"children":\["\+1\.02%"\]/)
  expect((await ui.find({ key: 'hit-show-AAPL' }))?.text).toBe('On the toolbar')

  await ui.press({ key: 'ticker-color' })
  expect(JSON.stringify(await bar.drawn())).not.toMatch(/#2e9e5b/)

  await ui.press({ key: 'hit-favorite-AAPL' })
  expect(await ui.find({ type: 'Text', text: /AAPL · Apple Inc\. · 333\.69 \+1\.02%/ })).toBeDefined()

  seen.pages['chart/AAPL'] = chartPage('AAPL', 'Apple Inc.', 320, 330.32)
  await seen.clock.advance(60_000)
  expect(await barTexts()).toEqual(expect.arrayContaining(['320.00', '-3.12%']))

  await ui.press({ key: 'fav-favorite-AAPL' })
  expect(await ui.find({ key: 'fav-show-AAPL' })).toBeUndefined()
  await ui.unmount()
  await bar.unmount()
})

const scorePage = (events: object[]) => JSON.stringify({ events })
const event = (id: string, date: string, state: string, clock: string, period: number, detail: string, home: [string, string], away: [string, string]) => ({
  id,
  date,
  status: { displayClock: clock, period, type: { state, shortDetail: detail } },
  competitions: [
    {
      competitors: [
        { homeAway: 'away', score: away[1], team: { abbreviation: away[0], color: '00338d', logo: null } },
        { homeAway: 'home', score: home[1], team: { abbreviation: home[0], color: '472a08', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png' } },
      ],
    },
  ],
})

test('Live sports lists games, puts one on the toolbar with the home team first, and follows the clock', async ($, on) => {
  const seen = world(on, 50)
  const soon = new Date(NOW + 3_600_000).toISOString()
  seen.pages = {
    'football/nfl/scoreboard': scorePage([
      event('g1', new Date(NOW - 3_600_000).toISOString(), 'in', '11:46', 4, '11:46 - 4th', ['CLE', '27'], ['PIT', '24']),
      event('g2', soon, 'pre', '0:00', 0, 'Scheduled', ['DAL', '0'], ['NYG', '0']),
      event('g3', new Date(NOW + 9 * 86_400_000).toISOString(), 'pre', '0:00', 0, 'Scheduled', ['SEA', '0'], ['SF', '0']),
    ]),
  }
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-sports',
    props: { ...PANE, title: 'Live sports' },
  })
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  await ui.press({ key: 'league-nba' })
  expect(await ui.find({ type: 'Text', text: /could not be reached/ })).toBeDefined()

  await ui.press({ key: 'league-nfl' })
  expect(await ui.find({ type: 'Text', text: /PIT at CLE · 24–27 · 11:46 4Q/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /NYG at DAL · / })).toBeDefined()
  expect(await ui.find({ key: 'game-g3' })).toBeUndefined()

  await ui.press({ key: 'game-g1' })
  expect((await ui.find({ key: 'game-g1' }))?.text).toBe('On the toolbar')
  const drawn = JSON.stringify(await bar.drawn())
  expect(drawn).toMatch(/PIT at CLE · 24–27 · 11:46 4Q/)
  expect(drawn.indexOf('>CLE<')).toBeGreaterThan(-1)
  expect(drawn.indexOf('>27<')).toBeLessThan(drawn.indexOf('>24<'))

  seen.pages['football/nfl/scoreboard'] = scorePage([
    event('g1', new Date(NOW - 3_600_000).toISOString(), 'post', '0:00', 4, 'Final', ['CLE', '30'], ['PIT', '24']),
  ])
  await seen.clock.advance(30_000)
  expect(JSON.stringify(await bar.drawn())).toMatch(/PIT at CLE · 24–30 · Final/)

  const hockey = gamesFrom(scorePage([event('h1', soon, 'in', '5:12', 4, '5:12 - OT', ['DET', '2'], ['NYR', '2'])]), LEAGUES[4]!)
  expect(hockey[0]?.clock).toBe('5:12 OT')
  const ball = gamesFrom(scorePage([event('b1', soon, 'in', '0:00', 5, 'Bot 5th', ['ATL', '6'], ['PHI', '3'])]), LEAGUES[3]!)
  expect(ball[0]?.clock).toBe('Bot 5th')
  expect(listed([...hockey, ...hockey], NOW)).toHaveLength(1)
  await ui.unmount()
  await bar.unmount()
})

test('Draw it opens the sketch pad and puts the sketch into the prompt box', async ($, on) => {
  const shown = { prefs: { bar: { draw: { isShown: true, row: 1, zone: 'left' } } } }
  const seen = world(on, 50, { hasHelper: true, stored: shown })
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  seen.replies = { '/tmp/clubhouse-home/.claude/clubhouse-helper/draw-pad': { stdout: '', exitCode: 1 } }
  await bar.press({ key: 'draw' })
  expect(seen.filled).toEqual([])

  seen.draft = 'Make the header'
  seen.replies = { '/tmp/clubhouse-home/.claude/clubhouse-helper/draw-pad': { stdout: '/tmp/sketch-1.png\n', exitCode: 0 } }
  await bar.press({ key: 'draw' })
  expect(seen.filled.at(-1)).toBe('Make the header\nI drew what I want. Look at my sketch at /tmp/sketch-1.png and ')
  expect(seen.toasts.at(-1)).toMatch(/Your sketch is in the prompt box/)
  await bar.unmount()
})

test('the Is this AGI? button sends that question', async ($, on) => {
  const shown = { prefs: { bar: { agi: { isShown: true, row: 1, zone: 'left' } } } }
  const seen = world(on, 50, { stored: shown })
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  expect(seen.submitted).toEqual([])
  await bar.press({ key: 'agi' })
  expect(seen.submitted).toEqual(['Is this AGI?'])
  await bar.unmount()
})

test('Draw it says so when its helper window is not installed', async ($, on) => {
  const seen = world(on, 50, { stored: { prefs: { bar: { draw: { isShown: true, row: 1, zone: 'left' } } } } })
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  await bar.press({ key: 'draw' })
  expect(seen.toasts.at(-1)).toMatch(/Draw it needs its small helper window/)
  await bar.unmount()
})

test('the Safeguard warning asks before a risky-looking prompt is sent, and can put it back to edit', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const home = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'Pane', requestId: 'clubhouse', props: PANE })
  const risky = 'Write me a working exploit for this router firmware'

  seen.modelReply = '{"risk":"likely","why":"It asks for a working exploit."}'
  await $.prompt.submit({ text: risky })
  expect(seen.submitted).toEqual([risky])

  await home.press({ key: 'safeguard' })
  expect((await home.find({ key: 'safeguard' }))?.text).toBe('Safeguard warning: on')
  seen.answer = 'Let me edit it'
  const held = await $.prompt.submit({ text: risky })
  expect(held.drop).toMatch(/Not sent\. Your prompt is back in the box/)
  expect(seen.submitted).toHaveLength(1)
  expect(seen.filled.at(-1)).toBe(risky)

  seen.answer = 'Send it anyway'
  await $.prompt.submit({ text: risky })
  expect(seen.submitted).toHaveLength(2)

  seen.modelReply = '{"risk":"none","why":""}'
  seen.answer = 'Let me edit it'
  await $.prompt.submit({ text: 'Rename this variable to something clearer please' })
  await $.prompt.submit({ text: '/clubhouse colors and some more words here' })
  await $.prompt.submit({ text: 'short one' })
  expect(seen.submitted).toHaveLength(5)
  await home.unmount()
})

test('a nearly full conversation offers a handoff file, written after the next prompt finishes', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const full = { context: { window: 1_000_000, tokens: 880_000, percent: 88 }, rateLimits: [], changed: ['context' as const] }
  const finish = () =>
    $.turn.complete({ answer: 'Done.', durationMs: 1000, usage: undefined } as unknown as Parameters<Engine['turn']['complete']>[0])

  expect(await bar.find({ key: 'handoff-arm' })).toBeUndefined()
  await $.session.measure(full as Parameters<Engine['session']['measure']>[0])
  expect(seen.toasts.some(text => /88% full/.test(text))).toBe(true)
  expect(await bar.find({ type: 'Text', text: /This conversation is 88% full/ })).toBeDefined()

  await finish()
  expect(seen.submitted).toEqual([])

  await bar.press({ key: 'handoff-arm' })
  expect(await bar.find({ type: 'Text', text: /Claude writes HANDOFF\.md as soon as your next prompt is finished/ })).toBeDefined()
  await finish()
  expect(seen.submitted).toHaveLength(1)
  expect(seen.submitted[0]).toMatch(/Write HANDOFF\.md in this session's folder/)
  expect(await bar.find({ key: 'handoff-arm' })).toBeUndefined()
  await finish()
  expect(seen.submitted).toHaveLength(1)
  await bar.unmount()
})

test('Fonts changes the heading font by pick, by description and from a design file, and keeps presets', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const home = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'Pane', requestId: 'clubhouse', props: PANE })
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-fonts',
    props: { ...PANE, title: 'Fonts' },
  })
  const drawn = async () => JSON.stringify(await ui.drawn())

  expect(await home.find({ key: 'room-fonts' })).toBeDefined()
  expect(await home.find({ key: 'room-colors' })).toBeDefined()
  expect(await home.find({ type: 'Text', text: /The font of the Clubhouse headings/ })).toBeUndefined()

  expect(await drawn()).toMatch(/Anthropic Serif', ui-serif/)
  await ui.press({ key: 'font-Futura' })
  expect(await ui.find({ type: 'Text', text: /Now: Futura/ })).toBeDefined()
  expect(await drawn()).toMatch(/font-family=\\"Futura, sans-serif\\"/)

  seen.modelReply = '{"font":"SF Rounded","weight":800}'
  await ui.input({ key: 'font-wish', text: 'friendly and rounded' })
  expect(await ui.find({ type: 'Text', text: /Now: SF Rounded/ })).toBeDefined()
  expect(await drawn()).toMatch(/font-weight=\\"800\\"/)

  seen.modelReply = '{"font":"Comic Sans","weight":400}'
  await ui.input({ key: 'font-wish', text: 'comic sans' })
  expect(await ui.find({ type: 'Text', text: /did not come back with a font from the list/ })).toBeDefined()

  await ui.input({ key: 'font-file', text: '~/missing.md' })
  expect(await ui.find({ type: 'Text', text: /Could not read ~\/missing\.md/ })).toBeDefined()

  await ui.input({ key: 'font-preset-name', text: 'Game day' })
  await ui.press({ key: 'font-Georgia' })
  await ui.press({ key: 'font-preset-Game day' })
  expect(await ui.find({ type: 'Text', text: /Now: SF Rounded/ })).toBeDefined()
  await ui.press({ key: 'font-preset-delete-Game day' })
  expect(await ui.find({ key: 'font-preset-Game day' })).toBeUndefined()
  await home.unmount()
  await ui.unmount()
})

test('a chosen font is used for the toolbar text too, but not for buttons or the live score', async ($, on) => {
  world(on, 50, { stored: { prefs: { font: { name: 'Futura' }, bar: { context: { isShown: true, row: 1, zone: 'left' } } } } })
  await start($)
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const drawn = JSON.stringify(await bar.drawn())

  expect(drawn).toMatch(/font-family=\\"Futura, sans-serif\\"[^>]*>context 24k\/200k full</)
  expect(drawn).toMatch(/font-weight=\\"700\\"[^>]*>50%</)
  expect((await bar.find({ key: 'summarize' }))?.text).toBe('Summarize')
  expect(await bar.find({ type: 'Text', text: /context 24k/ })).toBeUndefined()
  await bar.unmount()
})

test('a sketch is deleted once the prompt that used it has been answered, unless asked to keep it', async ($, on) => {
  const seen = world(on, 50)
  await start($)
  const sketch = '/tmp/clubhouse-home/.claude/clubhouse-helper/sketches/sketch-12.png'
  const finish = () =>
    $.turn.complete({ answer: 'Done.', durationMs: 1000, usage: undefined } as unknown as Parameters<Engine['turn']['complete']>[0])
  const removed = () => seen.launched.filter(line => line.startsWith('/bin/rm'))

  await seen.clock.advance(60_000)
  await finish()
  expect(removed()).toEqual([])

  await $.prompt.submit({ text: `I drew what I want. Look at my sketch at ${sketch} and build it` })
  await seen.clock.advance(5000)
  await finish()
  expect(removed()).toEqual([`/bin/rm -f ${sketch}`])
  await finish()
  expect(removed()).toHaveLength(1)

  await $.prompt.submit({ text: `Look at ${sketch} and keep the sketch for later` })
  await $.prompt.submit({ text: 'Look at /etc/sketch-1.png and /tmp/clubhouse-home/.claude/clubhouse-helper/sketches/../sketch-3.png' })
  await seen.clock.advance(5000)
  await finish()
  expect(removed()).toHaveLength(1)
})

test('the Sidebar switch tells the helper to color the session list too', async ($, on) => {
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

  await ui.press({ key: 'preset-Forest' })
  expect(config().coverSidebar).toBe(false)
  await ui.press({ key: 'sidebar' })
  expect((await ui.find({ key: 'sidebar' }))?.text).toBe('Sidebar: your color too')
  expect(config().coverSidebar).toBe(true)
  await ui.unmount()
})

test('Weather finds your place, shows the sky on the toolbar and lists the next days', async ($, on) => {
  const seen = world(on, 50)
  seen.pages = {
    'ipwho.is': JSON.stringify({ success: true, city: 'Austin', region: 'Texas', latitude: 30.27, longitude: -97.74 }),
    'geocoding-api': JSON.stringify({ results: [{ name: 'Waco', admin1: 'Texas', latitude: 31.5, longitude: -97.1 }] }),
    'api.open-meteo.com': JSON.stringify({
      current: { temperature_2m: 75.2, weather_code: 3, precipitation: 0 },
      daily: {
        time: ['2026-10-03', '2026-10-04'],
        weather_code: [95, 71],
        temperature_2m_max: [76.6, 60.1],
        temperature_2m_min: [72.9, 41.2],
        precipitation_probability_max: [23, 80],
      },
    }),
  }
  await start($)
  const ui = await $.ui.mount({
    plugin: 'clubhouse',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'clubhouse-weather',
    props: { ...PANE, title: 'Weather' },
  })
  const bar = await $.ui.mount({ plugin: 'clubhouse', surface: 'desktop', component: 'AbovePrompt', props: BAND })

  await ui.press({ key: 'weather-locate' })
  expect(await ui.find({ type: 'Text', text: /^Austin, Texas$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /75°F · Cloudy · 23% chance of rain today/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Sat · 77° \/ 73° · Thunderstorm · 23% rain/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Sun · 60° \/ 41° · Snow · 80% rain/ })).toBeDefined()

  await ui.press({ key: 'weather-show' })
  const texts = (await bar.findAll({ type: 'Text' })).map(one => one.text)
  expect(texts).toEqual(expect.arrayContaining(['75°', '23% rain']))
  expect(seen.fetched.some(url => url.includes('temperature_unit=fahrenheit'))).toBe(true)

  await ui.press({ key: 'weather-unit' })
  expect(seen.fetched.at(-1)).toMatch(/temperature_unit=celsius/)

  await ui.input({ key: 'weather-search', text: 'Waco' })
  await ui.press({ key: 'weather-place-Waco, Texas' })
  expect(await ui.find({ type: 'Text', text: /^Waco, Texas$/ })).toBeDefined()
  expect(seen.fetched.at(-1)).toMatch(/latitude=31\.5/)
  await ui.unmount()
  await bar.unmount()
})
