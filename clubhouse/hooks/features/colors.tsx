import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Palette, PaletteSlot, Prefs, Reach } from '../../types'
import {
  HELPER_CONFIG,
  READ_APP_MODE,
  START_HELPER,
  appModeFrom,
  backdropOf,
  coversApp,
  helperConfig,
  inkOf,
  swapsLightAndDark,
} from '../lib/appColor'
import { clawdSvg, wheelSvg } from '../lib/clawd'
import { contrast, isLight, mix, normalizeHex, rgbString, shift, toHsl } from '../lib/color'
import type { Hsl } from '../lib/color'
import {
  DEFAULT_COLORS_VIEW,
  DEFAULT_PALETTE,
  DEFAULT_PREFS,
  PREFS_KEY,
  PREFS_SHAPE,
  isRecord,
  resetLook,
} from '../lib/defaults'
import { makeParts } from '../lib/parts'
import { WINDOW_TINT_UNDO, windowTintSnippet } from '../lib/windowTint'

const colorsView = atom({ plugin: 'clubhouse', key: 'colorsView' } as const, DEFAULT_COLORS_VIEW)
const prefs = atom({ plugin: 'clubhouse', key: 'prefs' } as const, DEFAULT_PREFS, {
  shape: PREFS_SHAPE,
})

const THEME_SLUG = 'clubhouse'
const THEME_REF = `custom:${THEME_SLUG}`
const WHEEL_SIZE = 110
const COMFORTABLE_CONTRAST = 4.5
const LOOK_MODEL = 'haiku'
const LOOK_SYSTEM =
  'You design three-color palettes. Reply with one JSON object and nothing else: ' +
  '{"accent":"#rrggbb","clawd":"#rrggbb","background":"#rrggbb"}. ' +
  'accent is for headings and highlights, clawd is the body color of a small mascot, ' +
  'background is a panel background. Keep accent and clawd clearly visible on background.'

const SLOTS: readonly (readonly [PaletteSlot, string, string])[] = [
  ['background', 'Background', 'The color behind everything the Clubhouse reaches.'],
  [
    'text',
    'Text',
    'The conversation text, icons and borders, while the button above says the whole session. Automatic picks dark or light, whichever reads better.',
  ],
  ['accent', 'Accent', 'Headings and highlights in the Clubhouse.'],
  ['clawd', 'Clawd', 'The mascot in the usage meter.'],
]

const UNSET: Record<PaletteSlot, string> = {
  background: 'app default',
  text: 'automatic',
  accent: 'app default',
  clawd: 'app default',
}

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
  ['look-ivory', 'Anthropic ivory', { accent: '#c6613f', clawd: '#d97757', background: '#faf9f5', text: null }],
  ['look-manilla', 'Anthropic manilla', { accent: '#c6613f', clawd: '#d97757', background: '#f5e3c7', text: null }],
  ['look-slate', 'Anthropic slate', { accent: '#d97757', clawd: '#d97757', background: '#141413', text: null }],
]

