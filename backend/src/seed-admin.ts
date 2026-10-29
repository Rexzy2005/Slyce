import { pathToFileURL } from 'node:url';
import { hashAdminPassword, normalizeAdminEmail } from './admin-auth.js';
import { createPrismaClient } from './database.js';

export async function seedAdministrator(env: NodeJS.ProcessEnv = process.env): Promise<'created' | 'already_exists'> {
  const emailValue = env.SLYCE_ADMIN_SEED_EMAIL;
  const password = env.SLYCE_ADMIN_SEED_PASSWORD;
  if (!emailValue?.trim()) throw new Error('SLYCE_ADMIN_SEED_EMAIL is required');
  if (!password) throw new Error('SLYCE_ADMIN_SEED_PASSWORD is required');
  const email = normalizeAdminEmail(emailValue);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('SLYCE_ADMIN_SEED_EMAIL must be a valid email address');
  const allowedEmails = (env.SLYCE_ADMIN_EMAILS ?? '').split(',').map(normalizeAdminEmail).filter(Boolean);
  if (!allowedEmails.includes(email)) throw new Error('SLYCE_ADMIN_SEED_EMAIL must be present in SLYCE_ADMIN_EMAILS');

  const database = createPrismaClient();
  try {
    const externalSubject = `local-admin:${email}`;
    const existing = await database.adminAccount.findUnique({ where: { externalSubject }, select: { id: true } });
    if (existing) return 'already_exists';
    const passwordHash = await hashAdminPassword(password);
    await database.adminAccount.create({ data: { externalSubject, email, passwordHash, role: 'ADMIN', active: true } });
    return 'created';
  } finally {
    await database.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedAdministrator()
    .then(result => { process.stdout.write(result === 'created' ? 'Administrator account created.\n' : 'Administrator account already exists; no changes were made.\n'); })
    .catch(error => { process.stderr.write(`Administrator seed failed: ${error instanceof Error ? error.message : 'unknown error'}\n`); process.exitCode = 1; });
}
