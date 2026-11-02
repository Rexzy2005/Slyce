'use client';
import { createContext, useContext } from 'react';
import type { Magic } from 'magic-sdk';
/** The Magic instance; only non-null inside the mounted sign-in provider (`useWallet().live`). Type-only import keeps magic-sdk out of server bundles. */
export const MagicContext = createContext<Magic | null>(null);
export const useMagic = () => useContext(MagicContext);
