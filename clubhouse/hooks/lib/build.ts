export const BUILD_TIMEOUT_MS = 240_000
export const BUILD_SCRIPT = 'helper/build.sh'
export const FIND_COMPILER = ['/usr/bin/xcrun', '--find', 'swiftc'] as const
export const STOP_HELPER = ['/usr/bin/pkill', '-x', 'window-tint'] as const
export const BUILD_STARTED = 'Building the helper. This takes about a minute; keep working, the result shows here.'
export const BUILD_DONE = 'The helper is built. Your Background now colors the whole window, and Draw it has its sketch pad.'
export const BUILD_NEEDS_TOOLS =
  'The helper needs Apple\'s command line tools, which are not on this Mac yet. Open Terminal, run "xcode-select --install", let it finish (it is a free download from Apple), then press Build the helper again.'
export const BUILD_WHY =
  'Why this button: a mod can only color what it draws itself. The conversation, the text box and the sidebar are drawn by the Claude app, and the app gives a mod no way to recolor them. ' +
  'So the Clubhouse comes with a small helper program that sits over the Claude window and turns the app\'s own greys into shades of your Background, leaves things with a color of their own alone, and follows the window as it moves. ' +
  'It is a separate program, not part of the mod, so it has to be built once on your Mac from the code in your copy. That is all this button does, and without it your colors stop at the Clubhouse\'s own parts. ' +
  'The helper only changes how the Claude window is drawn: it does not record your screen and sends nothing anywhere.'
export const BUILD_AGAIN = 'Rebuild after you update the Clubhouse, so the helper matches the new version.'
export const BUILD_NO_FOLDER =
  'Could not tell where your copy of the Clubhouse is. Run helper/build.sh from that folder, or ask Claude to build the Clubhouse helper.'

const LINES_SHOWN = 4

export function buildFailed(output: string): string {
  const last = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .slice(-LINES_SHOWN)
    .join(' / ')

  return `The helper did not build.${last === '' ? '' : ` The build said: ${last}`} Ask Claude to look at it: "build the clubhouse helper".`
}
