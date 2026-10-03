const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const LARGEST_BLOCK = 65_535
const ADLER = 65_521
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CRC_TABLE = Array.from({ length: 256 }, (_, start) => {
  let value = start

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

export type Pixels = { width: number; height: number; rgba: number[] }

function crcOf(bytes: readonly number[]): number {
  return (bytes.reduce((crc, byte) => CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0
}

function adlerOf(bytes: readonly number[]): number {
  const [low, high] = bytes.reduce(([one, two], byte) => [(one + byte) % ADLER, (two + one + byte) % ADLER], [1, 0])

  return ((high! << 16) | low!) >>> 0
}

function word(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function chunk(kind: string, body: readonly number[]): number[] {
  const named = [...kind].map(letter => letter.charCodeAt(0)).concat(body)

  return [...word(body.length), ...named, ...word(crcOf(named))]
}

function stored(bytes: readonly number[]): number[] {
  const blocks: number[] = []

  for (let at = 0; at < bytes.length; at += LARGEST_BLOCK) {
    const block = bytes.slice(at, at + LARGEST_BLOCK)
    const isLast = at + LARGEST_BLOCK >= bytes.length

    blocks.push(isLast ? 1 : 0, block.length & 0xff, block.length >>> 8, ~block.length & 0xff, (~block.length >>> 8) & 0xff, ...block)
  }

  return [0x78, 0x01, ...blocks, ...word(adlerOf(bytes))]
}

export function pngOf({ width, height, rgba }: Pixels): number[] {
  const rows = Array.from({ length: height }, (_, row) => [0, ...rgba.slice(row * width * 4, (row + 1) * width * 4)]).flat()

  return [
    ...SIGNATURE,
    ...chunk('IHDR', [...word(width), ...word(height), 8, 6, 0, 0, 0]),
    ...chunk('IDAT', stored(rows)),
    ...chunk('IEND', []),
  ]
}

export function toBase64(bytes: readonly number[]): string {
  let text = ''

  for (let at = 0; at < bytes.length; at += 3) {
    const [first, second, third] = [bytes[at]!, bytes[at + 1], bytes[at + 2]]
    const packed = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

    text +=
      LETTERS[(packed >>> 18) & 63]! +
      LETTERS[(packed >>> 12) & 63]! +
      (second === undefined ? '=' : LETTERS[(packed >>> 6) & 63]!) +
      (third === undefined ? '=' : LETTERS[packed & 63]!)
  }

  return text
}

export function pixelsFrom(listing: string): Pixels | null {
  const [size, hex] = listing.trim().split('\n')
  const [width, height] = (size ?? '').split(' ').map(Number)

  if (width === undefined || height === undefined || hex === undefined) return null
  if (!(width > 0 && height > 0) || hex.length !== width * height * 8 || /[^0-9a-f]/.test(hex)) return null

  return {
    width,
    height,
    rgba: Array.from({ length: width * height * 4 }, (_, at) => parseInt(hex.slice(at * 2, at * 2 + 2), 16)),
  }
}
