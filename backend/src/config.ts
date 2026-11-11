export type Environment = 'development' | 'test' | 'production';

export interface BackendConfig {
  environment: Environment;
  port: number;
  host: string;
  corsOrigins: readonly string[];
  maxRequestBytes: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  adminEmails: readonly string[];
  authSessionSecret?: string;
  goodDollarRpcUrl?: string;
  goodDollarEnvironment: 'production' | 'staging' | 'development';
  goodDollarIdentityAddress?: string;
  /** Slyyce contracts indexed for the admin users/transactions view (ADR-0012). */
  chainActivity?: { rpcUrl: string; contracts: readonly `0x${string}`[]; startBlock: bigint };
  /** Backend-signed scores (ADR-0015). Celo mainnet only, like wallet sign-in. */
  scoreSigning?: { privateKey: `0x${string}`; chainId: number; arcade: `0x${string}`; tournament?: `0x${string}`; shop?: `0x${string}` };
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return 3001;
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  return port;
}

function parseEnvironment(value: string | undefined): Environment {
  if (value === undefined || value === '') return 'development';
  if (value === 'development' || value === 'test' || value === 'production') return value;
  throw new Error('NODE_ENV must be development, test, or production');
}

function parsePositiveInteger(value: string | undefined, name: string, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

function parseOrigins(value: string | undefined, environment: Environment): readonly string[] {
  const origins = (value ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
  if (environment === 'production' && origins.length === 0) throw new Error('CORS_ORIGINS is required in production');
  // Credentialed CORS reflects the origin, so a wildcard would let any site use the admin session cookie.
  if (environment === 'production' && origins.includes('*')) throw new Error('CORS_ORIGINS must list explicit origins in production');
  return origins;
}

function parseAdminEmails(value: string | undefined): readonly string[] {
  const emails = [...new Set((value ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean))];
  const invalid = emails.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid) throw new Error('SLYCE_ADMIN_EMAILS must contain only valid comma-separated email addresses');
  return emails;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const environment = parseEnvironment(env.NODE_ENV);
  const adminEmails = parseAdminEmails(env.SLYCE_ADMIN_EMAILS);
  const authSessionSecret = parseSecret(env.AUTH_SESSION_SECRET, 'AUTH_SESSION_SECRET');
  if (environment === 'production' && adminEmails.length === 0) throw new Error('SLYCE_ADMIN_EMAILS is required in production');
  if (environment === 'production' && !authSessionSecret) throw new Error('AUTH_SESSION_SECRET is required in production');
  const chainActivity = parseChainActivity(env);
  const scoreSigning = parseScoreSigning(env);
  return {
    environment,
    port: parsePort(env.PORT),
    host: env.HOST?.trim() || '0.0.0.0',
    corsOrigins: parseOrigins(env.CORS_ORIGINS, environment),
    maxRequestBytes: parsePositiveInteger(env.MAX_REQUEST_BYTES, 'MAX_REQUEST_BYTES', 1_048_576),
    rateLimitWindowMs: parsePositiveInteger(env.RATE_LIMIT_WINDOW_MS, 'RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMaxRequests: parsePositiveInteger(env.RATE_LIMIT_MAX_REQUESTS, 'RATE_LIMIT_MAX_REQUESTS', 120),
    adminEmails,
    ...(authSessionSecret ? { authSessionSecret } : {}),
    ...(env.GOODDOLLAR_RPC_URL?.trim() ? { goodDollarRpcUrl: env.GOODDOLLAR_RPC_URL.trim() } : {}),
    goodDollarEnvironment: env.GOODDOLLAR_ENV === 'staging' || env.GOODDOLLAR_ENV === 'development' ? env.GOODDOLLAR_ENV : 'production',
    ...(env.GOODDOLLAR_IDENTITY_ADDRESS?.trim() ? { goodDollarIdentityAddress: env.GOODDOLLAR_IDENTITY_ADDRESS.trim() } : {}),
    ...(chainActivity ? { chainActivity } : {}),
    ...(scoreSigning ? { scoreSigning } : {}),
  };
}

function parseChainActivity(env: NodeJS.ProcessEnv): BackendConfig['chainActivity'] {
  const rpcUrl = env.CHAIN_RPC_URL?.trim() || env.GOODDOLLAR_RPC_URL?.trim();
  const names = ['SLYYCE_ARCADE_ADDRESS', 'SLYYCE_TOURNAMENT_ADDRESS', 'SLYYCE_SHOP_ADDRESS'] as const;
  const values = names.map(name => env[name]?.trim()).filter((value): value is string => Boolean(value));
  if (values.length === 0) return undefined;
  const invalid = names.find(name => env[name]?.trim() && !/^0x[0-9a-fA-F]{40}$/.test(env[name]!.trim()));
  if (invalid) throw new Error(`${invalid} must be a 0x-prefixed 20-byte address`);
  const start = env.SLYYCE_CONTRACTS_START_BLOCK?.trim();
  if (!start || !/^\d+$/.test(start)) throw new Error('SLYYCE_CONTRACTS_START_BLOCK must be the block number the contracts were deployed at');
  if (!rpcUrl) throw new Error('CHAIN_RPC_URL or GOODDOLLAR_RPC_URL is required when Slyyce contract addresses are set');
  return { rpcUrl, contracts: values as `0x${string}`[], startBlock: BigInt(start) };
}

function parseScoreSigning(env: NodeJS.ProcessEnv): BackendConfig['scoreSigning'] {
  const privateKey = env.SCORE_SIGNER_PRIVATE_KEY?.trim();
  if (!privateKey) return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('SCORE_SIGNER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key');
  const arcade = env.SLYYCE_ARCADE_ADDRESS?.trim();
  if (!arcade) throw new Error('SLYYCE_ARCADE_ADDRESS is required when SCORE_SIGNER_PRIVATE_KEY is set');
  const tournament = env.SLYYCE_TOURNAMENT_ADDRESS?.trim();
  const shop = env.SLYYCE_SHOP_ADDRESS?.trim();
  // Addresses are validated by parseChainActivity. The shop enables extra lives (ADR-0016).
  return { privateKey: privateKey as `0x${string}`, chainId: 42220, arcade: arcade as `0x${string}`, ...(tournament ? { tournament: tournament as `0x${string}` } : {}), ...(shop ? { shop: shop as `0x${string}` } : {}) };
}

function parseSecret(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters`);
  return value;
}
