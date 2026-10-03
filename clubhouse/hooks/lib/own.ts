const PLUGIN_FOLDER = 'clubhouse'
const ASKS_TO_CHANGE = /\bin (the |my )?clubhouse\b/i

export function ownFolder(pluginDirs: string | undefined): string | null {
  const found = (pluginDirs ?? '')
    .split(/[:,]/)
    .map(one => one.trim().replace(/\/+$/, ''))
    .find(one => one.split('/').at(-1) === PLUGIN_FOLDER)

  return found === undefined ? null : found.slice(0, -(PLUGIN_FOLDER.length + 1)) || null
}

export function shortFolder(folder: string, home: string | undefined): string {
  return home !== undefined && home !== '' && folder.startsWith(`${home}/`) ? `~${folder.slice(home.length)}` : folder
}

export function asksToChange(text: string): boolean {
  return ASKS_TO_CHANGE.test(text)
}

export function changeContext(folder: string | null): string {
  return [
    'The user is asking to change Claude Clubhouse, a Claude Code mod installed on this computer.',
    folder === null
      ? 'Find its folder first: it is the one named in CLAUDE_CODE_PLUGIN_DIRS in ~/.claude/settings.json; the plugin is its clubhouse/ subfolder.'
      : `Its code is in ${folder}; the plugin is the clubhouse/ subfolder there.`,
    'Read CLAUDE.md in that folder first and follow it.',
    'This is the user\'s own copy: edit it in place, run "claude plugin validate clubhouse" and "claude plugin test clubhouse" from that folder, and commit on this computer.',
    'Do not push, open a pull request or publish a release unless the user asks, and never to a repository that is not theirs.',
  ].join(' ')
}
