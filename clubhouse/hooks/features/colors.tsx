import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { GapFill, Palette, PaletteSlot, Prefs } from '../../types'
import { clawdSvg, wheelSvg } from '../lib/clawd'
import { isLight, mix, normalizeHex, rgbString, shift, toHsl } from '../lib/color'
import type { Hsl } from '../lib/color'
import { DEFAULT_COLORS_VIEW, DEFAULT_PREFS, PREFS_KEY, isRecord, resetLook } from '../lib/defaults'
import { makeParts } from '../lib/parts'
import { WINDOW_TINT_UNDO, windowTintSnippet } from '../lib/windowTint'

const colorsView = atom({ plugin: 'clubhouse', key: 'colorsView' } as const, DEFAULT_COLORS_VIEW)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS)

const THEME_SLUG = 'clubhouse'
const THEME_REF = `custom:${THEME_SLUG}`
const BLANK_SLOT = '#2b2b2b'
const LOOK_MODEL = 'haiku'
const LOOK_SYSTEM =
  'You design three-color palettes. Reply with one JSON object and nothing else: ' +
  '{"accent":"#rrggbb","clawd":"#rrggbb","background":"#rrggbb"}. ' +
  'accent is for headings and highlights, clawd is the body color of a small mascot, ' +
  'background is a panel background. Keep accent and clawd clearly visible on background.'

const SLOTS: readonly (readonly [PaletteSlot, string, string])[] = [
  ['accent', 'Accent', 'Headings and highlights in the clubhouse.'],
  ['clawd', 'Clawd', 'The mascot in the usage meter.'],
  [
    'background',
    'Background',
    'Behind the Clubhouse panes and the band. Text flips dark or light to stay readable.',
  ],
]

const PRESETS: readonly (readonly [string, string])[] = [
  ['Claude', '#d97757'],
  ['Plush', '#e8743b'],
  ['Sun', '#f2b632'],
  ['Forest', '#2e8b57'],
  ['Ocean', '#2f7fd1'],
  ['Grape', '#7c5cd6'],
  ['Rose', '#e0528a'],
  ['Slate', '#3a4252'],
  ['Night', '#15171c'],
  ['Paper', '#f6f3ea'],
]

const ANTHROPIC: readonly (readonly [string, string])[] = [
  ['Clay', '#d97757'],
  ['Clay Deep', '#c6613f'],
  ['Slate Dark', '#141413'],
  ['Slate Medium', '#3d3d3a'],
  ['Cloud Dark', '#87867f'],
  ['Cloud Medium', '#b0aea5'],
  ['Stone', '#cccbc8'],
  ['Oat Warm', '#e3dacc'],
  ['Manilla', '#f5e3c7'],
  ['Ivory Medium', '#f0eee6'],
  ['Ivory Light', '#faf9f5'],
]

const LOOKS: readonly (readonly [string, string, Palette])[] = [
  ['look-ivory', 'Anthropic ivory', { accent: '#c6613f', clawd: '#d97757', background: '#faf9f5' }],
  ['look-manilla', 'Anthropic manilla', { accent: '#c6613f', clawd: '#d97757', background: '#f5e3c7' }],
  ['look-slate', 'Anthropic slate', { accent: '#d97757', clawd: '#d97757', background: '#141413' }],
]

const GAP_FILL_NEXT: Record<GapFill, GapFill> = { off: 'soft', soft: 'full', full: 'off' }
const GAP_FILL_LABEL: Record<GapFill, string> = {
  off: 'Fill the gaps: off',
  soft: 'Fill the gaps: soft',
  full: 'Fill the gaps: full',
}
const TINT_FILE = '.claude/clubhouse-window-tint.js'

const NUDGES: readonly (readonly [string, string, Partial<Hsl>])[] = [
  ['hue-back', '◀ hue', { hue: -15 }],
  ['hue-on', 'hue ▶', { hue: 15 }],
  ['lighter', 'lighter', { lightness: 6 }],
  ['darker', 'darker', { lightness: -6 }],
  ['vivid', 'bolder', { saturation: 10 }],
  ['soft', 'softer', { saturation: -10 }],
]

