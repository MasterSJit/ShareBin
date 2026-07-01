import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

const STORAGE_ROOT =
  process.env.STORAGE_LOCAL_ROOT || path.join(process.cwd(), 'storage')

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
  delete(key: string): Promise<void>
  getLocalPath(key: string): string
}

class LocalStorageProvider implements StorageProvider {
  private root: string

  constructor(root: string) {
    this.root = root
  }

  private fullPath(key: string): string {
    // Prevent path traversal
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '')
    return path.join(this.root, safe)
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
    const full = this.fullPath(key)
    return fs.readFile(full)
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

/** Build a yyyymm/uuid storage key for an uploaded file. */
export function buildStorageKey(originalFileName: string): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const uuid = crypto.randomUUID()
  // keep original extension for human-friendliness
  const ext = path.extname(originalFileName || '')
  return `${yyyy}/${mm}/${uuid}${ext}`
}
