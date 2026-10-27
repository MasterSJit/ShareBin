import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_LOCAL_ROOT || path.join(process.cwd(), 'storage')
)

/**
 * StorageProvider abstraction (spec §5.2).
 * Only LocalStorageProvider is wired up here (sandbox constraint),
 * but the interface mirrors the S3 implementation in the docs.
 */
export interface StorageProvider {
  upload(
    key: string,
    data: Buffer,
    mimeType: string
  ): Promise<string>
  download(key: string): Promise<Buffer>
  /** Read bytes [start, end] inclusive (for HTTP Range requests). */
  readRange(key: string, start: number, end: number): Promise<Buffer>
  delete(key: string): Promise<void>
  getLocalPath(key: string): string
}

class LocalStorageProvider implements StorageProvider {
  private root: string

  constructor(root: string) {
    this.root = root
  }

  private fullPath(key: string): string {
    // Resolve and verify the result stays inside the storage root, which
    // blocks `..` segments, absolute paths and encoded tricks alike.
    const full = path.resolve(this.root, key.replace(/^[/\\]+/, ''))
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key')
    }
    return full
  }

  getLocalPath(key: string): string {
    return this.fullPath(key)
  }

  async upload(key: string, data: Buffer, _mimeType: string): Promise<string> {
    const full = this.fullPath(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, data)
    return key
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(key))
  }

  async readRange(key: string, start: number, end: number): Promise<Buffer> {
    const handle = await fs.open(this.fullPath(key), 'r')
    try {
      const length = end - start + 1
      const buf = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buf, 0, length, start)
      return buf.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.fullPath(key))
    } catch {
      // already gone
    }
  }
}

let provider: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider(STORAGE_ROOT)
  }
  return provider
}

/** Build a yyyy/mm/uuid storage key for an uploaded file. */
export function buildStorageKey(originalFileName: string): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const uuid = crypto.randomUUID()
  // keep a sanitised original extension for human-friendliness
  const ext = path
    .extname(originalFileName || '')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 12)
  return `${yyyy}/${mm}/${uuid}${ext.length > 1 ? ext : ''}`
}
