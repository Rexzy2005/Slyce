import { X509Certificate } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export function requireDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required for database access');
  return value;
}

function normalizedCaCertificate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const certificate = value.replace(/\\n/g, '\n').trim();
  if (!certificate.includes('-----BEGIN CERTIFICATE-----') || !certificate.includes('-----END CERTIFICATE-----')) {
    throw new Error('SUPABASE_CA_CERT must contain a PEM-encoded CA certificate');
  }
  try {
    new X509Certificate(certificate);
  } catch {
    throw new Error('SUPABASE_CA_CERT must contain a valid CA certificate');
  }
  return certificate;
}

function removeSslUrlParameters(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslrootcert');
  return url.toString();
}

export function createPrismaClient(databaseUrl = requireDatabaseUrl(), env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const ca = normalizedCaCertificate(env.SUPABASE_CA_CERT);
  const adapter = new PrismaPg(ca
    ? { connectionString: removeSslUrlParameters(databaseUrl), ssl: { ca, rejectUnauthorized: true } }
    : { connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
