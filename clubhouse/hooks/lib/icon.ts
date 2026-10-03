export type HomeIconSpec = { size: number; accent: string }

const BADGE_TOP = '#33353c'
const BADGE_BOTTOM = '#17181c'
const HOUSE_TOP = '#fffaf1'
const HOUSE_BOTTOM = '#f1e4cf'
const EDGE = 28
const ROOF = 'M 22 282 L 256 80 L 490 282'
const CHIMNEY = 'M 352 52 H 436 V 232 L 352 160 Z'
const WALLS =
  'M 256 146 L 440 304 V 458 a 22 22 0 0 1 -22 22 H 94 a 22 22 0 0 1 -22 -22 V 304 Z'
const DOOR = 'M 208 480 V 348 a 10 10 0 0 1 10 -10 H 294 a 10 10 0 0 1 10 10 V 480 Z'

export function homeIconSvg({ size, accent }: HomeIconSpec): string {
  const edge = `fill="${BADGE_BOTTOM}" stroke="${BADGE_BOTTOM}" stroke-width="${EDGE * 2}" stroke-linejoin="round"`
  const house =
    `<path d="${CHIMNEY}" ${edge}/>` +
    `<path d="${WALLS}" ${edge}/>` +
    `<path d="${ROOF}" fill="none" stroke="${BADGE_BOTTOM}" stroke-width="${50 + EDGE * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${CHIMNEY}" fill="url(#house)"/>` +
    `<path d="${WALLS}" fill="url(#house)"/>` +
    `<path d="${ROOF}" fill="none" stroke="url(#roof)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${DOOR}" fill="${accent}"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
    '<defs>' +
    `<linearGradient id="badge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BADGE_TOP}"/><stop offset="1" stop-color="${BADGE_BOTTOM}"/></linearGradient>` +
    `<linearGradient id="house" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${HOUSE_TOP}"/><stop offset="1" stop-color="${HOUSE_BOTTOM}"/></linearGradient>` +
    `<linearGradient id="roof" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="300"><stop offset="0" stop-color="${HOUSE_TOP}"/><stop offset="1" stop-color="${HOUSE_BOTTOM}"/></linearGradient>` +
    '</defs>' +
    '<rect x="1" y="1" width="62" height="62" rx="16" fill="url(#badge)"/>' +
    '<rect x="1.5" y="1.5" width="61" height="61" rx="15.5" fill="none" stroke="#ffffff" stroke-opacity="0.1"/>' +
    `<path d="M 40.4 18.8 A 17.5 17.5 0 1 0 40.4 41.2" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>` +
    `<g transform="translate(23 18.5) scale(0.07)">${house}</g>` +
    '</svg>'
  )
}
