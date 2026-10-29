import type { AuthenticatedPrincipal } from './security.js';

export interface PrincipalStore {
  ensure(principal: AuthenticatedPrincipal): Promise<void>;
}

interface PlayerRecordStore {
  upsert(args: {
    where: { id: string };
    create: { id: string };
    update: Record<string, never>;
  }): Promise<unknown>;
}

interface AdminRecordStore {
  upsert(args: {
    where: { externalSubject: string };
    create: { externalSubject: string; email?: string; role: 'ADMIN' };
    update: { email?: string };
  }): Promise<unknown>;
}

export interface PrincipalDatabase {
  player: PlayerRecordStore;
  adminAccount: AdminRecordStore;
}

export class PrismaPrincipalStore implements PrincipalStore {
  constructor(private readonly database: PrincipalDatabase) {}

  async ensure(principal: AuthenticatedPrincipal): Promise<void> {
    if (principal.kind === 'player') {
      if (!principal.playerId) throw new Error('Authenticated player is missing a player ID');
      await this.database.player.upsert({
        where: { id: principal.playerId },
        create: { id: principal.playerId },
        update: {},
      });
      return;
    }

    await this.database.adminAccount.upsert({
      where: { externalSubject: principal.subject },
      create: {
        externalSubject: principal.subject,
        ...(principal.email ? { email: principal.email } : {}),
        role: 'ADMIN',
      },
      update: {
        ...(principal.email ? { email: principal.email } : {}),
      },
    });
  }
}