function themeOverrides(palette: Palette, isLightBase: boolean): Record<string, string> {
  const surface = isLightBase ? '#f0f0f0' : '#373737'
  const { background } = palette
  const fitsBase = background !== null && isLight(background) === isLightBase
  const panel = fitsBase && background !== null ? background : mix(surface, palette.accent, 0.2)
  const glow = mix(palette.accent, '#ffffff', 0.3)
  const keys: Record<string, string> = {
    claude: palette.accent,
    claudeShimmer: glow,
    permission: palette.accent,
    permissionShimmer: glow,
    suggestion: palette.accent,
    promptBorder: palette.accent,
    promptBorderShimmer: glow,
    bashBorder: palette.accent,
    rate_limit_fill: palette.accent,
    briefLabelClaude: palette.accent,
    clawd_body: palette.clawd,
    userMessageBackground: panel,
    userMessageBackgroundHover: mix(panel, isLightBase ? '#ffffff' : '#808080', 0.2),
    composerSidebarBackground: panel,
    bashMessageBackgroundColor: mix(panel, palette.accent, 0.1),
    memoryBackgroundColor: mix(panel, palette.accent, 0.1),
  }

  return Object.fromEntries(Object.entries(keys).map(([key, hex]) => [key, rgbString(hex)]))
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  await update($, prefs, change)
  await $.store.set(PREFS_KEY, await read($, prefs))
}

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, colorsView, view => ({ ...view, note }))
}

async function applyToApp($: EngineInterface): Promise<void> {
  try {
    const home = await $.env.get('HOME')
    const row = (await $.config.list()).find(one => one.key === 'theme')
    const current = typeof row?.value === 'string' ? row.value : 'dark'
    const chosen = await read($, prefs)
    const previous = current === THEME_REF ? (chosen.previousTheme ?? 'dark') : current
    const isLightBase = previous.startsWith('light')

    if (home === undefined) {
      await say($, 'Could not find your home folder, so no theme was written.')

      return
    }

    await $.fs.write(
      `${home}/.claude/themes/${THEME_SLUG}.json`,
      `${JSON.stringify(
        {
          name: 'Claude Clubhouse',
          base: isLightBase ? 'light' : 'dark',
          overrides: themeOverrides(chosen.palette, isLightBase),
        },
        null,
        2,
      )}\n`,
    )
    await keep($, held => ({ ...held, previousTheme: previous }))

    if (current === THEME_REF) {
      await $.config.set({ key: 'theme', value: previous })
    }

    const set = await $.config.set({ key: 'theme', value: THEME_REF })
    await say(
      $,
      set.deny === undefined
        ? 'Applied to Claude Code. If nothing changed here, this app does not read the theme; Undo puts it back.'
        : `The theme file was written, but switching to it was refused: ${set.deny}`,
    )
  } catch (error) {
    await say($, `Could not apply the theme: ${reason(error)}`)
  }
}

async function undoApp($: EngineInterface): Promise<void> {
  try {
    const { previousTheme } = await read($, prefs)

    if (previousTheme === null) {
      await say($, 'Nothing to undo: the Clubhouse has not changed your theme.')

      return
    }

    const set = await $.config.set({ key: 'theme', value: previousTheme })
    await say(
      $,
      set.deny === undefined
        ? `Theme is back to ${previousTheme}.`
        : `Could not switch back: ${set.deny}`,
    )
  } catch (error) {
    await say($, `Could not undo: ${reason(error)}`)
  }
}

async function describeLook($: EngineInterface, wish: string): Promise<void> {
  const asked = wish.trim()

  if (asked === '') return
  await say($, `Asking for a "${asked}" look…`)

  try {
    const reply = await $.model.complete({
      model: LOOK_MODEL,
      system: LOOK_SYSTEM,
      prompt: asked,
      maxTokens: 120,
    })

    if (!reply.isAnswered) {
      await say($, `The model did not answer (${reply.reason}).`)

      return
    }

    const found: unknown = JSON.parse(reply.text.match(/\{[^{}]*\}/)?.[0] ?? 'null')
    const pick = (key: string) => {
      const value = isRecord(found) ? found[key] : null

      return typeof value === 'string' ? normalizeHex(value) : null
    }
    const accent = pick('accent')
    const clawd = pick('clawd')
    const background = pick('background')

    if (accent === null || clawd === null || background === null) {
      await say($, 'The model answered, but not with three colors. Try wording it differently.')

      return
    }

    await keep($, held => ({ ...held, palette: { accent, clawd, background } }))
    await say($, `Set to accent ${accent}, Clawd ${clawd}, background ${background}.`)
  } catch (error) {
    await say($, `Could not build that look: ${reason(error)}`)
  }
}