const REACH_NEXT: Record<Reach, Reach> = { app: 'conversation', conversation: 'rooms', rooms: 'app' }
const REACH_LABEL: Record<Reach, string> = {
  app: 'Background covers: the whole session',
  conversation: 'Background covers: the conversation',
  rooms: 'Background covers: the Clubhouse only',
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

function colorOf(held: Prefs, slot: PaletteSlot): string {
  return held.palette[slot] ?? (slot === 'text' ? inkOf(held) : backdropOf(held))
}

async function appModeNow($: EngineInterface): Promise<Prefs['appMode'] | null> {
  const ran = await $.process.run(['/bin/sh', '-c', READ_APP_MODE]).catch(() => null)

  return ran === null ? null : appModeFrom(ran.stdout)
}

async function keep($: EngineInterface, change: (held: Prefs) => Prefs): Promise<void> {
  const mode = await appModeNow($)
  await update($, prefs, held => ({ ...change(held), appMode: mode ?? held.appMode }))
  const chosen = await read($, prefs)
  await $.store.set(PREFS_KEY, chosen)
  const userFolder = await $.env.get('HOME')

  if (userFolder === undefined) return
  await $.fs.write(`${userFolder}/${HELPER_CONFIG}`, helperConfig(chosen)).catch(() => undefined)

  if (coversApp(chosen)) {
    await $.process.run(['/bin/sh', '-c', START_HELPER]).catch(() => undefined)
  }
}

async function say($: EngineInterface, note: string): Promise<void> {
  await update($, colorsView, view => ({ ...view, note }))
}

async function applyToApp($: EngineInterface): Promise<void> {
  try {
    const userFolder = await $.env.get('HOME')
    const row = (await $.config.list()).find(one => one.key === 'theme')
    const current = typeof row?.value === 'string' ? row.value : 'dark'
    const chosen = await read($, prefs)
    const previous = current === THEME_REF ? (chosen.previousTheme ?? 'dark') : current
    const isLightBase = previous.startsWith('light')

    if (userFolder === undefined) {
      await say($, 'Could not find your home folder, so no theme was written.')

      return
    }

    await $.fs.write(
      `${userFolder}/.claude/themes/${THEME_SLUG}.json`,
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

    await keep($, held => ({ ...held, palette: { accent, clawd, background, text: null } }))
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
          ? 'Undo copied. Paste it in the Console window and press Return.'
          : 'App colors copied. Paste them in the Console window and press Return.',
      )

      return
    }

    const userFolder = await $.env.get('HOME')

    if (userFolder === undefined) {
      await say($, 'Could not reach the clipboard or your home folder.')

      return
    }

    await $.fs.write(`${userFolder}/${TINT_FILE}`, `${text}\n`)
    await say($, `Could not reach the clipboard, so it is saved in ~/${TINT_FILE}. Open that file and copy its one line.`)
  } catch (error) {
    await say($, `Could not prepare the app colors: ${reason(error)}`)
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
    const { Box, Text } = elements
    const chosen = await read($, prefs)
    const view = await read($, colorsView)
    const slot = view.slot
    const current = colorOf(chosen, slot)
    const { look, ink, frame, note, plain, title, heading, picture, swatch, Button, Input } = makeParts(
      elements,
      chosen,
      e.surface,
    )
    const setSlot = (hex: string | null) =>
      void keep($, held => ({ ...held, palette: { ...held.palette, [slot]: hex } }))
    const nudge = (change: Partial<Hsl>) =>
      void keep($, held => ({
        ...held,
        palette: { ...held.palette, [slot]: shift(colorOf(held, slot), change) },
      }))
    const isHardToRead =
      coversApp(chosen) && contrast(backdropOf(chosen), inkOf(chosen)) < COMFORTABLE_CONTRAST

    return (
      <Box flexDirection="column" gap={1} {...frame}>
        {title('Colors')}
        {note(
          'Pick the colors of everything the Clubhouse draws. Choose what to color, then nudge it, pick a preset, type a hex code or describe a look. /clubhouse colors opens this.',
        )}

        <Box gap={1} flexWrap="wrap">
          <Button
            key="reach"
            label={REACH_LABEL[chosen.reach] ?? REACH_LABEL.app}
            variant="primary"
            onPress={() => void keep($, held => ({ ...held, reach: REACH_NEXT[held.reach] }))}
          />
          <Button key="reset-colors" label="Reset all to default" onPress={() => void keep($, resetLook)} />
        </Box>
        {note(
          chosen.reach !== 'app'
            ? 'Press the button to make your Background color the color of the whole session.'
            : !chosen.isHelperReady
              ? 'The helper that colors the whole session is not installed on this Mac, so the Background color stops at the conversation. Ask Claude to build it.'
              : chosen.palette.background === null
                ? 'Pick a Background color below and it becomes the color of the whole session: the conversation, the toolbar, the text box and the Clubhouse rooms. The sidebar keeps the app\'s own look.'
                : 'Your Background color is the color of the whole session: the conversation, the toolbar, the text box and the Clubhouse rooms. Text, icons and borders take your Text color. The sidebar keeps the app\'s own look.',
        )}
        {swapsLightAndDark(chosen) &&
          note(
            `This is a ${chosen.appMode === 'dark' ? 'light' : 'dark'} color on a ${chosen.appMode} app, so the helper swaps light and dark across the session to keep text readable. Pictures in the conversation swap too. Switching the Claude app itself to ${chosen.appMode === 'dark' ? 'light' : 'dark'} mode avoids that, and the Clubhouse notices on its own.`,
          )}
        {isHardToRead &&
          note(
            'On a mid-bright background like this, neither dark nor light text stands out strongly, and Clawd and the usage bar take lighter shades of their colors. A darker or lighter background reads best.',
          )}

        {heading('What to color')}
        {SLOTS.map(([id, label, about]) => (
          <Box flexDirection="column">
            <Box gap={1} alignItems="center">
              <Button
                key={`slot-${id}`}
                label={label}
                variant={slot === id ? 'primary' : 'secondary'}
                onPress={() => void update($, colorsView, held => ({ ...held, slot: id }))}
              />
              {swatch(colorOf(chosen, id))}
              <Text {...ink}>{chosen.palette[id] ?? UNSET[id]}</Text>
              <Button
                key={`reset-${id}`}
                label="Reset"
                onPress={() =>
                  void keep($, held => ({ ...held, palette: { ...held.palette, [id]: DEFAULT_PALETTE[id] } }))
                }
              />
            </Box>
            {note(about)}
          </Box>
        ))}

        {heading(`Adjust ${slot}`)}
        <Box gap={2} alignItems="center">
          {picture(
            wheelSvg({ hue: toHsl(current).hue, color: current, size: WHEEL_SIZE }),
            `Color wheel showing ${current}`,
            WHEEL_SIZE,
            WHEEL_SIZE,
          )}
          {picture(clawdSvg('happy', look.clawd, 6), 'Clawd in the chosen color', 90, 58)}
        </Box>
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
          {(slot === 'background' || slot === 'text') && (
            <Button
              key="preset-none"
              label={slot === 'text' ? 'Automatic' : 'None'}
              onPress={() => setSlot(null)}
            />
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

        {heading('How the session gets its color')}
        {note(`Claude Code can only paint its own rows and panels, so the Clubhouse runs a small helper on your Mac. Wherever the session shows the app's plain background, the helper swaps in your Background color, and it moves text, icons and borders to your Text color. It notices on its own whether the Claude app is in dark or light mode (${chosen.appMode} right now), and it stops when you reset, switch the Clubhouse off or quit Claude.`)}

        <Box>
          <Button
            key="advanced"
            label={view.isAdvancedOpen ? '▾ Advanced' : '▸ Advanced'}
            onPress={() => void update($, colorsView, held => ({ ...held, isAdvancedOpen: !held.isAdvancedOpen }))}
          />
        </Box>
        {view.isAdvancedOpen && (
          <Box flexDirection="column" gap={1}>
            {heading('Repaint the app itself')}
            {note('The Claude app has a Developer Mode that lets you change its real colors by hand. It lasts until the app restarts, then you do steps 2 and 3 again.')}
            {note('1. Look at the very top of your screen, the strip that starts with the Apple logo. Click Help, then Troubleshooting, then Enable Developer Mode, and confirm. You only do this once.')}
            {note('2. Hold Option and Command and press I. A new window opens. Click the word Console near its top.')}
            {note('3. Press Copy app colors below. Click in the big empty area of that new window, hold Command and press V, then press Return. If it asks, type the words allow pasting, press Return, and paste again.')}
            <Box gap={1} flexWrap="wrap">
              <Button key="window-tint" label="Copy app colors" onPress={() => void shareWindowTint($, false)} />
              <Button key="window-undo" label="Copy undo" onPress={() => void shareWindowTint($, true)} />
            </Box>
            {heading('Claude Code in a terminal')}
            {note('In a terminal, Claude Code draws everything itself, so this theme recolors its accents, borders and panels there.')}
            <Box gap={1} flexWrap="wrap">
              <Button key="apply-app" label="Apply to Claude Code theme" onPress={() => void applyToApp($)} />
              <Button key="undo-app" label="Undo" onPress={() => void undoApp($)} />
            </Box>
          </Box>
        )}
        {view.note !== null && plain(view.note)}
      </Box>
    )
  })
}
