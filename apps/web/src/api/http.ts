import { z } from 'zod';
import type { SlyceApi } from './contracts';
import { ApiError } from './errors';
export interface HttpRequest { url: string; method: 'GET' | 'POST'; body?: unknown }
/** A backend-approved mapping must supply each URL, request and wire-to-view decoder. */
export type HttpBindings = { [K in keyof SlyceApi]: {
  request: (...args: Parameters<SlyceApi[K]>) => HttpRequest;
  response: z.ZodType<Awaited<ReturnType<SlyceApi[K]>>>;
} };
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

export async function requestValidated<T>(request: HttpRequest, schema: z.ZodType<T>, signal?: AbortSignal, transport: typeof fetch = fetch): Promise<T> {
  signal?.throwIfAborted();
  let response: Response;
  try {
    response = await transport(request.url, { method: request.method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      ...(signal ? { signal } : {}),
      ...(request.body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('network', 'The service could not be reached. Try again.');
  }
  if (!response.ok) throw new ApiError('http', 'The service could not complete this request.', response.status);
  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    // A route/account change can abort while the response body is still streaming.
    if (signal?.aborted) throw error;
    throw new ApiError('invalid-response', 'The service returned an unreadable response.');
  }
  signal?.throwIfAborted();
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError('invalid-response', 'The service returned an unexpected response.');
  return result.data;
}
export function createHttpApi(bindings: HttpBindings): SlyceApi {
  return {
    session: signal => requestValidated(bindings.session.request(signal), bindings.session.response, signal),
    startRound: signal => requestValidated(bindings.startRound.request(signal), bindings.startRound.response, signal),
    finishRound: (input, signal) => requestValidated(bindings.finishRound.request(input, signal), bindings.finishRound.response, signal),
    leaderboard: (scope, signal) => requestValidated(bindings.leaderboard.request(scope, signal), bindings.leaderboard.response, signal),
    inventory: signal => requestValidated(bindings.inventory.request(signal), bindings.inventory.response, signal),
    useInventory: (input, signal) => requestValidated(bindings.useInventory.request(input, signal), bindings.useInventory.response, signal),
    rewards: signal => requestValidated(bindings.rewards.request(signal), bindings.rewards.response, signal),
    shopItems: signal => requestValidated(bindings.shopItems.request(signal), bindings.shopItems.response, signal),
  };
}
