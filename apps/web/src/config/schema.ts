import { z } from 'zod';
const optionalText = z.preprocess(value => value === '' ? undefined : value, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(value => value === '' ? undefined : value, z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Use an HTTP(S) URL').optional());
const address = z.preprocess(value => value === '' ? undefined : value, z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Expected an EVM address').refine(value => !/^0x0{40}$/.test(value), 'Zero address is not a deployment').optional());
export const publicConfigSchema = z.object({
  appUrl: optionalUrl,
  backendUrl: optionalUrl,
  supabaseUrl: optionalUrl,
  supabaseAnonKey: optionalText,
  network: z.preprocess(value => value === '' ? undefined : value, z.enum(['celo', 'celo-sepolia']).optional()),
  rpcUrl: optionalUrl,
  walletConnectProjectId: z.preprocess(value => value === '' ? undefined : value, z.string().regex(/^[a-fA-F0-9]{32}$/, 'Expected a Reown project ID').optional()),
  gdAddress: address,
  shopAddress: address,
  tournamentAddress: address,
  arcadeAddress: address,
  /** GoodDollar contract set on Celo mainnet: production (real G$) or development/staging (test G$). */
  goodDollarEnv: z.preprocess(value => value === '' ? undefined : value, z.enum(['production', 'staging', 'development']).optional()),
}).superRefine((config, context) => {
  if ((config.rpcUrl || config.gdAddress || config.shopAddress || config.tournamentAddress || config.arcadeAddress || config.walletConnectProjectId) && !config.network) {
    context.addIssue({ code: 'custom', path: ['network'], message: 'Select a network for Web3 configuration' });
  }
  if (config.goodDollarEnv && config.network !== 'celo') context.addIssue({ code: 'custom', path: ['goodDollarEnv'], message: 'GoodDollar identity and UBI contracts are deployed on Celo mainnet only' });
  // AppKit initializes during pre-rendering (no window) and Reown verifies the domain, so the URL must be explicit.
  if (config.walletConnectProjectId && !config.appUrl) context.addIssue({ code: 'custom', path: ['appUrl'], message: 'NEXT_PUBLIC_APP_URL is required for wallet sign-in' });
  if (config.network && !config.rpcUrl) context.addIssue({ code: 'custom', path: ['rpcUrl'], message: 'An explicit RPC endpoint is required for the selected network' });
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export function parsePublicConfig(value: unknown): PublicConfig {
  const result = publicConfigSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid public configuration: ' + result.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message).join('; '));
  return result.data;
}
export const serverConfigSchema = z.object({
  databaseUrl: z.url(),
  sessionSecret: z.string().min(32),
  resultsSignerPrivateKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/).refine(value => !/^0x0{64}$/.test(value)),
});
export { optionalText };