async function shareWindowTint($: EngineInterface, isUndo: boolean): Promise<void> {
  try {
    const { background } = (await read($, prefs)).palette

    if (!isUndo && background === null) {
      await say($, 'Pick a background color first: press Background above, then choose a color.')

      return
    }

    const text = isUndo || background === null ? WINDOW_TINT_UNDO : windowTintSnippet(background)
    const isCopied =
      (await $.ui.copy({ text }).then(
        copied => copied.isCopied,
        () => false,
      )) ||
      (await $.process.run(['pbcopy'], { stdin: text }).then(
        ran => ran.exitCode === 0,
        () => false,
      ))

    if (isCopied) {
      await say(
        $,
        isUndo
          ? 'Undo copied. Paste it in the DevTools console and press Enter.'
          : 'Window tint copied. Paste it in the DevTools console and press Enter.',
      )

      return
    }

    const home = await $.env.get('HOME')

    if (home === undefined) {
      await say($, 'Could not reach the clipboard or your home folder.')

      return
    }

    await $.fs.write(`${home}/${TINT_FILE}`, `${text}\n`)
    await say($, `Could not reach the clipboard, so it is saved in ~/${TINT_FILE}. Open that file and copy its one line.`)
  } catch (error) {
    await say($, `Could not prepare the window tint: ${reason(error)}`)
  }
}

async function takeHex($: EngineInterface, slot: PaletteSlot, typed: string): Promise<void> {
  const hex = normalizeHex(typed)

  if (hex === null) {
    await say($, `"${typed}" is not a hex color. Try something like #d97757.`)

    return
  }

  await keep($, held => ({ ...held, palette: { ...held.palette, [slot]: hex } }))
  await say($, `${slot} set to ${hex}.`)
}

