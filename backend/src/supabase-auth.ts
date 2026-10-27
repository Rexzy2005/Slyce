import { createClient } from '@supabase/supabase-js';
import type { BackendConfig } from './config.js';
import type { AuthenticatedPrincipal, TokenVerifier } from './security.js';

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
}

interface SupabaseAuthApi {
  getUser(token: string): Promise<{
    data: { user: { id: string; email?: string | null } | null };
    error: unknown;
  }>;
}

export function requireSupabaseAuthConfig(env: NodeJS.ProcessEnv = process.env): SupabaseAuthConfig {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for authentication');
  return { url, anonKey };
}

export class SupabaseTokenVerifier implements TokenVerifier {
  constructor(
    private readonly client: { auth: SupabaseAuthApi },
    private readonly adminEmails: readonly string[],
  ) {}

  async verify(token: string): Promise<AuthenticatedPrincipal | null> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;
    const email = data.user.email?.trim().toLowerCase();
    const isAdministrator = !!email && this.adminEmails.includes(email);
    return {
      subject: data.user.id,
      kind: isAdministrator ? 'administrator' : 'player',
      ...(email ? { email } : {}),
      ...(isAdministrator ? { roles: ['admin'] as const } : { roles: [] as const, playerId: data.user.id }),
    };
  }
}

export function createSupabaseTokenVerifier(config: BackendConfig, env: NodeJS.ProcessEnv = process.env): SupabaseTokenVerifier {
  const authConfig = requireSupabaseAuthConfig(env);
  const client = createClient(authConfig.url, authConfig.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return new SupabaseTokenVerifier(client, config.adminEmails);
}
