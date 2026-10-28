import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { requireDatabaseUrl } from './database.js';
import { requireSupabaseAuthConfig } from './supabase-auth.js';

export function verifyDeploymentEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const config = loadConfig(env);
  if (config.environment !== 'production') throw new Error('NODE_ENV must be production for deployment');
  requireDatabaseUrl(env);
  if (!env.DIRECT_URL?.trim()) throw new Error('DIRECT_URL is required for production migrations');
  requireSupabaseAuthConfig(env);
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
