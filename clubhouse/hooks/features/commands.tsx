import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { HiddenPlan, Prefs } from '../../types'
import { HELPER_CONFIG, START_HELPER, coversApp, helperConfig } from '../lib/appColor'
import { groupCommands, withoutHiddenSkills } from '../lib/commands'
import type { ListedCommand } from '../lib/commands'
import {
  COMMANDS_KEY,
  DEFAULT_COMMANDS_VIEW,
  DEFAULT_HIDDEN_PLAN,
  DEFAULT_PREFS,
  HIDDEN_KEY,
  HIDDEN_PLAN_KEY,
  HOME_PANE,
  PREFS_KEY,
  PREFS_SHAPE,
  ROOMS,
  resetLook,
  topCommands,
} from '../lib/defaults'
import { makeParts } from '../lib/parts'

const commandStats = atom({ plugin: 'clubhouse', key: 'commandStats' } as const, {})
const commandsView = atom({ plugin: 'clubhouse', key: 'commandsView' } as const, DEFAULT_COMMANDS_VIEW)
const hiddenCommands = atom({ plugin: 'clubhouse', key: 'hiddenCommands' } as const, [])
const hiddenPlan = atom({ plugin: 'clubhouse', key: 'hiddenPlan' } as const, DEFAULT_HIDDEN_PLAN)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const pulse = atom({ plugin: 'clubhouse', key: 'pulse' } as const, 0)

const TOP_SIZE = 5
const MATCH_SIZE = 40
const ABOUT_CHARS = 140
const INTERNAL_PREFIX = '__'

let presetName = ''

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

async function count($: EngineInterface, name: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, commandStats, stats => ({
      ...stats,
      [name]: { count: (stats[name]?.count ?? 0) + 1, lastAt: at },
    }))
    await $.store.set(COMMANDS_KEY, await read($, commandStats))
  } catch {
    return
  }
}

async function offer($: EngineInterface, name: string): Promise<void> {
  try {
    const { isFilled } = await $.prompt.fill({ text: `/${name} ` })
    await update($, commandsView, view => ({
      ...view,
      note: isFilled
        ? `/${name} is in the prompt box. Press Enter to run it.`
        : `The prompt box is busy. Type /${name} yourself.`,
    }))
  } catch (error) {
    const why = error instanceof Error ? error.message : 'unknown error'
    await update($, commandsView, view => ({
      ...view,
      note: `Could not fill the prompt box (${why}). Type /${name} yourself.`,
    }))
  }
}

async function visit($: EngineInterface, id: string, title: string): Promise<void> {
  await $.ui.open({ id, title, focus: true, closeOnEscape: true })
  await update($, pulse, beat => beat + 1)
}

async function setHidden(
  $: EngineInterface,
  change: (hidden: string[]) => string[],
  note: string,
): Promise<void> {
  await update($, hiddenCommands, change)
  await $.store.set(HIDDEN_KEY, await read($, hiddenCommands))
  await update($, commandsView, view => ({ ...view, note }))
  $.ui.invalidate('command.describe')
  $.ui.invalidate('prompt.attachment')
}

async function setPlan(
  $: EngineInterface,
  change: (plan: HiddenPlan) => HiddenPlan,
  note: string,
): Promise<void> {
  await update($, hiddenPlan, change)
  await $.store.set(HIDDEN_PLAN_KEY, await read($, hiddenPlan))
  await update($, commandsView, view => ({ ...view, note }))
}

async function savePreset($: EngineInterface): Promise<void> {
  const name = presetName.trim()
  const hidden = await read($, hiddenCommands)

  if (name === '') {
    await update($, commandsView, view => ({
      ...view,
      note: 'Type a name for the preset, press Enter, then press Save as preset.',
    }))

    return
  }

  await setPlan(
    $,
    plan => ({ ...plan, presets: { ...plan.presets, [name]: hidden } }),
    `Saved "${name}" with ${hidden.length} hidden.`,
  )
  presetName = ''
}

