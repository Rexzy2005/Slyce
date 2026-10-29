import { z } from 'zod';
import type { RoundDescriptor, RoundSubmission } from '@slyyce/shared';
// Provisional frontend view contracts; NOT an approved backend wire format.
export const sessionSchema = z.union([
  z.object({ status: z.literal('anonymous') }),
  z.object({ status: z.literal('authenticated'), playerId: z.string().min(1), address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
]);
export const leaderboardSchema = z.array(z.object({ playerId: z.string().min(1), displayName: z.string().min(1), score: z.number().int().nonnegative(), rank: z.number().int().positive() }));
export const inventorySchema = z.array(z.object({ id: z.string().min(1), name: z.string().min(1), quantity: z.number().int().nonnegative() }));
const tokenAmount = z.string().regex(/^(0|[1-9][0-9]*)$/);
export const rewardsSchema = z.array(z.object({ id: z.string().min(1), label: z.string().min(1), amountUnits: tokenAmount, status: z.enum(['locked', 'claimable', 'claimed']) }));
export const shopSchema = z.array(z.object({ id: z.string().min(1), name: z.string().min(1), category: z.enum(['power-up', 'cosmetic']), priceUnits: tokenAmount }));
export const roundSchema: z.ZodType<RoundDescriptor> = z.object({ roundId: z.string().min(1), seed: z.string().min(1), rulesVersion: z.string().min(1) });
export const finishSchema = z.union([z.object({ status: z.literal('verified'), score: z.number().int().nonnegative() }), z.object({ status: z.literal('rejected'), reason: z.string().min(1) })]);
export const useItemSchema = z.object({ status: z.literal('accepted'), inventory: inventorySchema });
export type LeaderboardScope = 'today' | 'week' | 'all';
export interface SlyyceApi {
  session(signal?: AbortSignal): Promise<z.infer<typeof sessionSchema>>;
  startRound(signal?: AbortSignal): Promise<RoundDescriptor>;
  finishRound(submission: RoundSubmission, signal?: AbortSignal): Promise<z.infer<typeof finishSchema>>;
  leaderboard(scope: LeaderboardScope, signal?: AbortSignal): Promise<z.infer<typeof leaderboardSchema>>;
  inventory(signal?: AbortSignal): Promise<z.infer<typeof inventorySchema>>;
  useInventory(input: { roundId: string; inventoryItemId: string }, signal?: AbortSignal): Promise<z.infer<typeof useItemSchema>>;
  rewards(signal?: AbortSignal): Promise<z.infer<typeof rewardsSchema>>;
  shopItems(signal?: AbortSignal): Promise<z.infer<typeof shopSchema>>;
}
