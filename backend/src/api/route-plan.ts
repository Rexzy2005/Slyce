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
  { method: 'POST', path: `${routeGroups.admin}/challenges`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/challenges`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/challenges/:id`, access: 'administrator', idempotent: false },
  { method: 'PATCH', path: `${routeGroups.admin}/challenges/:id`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/challenges/:id/publish`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/challenges/:id/pause`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/challenges/:id/archive`, access: 'administrator', idempotent: true },
  { method: 'GET', path: `${routeGroups.challenges}`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.challenges}/me`, access: 'player', idempotent: false },
  { method: 'POST', path: `${routeGroups.challenges}/:id/join`, access: 'player', idempotent: true },
  { method: 'GET', path: `${routeGroups.challenges}/:id`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.bounties}`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.bounties}/me`, access: 'player', idempotent: false },
  { method: 'POST', path: `${routeGroups.bounties}/:id/join`, access: 'player', idempotent: true },
  { method: 'GET', path: `${routeGroups.bounties}/:id`, access: 'public', idempotent: false },
  { method: 'GET', path: `${routeGroups.bounties}/:id/leaderboard`, access: 'public', idempotent: false },
  { method: 'POST', path: `${apiPrefix}/bounty-participations/:id/submit`, access: 'player', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounties`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/bounties`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/bounties/:id`, access: 'administrator', idempotent: false },
  { method: 'PATCH', path: `${routeGroups.admin}/bounties/:id`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounties/:id/publish`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounties/:id/pause`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounties/:id/close`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounties/:id/archive`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/bounty-submissions/:id/review`, access: 'administrator', idempotent: true },
  { method: 'GET', path: `${routeGroups.rewards}`, access: 'player', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/rewards`, access: 'administrator', idempotent: false },
  { method: 'POST', path: `${routeGroups.admin}/rewards/:id/review`, access: 'administrator', idempotent: true },
  { method: 'POST', path: `${routeGroups.admin}/rewards/:id/distributions`, access: 'administrator', idempotent: true },
  { method: 'GET', path: `${routeGroups.admin}/metrics`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/audit-logs`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/chain/users`, access: 'administrator', idempotent: false },
  { method: 'GET', path: `${routeGroups.admin}/chain/transactions`, access: 'administrator', idempotent: false },
];
