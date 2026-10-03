import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Recipe, ToolRule, ToolRules } from '../../types'
import { DEFAULT_PREFS, DEFAULT_TOOLS_VIEW, PREFS_SHAPE, TOOL_RULES_KEY } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import {
  RECIPE_TIMEOUT_MS,
  RECIPE_TOOL_PREFIX,
  RETIRED_RECIPE,
  argvOf,
  askOf,
  inputOf,
  recipeOf,
  resultText,
  toolNameOf,
} from '../lib/recipes'
import {
  RULE_LABEL,
  argSummary,
  groupTools,
  isMoneyTool,
  nextRule,
  shortName,
  withRule,
} from '../lib/tools'
import type { ListedTool } from '../lib/tools'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})
const toolRules = atom({ plugin: 'clubhouse', key: 'toolRules' } as const, {})
const recipes = atom({ plugin: 'clubhouse', key: 'recipes' } as const, [])
const toolsView = atom({ plugin: 'clubhouse', key: 'toolsView' } as const, DEFAULT_TOOLS_VIEW)

const ALLOW_ONCE = 'Allow once'
const DENY = 'Deny'
const MATCH_SIZE = 40
const ABOUT_CHARS = 140

async function setRules(
  $: EngineInterface,
  change: (rules: ToolRules) => ToolRules,
  note: string,
): Promise<void> {
  await update($, toolRules, change)
  await $.store.set(TOOL_RULES_KEY, await read($, toolRules))
  await update($, toolsView, view => ({ ...view, note }))
}

async function isAllowedOnce($: EngineInterface, question: string): Promise<boolean> {
  const answer = await $.ui
    .ask(question, { header: 'Ask first', options: [ALLOW_ONCE, DENY] })
    .catch(() => DENY)

  return answer === ALLOW_ONCE
}

async function runRecipe(
  $: EngineInterface,
  recipe: Recipe,
  input: Record<string, unknown>,
  isCleared: boolean,
): Promise<{ result: string } | { deny: string }> {
  const verdict = isCleared
    ? { decision: 'allow' as const }
    : await $.tool
        .check({ tool: toolNameOf(recipe.name), input })
        .catch(() => ({ decision: 'ask' as const }))

  if (verdict.decision === 'deny') {
    return { deny: `The recipe "${recipe.name}" is not allowed here. Do not retry it; tell the user.` }
  }

  if (
    verdict.decision === 'ask' &&
    !(await isAllowedOnce($, askOf(recipe, input)))
  ) {
    return { deny: `The user declined the recipe "${recipe.name}". Do not retry it without asking them.` }
  }

  const ran = await $.process.run(argvOf(recipe, input), { timeoutMs: RECIPE_TIMEOUT_MS }).catch(() => null)

  return ran === null
    ? { deny: `The recipe "${recipe.name}" could not start, or ran past its five minutes.` }
    : { result: resultText(recipe, ran) }
}

