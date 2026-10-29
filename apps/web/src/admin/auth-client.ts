import { apiFetch } from '../api/http';
import { publicConfig } from '../config/public';

function endpoint(path: string): string {
  if (!publicConfig.backendUrl) throw new Error('Administrator authentication is not configured.');
  return `${publicConfig.backendUrl}${path}`;
}

export async function adminRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return apiFetch(endpoint(path), { ...init, credentials: 'include', cache: 'no-store' });
}

export async function adminMutation(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Slyce-CSRF', '1');
  return adminRequest(path, { ...init, headers });
}

export async function adminLogin(email: string, password: string): Promise<Response> {
  return adminMutation('/api/v1/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
}

export async function adminLogout(): Promise<void> {
  await adminMutation('/api/v1/admin/auth/logout', { method: 'POST' });
}
