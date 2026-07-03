/* eslint-disable @typescript-eslint/no-require-imports */
// Seed script — seeds RBAC roles/permissions + subscription plans + admin user
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const db = new PrismaClient()

  // ---- Permissions ----
  const permissions = [
    // Paste permissions
    { name: 'paste:create', description: 'Create text pastes', category: 'paste' },
    { name: 'paste:create.file', description: 'Upload file pastes', category: 'paste' },
    { name: 'paste:edit.own', description: 'Edit own pastes', category: 'paste' },
    { name: 'paste:edit.any', description: 'Edit any paste', category: 'paste' },
    { name: 'paste:delete.own', description: 'Delete own pastes', category: 'paste' },
    { name: 'paste:delete.any', description: 'Delete any paste', category: 'paste' },
    { name: 'paste:view.private', description: 'View private pastes', category: 'paste' },
    { name: 'paste:use.custom_expiry', description: 'Use custom expiry dates', category: 'paste' },
    { name: 'paste:use.burn', description: 'Use burn-after-read', category: 'paste' },
    { name: 'paste:use.password', description: 'Use password protection', category: 'paste' },
    { name: 'paste:use.private', description: 'Create private pastes', category: 'paste' },
    // User permissions
    { name: 'user:read.own', description: 'View own profile', category: 'user' },
    { name: 'user:read.any', description: 'View any user', category: 'user' },
    { name: 'user:edit.own', description: 'Edit own profile', category: 'user' },
    { name: 'user:edit.any', description: 'Edit any user', category: 'user' },
    { name: 'user:delete.any', description: 'Delete any user', category: 'user' },
    // Admin permissions
    { name: 'admin:access', description: 'Access admin panel', category: 'admin' },
    { name: 'admin:users', description: 'Manage users', category: 'admin' },
    { name: 'admin:content', description: 'Manage all content', category: 'admin' },
    { name: 'admin:settings', description: 'Manage site settings', category: 'admin' },
    { name: 'admin:rbac', description: 'Manage roles & permissions', category: 'admin' },
    { name: 'admin:plans', description: 'Manage subscription plans', category: 'admin' },
    { name: 'admin:subscriptions', description: 'Manage user subscriptions', category: 'admin' },
    { name: 'admin:analytics', description: 'View analytics', category: 'admin' },
    { name: 'admin:audit', description: 'View audit logs', category: 'admin' },
  ]

  for (const p of permissions) {
    await db.permission.upsert({
      where: { name: p.name },
      update: { description: p.description, category: p.category },
      create: p,
    })
  }
  console.log(`Seeded ${permissions.length} permissions`)

  // ---- Roles ----
  const roles = [
    { name: 'user', description: 'Default user role', color: 'brand', isSystem: true, perms: [
      'paste:create', 'paste:create.file', 'paste:edit.own', 'paste:delete.own',
      'paste:use.burn', 'paste:use.password', 'user:read.own', 'user:edit.own',
    ]},
    { name: 'moderator', description: 'Content moderator', color: 'amber', isSystem: true, perms: [
      'paste:create', 'paste:create.file', 'paste:edit.own', 'paste:edit.any', 'paste:delete.own', 'paste:delete.any',
      'paste:use.burn', 'paste:use.password', 'paste:use.private', 'paste:use.custom_expiry',
      'user:read.own', 'user:read.any', 'user:edit.own',
      'admin:access', 'admin:content', 'admin:audit',
    ]},
    { name: 'admin', description: 'Full system administrator', color: 'brand-2', isSystem: true, perms: [
      // all permissions
      ...permissions.map(p => p.name),
    ]},
  ]

  for (const r of roles) {
    const role = await db.role.upsert({
      where: { name: r.name },
      update: { description: r.description, color: r.color, isSystem: r.isSystem },
      create: { name: r.name, description: r.description, color: r.color, isSystem: r.isSystem },
    })
    // Sync permissions
    const perms = await db.permission.findMany({ where: { name: { in: r.perms } } })
    await db.rolePermission.deleteMany({ where: { roleId: role.id } })
    for (const p of perms) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      })
    }
    console.log(`Seeded role: ${r.name} (${r.perms.length} perms)`)
  }

  // ---- Plans ----
  const plans = [
    {
      name: 'Free', description: 'Free tier — basic features',
      monthlyPrice: 0, maxStorageBytes: 50 * 1024 * 1024, maxPasteSize: 2 * 1024 * 1024,
      maxPastesPerMonth: 20,
      allowedExpiryPresets: 'never,10m,1h,1d,1w,1M',
      allowCustomExpiry: false, allowBurnAfterRead: true, allowPassword: true,
      allowPrivate: false, allowFileUpload: true, isSystem: true, sortOrder: 0,
    },
    {
      name: 'Pro', description: 'Pro tier — more storage & features',
      monthlyPrice: 9.99, maxStorageBytes: 5 * 1024 * 1024 * 1024, maxPasteSize: 25 * 1024 * 1024,
      maxPastesPerMonth: 500,
      allowedExpiryPresets: 'never,10m,1h,1d,1w,1M,1y',
      allowCustomExpiry: true, allowBurnAfterRead: true, allowPassword: true,
      allowPrivate: true, allowFileUpload: true, isSystem: true, sortOrder: 1,
    },
    {
      name: 'Business', description: 'Business tier — unlimited everything',
      monthlyPrice: 29.99, maxStorageBytes: 50 * 1024 * 1024 * 1024, maxPasteSize: 100 * 1024 * 1024,
      maxPastesPerMonth: 10000,
      allowedExpiryPresets: 'never,10m,1h,1d,1w,1M,1y,custom',
      allowCustomExpiry: true, allowBurnAfterRead: true, allowPassword: true,
      allowPrivate: true, allowFileUpload: true, isSystem: true, sortOrder: 2,
    },
  ]

  for (const p of plans) {
    await db.plan.upsert({
      where: { name: p.name },
      update: { allowBurnAfterRead: true },
      create: p,
    })
    console.log(`Seeded plan: ${p.name}`)
  }

  // ---- Admin user ----
  const email = 'admin@pasteshare.local'
  const password = 'admin123'
  const adminRole = await db.role.findUnique({ where: { name: 'admin' } })
  const proPlan = await db.plan.findUnique({ where: { name: 'Business' } })

  const existing = await db.user.findUnique({ where: { email } })
  if (!existing) {
    const hash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: {
        email,
        passwordHash: hash,
        displayName: 'PasteShare Admin',
        role: 'admin',
        roleId: adminRole?.id,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    })
    // Give admin a Business subscription (lifetime)
    if (proPlan) {
      await db.subscription.create({
        data: { userId: user.id, planId: proPlan.id, status: 'active', expiresAt: null },
      })
    }
    await db.usageRecord.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })
    console.log(`Seeded admin user: ${email} / ${password}`)
  } else {
    await db.user.update({
      where: { email },
      data: { role: 'admin', roleId: adminRole?.id, status: 'active', emailVerifiedAt: new Date() },
    })
    if (proPlan && !await db.subscription.findFirst({ where: { userId: existing.id, planId: proPlan.id } })) {
      await db.subscription.create({
        data: { userId: existing.id, planId: proPlan.id, status: 'active', expiresAt: null },
      })
    }
    await db.usageRecord.upsert({
      where: { userId: existing.id },
      update: {},
      create: { userId: existing.id },
    })
    console.log(`Updated admin user: ${email}`)
  }

  // ---- Default site settings ----
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
