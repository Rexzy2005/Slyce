'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '../config/public';

let client: SupabaseClient | undefined;

export function getAdminAuthClient(): SupabaseClient {
  if (!publicConfig.supabaseUrl || !publicConfig.supabaseAnonKey) {
    throw new Error('Admin authentication is not configured.');
  }
  client ??= createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return client;
}
