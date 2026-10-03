import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Recipe } from '../../types'
import { DEFAULT_PREFS, DEFAULT_RECIPES_VIEW, PREFS_SHAPE } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  RECIPES_KEY,
  RECIPE_TIMEOUT_MS,
  RECIPE_TOOL_PREFIX,
  RETIRED_RECIPE,
  argvOf,
  blanksOf,
  problemWith,
  recipeFrom,
  recipeOf,
  resultText,
  toolSpecOf,
  withRecipe,
} from '../lib/recipes'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const recipes = atom({ plugin: 'clubhouse', key: 'recipes' } as const, [])
const recipesView = atom({ plugin: 'clubhouse', key: 'recipesView' } as const, DEFAULT_RECIPES_VIEW)

const BLANK_DRAFT: Recipe = { name: '', about: '', command: '' }
const TRIAL_CHARS = 1200

let draft: Recipe = BLANK_DRAFT

async function keep($: EngineInterface, listed: Recipe[], note: string): Promise<void> {
  await update($, recipes, () => listed)
  await $.store.set(RECIPES_KEY, listed)
  await update($, recipesView, held => ({ ...held, note, editing: null }))
}

async function save($: EngineInterface): Promise<void> {
  const held = await read($, recipes)
  const made = recipeFrom(draft)
  const problem = problemWith(made, held)

  if (problem !== null) {
    await update($, recipesView, view => ({ ...view, note: problem }))

    return
  }

  const isListed = await $.tool.register(toolSpecOf(made)).then(
    () => true,
    () => false,
  )
  draft = BLANK_DRAFT
  await keep(
    $,
    withRecipe(held, made),
    isListed
      ? `Saved. Claude can call ${made.name} from your next message.`
      : `Saved. Claude can call ${made.name} from the next session.`,
  )
}

async function remove($: EngineInterface, name: string): Promise<void> {
  const held = await read($, recipes)
  await $.tool.register({ name, description: RETIRED_RECIPE }).catch(() => undefined)
  await keep(
    $,
    held.filter(one => one.name !== name),
    `Deleted ${name}. Claude is refused if it tries to call it.`,
  )
}

async function tryOut($: EngineInterface, one: Recipe): Promise<void> {
  const { name } = one
  await update($, recipesView, view => ({ ...view, trial: { name, text: 'Running…' } }))
  const ran = await $.process.run(argvOf(one, {}), { timeoutMs: RECIPE_TIMEOUT_MS }).catch(() => null)
  const text = ran === null ? 'It could not start, or ran past its five minutes.' : resultText(one, ran)
  await update($, recipesView, view => ({ ...view, trial: { name, text: text.slice(-TRIAL_CHARS) } }))
}

export function recipesRoom(on: On): void {
  on('tool.describe', async ($, e, next) => {
    const described = await next(e)

    return e.tool.startsWith(RECIPE_TOOL_PREFIX) && recipeOf(e.tool, await read($, recipes)) !== undefined
      ? { ...described, isDeferred: false }
      : described
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-recipes' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const held = await read($, recipes)
    const view = await read($, recipesView)
    const { frame, note, plain, title, card, Button, Input } = makeParts(elements, chosen, e.surface)
    const edit = (one: Recipe | null) => {
      draft = one ?? BLANK_DRAFT
      void update($, recipesView, shown => ({ ...shown, note: null, editing: one?.name ?? null }))
    }

    const form =
      Input === null
        ? card('New recipe', [
            note('Making a recipe needs a text box, which this screen does not have. Use the desktop app or a terminal.'),
          ])
        : card(view.editing === null ? 'New recipe' : `Edit ${view.editing}`, [
            note('Press Enter in each box to set it, then Save.'),
            <Input
              key="recipe-name"
              label="Name"
              placeholder="run_tests"
              value={draft.name}
              onInput={typed => {
                draft = { ...draft, name: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, name: typed }
              }}
            />,
            <Input
              key="recipe-about"
              label="What it does"
              placeholder="Runs the project's tests"
              value={draft.about}
              onInput={typed => {
                draft = { ...draft, about: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, about: typed }
              }}
            />,
            <Input
              key="recipe-command"
              label="Command"
              placeholder="npm test -- {file}"
              value={draft.command}
              onInput={typed => {
                draft = { ...draft, command: typed }
              }}
              onSubmit={typed => {
                draft = { ...draft, command: typed }
              }}
            />,
            note(
              'For anything that changes each time, put a blank in braces, like {file}. Claude fills the blank, and what it fills in is handed to the command as one argument, never run as code.',
            ),
            <Box gap={1}>
              <Button key="recipe-save" label="Save recipe" variant="primary" onPress={() => void save($)} />
              {view.editing !== null && <Button key="recipe-cancel" label="Cancel" onPress={() => edit(null)} />}
            </Box>,
          ])

    const saved = (one: Recipe) => {
      const blanks = blanksOf(one.command)

      return card(one.name, [
        one.about === '' ? null : plain(one.about),
        note(`Runs: ${one.command}`),
        note(blanks.length === 0 ? 'No blanks.' : `Claude fills in: ${blanks.join(', ')}.`),
        <Box gap={1} flexWrap="wrap">
          {blanks.length === 0 && (
            <Button key={`recipe-try-${one.name}`} label="Try it" onPress={() => void tryOut($, one)} />
          )}
          <Button key={`recipe-edit-${one.name}`} label="Edit" onPress={() => edit(one)} />
          <Button key={`recipe-delete-${one.name}`} label="Delete" onPress={() => void remove($, one.name)} />
        </Box>,
        view.trial?.name === one.name ? plain(view.trial.text) : null,
      ])
    }

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Recipes')}
        {note(
          'A recipe is a shortcut for Claude. Save a command you would type in a terminal once, and from then on Claude runs exactly that command when you ask, in any session. /clubhouse recipes opens this.',
        )}
        {note(
          'Example: name db_push, command supabase db push. After that, "push the database" is one step for Claude and you never open the terminal.',
        )}
        {form}
        {view.note !== null && plain(view.note)}
        {held.length === 0
          ? note('No recipes yet. A first one to try: name run_tests, command npm test.')
          : held.map(saved)}
        {note(
          'A recipe runs in this session\'s folder and is stopped after five minutes. To make Claude ask you before it uses one, set it to Ask first in Tool rules.',
        )}
      </Box>
    )
  })
}
