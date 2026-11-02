import type { ReactNode } from 'react';
import { SignInGate, VerifiedGate } from '../../web3/sign-in-gate';
export default function ArenaLayout({ children }: { children: ReactNode }) {
  return <SignInGate><main id="main" tabIndex={-1} className="playground-main"><VerifiedGate>{children}</VerifiedGate></main></SignInGate>;
}
