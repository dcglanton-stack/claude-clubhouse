export type HomeIconSpec = { size: number; accent: string }

const BADGE_TOP = '#33353c'
const BADGE_BOTTOM = '#17181c'
const HOUSE_TOP = '#fffaf1'
const HOUSE_BOTTOM = '#f1e4cf'

export function homeIconSvg({ size, accent }: HomeIconSpec): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
    '<defs>' +
    `<linearGradient id="badge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BADGE_TOP}"/><stop offset="1" stop-color="${BADGE_BOTTOM}"/></linearGradient>` +
    `<linearGradient id="house" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${HOUSE_TOP}"/><stop offset="1" stop-color="${HOUSE_BOTTOM}"/></linearGradient>` +
    '</defs>' +
    '<rect x="1" y="1" width="62" height="62" rx="16" fill="url(#badge)"/>' +
    '<rect x="1.5" y="1.5" width="61" height="61" rx="15.5" fill="none" stroke="#ffffff" stroke-opacity="0.1"/>' +
    `<path d="M 38.5 19.6 A 16.5 16.5 0 1 0 38.5 46.4" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M 41 15.5 L 57 30.5 H 53 V 48 a 3 3 0 0 1 -3 3 H 32 a 3 3 0 0 1 -3 -3 V 30.5 H 25 Z" fill="url(#house)" stroke="${BADGE_BOTTOM}" stroke-width="3.2" stroke-linejoin="round"/>` +
    `<rect x="37.4" y="38.5" width="7.2" height="12.5" rx="3.6" fill="${accent}"/>` +
    '</svg>'
  )
}
