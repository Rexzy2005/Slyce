import { apiPrefix, routeGroups } from './contracts.js';

export type RouteAccess = 'public' | 'player' | 'administrator';

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  access: RouteAccess;
  idempotent: boolean;
}

/**
 * Contract inventory only. Handlers are added when their authentication and
 * persistence prerequisites are verified; unknown routes remain 404.
 */
export const routePlan: readonly RouteDefinition[] = [
  { method: 'POST', path: `${apiPrefix}/auth/wallet/challenge`, access: 'public', idempotent: false },
  { method: 'POST', path: `${apiPrefix}/auth/wallet/verify`, access: 'public', idempotent: true },
  { method: 'GET', path: routeGroups.session, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.players}/me`, access: 'player', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/players`, access: 'administrator', idempotent: false },
  { method: 'POST', path: `${apiPrefix}/gooddollar/verification/check`, access: 'public', idempotent: true },
  { method: 'GET', path: `${routeGroups.admin}/gooddollar/verification-count`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.gameplay}/rounds`, access: 'player', idempotent: false },
  { method: 'POST', path: `${routeGroups.gameplay}/rounds`, access: 'player', idempotent: true },
  { method: 'POST', path: `${routeGroups.gameplay}/rounds/:roundId/finish`, access: 'player', idempotent: true },
  { method: 'GET', path: `${routeGroups.leaderboards}`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.challenges}`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.bounties}`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.rewards}`, access: 'player', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/metrics`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/audit-logs`, access: 'administrator', idempotent: false },
];
