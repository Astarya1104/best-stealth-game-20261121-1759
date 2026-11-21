// SEEDKEEPER — guard AI: patrols, vision cones, suspicion, chase, investigate.
// A guard walks a waypoint loop. It sees the player only inside its vision
// cone with a clear line of sight. Being seen fills suspicion; suspicion
// decays when the player is hidden. At full suspicion the guard gives chase;
// losing the player makes it suspicious, then it goes back to its patrol.

import { TILE, blocksSight, isFlowerBed } from './level.js';

export const VISION_RANGE = 230; // px, walking player in the open
export const VISION_HALF_ANGLE = 0.66; // radians, ~38 degrees each side
export const SNEAK_RANGE = 150; // px, while the player sneaks
export const HIDDEN_RANGE = 80; // px, while the player hides in a flower bed

const SUSPICION_GAIN_NEAR = 55; // per second, player close and visible
const SUSPICION_GAIN_FAR = 26; // per second, player far and visible
const SUSPICION_DECAY = 20; // per second, player unseen
const SUSPICION_SUSPECT = 40; // at or above this the guard gets curious
const CHASE_TIME = 4; // seconds of chase after losing sight
const CATCH_DIST = 20; // px: touching the player while alerted = caught

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Sample the straight line from (x0,y0) to (x1,y1); a wall or hedge tile
// anywhere along it blocks sight. Flower beds never block sight.
export function hasLineOfSight(x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (blocksSight(col, row)) return false;
  }
  return true;
}

// Cast one ray of the vision cone until it hits a sight-blocking tile.
// Returns the ray's end point, used to draw the cone as a clipped polygon.
export function castConeRay(x, y, angle, maxLen) {
  const step = 6;
  let len = 0;
  while (len < maxLen) {
    len += step;
    const px = x + Math.cos(angle) * len;
    const py = y + Math.sin(angle) * len;
    if (blocksSight(Math.floor(px / TILE), Math.floor(py / TILE))) {
      return { x: px, y: py, len };
    }
  }
  return { x: x + Math.cos(angle) * maxLen, y: y + Math.sin(angle) * maxLen, len: maxLen };
}

export class Guard {
  constructor(def) {
    this.name = def.name;
    this.hat = def.hat;
    this.coat = def.coat;
    this.speed = def.speed;
    this.waypoints = def.waypoints.map(([c, r]) => ({
      x: (c + 0.5) * TILE,
      y: (r + 0.5) * TILE,
    }));
    this.wpIndex = 0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = 'patrol'; // patrol | suspect | alert | investigate
    this.suspicion = 0;
    this.lastSeen = null;
    this.chaseTimer = 0;
    this.investigateTarget = null;
    this.investigateTimer = 0;
    this.lookTimer = 0;
    this.lookAngle = 0;
    this.stepAcc = 0;
  }

  reset() {
    this.wpIndex = 0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.lastSeen = null;
    this.chaseTimer = 0;
    this.investigateTarget = null;
    this.investigateTimer = 0;
    this.lookTimer = 0;
  }

  // Can this guard see the player right now? Returns a 0..1 visibility
  // strength (0 = unseen) that already folds in distance, angle, cover
  // and whether the player is sneaking.
  visibilityOf(player) {
    const d = dist(this.x, this.y, player.x, player.y);
    const playerCol = Math.floor(player.x / TILE);
    const playerRow = Math.floor(player.y / TILE);
    const hidden = isFlowerBed(playerCol, playerRow);
    let range = player.sneaking ? SNEAK_RANGE : VISION_RANGE;
    if (hidden) range = Math.min(range, HIDDEN_RANGE);
    if (d > range) return 0;
    const ang = Math.atan2(player.y - this.y, player.x - this.x);
    if (angleDiff(ang, this.facing) > VISION_HALF_ANGLE) return 0;
    if (!hasLineOfSight(this.x, this.y, player.x, player.y)) return 0;
    // Closer and more centred reads as stronger: suspicion grows faster.
    const distFactor = 1 - (d / range) * 0.6;
    const centreFactor = 1 - (angleDiff(ang, this.facing) / VISION_HALF_ANGLE) * 0.4;
    let v = distFactor * centreFactor;
    if (player.sneaking) v *= 0.5;
    if (hidden) v *= 0.35;
    return Math.max(0, Math.min(1, v));
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.facing = Math.atan2(dy, dx);
    return d - step < 2;
  }

