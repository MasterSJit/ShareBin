/* eslint-disable @typescript-eslint/no-require-imports */
// Seed script — run with: bun run prisma/seed.ts
// Creates default site settings + an admin user (admin@pasteshare.local / admin123)
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const db = new PrismaClient()
  const email = 'admin@pasteshare.local'
  const password = 'admin123'

  const existing = await db.user.findUnique({ where: { email } })
  if (!existing) {
    const hash = await bcrypt.hash(password, 12)
    await db.user.create({
      data: {
        email,
        passwordHash: hash,
        displayName: 'PasteShare Admin',
        role: 'admin',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    })
    console.log(`Seeded admin user: ${email} / ${password}`)
  } else if (existing.role !== 'admin') {
    await db.user.update({
      where: { email },
      data: { role: 'admin', status: 'active', emailVerifiedAt: new Date() },
    })
    console.log(`Upgraded existing user to admin: ${email}`)
  } else {
    console.log(`Admin user already exists: ${email}`)
  }

  // Seed default site settings
  const defaults = {
    siteName: JSON.stringify('PasteShare'),
    tagline: JSON.stringify('Share code & files with syntax-highlighted links.'),
    defaultExpiry: JSON.stringify('never'),
    maxFileSizeBytes: JSON.stringify(25 * 1024 * 1024),
    allowedFileTypes: JSON.stringify('*'),
    storageDriver: JSON.stringify('local'),
    guestPostingEnabled: JSON.stringify(true),
    metaTitleTemplate: JSON.stringify('{title} — PasteShare'),
    metaDescriptionTemplate: JSON.stringify('A public paste on PasteShare.'),
    sitemapEnabled: JSON.stringify(true),
    robotsTxt: JSON.stringify('User-agent: *\nAllow: /\nDisallow: /api/'),
  }
  for (const [k, v] of Object.entries(defaults)) {
    await db.siteSetting.upsert({ where: { key: k }, update: {}, create: { key: k, value: v } })
  }
  console.log('Seeded default site settings.')

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
