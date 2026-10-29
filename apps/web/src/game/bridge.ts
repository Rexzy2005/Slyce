import type { PreviewSettings } from './preview-settings';
import type { SoundCue } from './effects';
import type { RoundDescriptor } from '@slyce/shared';
import type { GameOverCause } from './practice-rules';
export type GameCommand = { type: 'configure-preview'; settings: PreviewSettings } | { type: 'preview'; enabled: boolean } | { type: 'preview-cue'; cue: SoundCue } | { type: 'start'; round: RoundDescriptor } | { type: 'pause' } | { type: 'resume' } | { type: 'activate-power-up'; inventoryItemId: string } | { type: 'set-blade'; colors: { glow: number; core: number } };
export type GameEvent = { type: 'effect'; cue: SoundCue } | { type: 'ready' } | { type: 'score-changed'; score: number } | { type: 'lives-changed'; lives: number } | { type: 'power-up-used'; inventoryItemId: string } | { type: 'combo'; count: number; bonus: number } | { type: 'game-over'; score: number; cause: GameOverCause; bestCombo: number; fruits: number } | { type: 'error'; message: string };
export function createGameBridge() {
  const commands = new Set<(command: GameCommand) => void>();
  const events = new Set<(event: GameEvent) => void>();
  return {
    send(command: GameCommand) { for (const listener of commands) listener(command); },
    emit(event: GameEvent) { for (const listener of events) listener(event); },
    onCommand(listener: (command: GameCommand) => void) { commands.add(listener); return () => { commands.delete(listener); }; },
    onEvent(listener: (event: GameEvent) => void) { events.add(listener); return () => { events.delete(listener); }; },
    dispose() { commands.clear(); events.clear(); },
  };
}
export type GameBridge = ReturnType<typeof createGameBridge>;
