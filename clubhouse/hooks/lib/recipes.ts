import type { Recipe } from '../../types'

export type RecipeRun = { exitCode: number; stdout: string; stderr: string }

export const RECIPES_KEY = 'recipes'
export const RECIPE_TOOL_PREFIX = 'mcp__clubhouse__'
export const RECIPE_TIMEOUT_MS = 300_000
export const MAX_RECIPES = 12
export const RETIRED_RECIPE = 'This recipe was deleted in Claude Clubhouse. Do not call it.'

const BLANK = /^\{([a-z][a-z0-9_]*)\}/i
const NAME_CHARS = 48
const ABOUT_CHARS = 200
const COMMAND_CHARS = 1000
const OUTPUT_CHARS = 20_000
const ASK_CHARS = 80

type Quote = 'none' | 'single' | 'double'

export function recipeSlug(typed: string): string {
  return typed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, NAME_CHARS)
}

export function toolNameOf(name: string): string {
  return `${RECIPE_TOOL_PREFIX}${name}`
}

export function recipeOf(tool: string, recipes: readonly Recipe[]): Recipe | undefined {
  return tool.startsWith(RECIPE_TOOL_PREFIX)
    ? recipes.find(one => toolNameOf(one.name) === tool)
    : undefined
}

function pieces(command: string): { text: string; blank: string | null; quote: Quote }[] {
  const found: { text: string; blank: string | null; quote: Quote }[] = []
  let quote: Quote = 'none'
  let at = 0

  while (at < command.length) {
    const letter = command[at] ?? ''
    const blank = command[at - 1] === '$' ? null : BLANK.exec(command.slice(at))

    if (blank !== null) {
      found.push({ text: blank[0], blank: (blank[1] ?? '').toLowerCase(), quote })
      at += blank[0].length
    } else if (letter === '\\' && quote !== 'single' && at + 1 < command.length) {
      found.push({ text: command.slice(at, at + 2), blank: null, quote })
      at += 2
    } else {
      found.push({ text: letter, blank: null, quote })

      if (letter === "'" && quote !== 'double') quote = quote === 'single' ? 'none' : 'single'
      if (letter === '"' && quote !== 'single') quote = quote === 'double' ? 'none' : 'double'
      at += 1
    }
  }

  return found
}

export function blanksOf(command: string): string[] {
  return [...new Set(pieces(command).flatMap(one => (one.blank === null ? [] : [one.blank])))]
}

export function scriptOf(command: string): string {
  const blanks = blanksOf(command)

  return pieces(command)
    .map(one => {
      if (one.blank === null) return one.text
      const value = `\${${blanks.indexOf(one.blank) + 1}}`

      return one.quote === 'double' ? value : one.quote === 'single' ? `'"${value}"'` : `"${value}"`
    })
    .join('')
}

export function inputOf(call: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(call).filter(([key]) => key !== 'tool' && key !== 'tool_use_id'))
}

export function argvOf(recipe: Recipe, input: Record<string, unknown>): string[] {
  const values = blanksOf(recipe.command).map(blank => {
    const given = input[blank]

    return given === undefined || given === null ? '' : String(given)
  })

  return ['/bin/sh', '-c', scriptOf(recipe.command), recipe.name, ...values]
}

export function toolSpecOf(recipe: Recipe): {
  name: string
  description: string
  inputSchema: Record<string, unknown>
} {
  const blanks = blanksOf(recipe.command)
  const typed = recipe.about.trim()
  const about = typed === '' ? `Runs ${recipe.name}.` : /[.!?]$/.test(typed) ? typed : `${typed}.`

  return {
    name: recipe.name,
    description:
      `${about} A recipe the user saved in Claude Clubhouse. It runs this in the session folder: ${recipe.command}` +
      (blanks.length === 0 ? '' : ' Each blank in braces is one argument, used exactly as given.'),
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        blanks.map(blank => [blank, { type: 'string', description: `Fills {${blank}} in the command.` }]),
      ),
      required: blanks,
    },
  }
}

export function resultText(recipe: Recipe, ran: RecipeRun): string {
  const tail = (text: string) => (text.length > OUTPUT_CHARS ? `…${text.slice(-OUTPUT_CHARS)}` : text)
  const parts = [
    `${recipe.name} finished with exit code ${ran.exitCode}.`,
    ran.stdout.trim() === '' ? null : tail(ran.stdout.trimEnd()),
    ran.stderr.trim() === '' ? null : `stderr:\n${tail(ran.stderr.trimEnd())}`,
  ]

  return parts.filter(one => one !== null).join('\n')
}

export function recipeFrom(typed: Recipe): Recipe {
  return {
    name: recipeSlug(typed.name),
    about: typed.about.trim().slice(0, ABOUT_CHARS),
    command: typed.command.trim().slice(0, COMMAND_CHARS),
  }
}

export function problemWith(recipe: Recipe, held: readonly Recipe[]): string | null {
  if (recipe.name === '') return 'Give the recipe a name, like run_tests.'
  if (recipe.command === '') return 'Type the command the recipe runs.'

  return held.length >= MAX_RECIPES && !held.some(one => one.name === recipe.name)
    ? `You have ${MAX_RECIPES} recipes, the most the Clubhouse keeps. Delete one first.`
    : null
}

export function askOf(recipe: Recipe, input: Record<string, unknown>): string {
  const given = blanksOf(recipe.command)
    .map(blank => `${blank}: ${String(input[blank] ?? '').slice(0, ASK_CHARS)}`)
    .join(', ')

  return `Claude wants to run your recipe ${recipe.name} (${recipe.command})${given === '' ? '' : ` with ${given}`}. Allow it?`
}

export function withRecipe(held: readonly Recipe[], recipe: Recipe): Recipe[] {
  return held.some(one => one.name === recipe.name)
    ? held.map(one => (one.name === recipe.name ? recipe : one))
    : [...held, recipe]
}

export function asRecipes(saved: unknown): Recipe[] {
  if (!Array.isArray(saved)) return []

  return saved
    .flatMap(one => {
      const record = one as Partial<Record<keyof Recipe, unknown>> | null

      return record !== null &&
        typeof record === 'object' &&
        typeof record.name === 'string' &&
        typeof record.about === 'string' &&
        typeof record.command === 'string'
        ? [recipeFrom({ name: record.name, about: record.about, command: record.command })]
        : []
    })
    .filter(one => one.name !== '' && one.command !== '')
    .slice(0, MAX_RECIPES)
}
