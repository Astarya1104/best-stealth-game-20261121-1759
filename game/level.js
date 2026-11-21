// SEEDKEEPER — level definition.
// A dawn botanical garden, drawn as a tile map. One tile = 40 px, 24 x 15.
//   #  stone wall (blocks movement and sight)
//   H  hedge (blocks movement and sight)
//   f  tall flower bed (walkable, slow, hides the player from far away)
//   .  lawn / gravel path (walkable)
//   P  player spawn (south-west lawn)
//   S  heirloom seed packet (collectible objective)
//   E  the garden gate (exit; opens once all 3 packets are collected)

export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;

export const MAP = [
  '########################',
  '#......ff......ff......#',
  '#.P....ff..S...ff..f...#',
  '#......ff......ff..f...#',
  '#..HH......##......HH..#',
  '#..HH..f...##...f..HH..#',
  '#......f...##...f......#',
  '#..f.......##.......f..#',
  '#..f...S...##...S...f..#',
  '#......f...##...f......#',
  '#..HH..f...##...f..HH..#',
  '#..HH......##......HH..#',
  '#......ff......ff......#',
  '#.f....ff..E...ff....f.#',
  '########################',
];

// Heirloom seed packets: real varieties, each with its own colour.
export const SEEDS = [
  { id: 'corn', name: 'Glass Gem Corn', color: '#e8a13c' },
  { id: 'bean', name: 'Dragon Tongue Bean', color: '#c65b7c' },
  { id: 'tomato', name: 'Cherokee Purple Tomato', color: '#7a4a8f' },
];

// Guard patrols. Each guard walks its waypoint loop (tile coords, x then y).
// Waypoints were picked on open lawn so no route crosses a wall or hedge.
export const GUARDS = [
  {
    name: 'Rose',
    hat: '#c96f4a',
    coat: '#b5543a',
    speed: 58,
    waypoints: [[5, 2], [18, 2], [18, 3], [5, 3]],
  },
  {
    name: 'Basil',
    hat: '#d9a441',
    coat: '#4a7c59',
    speed: 52,
    waypoints: [[3, 6], [10, 6], [10, 9], [3, 9]],
  },
  {
    name: 'Sage',
    hat: '#8a6fb8',
    coat: '#5b7fa6',
    speed: 52,
    waypoints: [[14, 6], [21, 6], [21, 9], [14, 9]],
  },
  {
    name: 'Warden',
    hat: '#3e5c76',
    coat: '#2f4858',
    speed: 62,
    waypoints: [[7, 11], [16, 11], [16, 12], [7, 12]],
  },
];

export const PLAYER_SPAWN = { x: 2, y: 2 };

// Tile helpers: everything works in tile coords, the game converts to px.
export function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return MAP[row][col];
}

export function isWall(col, row) {
  return tileAt(col, row) === '#';
}

export function isHedge(col, row) {
  return tileAt(col, row) === 'H';
}

export function blocksSight(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'H';
}

export function isFlowerBed(col, row) {
  return tileAt(col, row) === 'f';
}

export function blocksMovement(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'H';
}

export function findTiles(ch) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === ch) out.push({ col: c, row: r });
    }
  }
  return out;
}
