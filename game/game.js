// SEEDKEEPER — game loop, states, input, HUD and scoring.
// States: title -> playing -> (caught: brief pause, lose a life, resume)
// -> win | gameover. The loop runs on requestAnimationFrame with a fixed
// time step clamp, so the game plays the same on any machine.

import { TILE, COLS, ROWS, MAP, GUARDS, SEEDS, findTiles, blocksMovement } from './level.js';
import { Player } from './player.js';
import { Guard } from './guards.js';
import { Renderer } from './render.js';
import { SoundBank } from './audio.js';

export const CANVAS_W = COLS * TILE;
export const CANVAS_H = ROWS * TILE;
const PEBBLE_RANGE = 320;
const PEBBLE_COOLDOWN = 6;
const MAX_LIVES = 3;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = new Renderer(canvas);
    this.sounds = new SoundBank();
    this.state = 'title';
    this.player = new Player({ x: 2, y: 2 });
    this.guards = GUARDS.map((d) => new Guard(d));
    this.packets = findTiles('S').map((t, i) => ({
      x: (t.col + 0.5) * TILE,
      y: (t.row + 0.5) * TILE,
      color: SEEDS[i % SEEDS.length].color,
      name: SEEDS[i % SEEDS.length].name,
      taken: false,
    }));
    const gateTile = findTiles('E')[0];
    this.gate = { x: (gateTile.col + 0.5) * TILE, y: (gateTile.row + 0.5) * TILE };
    this.gateOpen = false;
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.pebbleCooldown = 0;
    this.pebbleMark = null;
    this.caughtTimer = 0;
    this.message = '';
    this.messageTimer = 0;
    this.score = 0;
    this.input = { left: false, right: false, up: false, down: false, sneak: false };
    this.lastTime = 0;
    this.bindInput();
  }

  bindInput() {
    const keys = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ShiftLeft: 'sneak', ShiftRight: 'sneak',
    };
    window.addEventListener('keydown', (e) => {
      if (keys[e.code] !== undefined) {
        this.input[keys[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.state === 'title') this.start();
        else if (this.state === 'win' || this.state === 'gameover') this.resetToTitle();
        e.preventDefault();
      }
      if (e.code === 'KeyR' && (this.state === 'playing' || this.state === 'win' || this.state === 'gameover')) {
        this.resetToTitle();
      }
      if (e.code === 'KeyM') this.toggleMute();
    });
    window.addEventListener('keyup', (e) => {
      if (keys[e.code] !== undefined) this.input[keys[e.code]] = false;
    });
    this.canvas.addEventListener('click', (e) => {
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
      this.tossPebble(x, y);
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toggleMute() {
    const muted = this.sounds.toggleMute();
    this.showMessage(muted ? 'Sound off (M to turn back on)' : 'Sound on');
  }

  showMessage(text, secs = 2.5) {
    this.message = text;
    this.messageTimer = secs;
  }

  start() {
    this.sounds.ensure();
    this.state = 'playing';
    this.showMessage('Collect 3 seed packets, then slip out the gate.');
    this.updateHud();
  }

  resetToTitle() {
    this.player.reset();
    for (const g of this.guards) g.reset();
    for (const p of this.packets) p.taken = false;
    this.gateOpen = false;
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.pebbleCooldown = 0;
    this.pebbleMark = null;
    this.state = 'title';
    this.score = 0;
    this.updateHud();
  }

  resetAfterCaught() {
    this.player.x = this.player.spawn.x;
    this.player.y = this.player.spawn.y;
    for (const g of this.guards) g.reset();
    this.state = 'playing';
    this.showMessage(this.lives > 0 ? `Caught! ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left — the gardeners reset.` : '');
  }

  tossPebble(x, y) {
    if (this.pebbleCooldown > 0) return;
    const d = Math.hypot(x - this.player.x, y - this.player.y);
    if (d > PEBBLE_RANGE) {
      this.showMessage('Too far to throw — get closer first.');
      return;
    }
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (blocksMovement(col, row)) {
      this.showMessage('The pebble would hit a wall.');
      return;
    }
    this.pebbleCooldown = PEBBLE_COOLDOWN;
    this.pebbleMark = { x, y, at: performance.now() };
    this.sounds.pebble();
    let best = null;
    let bestD = Infinity;
    for (const g of this.guards) {
      const gd = Math.hypot(g.x - x, g.y - y);
      if (gd < bestD) {
        bestD = gd;
        best = g;
      }
    }
    if (best && bestD < 420) {
      best.investigate({ x, y });
      this.showMessage(`${best.name} heard something…`);
    }
  }

  update(dt) {
    if (this.state === 'playing') {
      this.elapsed += dt;
      if (this.pebbleCooldown > 0) this.pebbleCooldown -= dt;
      if (this.messageTimer > 0) this.messageTimer -= dt;
      this.player.update(dt, this.input, this.sounds);
      for (const g of this.guards) g.update(dt, this.player, this.sounds);

      const taken = this.player.collect(this.packets);
      if (taken) {
        this.sounds.pickup();
        this.showMessage(`Picked up ${taken.name} — ${this.player.seeds} of 3.`);
        if (this.player.seeds >= 3 && !this.gateOpen) {
          this.gateOpen = true;
          this.sounds.gateOpen();
          this.showMessage('The gate is open — slip out before they notice!', 3.5);
        }
      }

      for (const g of this.guards) {
        if (g.catches(this.player)) {
          this.lives -= 1;
          this.sounds.caught();
          if (this.lives <= 0) {
            this.state = 'gameover';
            this.score = this.player.seeds * 150;
          } else {
            this.state = 'caught';
            this.caughtTimer = 1.6;
          }
          break;
        }
      }

      if (this.gateOpen) {
        const gd = Math.hypot(this.gate.x - this.player.x, this.gate.y - this.player.y);
        if (gd < 26) {
          this.state = 'win';
          this.score = 1000 + this.lives * 250 + Math.max(0, 600 - Math.floor(this.elapsed) * 2);
          this.sounds.win();
        }
      }
      this.updateHud();
    } else if (this.state === 'caught') {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) this.resetAfterCaught();
    }
  }

  updateHud() {
    const h = this.hud;
    if (!h) return;
    h.seeds.textContent = `${this.player.seeds} / 3`;
    h.lives.textContent = '🌱'.repeat(Math.max(0, this.lives)) + '·'.repeat(Math.max(0, MAX_LIVES - this.lives));
    const mins = Math.floor(this.elapsed / 60);
    const secs = Math.floor(this.elapsed % 60);
    h.time.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    const maxSuspicion = Math.max(0, ...this.guards.map((g) => g.suspicion));
    h.eyeFill.style.width = `${maxSuspicion}%`;
    h.eye.classList.toggle('hot', maxSuspicion >= 100);
    h.eye.classList.toggle('warm', maxSuspicion >= 40 && maxSuspicion < 100);
    h.pebble.textContent = this.pebbleCooldown > 0
      ? `Pebble ${Math.ceil(this.pebbleCooldown)}s`
      : 'Pebble ready';
    h.message.textContent = this.messageTimer > 0 ? this.message : '';
    h.state.textContent = this.state;
    if (this.state === 'win') {
      h.overlayTitle.textContent = 'Out clean — the seeds are safe.';
      h.overlayBody.textContent = `Score ${this.score} · ${this.formatTime()} · ${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left. Press Enter to play again.`;
      h.overlay.classList.remove('hidden');
    } else if (this.state === 'gameover') {
      h.overlayTitle.textContent = 'Caught three times — the garden keeps its seeds.';
      h.overlayBody.textContent = `You gathered ${this.player.seeds} of 3 packets. Press Enter to try again.`;
      h.overlay.classList.remove('hidden');
    } else if (this.state === 'title') {
      h.overlayTitle.textContent = 'SEEDKEEPER';
      h.overlayBody.textContent = 'A quiet theft at dawn in the seed library. Collect 3 heirloom packets and slip out the gate — unseen.';
      h.overlay.classList.remove('hidden');
    } else {
      h.overlay.classList.add('hidden');
    }
  }

  formatTime() {
    const mins = Math.floor(this.elapsed / 60);
    const secs = Math.floor(this.elapsed % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  frame(time) {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    this.update(dt);
    const view = {
      player: this.player,
      guards: this.guards,
      packets: this.packets,
      gate: this.gate,
      gateOpen: this.gateOpen,
      pebbleMark: this.pebbleMark,
    };
    this.renderer.render(view, time);
    requestAnimationFrame((t) => this.frame(t));
  }

  run() {
    this.updateHud();
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.frame(t);
    });
  }
}
