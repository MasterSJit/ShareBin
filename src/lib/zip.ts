import zlib from 'zlib'
import type { StorageProvider } from '@/lib/storage'

/**
 * Minimal ZIP reader (central directory + single-entry extraction) built on
 * StorageProvider.readRange, so listing a large archive only reads its tail.
 * Supports stored (0) and deflated (8) entries and ZIP64. Encrypted entries
 * are listed but can't be extracted.
 */

export type ZipEntry = {
  name: string
  isDirectory: boolean
  size: number
  compressedSize: number
  method: number
  encrypted: boolean
  modifiedAt: string | null
  /** Offset of the local file header (internal; not sent to clients). */
  offset: number
}

const EOCD_SIG = 0x06054b50
const ZIP64_LOCATOR_SIG = 0x07064b50
const ZIP64_EOCD_SIG = 0x06064b50
const CDH_SIG = 0x02014b50
const LFH_SIG = 0x04034b50

export const MAX_LISTED_ENTRIES = 5000
const MAX_CENTRAL_DIR_BYTES = 16 * 1024 * 1024
/** Refuse to inflate entries larger than this (zip-bomb guard). */
export const MAX_EXTRACT_BYTES = 50 * 1024 * 1024

export class ZipError extends Error {}

function dosDateTime(date: number, time: number): string | null {
  if (!date) return null
  const d = new Date(
    Date.UTC(1980 + (date >> 9), ((date >> 5) & 0x0f) - 1, date & 0x1f, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2),
  )
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function u64(buf: Buffer, off: number): number {
  return Number(buf.readBigUInt64LE(off))
}

export async function listZip(storage: StorageProvider, key: string, fileSize: number): Promise<{ entries: ZipEntry[]; total: number }> {
  if (fileSize < 22) throw new ZipError('Not a ZIP archive')
  const tailLen = Math.min(fileSize, 22 + 0xffff + 20)
  const tailStart = fileSize - tailLen
  const tail = await storage.readRange(key, tailStart, fileSize - 1)

  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ZipError('Not a ZIP archive (no end-of-central-directory record)')

  let total = tail.readUInt16LE(eocd + 10)
  let cdSize = tail.readUInt32LE(eocd + 12)
  let cdOffset = tail.readUInt32LE(eocd + 16)

  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20
    if (loc < 0 || tail.readUInt32LE(loc) !== ZIP64_LOCATOR_SIG) throw new ZipError('Corrupt ZIP64 archive')
    const z64Offset = u64(tail, loc + 8)
    const z64 = await storage.readRange(key, z64Offset, z64Offset + 55)
    if (z64.readUInt32LE(0) !== ZIP64_EOCD_SIG) throw new ZipError('Corrupt ZIP64 archive')
    total = u64(z64, 32)
    cdSize = u64(z64, 40)
    cdOffset = u64(z64, 48)
  }
  if (cdSize > MAX_CENTRAL_DIR_BYTES) throw new ZipError('Archive directory is too large to list')
  if (cdOffset + cdSize > fileSize) throw new ZipError('Corrupt ZIP archive')

  const cd = cdSize > 0 ? await storage.readRange(key, cdOffset, cdOffset + cdSize - 1) : Buffer.alloc(0)
  const entries: ZipEntry[] = []
  let p = 0
  while (p + 46 <= cd.length && entries.length < MAX_LISTED_ENTRIES) {
    if (cd.readUInt32LE(p) !== CDH_SIG) break
    const flags = cd.readUInt16LE(p + 8)
    const method = cd.readUInt16LE(p + 10)
    const time = cd.readUInt16LE(p + 12)
    const date = cd.readUInt16LE(p + 14)
    let compressedSize = cd.readUInt32LE(p + 20)
    let size = cd.readUInt32LE(p + 24)
    const nameLen = cd.readUInt16LE(p + 28)
    const extraLen = cd.readUInt16LE(p + 30)
    const commentLen = cd.readUInt16LE(p + 32)
    let offset = cd.readUInt32LE(p + 42)
    const nameBuf = cd.subarray(p + 46, p + 46 + nameLen)
    // Bit 11 = UTF-8 names; older tools use CP437, latin1 is a close fallback.
    const name = (flags & 0x800 ? nameBuf.toString('utf8') : nameBuf.toString('latin1')).replace(/\\/g, '/')

    // ZIP64 extended information extra field
    let e = p + 46 + nameLen
    const extraEnd = e + extraLen
    while (e + 4 <= extraEnd) {
      const id = cd.readUInt16LE(e)
      const len = cd.readUInt16LE(e + 2)
      if (id === 0x0001) {
        let q = e + 4
        if (size === 0xffffffff) { size = u64(cd, q); q += 8 }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cd, q); q += 8 }
        if (offset === 0xffffffff) { offset = u64(cd, q) }
      }
      e += 4 + len
    }

    entries.push({
      name,
      isDirectory: name.endsWith('/'),
      size,
      compressedSize,
      method,
      encrypted: (flags & 0x1) === 1,
      modifiedAt: dosDateTime(date, time),
      offset,
    })
    p += 46 + nameLen + extraLen + commentLen
  }
  return { entries, total }
}

/** Extract one entry's bytes. */
export async function extractZipEntry(storage: StorageProvider, key: string, entry: ZipEntry): Promise<Buffer> {
  if (entry.isDirectory) throw new ZipError('Entry is a directory')
  if (entry.encrypted) throw new ZipError('Entry is encrypted')
  if (entry.method !== 0 && entry.method !== 8) throw new ZipError(`Unsupported compression method ${entry.method}`)
  if (entry.size > MAX_EXTRACT_BYTES) throw new ZipError('Entry is too large to extract in the browser — download the archive')

  const lfh = await storage.readRange(key, entry.offset, entry.offset + 29)
  if (lfh.length < 30 || lfh.readUInt32LE(0) !== LFH_SIG) throw new ZipError('Corrupt ZIP entry')
  const dataStart = entry.offset + 30 + lfh.readUInt16LE(26) + lfh.readUInt16LE(28)
  if (entry.compressedSize === 0) return Buffer.alloc(0)
  const raw = await storage.readRange(key, dataStart, dataStart + entry.compressedSize - 1)

  if (entry.method === 0) return raw
  try {
    return zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, Math.min(entry.size, MAX_EXTRACT_BYTES)) })
  } catch {
    throw new ZipError('Failed to decompress entry')
  }
}