  update(dt, player, sounds) {
    const vis = this.visibilityOf(player);
    const wasAlert = this.state === 'alert';

    if (vis > 0) {
      const rate = vis > 0.6 ? SUSPICION_GAIN_NEAR : SUSPICION_GAIN_FAR;
      this.suspicion = Math.min(100, this.suspicion + rate * vis * dt);
      this.lastSeen = { x: player.x, y: player.y };
      if (this.suspicion >= 100 && !wasAlert) {
        this.state = 'alert';
        this.chaseTimer = CHASE_TIME;
        sounds.alert();
      } else if (this.suspicion >= SUSPICION_SUSPECT && this.state === 'patrol') {
        this.state = 'suspect';
      }
    } else {
      this.suspicion = Math.max(0, this.suspicion - SUSPICION_DECAY * dt);
      if (this.state === 'suspect' && this.suspicion < SUSPICION_SUSPECT) {
        this.state = 'patrol';
      }
    }

    if (this.state === 'patrol') {
      const wp = this.waypoints[this.wpIndex];
      if (this.moveToward(wp.x, wp.y, this.speed, dt)) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      }
    } else if (this.state === 'suspect') {
      // Walk slowly toward where the player was last seen, then look around.
      if (this.lastSeen) {
        if (this.moveToward(this.lastSeen.x, this.lastSeen.y, this.speed * 0.7, dt)) {
          this.lookTimer += dt;
          this.facing = this.lookAngle + Math.sin(this.lookTimer * 1.8) * 1.1;
          if (this.lookTimer > 2.5) {
            this.lookTimer = 0;
            this.lookAngle = this.facing;
            this.lastSeen = null;
            this.state = 'patrol';
          }
        } else {
          this.lookAngle = this.facing;
        }
      }
    } else if (this.state === 'alert') {
      this.chaseTimer -= dt;
      const target = this.lastSeen && vis > 0
        ? { x: player.x, y: player.y }
        : this.lastSeen;
      if (target) this.moveToward(target.x, target.y, this.speed * 1.7, dt);
      if (this.chaseTimer <= 0) {
        this.state = 'suspect';
        this.suspicion = 55;
        this.lookTimer = 0;
        this.lookAngle = this.facing;
      }
    } else if (this.state === 'investigate') {
      if (this.investigateTarget) {
        if (this.moveToward(this.investigateTarget.x, this.investigateTarget.y, this.speed * 0.9, dt)) {
          this.investigateTimer += dt;
          this.facing = this.lookAngle + Math.sin(this.investigateTimer * 2.2) * 1.2;
          if (this.investigateTimer > 2) {
            this.investigateTarget = null;
            this.investigateTimer = 0;
            this.state = 'patrol';
          }
        } else {
          this.lookAngle = this.facing;
        }
      }
    }

    // Footsteps while moving: the player hears where a guard is.
    this.stepAcc += dt * (this.state === 'alert' ? 2.4 : 1.4);
    if (this.stepAcc > 0.55) {
      this.stepAcc = 0;
      sounds.noise(0.05, 0.05, 900);
    }
  }

  // A pebble lands nearby: go and look at it, unless already chasing.
  investigate(point) {
    if (this.state === 'alert') return;
    this.state = 'investigate';
    this.investigateTarget = { x: point.x, y: point.y };
    this.investigateTimer = 0;
    this.lookAngle = this.facing;
  }

  // True when this guard is touching the player while on alert.
  catches(player) {
    return this.state === 'alert' && dist(this.x, this.y, player.x, player.y) < CATCH_DIST;
  }
}
