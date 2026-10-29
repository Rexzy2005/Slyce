'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createGameAudio, type GameAudio } from './audio';
import { defaultPreviewSettings, type PreviewSettings } from './preview-settings';
import { PauseSettings } from './pause-settings';
import { LoadingScreen } from '../components/loading-screen';
import { Icon } from '../components/icon';
import { createGameBridge, type GameBridge } from './bridge';
import { attachGameHost } from './host-lifecycle';
import { readBestScore, recordBestScore } from './best-score';
import type { GameOverCause } from './practice-rules';
/** `blade` must already be verified as owned on-chain; the default trail needs no ownership. */
export interface GameResult { score: number; bestCombo: number; fruits: number; cause: GameOverCause }
export function GameHost({ blade, payGate, afterGame }: { blade?: { glow: number; core: number }; /** When set, every round must be paid before it starts. */ payGate?: (start: () => void) => ReactNode; /** Rendered on the game-over screen, e.g. saving the result on-chain. */ afterGame?: (result: GameResult) => ReactNode } = {}) {
  const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewSettings, setPreviewSettings] = useState(defaultPreviewSettings);
  const settingsRef = useRef(previewSettings);
  const audioRef = useRef<GameAudio | null>(null);
  const [effectsPreview, setEffectsPreview] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [soundMessage, setSoundMessage] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const session = useRef<HTMLElement>(null);
  const bridgeRef = useRef<GameBridge | null>(null);
  const [status, setStatus] = useState('Preparing the canvas…');
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [lives, setLives] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [combo, setCombo] = useState<{ count: number; bonus: number } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<{ score: number; cause: GameOverCause; bestCombo: number; fruits: number; best: number; improved: boolean; round: number } | null>(null);
  useEffect(() => { setBest(readBestScore(previewSettings.difficulty)); }, [previewSettings.difficulty]);
  useEffect(() => { if (ready && blade) bridgeRef.current?.send({ type: 'set-blade', colors: blade }); }, [ready, blade?.glow, blade?.core]);
  useEffect(() => {
    const parent = container.current;
    if (!parent) return;
    const audio = createGameAudio(); audioRef.current = audio;
    const bridge = createGameBridge();
    bridgeRef.current = bridge;
    const unsubscribe = bridge.onEvent(event => {
      if (event.type === 'effect') audio.play(event.cue);
      if (event.type === 'ready') { bridge.send({ type: 'configure-preview', settings: settingsRef.current }); setReady(true); setStatus('Canvas ready. Practice scores stay on this device.'); }
      if (event.type === 'score-changed') setScore(event.score);
      if (event.type === 'lives-changed') setLives(event.lives);
      if (event.type === 'combo') setCombo({ count: event.count, bonus: event.bonus });
      if (event.type === 'game-over') {
        const record = recordBestScore(settingsRef.current.difficulty, event.score);
        setBest(record.best || null); setGameOver({ score: event.score, cause: event.cause, bestCombo: event.bestCombo, fruits: event.fruits, round: Date.now(), ...record });
      }
      if (event.type === 'error') { setStatus(event.message); setFailed(true); setReady(false); setPaused(false); }
    });
    const host = attachGameHost(parent, bridge, () => import('./runtime'), () => {
      setFailed(true); setReady(false); setPaused(false); setStatus('The canvas could not load. Retry to reconnect the renderer.');
    });
    return () => { audioRef.current = null; audio.dispose(); bridgeRef.current = null; unsubscribe(); host.dispose(); bridge.dispose(); };
  }, [attempt]);
  useEffect(() => {
    setFullscreenSupported(Boolean(document.fullscreenEnabled));
    const changed = () => setFullscreen(document.fullscreenElement === session.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    const surface = board.current;
    if (!surface) return;
    // Native non-passive handling covers the canvas, overlays and board edges.
    // Do not stop propagation: Phaser must still receive the swipe.
    const preventPagePan = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); };
    surface.addEventListener('touchmove', preventPagePan, { passive: false });
    return () => surface.removeEventListener('touchmove', preventPagePan);
  }, []);
  function togglePause() {
    if (!ready || failed) return;
    bridgeRef.current?.send({ type: paused ? 'resume' : 'pause' });
    audioRef.current?.stop();
    setSettingsOpen(false);
    setPaused(value => !value);
  }
  async function toggleFullscreen() {
    setDisplayError(null);
    try {
      if (document.fullscreenElement === session.current) await document.exitFullscreen();
      else await session.current?.requestFullscreen();
    } catch { setDisplayError('Full screen is unavailable here. You can continue in this view.'); }
  }
  function retry() {
    setSettingsOpen(false);
    setEffectsPreview(false); setSoundEnabled(false); setSoundPending(false);
    setFailed(false); setReady(false); setPaused(false); setScore(null); setLives(null); setCombo(null); setGameOver(null);
    setStatus('Preparing the canvas…'); setAttempt(value => value + 1);
  }
  async function toggleSound() {
    const audio = audioRef.current; if (!audio) return;
    if (soundEnabled) { audio.mute(); setSoundEnabled(false); return; }
    setSoundPending(true); audio.setVolume(.35);
    const enabled = await audio.enable();
    if (audioRef.current !== audio) return;
    setSoundEnabled(enabled); setSoundPending(false);
    setSoundMessage(enabled ? null : 'Audio could not start in this browser. You can still use the visual preview.');
    if (enabled) audio.play('click');
  }
  function changeSettings(settings: PreviewSettings) {
    settingsRef.current = settings; setPreviewSettings(settings);
    bridgeRef.current?.send({ type: 'configure-preview', settings });
  }
  /** Routes every round start through the pay gate when one is configured. */
  function requestStart(start: () => void) {
    if (!payGate) { start(); return; }
    setPendingStart(() => start);
  }
  function togglePreview() {
    if (!ready || failed) return;
    if (!effectsPreview && payGate) { requestStart(startPreview); return; }
    startPreview();
  }
  function startPreview() {
    if (!ready || failed) return;
    setPendingStart(null);
    audioRef.current?.stop();
    bridgeRef.current?.send({ type: 'resume' }); setPaused(false);
    bridgeRef.current?.send({ type: 'preview', enabled: !effectsPreview });
    setSettingsOpen(false); setCombo(null); setGameOver(null);
    if (effectsPreview) { setScore(null); setLives(null); }
    setEffectsPreview(value => !value);
  }
  function playAgain() {
    if (!ready || failed) return;
    requestStart(restartRound);
  }
  function restartRound() {
    setPendingStart(null);
    bridgeRef.current?.send({ type: 'preview', enabled: true });
    setCombo(null); setGameOver(null);
  }
  return <section onClickCapture={event => { if (event.target instanceof Element && event.target.closest('button:not([data-sound-preview])')) audioRef.current?.play('click'); }} ref={session} className="game-session" aria-label="Slyce game session">
    <div className="session-hud" aria-label="Round readings"><div className="hud-brand"><Link href="/play" aria-label="Slyce lobby"><Icon name="back" /><span>SLYCE</span></Link><div className="hud-title"><strong>The cutting floor</strong><span>Practice round</span></div></div>
      <div className="hud-reading score-reading"><Icon name="chart" /><span>SCORE<strong>{score === null ? 'Not started' : score.toLocaleString()}</strong></span></div>
      <div className="hud-reading"><Icon name="heart" /><span>LIVES<strong>{lives === null ? 'Not set' : lives}</strong></span></div>
      <div className="hud-reading combo-reading"><span>COMBO<strong>{combo ? 'x' + combo.count + ' +' + combo.bonus : 'None yet'}</strong></span><span className="combo-track" aria-hidden="true" /></div>
      <div className="hud-reading"><Icon name="timer" /><span>BEST<strong>{best === null ? 'None yet' : best.toLocaleString()}</strong></span></div>
    </div>
    <div ref={board} className={effectsPreview ? 'chopping-board effects-active' : 'chopping-board'} aria-label="Game canvas">
      <div ref={container} className="game-canvas" aria-hidden="true" />

      {!ready && !failed && <div className="board-loading"><LoadingScreen message="Preparing your board" detail="Getting everything ready for your first cut." compact /></div>}
      {gameOver && !failed && <div className="board-center game-over"><span className="board-symbol"><Icon name={gameOver.cause === 'bomb' ? 'sparkles' : 'heart'} /></span><p className="eyebrow">{gameOver.cause === 'bomb' ? 'YOU HIT A BOMB' : 'OUT OF LIVES'}</p><h2>Game over</h2>
        <p role="status">Final score <strong className="final-score">{gameOver.score.toLocaleString()}</strong> · {gameOver.improved ? 'New best!' : 'Best ' + gameOver.best.toLocaleString()}</p>
        {afterGame && <div className="after-game" key={gameOver.round}>{afterGame({ score: gameOver.score, bestCombo: gameOver.bestCombo, fruits: gameOver.fruits, cause: gameOver.cause })}</div>}
        <button className="button" onClick={playAgain}><Icon name="reset" /> Play again</button>
        {!afterGame && <p className="board-boundary">Practice score saved on this device only · Not verified</p>}</div>}
      {(ready || failed) && !gameOver && (!effectsPreview || paused || failed) && <div className={paused || failed ? 'board-center' : 'board-center board-ready'}>{!paused && !failed && <Image className="ready-fruit-art" src="/game/fruit-splash-v1.webp" alt="" width={1672} height={941} priority unoptimized />}<span className="board-symbol"><Icon name={paused ? 'pause' : 'scissors'} /></span><p className="eyebrow">{paused ? 'TAKE A BREATHER' : 'SLICE INTO SOMETHING GOOD'}</p><h2>{failed ? 'Canvas unavailable' : paused ? 'Your board is paused.' : 'Ready to slice?'}</h2><p className={!paused && !failed ? 'sr-only' : undefined} role={failed ? 'alert' : 'status'}>{paused ? 'Resume the canvas whenever you are ready.' : status}</p>
      {failed ? <button className="button" onClick={retry}><Icon name="reset" /> Retry canvas</button> : paused ? <button className="button" onClick={togglePause}><Icon name="play" /> Resume canvas</button> : <button className="button board-start" aria-label="Start practice round" title="Local practice round. Scores are not verified and earn no rewards." disabled={!ready} onClick={togglePreview}><Icon name="play" /> Start slicing</button>}
      {paused && !failed && <button className="control-button pause-settings-trigger" onClick={() => setSettingsOpen(true)}><Icon name="settings" /> Settings</button>}
      {!paused && !failed && <><p className="ready-instruction">Slice fruit, dodge bombs. Miss three and it's over.</p><span className="ready-mode">{previewSettings.difficulty} · {previewSettings.fruits.length} fruit types</span><p id="round-boundary" className="board-boundary">Practice · Score saved on this device only</p></>}</div>}
      {effectsPreview && !paused && !failed && !gameOver && <div className="preview-caption">PRACTICE · Slice fruit · Avoid bombs</div>}
      <span className="board-corner corner-top" aria-hidden="true" /><span className="board-corner corner-bottom" aria-hidden="true" />
    </div>
    <div className="arena-quick-controls" role="group" aria-label="Quick arena controls">
      <button className="control-button" disabled={!ready || failed} aria-label={paused ? 'Resume canvas' : 'Pause canvas'} aria-pressed={paused} onClick={togglePause}><Icon name={paused ? 'play' : 'pause'} /><span>{paused ? 'Resume' : 'Pause'}</span></button>
      <button className="control-button" disabled={soundPending || !ready} aria-label={soundPending ? 'Starting audio…' : soundEnabled ? 'Mute sound' : 'Enable sound'} aria-pressed={soundEnabled} onClick={toggleSound}><Icon name={soundEnabled ? 'sound' : 'muted'} /><span>{soundPending ? 'Starting…' : soundEnabled ? 'Sound on' : 'Sound off'}</span></button>
      <button className="control-button" disabled={!fullscreenSupported} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreenSupported ? undefined : 'Full screen is not supported in this browser'} onClick={toggleFullscreen}><Icon name={fullscreen ? 'shrink' : 'expand'} /><span>{fullscreen ? 'Restore' : 'Expand'}</span></button>
      <button className="control-button" disabled={!ready || failed} aria-label={effectsPreview ? 'End practice round' : 'Quick start practice'} aria-pressed={effectsPreview} onClick={togglePreview}><Icon name={effectsPreview ? 'back' : 'play'} /><span>{effectsPreview ? 'Finish' : 'Slice'}</span></button>
    </div>
    {pendingStart && payGate && <div className="pay-gate" role="dialog" aria-modal="true" aria-label="Pay to play"><div className="pay-gate-card">{payGate(pendingStart)}<button className="text-button" onClick={() => setPendingStart(null)}>Not now</button></div></div>}
    {settingsOpen && paused && !failed && <PauseSettings settings={previewSettings} soundEnabled={soundEnabled} soundPending={soundPending} message={soundMessage} onClose={() => setSettingsOpen(false)} onSound={() => { void toggleSound(); }} onChange={changeSettings} />}
    {soundMessage && <p className="arena-notice" role="status">{soundMessage}</p>}
    {displayError && <p className="error-text" role="status">{displayError}</p>}

  </section>;
}
