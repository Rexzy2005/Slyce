import { parsePublicConfig } from './schema';
// Explicit reads are required for Next's build-time public environment replacement.
const resolvedAppUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}` : undefined)
  || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/^https?:\/\//, '')}` : undefined)
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}` : undefined)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : undefined);

export const publicConfig = parsePublicConfig({
  appUrl: resolvedAppUrl,
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
  network: process.env.NEXT_PUBLIC_NETWORK,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  gdAddress: process.env.NEXT_PUBLIC_GD_ADDRESS,
  shopAddress: process.env.NEXT_PUBLIC_SHOP_ADDRESS,
  tournamentAddress: process.env.NEXT_PUBLIC_TOURNAMENT_ADDRESS,
  arcadeAddress: process.env.NEXT_PUBLIC_ARCADE_ADDRESS,
  goodDollarEnv: process.env.NEXT_PUBLIC_GOODDOLLAR_ENV,
});
export const isProduction = process.env.NODE_ENV === 'production';
