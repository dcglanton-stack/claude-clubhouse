import { isLight, toHsl } from './color'

type Family = {
  steps: readonly (readonly [string, number])[]
  text: readonly (readonly [string, string])[]
  border: string
}

const STYLE_ID = 'clubhouse-window-tint'
const SELECTORS = ':root, html[data-mode], html[data-theme], [data-theme], .darkTheme'
const BORDER_LEVELS: readonly string[] = ['100', '200', '300', '400']

const DARK: Family = {
  steps: [
    ['000', 3.9],
    ['100', 0],
    ['200', -2.7],
    ['300', -6.9],
    ['400', -14.5],
    ['500', -14.5],
  ],
  text: [
    ['000', '48 33.3% 97.1%'],
    ['100', '48 33.3% 97.1%'],
    ['200', '50 9% 73.7%'],
    ['300', '50 9% 73.7%'],
    ['400', '48 4.8% 59.2%'],
    ['500', '48 4.8% 59.2%'],
  ],
  border: '51 16.5% 84.5%',
}

const LIGHT: Family = {
  steps: [
    ['000', 2.9],
    ['100', 0],
    ['200', -2.6],
    ['300', -4.9],
    ['400', -8.5],
    ['500', -8.5],
  ],
  text: [
    ['000', '60 2.6% 7.6%'],
    ['100', '60 2.6% 7.6%'],
    ['200', '60 2.5% 23.3%'],
    ['300', '60 2.5% 23.3%'],
    ['400', '51 3.1% 43.7%'],
    ['500', '51 3.1% 43.7%'],
  ],
  border: '30 3.3% 11.8%',
}

export const WINDOW_TINT_UNDO = `document.getElementById('${STYLE_ID}')?.remove()`

export function windowTintCss(background: string): string {
  const { hue, saturation, lightness } = toHsl(background)
  const family = isLight(background) ? LIGHT : DARK
  const level = (shift: number) =>
    `${Math.round(hue)} ${saturation.toFixed(1)}% ${Math.max(0, Math.min(100, lightness + shift)).toFixed(1)}%`
  const rules = [
    ...family.steps.map(([name, shift]) => `--bg-${name}: ${level(shift)} !important`),
    ...family.text.map(([name, value]) => `--text-${name}: ${value} !important`),
    ...BORDER_LEVELS.map(name => `--border-${name}: ${family.border} !important`),
  ]

  return `${SELECTORS} { ${rules.join('; ')} }`
}

export function windowTintSnippet(background: string): string {
  return (
    `(() => { document.getElementById('${STYLE_ID}')?.remove(); ` +
    `const style = document.createElement('style'); style.id = '${STYLE_ID}'; ` +
    `style.textContent = ${JSON.stringify(windowTintCss(background))}; ` +
    `document.head.append(style); return 'Clubhouse window tint applied' })()`
  )
}