export function commands(on: On): void {
  on('command.run', async ($, e, next) => {
    await count($, e.command)

    if (e.command !== 'clubhouse') {
      return next(e)
    }

    const wish = e.args.trim().toLowerCase()

    if (wish === 'on' || wish === 'off') {
      await keep($, held => ({ ...held, isEnabled: wish === 'on' }))

      return {
        text:
          wish === 'on'
            ? 'Clubhouse is on.'
            : 'Clubhouse is off. Type /clubhouse on to bring it back.',
      }
    }

    if (wish === 'color reset' || wish === 'colors reset') {
      await keep($, resetLook)

      return { text: 'Clubhouse colors are back to their defaults.' }
    }

    const alias = wish === 'hq' ? 'agents' : wish === 'bar' ? 'toolbar' : wish
    const room = ROOMS.find(one => one.word === alias)

    if (room !== undefined) {
      await visit($, room.id, room.title)

      return { text: `${room.title} opened.` }
    }

    await visit($, HOME_PANE, 'Clubhouse')

    return { text: 'Clubhouse opened.' }
  })

  on('command.describe', async ($, e, next) => {
    const hidden = await read($, hiddenCommands)

    return hidden.includes(e.command) ? next({ ...e, isHidden: true }) : next(e)
  })

  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    const hidden = await read($, hiddenCommands)

    return next({ ...e, text: withoutHiddenSkills(e.text, hidden) })
  })

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const hidden = await read($, hiddenCommands)

    return hidden.includes(e.skill)
      ? { deny: `The user hid the skill "${e.skill}" in Claude Clubhouse. Do the task without it.` }
      : next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-commands' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const stats = await read($, commandStats)
    const view = await read($, commandsView)
    const hidden = await read($, hiddenCommands)
    const plan = await read($, hiddenPlan)
    const all: ListedCommand[] = (await $.command.list()).filter(one => !one.name.startsWith(INTERNAL_PREFIX))
    const groups = groupCommands(all, hidden)
    const wanted = view.filter.trim().toLowerCase().replace(/^\//, '')
    const matching = all.filter(
      one =>
        !hidden.includes(one.name) &&
        (one.name.toLowerCase().includes(wanted) || one.description.toLowerCase().includes(wanted)),
    )
    const { card, frame, note, plain, title, Button, Input } = makeParts(elements, chosen, e.surface)

    const setFilter = (typed: string) =>
      void update($, commandsView, held => ({ ...held, filter: typed }))
    const toggleGroup = (id: string) =>
      void update($, commandsView, held => ({
        ...held,
        open: held.open.includes(id) ? held.open.filter(one => one !== id) : [...held.open, id],
      }))
    const hide = (names: readonly string[], label: string) =>
      void setHidden(
        $,
        held => [...new Set([...held, ...names])],
        `${label} hidden. Claude no longer sees or uses ${names.length === 1 ? 'it' : 'them'}; undo under Hidden skills.`,
      )
    const unhide = (name: string) =>
      void setHidden($, held => held.filter(one => one !== name), `/${name} is back.`)

    const entry = (one: ListedCommand, canHide: boolean) => (
      <Box flexDirection="column">
        <Box gap={1}>
          <Button key={`run-${one.name}`} label={`/${one.name}`} onPress={() => void offer($, one.name)} />
          {canHide && (
            <Button key={`hide-${one.name}`} label="Hide" onPress={() => hide([one.name], `/${one.name}`)} />
          )}
        </Box>
        {one.description !== '' && note(one.description.slice(0, ABOUT_CHARS))}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Commands')}
        {note(
          'Everything you can type after a slash, sorted into groups. Click a group to open it and a command to put it in the prompt box. /clubhouse commands opens this.',
        )}

        {card('Most used and most recent', [
          <Box gap={1} flexWrap="wrap">
            {topCommands(stats, TOP_SIZE).map(name => (
              <Button key={`top-${name}`} label={`/${name}`} onPress={() => void offer($, name)} />
            ))}
          </Box>,
        ])}

        {card('About hiding', [
          note('Hide puts a skill, or a whole group, out of the way. It leaves the slash menu, Claude is no longer told it exists (which saves a little context every session), and Claude is refused if it tries to use it.'),
          note('Nothing is deleted from your computer, and it stays hidden in every session until you show it again under Hidden skills at the bottom.'),
          note('Claude in a session already under way has seen the full list, so for Claude the change starts with the next session or after /clear.'),
          note('To remove a whole plugin and everything it adds, ask Claude to turn that plugin off.'),
        ])}

        {Input !== null && (
          <Input
            key="filter"
            label="Find"
            placeholder="part of a name or what it does"
            submitLabel="Find"
            onInput={setFilter}
            onSubmit={setFilter}
          />
        )}
        {view.note !== null && plain(view.note)}

        {wanted !== '' &&
          card(
            `Matching "${wanted}" (${matching.length})`,
            <Box flexDirection="column" gap={1}>
              {matching.slice(0, MATCH_SIZE).map(one => entry(one, one.source !== 'builtin'))}
              {matching.length > MATCH_SIZE && note(`${matching.length - MATCH_SIZE} more. Type more to narrow it.`)}
            </Box>,
          )}

        {wanted === '' &&
          groups.map(group => {
            const isOpen = view.open.includes(group.id)

            return (
              <Box flexDirection="column" gap={1}>
                <Box gap={1}>
                  <Button
                    key={`group-${group.id}`}
                    label={`${isOpen ? '▾' : '▸'} ${group.title} (${group.commands.length})`}
                    variant={isOpen ? 'primary' : 'secondary'}
                    onPress={() => toggleGroup(group.id)}
                  />
                  {isOpen && group.canHide && (
                    <Button
                      key={`hideall-${group.id}`}
                      label="Hide all"
                      onPress={() =>
                        hide(
                          group.commands.map(one => one.name),
                          `All ${group.commands.length} in ${group.title}`,
                        )
                      }
                    />
                  )}
                </Box>
                {isOpen &&
                  card(
                    group.title,
                    <Box flexDirection="column" gap={1}>
                      {group.commands.map(one => entry(one, group.canHide))}
                    </Box>,
                  )}
              </Box>
            )
          })}

        {wanted === '' &&
          card(`Hidden skills (${hidden.length})`, [
            note('Hidden in every session: gone from the slash menu, and Claude is not told about them and cannot use them.'),
            hidden.length > 0 && (
              <Box gap={1} flexWrap="wrap">
                {hidden.map(name => (
                  <Button key={`unhide-${name}`} label={`Show /${name}`} onPress={() => unhide(name)} />
                ))}
                <Button
                  key="unhide-all"
                  label="Show all"
                  onPress={() => void setHidden($, () => [], 'Everything is showing again.')}
                />
              </Box>
            ),
          ])}

        {wanted === '' &&
          card('Presets', [
            note('A preset is a saved list of what to hide. Save the list you have now under a name, and switch between presets whenever you like. Turn on "every session" for one and each new session starts with that list.'),
            Input !== null && (
              <Input
                key="preset-name"
                label="Name"
                placeholder="coding"
                submitLabel="Set"
                onInput={typed => {
                  presetName = typed
                }}
                onSubmit={typed => {
                  presetName = typed
                }}
              />
            ),
            <Box>
              <Button key="preset-save" label="Save as preset" variant="primary" onPress={() => void savePreset($)} />
            </Box>,
            ...Object.entries(plan.presets).map(([name, names]) => (
              <Box flexDirection="column">
                {plain(`${name} (${names.length} hidden)`)}
                <Box gap={1} flexWrap="wrap">
                  <Button
                    key={`preset-use-${name}`}
                    label="Use now"
                    onPress={() => void setHidden($, () => names, `Now using "${name}".`)}
                  />
                  <Button
                    key={`preset-start-${name}`}
                    label={plan.startWith === name ? 'Every session: on' : 'Every session: off'}
                    variant={plan.startWith === name ? 'primary' : 'secondary'}
                    onPress={() =>
                      void setPlan(
                        $,
                        held => ({ ...held, startWith: held.startWith === name ? null : name }),
                        plan.startWith === name
                          ? `New sessions no longer start with "${name}".`
                          : `Every new session will start with "${name}".`,
                      )
                    }
                  />
                  <Button
                    key={`preset-delete-${name}`}
                    label="Delete"
                    onPress={() =>
                      void setPlan(
                        $,
                        held => ({
                          presets: Object.fromEntries(
                            Object.entries(held.presets).filter(([other]) => other !== name),
                          ),
                          startWith: held.startWith === name ? null : held.startWith,
                        }),
                        `Deleted "${name}".`,
                      )
                    }
                  />
                </Box>
              </Box>
            )),
          ])}
      </Box>
    )
  })
}
