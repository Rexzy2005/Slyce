import type { SlyyceApi } from './contracts';
import { ApiError } from './errors';
const unavailable = async (): Promise<never> => { throw new ApiError('unavailable', 'This service is not connected yet. No account or game data has been loaded.'); };
/** Deliberately unavailable; no fabricated data, endpoints, sessions or successes. */
export const api: SlyyceApi = {
  session: unavailable, startRound: unavailable, finishRound: unavailable,
  leaderboard: unavailable, inventory: unavailable, useInventory: unavailable,
  rewards: unavailable, shopItems: unavailable,
};