export function tools(on: On): void {
  on('tool.call', async ($, e, next) => {
    const rule = (await read($, toolRules))[e.tool]
    const recipe = recipeOf(e.tool, await read($, recipes))

    if (recipe === undefined && e.tool.startsWith(RECIPE_TOOL_PREFIX)) {
      return { deny: RETIRED_RECIPE }
    }

    if (rule === undefined) {
      return recipe === undefined ? next(e) : runRecipe($, recipe, inputOf(e), false)
    }

    const name = shortName(e.tool)

    if (rule === 'block') {
      return {
        deny: `The user blocked the tool "${name}" in Claude Clubhouse. Do not retry it; tell the user it is blocked.`,
      }
    }

    const args = argSummary(e)

    if (!(await isAllowedOnce($, `Claude wants to use ${name}${args === '' ? '' : ` with ${args}`}. Allow it?`))) {
      return { deny: `The user declined "${name}" in Claude Clubhouse. Do not retry it without asking them.` }
    }

    return recipe === undefined ? next(e) : runRecipe($, recipe, inputOf(e), true)
  })

  on('ui.render', { component: 'Pane', requestId: 'clubhouse-tools' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box } = elements
    const chosen = await read($, prefs)
    const rules = await read($, toolRules)
    const view = await read($, toolsView)
    const all: ListedTool[] = await $.tool.list()
    const groups = groupTools(all)
    const money = all.filter(one => isMoneyTool(one.name)).map(one => one.name)
    const isGuarded = money.length > 0 && money.every(name => rules[name] !== undefined)
    const ruled = Object.keys(rules)
    const wanted = view.filter.trim().toLowerCase()
    const matching = all.filter(
      one => one.name.toLowerCase().includes(wanted) || one.description.toLowerCase().includes(wanted),
    )
    const { frame, note, plain, title, card, Button, Input } = makeParts(elements, chosen, e.surface)

    const setFilter = (typed: string) =>
      void update($, toolsView, held => ({ ...held, filter: typed }))
    const toggleGroup = (id: string) =>
      void update($, toolsView, held => ({
        ...held,
        open: held.open.includes(id) ? held.open.filter(one => one !== id) : [...held.open, id],
      }))
    const apply = (names: readonly string[], rule: ToolRule | undefined, label: string) =>
      void setRules(
        $,
        held => withRule(held, names, rule),
        `${label}: ${RULE_LABEL[rule ?? 'allow'].toLowerCase()}.`,
      )

    const entry = (one: ListedTool, prefix = 'rule') => (
      <Box flexDirection="column">
        <Box gap={1}>
          <Button
            key={`${prefix}-${one.name}`}
            label={RULE_LABEL[rules[one.name] ?? 'allow']}
            variant={rules[one.name] === undefined ? 'secondary' : 'primary'}
            onPress={() => apply([one.name], nextRule(rules[one.name]), shortName(one.name))}
          />
          {plain(shortName(one.name))}
        </Box>
        {one.description !== '' && note(one.description.slice(0, ABOUT_CHARS))}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Tool rules')}
        {note(
          'Decide what Claude may do without checking with you. Each tool has one button that cycles Allowed, Ask first and Blocked. /clubhouse tools opens this.',
        )}

        {card('How the rules work', [
          note('Allowed: Claude Code handles the tool the way it normally does, including its own permission prompts.'),
          note('Ask first: a question pops up showing the tool and what Claude is about to send. Nothing runs unless you pick Allow once.'),
          note('Blocked: the call is refused and Claude is told not to retry.'),
          note('Rules apply in every session and to agents too, and stay active even when the Clubhouse is switched off.'),
        ])}

        {money.length > 0 &&
          card('Money safeguard', [
            note(`${money.length} connected tools can place, change or cancel an order, or move money. With the safeguard on, Claude must ask you before each one.`),
            <Box gap={1}>
              <Button
                key="tools-safeguard"
                label={isGuarded ? 'Safeguard is on' : 'Turn safeguard on'}
                variant={isGuarded ? 'primary' : 'secondary'}
                onPress={() =>
                  apply(
                    isGuarded ? money : money.filter(name => rules[name] === undefined),
                    isGuarded ? undefined : 'ask',
                    'Money tools',
                  )
                }
              />
            </Box>,
          ])}

        {Input !== null && (
          <Input
            key="tools-filter"
            label="Find"
            placeholder="part of a tool name or what it does"
            submitLabel="Find"
            onInput={setFilter}
            onSubmit={setFilter}
          />
        )}
        {view.note !== null && plain(view.note)}

        {ruled.length > 0 &&
          wanted === '' &&
          card(
            `Your rules (${ruled.length})`,
            <Box flexDirection="column" gap={1}>
              {all.filter(one => rules[one.name] !== undefined).map(one => entry(one, 'mine'))}
              <Box>
                <Button key="rules-clear" label="Clear all rules" onPress={() => apply(ruled, undefined, 'All tools')} />
              </Box>
            </Box>,
          )}

        {wanted !== '' &&
          card(
            `Matching "${wanted}" (${matching.length})`,
            <Box flexDirection="column" gap={1}>
              {matching.slice(0, MATCH_SIZE).map(one => entry(one))}
              {matching.length > MATCH_SIZE && note(`${matching.length - MATCH_SIZE} more. Type more to narrow it.`)}
            </Box>,
          )}

        {wanted === '' &&
          groups.map(group => {
            const isOpen = view.open.includes(group.id)
            const names = group.tools.map(one => one.name)

            return (
              <Box flexDirection="column" gap={1}>
                <Box gap={1} flexWrap="wrap">
                  <Button
                    key={`tgroup-${group.id}`}
                    label={`${isOpen ? '▾' : '▸'} ${group.title} (${group.tools.length})`}
                    variant={isOpen ? 'primary' : 'secondary'}
                    onPress={() => toggleGroup(group.id)}
                  />
                  {isOpen && (
                    <Button key={`askall-${group.id}`} label="Ask first for all" onPress={() => apply(names, 'ask', group.title)} />
                  )}
                  {isOpen && (
                    <Button key={`blockall-${group.id}`} label="Block all" onPress={() => apply(names, 'block', group.title)} />
                  )}
                  {isOpen && (
                    <Button key={`allowall-${group.id}`} label="Allow all" onPress={() => apply(names, undefined, group.title)} />
                  )}
                </Box>
                {isOpen &&
                  card(
                    group.title,
                    <Box flexDirection="column" gap={1}>
                      {group.tools.map(one => entry(one))}
                    </Box>,
                  )}
              </Box>
            )
          })}
      </Box>
    )
  })
}
