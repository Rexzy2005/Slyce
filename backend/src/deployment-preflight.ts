import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { requireDatabaseUrl } from './database.js';

export function verifyDeploymentEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const config = loadConfig(env);
  if (config.environment !== 'production') throw new Error('NODE_ENV must be production for deployment');
  requireDatabaseUrl(env);
  if (!env.DIRECT_URL?.trim()) throw new Error('DIRECT_URL is required for production migrations');
  const ca = env.SUPABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  const caBody = ca?.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s/g, '');
  if (!ca?.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----') || !caBody || /[^A-Za-z0-9+/=]/.test(caBody)) {
    throw new Error('SUPABASE_CA_CERT must contain a valid PEM-encoded CA certificate for verified Supabase TLS');
  }
  if (config.goodDollarRpcUrl && !config.goodDollarIdentityAddress) {
    throw new Error('GOODDOLLAR_IDENTITY_ADDRESS is required when GOODDOLLAR_RPC_URL is configured');
  }
  if (config.goodDollarIdentityAddress && !config.goodDollarRpcUrl) {
    throw new Error('GOODDOLLAR_RPC_URL is required when GOODDOLLAR_IDENTITY_ADDRESS is configured');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyDeploymentEnvironment();
    process.stdout.write('Production deployment environment is valid.\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Deployment environment is invalid'}\n`);
    process.exitCode = 1;
  }
}
