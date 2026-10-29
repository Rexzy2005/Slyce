import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

function directUrlWithVerifiedCa(): string {
  const directUrl = env('DIRECT_URL');
  const rawCa = process.env.SUPABASE_CA_CERT;
  if (!rawCa?.trim()) return directUrl;

  const ca = rawCa.replace(/\\n/g, '\n').trim();
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('SUPABASE_CA_CERT must contain a PEM-encoded CA certificate');
  }
  try {
    new X509Certificate(ca);
  } catch {
    throw new Error('SUPABASE_CA_CERT must contain a valid CA certificate');
  }

  const fingerprint = crypto.createHash('sha256').update(ca).digest('hex').slice(0, 16);
  const caPath = path.join(os.tmpdir(), `slyyce-supabase-ca-${fingerprint}.crt`);
  if (!fs.existsSync(caPath)) fs.writeFileSync(caPath, `${ca}\n`, { mode: 0o600 });

  const url = new URL(directUrl);
  url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.set('sslrootcert', caPath);
  return url.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: directUrlWithVerifiedCa(),
  },
});
