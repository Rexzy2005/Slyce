'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '../config/public';

let client: SupabaseClient | undefined;
const ADMIN_SESSION_STARTED_AT_KEY = 'slyce.adminSessionStartedAt';
const ADMIN_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getAdminAuthClient(): SupabaseClient {
  if (!publicConfig.supabaseUrl || !publicConfig.supabaseAnonKey) {
    throw new Error('Admin authentication is not configured.');
  }
  client ??= createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return client;
}

export function recordAdminSessionStart(): void { window.localStorage.setItem(ADMIN_SESSION_STARTED_AT_KEY, String(Date.now())); }
export function clearAdminSessionStart(): void { window.localStorage.removeItem(ADMIN_SESSION_STARTED_AT_KEY); }
export function isAdminSessionWithinMaximumAge(): boolean {
  const startedAt = Number(window.localStorage.getItem(ADMIN_SESSION_STARTED_AT_KEY));
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    recordAdminSessionStart();
    return true;
  }
  return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < ADMIN_SESSION_MAX_AGE_MS;
}
