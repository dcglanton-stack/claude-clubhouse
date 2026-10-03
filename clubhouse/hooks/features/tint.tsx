import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderElement, ResolveInput } from 'claude-code'

import { lookOf, tintsRows } from '../lib/appColor'
import { DEFAULT_PREFS, PREFS_SHAPE } from '../lib/defaults'
import { frameRow, tintRow } from '../lib/parts'

const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})

async function tinted<E extends ResolveInput>(
  $: EngineInterface,
  e: E,
  next: (e: E) => Promise<RenderElement>,
  isOwnPrompt: boolean,
): Promise<RenderElement> {
  const chosen = await read($, prefs)

  if (e.surface === 'terminal') {
    return next(e)
  }

  if (tintsRows(chosen)) {
    return tintRow($.ui.resolve(e), chosen, await next(e))
  }

  const { hairline, tone } = lookOf(chosen, e.surface)

  return isOwnPrompt && tone !== null ? frameRow($.ui.resolve(e), hairline, await next(e)) : next(e)
}

export function tint(on: On): void {
  on('ui.render', { component: 'UserMessage' }, ($, e, next) =>
    tinted($, e, next, e.props.task === undefined && e.props.from === undefined),
  )
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => tinted($, e, next, false))
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => tinted($, e, next, false))
  on('ui.render', { component: 'ToolResult' }, ($, e, next) => tinted($, e, next, false))
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => tinted($, e, next, false))
  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => tinted($, e, next, false))
  on('ui.render', { component: 'Spinner' }, ($, e, next) => tinted($, e, next, false))
}
