import { defaultPreviewSettings, difficultyPacing, type PreviewSettings } from './preview-settings';
import Phaser from 'phaser';
import type { GameBridge } from './bridge';
import type { GameRuntime } from './lifecycle';
import { strokeTouchesFruit, type Point, type SoundCue } from './effects';
import { advanceFruit, launchFruit, splitFruit, type FruitMotion } from './fruit-motion';
import { extendBlade, juiceMarks, type BladePoint, type JuiceMark } from './juice-effects';
import { bombTexture, fruitTexture, fruitKinds, fruitAppearance, type FruitKind } from './fruit-texture';
import { defaultBlade } from '../features/catalog';
import { bombChance, cutBomb, cutFruit, endSwipe, missFruit, newPractice } from './practice-rules';
/** Browser-only renderer for local practice rounds (ADR-0003). No authoritative rounds or replay rules. */
export function createRuntime(parent: HTMLElement, bridge: GameBridge): GameRuntime {
  let manuallyPaused = false, visible = true, disposed = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  type Fruit = { image: Phaser.GameObjects.Image; body: FruitMotion; kind: FruitKind; radius: number; cut: boolean; bomb: boolean };
  type Drop = { x: number; y: number; vx: number; vy: number; life: number; duration: number; radius: number; color: number };
  class EffectsScene extends Phaser.Scene {
    private fruits: Fruit[] = [];
    private drops: Drop[] = [];
    private trail: BladePoint[] = [];
    private stains: { marks: JuiceMark[]; color: number; life: number }[] = [];
    private boardInk: Phaser.GameObjects.Graphics | null = null;
    private ink: Phaser.GameObjects.Graphics | null = null;
    private blade: Phaser.GameObjects.Graphics | null = null;
    private pointer: (Point & { id: number }) | null = null;
    private active = false;
    private settings = defaultPreviewSettings();
    private practice = newPractice();
    bladeColors: { glow: number; core: number } = defaultBlade;
    configure(settings: PreviewSettings) {
      if (!settings.fruits.length) return;
      this.settings = { difficulty: settings.difficulty, fruits: [...settings.fruits] };
      if (this.active) this.preview(true);
    }
    private clock = 0;
    private nextLaunch = 0;
    private waveRemaining = 0;
    private halves: { image: Phaser.GameObjects.Image; body: FruitMotion; life: number }[] = [];
    create() {
      for (const kind of fruitKinds) for (const part of ['whole', 'upper', 'lower'] as const) {
        if (!this.textures.addCanvas(kind + '-' + part, fruitTexture(part, kind))) throw new Error('Fruit texture could not load');
      }
      if (!this.textures.addCanvas('bomb', bombTexture())) throw new Error('Bomb texture could not load');
      this.boardInk = this.add.graphics().setDepth(-1);
      this.ink = this.add.graphics().setDepth(0); this.blade = this.add.graphics().setDepth(3);
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (this.active && !this.practice.over && !this.pointer) { this.trail = []; this.pointer = { x: p.x, y: p.y, id: p.id }; } });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!this.active || this.practice.over || !p.isDown || !this.pointer || this.pointer.id !== p.id) return;
        const previous = this.pointer; const next = { x: p.x, y: p.y, id: p.id }; this.pointer = next;
        if (Math.hypot(next.x - previous.x, next.y - previous.y) < 2) return;
        this.trail = extendBlade(this.trail, previous, next);
        bridge.emit({ type: 'effect', cue: 'swipe' });
        for (const fruit of this.fruits) if (!fruit.cut && !this.practice.over && strokeTouchesFruit(previous, next, fruit.image, fruit.radius)) this.cut(fruit, Math.atan2(next.y - previous.y, next.x - previous.x));
      });
      this.input.on('pointerup', () => this.finishSwipe()); this.input.on('pointerupoutside', () => this.finishSwipe());
      this.events.once('shutdown', () => { this.fruits = []; this.drops = []; this.halves = []; this.stains = []; this.trail = []; this.pointer = null; });
      bridge.emit({ type: 'ready' });
    }
    clearPointer() { this.finishSwipe(); this.trail = []; }
    private finishSwipe() {
      this.pointer = null;
      const result = endSwipe(this.practice); this.practice = result.state;
      if (!result.bonus) return;
      bridge.emit({ type: 'combo', count: result.combo, bonus: result.bonus }); bridge.emit({ type: 'effect', cue: 'combo' });
      bridge.emit({ type: 'score-changed', score: this.practice.score });
    }
    private clearBoard() {
      this.pointer = null; this.trail = []; this.drops = [];
      this.fruits.forEach(f => f.image.destroy()); this.fruits = [];
      this.halves.forEach(half => half.image.destroy()); this.halves = [];
      this.nextLaunch = this.clock + .12; this.waveRemaining = 0;
      this.ink?.clear(); this.blade?.clear();
    }
    /** Enabling starts a fresh practice round; disabling leaves the board idle. */
    preview(enabled: boolean) {
      this.active = enabled; this.clock = 0; this.clearBoard(); this.stains = []; this.boardInk?.clear();
      this.practice = newPractice();
      if (enabled) { bridge.emit({ type: 'score-changed', score: 0 }); bridge.emit({ type: 'lives-changed', lives: this.practice.lives }); }
    }
    resizeBoard() {
      // A resize invalidates the old flight bounds. Clear airborne objects without costing lives or score.
      if (this.active) this.clearBoard();
    }
    private gameOver() {
      const cause = this.practice.over; if (!cause) return;
      this.pointer = null;
      bridge.emit({ type: 'effect', cue: cause === 'bomb' ? 'boom' : 'fail' });
      bridge.emit({ type: 'game-over', score: this.practice.score, cause, bestCombo: this.practice.bestCombo, fruits: this.practice.fruits });
    }
    private launch() {
      if (this.fruits.length >= difficultyPacing[this.settings.difficulty].maxFruit) return;
      const width = this.scale.width, height = this.scale.height;
      const radius = Math.max(25, Math.min(53, width * .065)) * (.85 + Math.random() * .25);
      const body = launchFruit(width, height, radius);
      const speed = difficultyPacing[this.settings.difficulty].speed;
      body.vx *= speed; body.vy *= speed; body.gravity *= speed * speed;
      if (reducedMotion) body.spin *= .3;
      const kind = this.settings.fruits[Math.floor(Math.random() * this.settings.fruits.length)] ?? 'melon';
      const bomb = Math.random() < bombChance[this.settings.difficulty];
      const image = this.add.image(body.x, body.y, bomb ? 'bomb' : kind + '-whole').setDepth(1).setDisplaySize(radius * 2, radius * 2);
      this.fruits.push({ image, body, kind, radius, cut: false, bomb });
    }
    private burst(x: number, y: number, color = 0xff3158, cutAngle = -.6) {
      this.stains.push({ marks: juiceMarks(x, y, cutAngle).filter(mark => mark.x > 35 + mark.radius * 3 && mark.x < this.scale.width - 35 - mark.radius * 3 && mark.y > 35 + mark.radius * 3 && mark.y < this.scale.height - 35 - mark.radius * 3), color, life: 35 });
      this.stains = this.stains.slice(-40);
      const count = reducedMotion ? 10 : 28;
      for (let i = 0; i < count; i++) {
        const angle = cutAngle + (Math.random() - .5) * Math.PI * 2; const speed = 70 + Math.random() * 230;
        this.drops.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, life: .7 + Math.random() * .35, duration: 1.1, radius: 2 + Math.random() * 7, color });
      }
      this.drops = this.drops.slice(-168);
    }
    private cut(fruit: Fruit, angle = -.6) {
      fruit.cut = true; fruit.image.setVisible(false);
      const { x, y } = fruit.body;
      if (fruit.bomb) {
        this.burst(x, y, 0xe5383b, angle); this.burst(x, y, 0xffb627, angle + Math.PI);
        this.practice = cutBomb(this.practice); this.gameOver(); return;
      }
      this.practice = cutFruit(this.practice);
      bridge.emit({ type: 'score-changed', score: this.practice.score });
      this.burst(x, y, fruitAppearance[fruit.kind].juice, angle);
      const bodies = splitFruit(fruit.body, angle);
      for (const [index, part] of ['upper', 'lower'].entries()) {
        const body = bodies[index]; if (!body) continue;
        const image = this.add.image(body.x, body.y, fruit.kind + '-' + part).setDepth(2).setDisplaySize(fruit.radius * 2, fruit.radius * 2);
        image.rotation = body.angle;
        this.halves.push({ image, body, life: reducedMotion ? .45 : 1.3 });
      }
      while (this.halves.length > 24) this.halves.shift()?.image.destroy();
      bridge.emit({ type: 'effect', cue: 'cut' }); bridge.emit({ type: 'effect', cue: 'splash' });
    }
    cue(cue: SoundCue) {
      if (!this.active) return;
      if (cue === 'cut' || cue === 'combo') {
        const fruit = this.fruits.find(f => !f.cut && !f.bomb && f.body.y > f.radius && f.body.y < this.scale.height - f.radius);
        if (fruit) { const { x, y } = fruit.image; this.trail = extendBlade([], { x: x - 90, y: y + 65 }, { x: x + 90, y: y - 65 }); this.cut(fruit); }
      }
      if (cue === 'splash' || cue === 'boom') this.burst(this.scale.width / 2, this.scale.height / 2, cue === 'boom' ? 0xffb627 : 0xff3158);
      bridge.emit({ type: 'effect', cue });
    }
    override update(_time: number, delta: number) {
      if (!this.active || !this.ink || !this.blade) return;
      const dt = Math.min(delta, 40) / 1000; this.clock += dt;
      if (!this.practice.over && this.clock >= this.nextLaunch) {
        if (this.waveRemaining === 0) this.waveRemaining = 1 + Math.floor(Math.random() * difficultyPacing[this.settings.difficulty].maxWave);
        this.launch(); this.waveRemaining--;
        this.nextLaunch = this.clock + (this.waveRemaining > 0 ? .16 + Math.random() * .12 : difficultyPacing[this.settings.difficulty].delay + Math.random() * .6);
      }
      this.fruits = this.fruits.filter(fruit => {
        advanceFruit(fruit.body, dt);
        fruit.image.setPosition(fruit.body.x, fruit.body.y); fruit.image.rotation = fruit.body.angle;
        const fallen = fruit.body.vy > 0 && fruit.body.y > this.scale.height + fruit.radius * 2;
        if (fallen && !fruit.cut && !fruit.bomb && !this.practice.over) {
          this.practice = missFruit(this.practice);
          bridge.emit({ type: 'lives-changed', lives: this.practice.lives });
          if (this.practice.over) this.gameOver(); else bridge.emit({ type: 'effect', cue: 'fail' });
        }
        if (fruit.cut || fallen) { fruit.image.destroy(); return false; }
        return true;
      });
      this.halves = this.halves.filter(half => {
        half.life -= dt; advanceFruit(half.body, dt);
        half.image.setPosition(half.body.x, half.body.y); half.image.rotation = half.body.angle;
        half.image.setAlpha(Math.min(1, Math.max(0, half.life * 3)));
        if (half.life <= 0 || half.body.y > this.scale.height + 120) { half.image.destroy(); return false; }
        return true;
      });
      this.ink.clear(); this.blade.clear();
      this.boardInk?.clear();
      this.stains = this.stains.filter(stain => stain.life > 0);
      for (const stain of this.stains) {
        stain.life -= dt;
        const opacity = Math.min(1, Math.max(0, stain.life / 7));
        for (const mark of stain.marks) {
          // Layered translucent pools let wood grain show through the juice.
          const dx = Math.cos(mark.angle) * mark.radius * mark.stretch, dy = Math.sin(mark.angle) * mark.radius * mark.stretch;
          this.boardInk?.lineStyle(Math.max(1, mark.radius * .45), stain.color, opacity * .22).lineBetween(mark.x, mark.y, mark.x + dx, mark.y + dy);
          this.boardInk?.fillStyle(stain.color, opacity * .22).fillCircle(mark.x + dx, mark.y + dy, Math.max(1, mark.radius * .22));
          this.boardInk?.fillStyle(stain.color, opacity * .26).fillCircle(mark.x, mark.y, mark.radius);
          this.boardInk?.fillStyle(stain.color, opacity * .14).fillCircle(mark.x - mark.radius * .2, mark.y + mark.radius * .2, mark.radius * .8);
          const wet = Math.max(0, (stain.life - 28) / 7);
          this.boardInk?.fillStyle(0xfff4d6, opacity * wet * .25).fillCircle(mark.x - mark.radius * .3, mark.y - mark.radius * .3, mark.radius * .18);
        }
      }
      this.drops = this.drops.filter(drop => drop.life > 0);
      for (const drop of this.drops) { drop.life -= dt; drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.vy += 260 * dt; const alpha = Math.max(0, drop.life / drop.duration); this.ink.lineStyle(drop.radius * 1.2, drop.color, alpha).lineBetween(drop.x, drop.y, drop.x - drop.vx * .025, drop.y - drop.vy * .025); this.ink.fillStyle(drop.color, alpha).fillCircle(drop.x, drop.y, drop.radius); }
      this.trail = this.trail.filter(point => point.life > 0);
      for (const point of this.trail) point.life -= dt * 6;
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i]; if (!a || !b) continue;
        const alpha = Math.max(0, Math.min(a.life, b.life));
        const taper = Math.sin(Math.PI * i / this.trail.length);
        const width = Math.max(.4, b.width * taper * alpha);
        this.blade.lineStyle(width * 4, this.bladeColors.glow, alpha * .07).lineBetween(a.x, a.y, b.x, b.y);
        this.blade.lineStyle(width * 1.5, this.bladeColors.glow, alpha * .35).lineBetween(a.x, a.y, b.x, b.y);
        this.blade.lineStyle(width * .65, this.bladeColors.core, alpha * .95).lineBetween(a.x, a.y, b.x, b.y);
        this.blade.fillStyle(this.bladeColors.core, alpha * .8).fillCircle(b.x, b.y, width * .3);
      }
    }
  }
  const scene = new EffectsScene();
  const game = new Phaser.Game({ type: Phaser.AUTO, parent, transparent: true, width: Math.max(parent.clientWidth, 1), height: Math.max(parent.clientHeight, 1), audio: { noAudio: true }, scene });
  const applyPause = () => { scene.clearPointer(); if (manuallyPaused || !visible) game.pause(); else game.resume(); };
  const unsubscribe = bridge.onCommand(command => {
    switch (command.type) {
      case 'configure-preview': scene.configure(command.settings); break;
      case 'set-blade': scene.bladeColors = command.colors; break;
      case 'pause': manuallyPaused = true; applyPause(); break;
      case 'resume': manuallyPaused = false; applyPause(); break;
      case 'preview': scene.preview(command.enabled); break;
      case 'preview-cue': scene.cue(command.cue); break;
      case 'start': bridge.emit({ type: 'error', message: 'Round creation and deterministic gameplay rules are not connected yet.' }); break;
      case 'activate-power-up': bridge.emit({ type: 'error', message: 'Inventory authorization and gameplay rules are not connected yet.' }); break;
    }
  });
  return {
    resize(width, height) { if (!disposed) { game.scale.resize(Math.max(1, width), Math.max(1, height)); scene.resizeBoard(); } },
    setVisible(value) { visible = value; if (!disposed) applyPause(); },
    destroy() { if (disposed) return; disposed = true; unsubscribe(); game.destroy(true); if (game.isRunning) game.loop.wake(); },
  };
}
