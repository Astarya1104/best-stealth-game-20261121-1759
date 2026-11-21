// SEEDKEEPER — the player: a rogue botanist in a green hood.
// Walks with WASD or arrows, sneaks while Shift is held (slower, quieter,
// harder to see), and picks up seed packets by walking over them.

import { TILE, blocksMovement, isFlowerBed } from './level.js';

export const WALK_SPEED = 165; // px per second
export const SNEAK_SPEED = 95;
export const PLAYER_RADIUS = 13;

export class Player {
  constructor(spawn) {
    this.spawn = { x: (spawn.x + 0.5) * TILE, y: (spawn.y + 0.5) * TILE };
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.seeds = 0;
    this.stepAcc = 0;
    this.hidden = false;
  }

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.facing = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.seeds = 0;
    this.stepAcc = 0;
  }

  // Circle-vs-tile collision: try the move axis by axis so the player
  // slides along walls instead of sticking to them.
  tryMove(nx, ny) {
    const r = PLAYER_RADIUS;
    const collides = (x, y) => {
      const cols = [Math.floor((x - r) / TILE), Math.floor((x + r) / TILE)];
      const rows = [Math.floor((y - r) / TILE), Math.floor((y + r) / TILE)];
      for (const c of cols) {
        for (const rw of rows) {
          if (blocksMovement(c, rw)) return true;
        }
      }
      return false;
    };
    if (!collides(nx, this.y)) this.x = nx;
    if (!collides(this.x, ny)) this.y = ny;
  }

  update(dt, input, sounds) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    this.sneaking = !!input.sneak;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
      const vx = (dx / len) * speed * dt;
      const vy = (dy / len) * speed * dt;
      this.tryMove(this.x + vx, this.y + vy);
      this.facing = Math.atan2(dy, dx);
      // Footsteps: one soft tap per stride, quieter while sneaking.
      this.stepAcc += dt * speed;
      if (this.stepAcc > 34) {
        this.stepAcc = 0;
        sounds.footstep(this.sneaking);
      }
    } else {
      this.stepAcc = 0;
    }
    const col = Math.floor(this.x / TILE);
    const row = Math.floor(this.y / TILE);
    this.hidden = isFlowerBed(col, row);
  }

  // Collect any seed packet within reach. Returns the packet taken, or null.
  collect(packets) {
    for (const p of packets) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < 26) {
        p.taken = true;
        this.seeds += 1;
        return p;
      }
    }
    return null;
  }
}