export function colors(on: On): void {
  on('ui.render', { component: 'Pane', requestId: 'clubhouse-colors' }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const canDraw = e.surface !== 'terminal'
    const { Box, Text } = elements
    const chosen = await read($, prefs)
    const view = await read($, colorsView)
    const slot = view.slot
    const current = chosen.palette[slot] ?? BLANK_SLOT
    const { ink, frame, note, plain, title, heading, Button, Input } = makeParts(elements, chosen, e.surface)
    const setSlot = (hex: string | null) =>
      void keep($, held => ({ ...held, palette: { ...held.palette, [slot]: hex } }))
    const nudge = (change: Partial<Hsl>) =>
      void keep($, held => ({
        ...held,
        palette: { ...held.palette, [slot]: shift(held.palette[slot] ?? BLANK_SLOT, change) },
      }))

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Colors')}
        {note(
          'Pick the colors of everything the Clubhouse draws. Choose what to color, then nudge it, pick a preset, type a hex code or describe a look. /clubhouse colors opens this.',
        )}

        {heading('What to color')}
        {SLOTS.map(([id, label, about]) => (
          <Box flexDirection="column">
            <Box gap={1}>
              <Button
                key={`slot-${id}`}
                label={label}
                variant={slot === id ? 'primary' : 'secondary'}
                onPress={() => void update($, colorsView, held => ({ ...held, slot: id }))}
              />
              <Text backgroundColor={chosen.palette[id] ?? BLANK_SLOT}>{'    '}</Text>
              <Text {...ink}>{chosen.palette[id] ?? 'app default'}</Text>
            </Box>
            {note(about)}
          </Box>
        ))}

        {heading(`Adjust ${slot}`)}
        {canDraw && 'Svg' in elements && (
          <Box gap={2} alignItems="center">
            <elements.Svg
              source={wheelSvg({ hue: toHsl(current).hue, color: current, size: 110 })}
              alt={`Color wheel showing ${current}`}
              width={110}
              height={110}
            />
            <elements.Svg
              source={clawdSvg('happy', chosen.palette.clawd, 6)}
              alt="Clawd in the chosen color"
              width={90}
              height={58}
            />
          </Box>
        )}
        <Box gap={1} flexWrap="wrap">
          {NUDGES.map(([key, label, change]) => (
            <Button key={key} label={label} onPress={() => nudge(change)} />
          ))}
        </Box>

        {heading('Presets')}
        <Box gap={1} flexWrap="wrap">
          {PRESETS.map(([name, hex]) => (
            <Button key={`preset-${name}`} label={name} onPress={() => setSlot(hex)} />
          ))}
          {slot === 'background' && (
            <Button key="preset-none" label="None" onPress={() => setSlot(null)} />
          )}
        </Box>

        {heading('Anthropic colors')}
        {note("The palette from Anthropic's own design: warm ivory and oat neutrals with one clay accent.")}
        <Box gap={1} flexWrap="wrap">
          {ANTHROPIC.map(([name, hex]) => (
            <Button key={`anthropic-${name}`} label={name} onPress={() => setSlot(hex)} />
          ))}
        </Box>

        {heading('Ready-made looks')}
        {note('Sets all three colors at once.')}
        <Box gap={1} flexWrap="wrap">
          {LOOKS.map(([key, label, palette]) => (
            <Button
              key={key}
              label={label}
              onPress={() => void keep($, held => ({ ...held, palette }))}
            />
          ))}
        </Box>

        {Input !== null && (
          <Box flexDirection="column" gap={1}>
            {heading('Exact color')}
            <Input
              key="hex"
              label="Hex code"
              placeholder="#d97757"
              submitLabel="Set"
              onSubmit={typed => void takeHex($, slot, typed)}
            />
            {heading('Describe a look')}
            {note('A small model picks all three colors from your words. Costs a few tokens.')}
            <Input
              key="look"
              label="Look"
              placeholder="cozy autumn cabin"
              submitLabel="Make it"
              onSubmit={wish => void describeLook($, wish)}
            />
          </Box>
        )}

        {heading('Buttons and text boxes')}
        {note('The app draws buttons and text boxes in its own light or dark style. Tell the Clubhouse which one your app is in, and it puts a matching backing behind them whenever your background would hide them.')}
        <Box>
          <Button
            key="app-mode"
            label={chosen.appMode === 'dark' ? 'My app is in dark mode' : 'My app is in light mode'}
            onPress={() =>
              void keep($, held => ({ ...held, appMode: held.appMode === 'dark' ? 'light' : 'dark' }))
            }
          />
        </Box>

        {heading('The conversation')}
        {note('Paints your background behind every row of the conversation: your messages, replies, tool rows and the working line. The app still draws each row itself, so nothing is lost. If your color is from the other family than your app, each row gets a readable backing.')}
        <Box gap={1} flexWrap="wrap">
          <Button
            key="tint-chat"
            label={chosen.tintChat ? 'Conversation tint: on' : 'Conversation tint: off'}
            variant={chosen.tintChat ? 'primary' : 'secondary'}
            onPress={() => void keep($, held => ({ ...held, tintChat: !held.tintChat }))}
          />
          <Button
            key="gap-fill"
            label={GAP_FILL_LABEL[chosen.gapFill]}
            variant={chosen.gapFill === 'off' ? 'secondary' : 'primary'}
            onPress={() => void keep($, held => ({ ...held, gapFill: GAP_FILL_NEXT[held.gapFill] }))}
          />
        </Box>
        {note('Fill the gaps is experimental. Soft stretches each row\'s color into the space around it and can never cover text. Full lays the color over the space between rows and out to the edges; if it covers anything, switch back. Both also widen the color inside the rooms.')}
        {note('If something looks wrong and you cannot reach this button, type /clubhouse reset.')}

        {heading('The whole window')}
        {note('The text box, the row under it, the tab strip and the sidebar are painted by the Claude app, not by Claude Code, so no mod can reach them. The app does have a Developer Mode, and with it you can apply your color to the entire window yourself:')}
        {note('1. In the menu bar choose Help, Troubleshooting, Enable Developer Mode, and confirm. You do this once; the app may need a restart.')}
        {note('2. Press Option-Command-I to open DevTools and click Console.')}
        {note('3. Press Copy window tint below, paste in the console, press Enter. The first time, Chrome asks you to type "allow pasting".')}
        <Box gap={1} flexWrap="wrap">
          <Button key="window-tint" label="Copy window tint" variant="primary" onPress={() => void shareWindowTint($, false)} />
          <Button key="window-undo" label="Copy undo" onPress={() => void shareWindowTint($, true)} />
        </Box>
        {note('What you paste only adds one style rule that sets the app\'s background, text and border colors from your Background color. It lasts until the window reloads or the app restarts, then you paste it again. If you paste a light tint into a dark app, or the reverse, flip the app-mode switch above so the Clubhouse matches.')}

        {heading('Claude Code in a terminal')}
        {note('In a terminal, Claude Code draws everything itself, so this theme recolors its accents, borders and panels there.')}
        <Box gap={1} flexWrap="wrap">
          <Button key="apply-app" label="Apply to Claude Code theme" onPress={() => void applyToApp($)} />
          <Button key="undo-app" label="Undo" onPress={() => void undoApp($)} />
          <Button
            key="reset-colors"
            label="Reset Clubhouse colors"
            onPress={() => void keep($, resetLook)}
          />
        </Box>
        {view.note !== null && plain(view.note)}
      </Box>
    )
  })
}
