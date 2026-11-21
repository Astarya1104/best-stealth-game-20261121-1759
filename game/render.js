// SEEDKEEPER — canvas renderer. Everything is drawn procedurally: no
// images, no fonts loaded over the network. The dawn palette is warm cream
// paths, sage lawns, terracotta beds and deep green hedges, so the amber
// vision cones and the green player read at a glance.

import { TILE, COLS, ROWS, MAP, tileAt } from './level.js';
import { castConeRay, VISION_RANGE, SNEAK_RANGE } from './guards.js';

const W = COLS * TILE;
const H = ROWS * TILE;

// Deterministic speckle so the lawn never looks flat: a tiny hash of the
// tile position decides each blade and pebble, so every render agrees.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ground = this.paintGround();
  }

  // The static ground (lawn, paths, beds, walls, hedges) is painted once
  // to an offscreen canvas; each frame only the moving things are drawn.
  paintGround() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    // Sage lawn base.
    g.fillStyle = '#8fae6b';
    g.fillRect(0, 0, W, H);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const t = MAP[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (t === '.') {
          // Lawn with a few darker blades and pale speckles.
          for (let i = 0; i < 5; i++) {
            const sx = x + hash2(col * 7 + i, row * 3) * TILE;
            const sy = y + hash2(col * 3, row * 7 + i) * TILE;
            g.fillStyle = hash2(col + i, row) > 0.5 ? '#7d9c5c' : '#9cbc7d';
            g.fillRect(sx, sy, 3, 2);
          }
        } else if (t === 'f') {
          // Tall flower bed: dark soil with rows of bright blooms.
          g.fillStyle = '#5d4a33';
          g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          const blooms = ['#e86a5a', '#f2a541', '#b678d6', '#e8e4f0'];
          for (let i = 0; i < 9; i++) {
            const bx = x + 6 + (i % 3) * 13 + hash2(col * 11 + i, row) * 4;
            const by = y + 7 + Math.floor(i / 3) * 12 + hash2(col, row * 11 + i) * 4;
            g.fillStyle = '#4e7a3d';
            g.fillRect(bx - 1, by + 2, 2, 6);
            g.fillStyle = blooms[(col + row + i) % blooms.length];
            g.beginPath();
            g.arc(bx, by, 3.4, 0, Math.PI * 2);
            g.fill();
          }
        } else if (t === '#') {
          // Stone wall: warm brick courses.
          g.fillStyle = '#9a7b5f';
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = '#8a6a50';
          g.fillRect(x, y, TILE, 3);
          g.fillRect(x, y + TILE / 2, TILE, 2);
          g.fillStyle = '#a8876b';
          g.fillRect(x + 3, y + 5, TILE - 6, 12);
          g.fillRect(x + 3, y + TILE / 2 + 4, TILE - 6, 12);
        } else if (t === 'H') {
          // Hedge: a dark green mound with lighter leaf flecks.
          g.fillStyle = '#3f6b34';
          g.beginPath();
          g.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#548c44';
          for (let i = 0; i < 7; i++) {
            const hx = x + 6 + hash2(col * 5 + i, row * 3) * (TILE - 12);
            const hy = y + 6 + hash2(col * 3, row * 5 + i) * (TILE - 12);
            g.beginPath();
            g.arc(hx, hy, 3, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }

    // Gravel cross-paths: pale strips along the open lawn rows and columns.
    g.fillStyle = 'rgba(232, 214, 176, 0.55)';
    for (let col = 0; col < COLS; col++) {
      if (tileAt(col, 7) === '.') g.fillRect(col * TILE, 7 * TILE + 14, TILE, 12);
    }
    for (let row = 0; row < ROWS; row++) {
      if (tileAt(12, row) === '.') g.fillRect(12 * TILE + 14, row * TILE, 12, TILE);
    }
    return c;
  }

  drawCone(g, guard) {
    const range = guard.state === 'alert' ? VISION_RANGE : VISION_RANGE;
    const half = 0.66;
    const rays = 14;
    g.beginPath();
    g.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i++) {
      const a = guard.facing - half + (2 * half * i) / rays;
      const end = castConeRay(guard.x, guard.y, a, range);
      g.lineTo(end.x, end.y);
    }
    g.closePath();
    const hot = guard.state === 'alert';
    const warm = guard.suspicion >= 40;
    g.fillStyle = hot
      ? 'rgba(214, 69, 50, 0.30)'
      : warm
        ? 'rgba(232, 161, 60, 0.30)'
        : 'rgba(240, 203, 96, 0.22)';
    g.fill();
    g.strokeStyle = hot ? 'rgba(214, 69, 50, 0.5)' : 'rgba(240, 203, 96, 0.35)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  drawGuard(g, guard) {
    this.drawCone(g, guard);
    // Body: coat circle, straw hat brim, face dot in the facing direction.
    g.fillStyle = guard.coat;
    g.beginPath();
    g.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = guard.hat;
    g.beginPath();
    g.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = guard.coat;
    g.beginPath();
    g.arc(guard.x, guard.y, 9, 0, Math.PI * 2);
    g.fill();
    const fx = guard.x + Math.cos(guard.facing) * 7;
    const fy = guard.y + Math.sin(guard.facing) * 7;
    g.fillStyle = '#f2e3c6';
    g.beginPath();
    g.arc(fx, fy, 3.5, 0, Math.PI * 2);
    g.fill();
    // Suspicion marker above the hat: ? while curious, ! while chasing.
    if (guard.state === 'alert') {
      this.drawMark(g, guard.x, guard.y - 26, '!', '#d64532');
    } else if (guard.state === 'suspect' || guard.suspicion >= 40) {
      this.drawMark(g, guard.x, guard.y - 26, '?', '#e8a13c');
    }
    // Thin suspicion arc under the guard while it is building.
    if (guard.suspicion > 2 && guard.suspicion < 100) {
      g.strokeStyle = guard.suspicion >= 40 ? '#e8a13c' : '#f0cb60';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      g.stroke();
    }
  }

  drawMark(g, x, y, ch, color) {
    g.font = 'bold 17px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(40, 30, 18, 0.85)';
    g.strokeText(ch, x, y);
    g.fillStyle = color;
    g.fillText(ch, x, y);
  }

  drawPlayer(g, player) {
    const bob = player.moving ? Math.sin(performance.now() / 90) * 1.5 : 0;
    // Soft shadow.
    g.fillStyle = 'rgba(40, 30, 18, 0.25)';
    g.beginPath();
    g.ellipse(player.x, player.y + 11, 11, 5, 0, 0, Math.PI * 2);
    g.fill();
    // Hooded cloak.
    g.fillStyle = player.hidden ? '#5d8a4a' : '#3e7a4e';
    g.beginPath();
    g.arc(player.x, player.y + bob, 13, 0, Math.PI * 2);
    g.fill();
    // Cream outline so the thief reads at a glance against the lawn.
    g.strokeStyle = 'rgba(242, 232, 208, 0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(player.x, player.y + bob, 13, 0, Math.PI * 2);
    g.stroke();
    // Face in shadow under the hood, looking where the player faces.
    const fx = player.x + Math.cos(player.facing) * 5;
    const fy = player.y + bob + Math.sin(player.facing) * 5;
    g.fillStyle = '#2c2118';
    g.beginPath();
    g.arc(fx, fy, 6, 0, Math.PI * 2);
    g.fill();
    // Satchel strap.
    g.strokeStyle = '#7a5a34';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(player.x - 8, player.y - 7 + bob);
    g.lineTo(player.x + 8, player.y + 7 + bob);
    g.stroke();
    // Sneak shimmer: a faint ring while sneaking.
    if (player.sneaking) {
      g.strokeStyle = 'rgba(232, 228, 240, 0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(player.x, player.y + bob, 18, 0, Math.PI * 2);
      g.stroke();
    }
  }

  drawSeed(g, packet, time) {
    if (packet.taken) return;
    const pulse = 1 + Math.sin(time / 350 + packet.x) * 0.08;
    g.save();
    g.translate(packet.x, packet.y);
    g.scale(pulse, pulse);
    // Glow ring so the objective reads from across the garden.
    g.strokeStyle = 'rgba(240, 203, 96, 0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 15, 0, Math.PI * 2);
    g.stroke();
    // Paper envelope with a coloured wax seal.
    g.fillStyle = '#f2e8d0';
    g.fillRect(-9, -7, 18, 14);
    g.strokeStyle = '#b09a72';
    g.lineWidth = 1;
    g.strokeRect(-9, -7, 18, 14);
    g.beginPath();
    g.moveTo(-9, -7);
    g.lineTo(0, 1);
    g.lineTo(9, -7);
    g.stroke();
    g.fillStyle = packet.color;
    g.beginPath();
    g.arc(0, 2, 3.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  drawGate(g, gate, open, time) {
    const { x, y } = gate;
    // Iron arch over the gate tile.
    g.fillStyle = '#3a3f44';
    g.fillRect(x - 18, y - 18, 5, 36);
    g.fillRect(x + 13, y - 18, 5, 36);
    g.fillRect(x - 18, y - 18, 36, 5);
    g.beginPath();
    g.arc(x, y - 18, 9, Math.PI, 0);
    g.fill();
    if (open) {
      // Golden light spills out of the open gate.
      const glow = 0.5 + Math.sin(time / 400) * 0.15;
      g.fillStyle = `rgba(240, 203, 96, ${glow})`;
      g.fillRect(x - 13, y - 13, 26, 26);
      g.fillStyle = '#7a5a34';
      g.font = 'bold 11px sans-serif';
      g.textAlign = 'center';
      g.fillText('OUT', x, y + 4);
    } else {
      g.fillStyle = '#6b7280';
      g.fillRect(x - 13, y - 13, 26, 26);
      g.fillStyle = '#f2e8d0';
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.fillText('LOCKED', x, y + 4);
    }
  }

  render(state, time) {
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.ground, 0, 0);
    for (const packet of state.packets) this.drawSeed(g, packet, time);
    this.drawGate(g, state.gate, state.gateOpen, time);
    for (const guard of state.guards) this.drawGuard(g, guard);
    this.drawPlayer(g, state.player);
    // Pebble marker: a small ring where the last pebble landed.
    if (state.pebbleMark && time - state.pebbleMark.at < 1200) {
      g.strokeStyle = 'rgba(240, 228, 200, 0.9)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(state.pebbleMark.x, state.pebbleMark.y, 7, 0, Math.PI * 2);
      g.stroke();
    }
    // Dawn wash: warm light from the east, a little vignette at the edges.
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(255, 214, 140, 0.05)');
    grad.addColorStop(1, 'rgba(255, 170, 90, 0.10)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }
}
