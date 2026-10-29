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
  };
}

function parseSecret(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters`);
  return value;
}
