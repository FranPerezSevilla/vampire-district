export const DEFAULT_CITY_CHUNK_SIZE = 512;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function chunkId(column, row) {
  return `${Math.max(0, Math.floor(finite(column)))}:${Math.max(0, Math.floor(finite(row)))}`;
}

export function chunkCoordinatesAt(x, y, chunkSize = DEFAULT_CITY_CHUNK_SIZE) {
  const size = Math.max(64, finite(chunkSize, DEFAULT_CITY_CHUNK_SIZE));
  return {
    column: Math.max(0, Math.floor(finite(x) / size)),
    row: Math.max(0, Math.floor(finite(y) / size))
  };
}

export function chunkIdAt(x, y, chunkSize = DEFAULT_CITY_CHUNK_SIZE) {
  const coordinates = chunkCoordinatesAt(x, y, chunkSize);
  return chunkId(coordinates.column, coordinates.row);
}

function pointsBounds(points = []) {
  const valid = points.filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));
  if (!valid.length) return null;
  const xs = valid.map(point => finite(point.x));
  const ys = valid.map(point => finite(point.y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function itemBounds(category, item) {
  if (!item) return null;
  if (Number.isFinite(Number(item.w)) && Number.isFinite(Number(item.h))) {
    return {
      x: finite(item.x),
      y: finite(item.y),
      w: Math.max(1, finite(item.w)),
      h: Math.max(1, finite(item.h))
    };
  }
  if (Array.isArray(item.points)) return pointsBounds(item.points);
  if (Number.isFinite(Number(item.ax)) && Number.isFinite(Number(item.ay))) {
    return pointsBounds([{ x: item.ax, y: item.ay }, { x: item.bx, y: item.by }]);
  }
  if (item.street || item.roof || item.sewer) {
    return pointsBounds([item.street, item.roof, item.sewer].filter(Boolean));
  }
  const radius = Math.max(1, finite(item.radius ?? item.hitRadius, category === "vehicles" ? 24 : 8));
  if (Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) {
    return { x: finite(item.x) - radius, y: finite(item.y) - radius, w: radius * 2, h: radius * 2 };
  }
  return null;
}

export function chunkIdsForBounds(bounds, world, chunkSize = DEFAULT_CITY_CHUNK_SIZE) {
  if (!bounds) return [];
  const size = Math.max(64, finite(chunkSize, DEFAULT_CITY_CHUNK_SIZE));
  const columns = Math.max(1, Math.ceil(finite(world?.width, size) / size));
  const rows = Math.max(1, Math.ceil(finite(world?.height, size) / size));
  const left = clamp(Math.floor(finite(bounds.x) / size), 0, columns - 1);
  const top = clamp(Math.floor(finite(bounds.y) / size), 0, rows - 1);
  const right = clamp(Math.floor((finite(bounds.x) + Math.max(0, finite(bounds.w) - 0.001)) / size), 0, columns - 1);
  const bottom = clamp(Math.floor((finite(bounds.y) + Math.max(0, finite(bounds.h) - 0.001)) / size), 0, rows - 1);
  const ids = [];
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) ids.push(chunkId(column, row));
  }
  return ids;
}

function chunkBounds(column, row, world, size) {
  const x = column * size;
  const y = row * size;
  return {
    x,
    y,
    w: Math.min(size, Math.max(0, finite(world.width) - x)),
    h: Math.min(size, Math.max(0, finite(world.height) - y))
  };
}

function neighbours(column, row, columns, rows) {
  const ids = [];
  for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y++) {
    for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x++) {
      if (x === column && y === row) continue;
      ids.push(chunkId(x, y));
    }
  }
  return ids;
}

export function buildCityChunkManifest({ world, collections = {}, chunkSize = DEFAULT_CITY_CHUNK_SIZE, id = "bloodnight-city" } = {}) {
  const size = Math.max(64, finite(chunkSize, DEFAULT_CITY_CHUNK_SIZE));
  const normalizedWorld = Object.freeze({
    width: Math.max(size, finite(world?.width, size)),
    height: Math.max(size, finite(world?.height, size))
  });
  const columns = Math.ceil(normalizedWorld.width / size);
  const rows = Math.ceil(normalizedWorld.height / size);
  const chunks = {};

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const key = chunkId(column, row);
      chunks[key] = {
        id: key,
        column,
        row,
        bounds: chunkBounds(column, row, normalizedWorld, size),
        neighbours: neighbours(column, row, columns, rows),
        counts: {},
        itemIds: {}
      };
    }
  }

  for (const [category, items] of Object.entries(collections)) {
    (items || []).forEach((item, index) => {
      const bounds = itemBounds(category, item);
      const itemId = String(item?.id || `${category}:${index}`);
      for (const key of chunkIdsForBounds(bounds, normalizedWorld, size)) {
        const chunk = chunks[key];
        chunk.counts[category] = (chunk.counts[category] || 0) + 1;
        (chunk.itemIds[category] ||= []).push(itemId);
      }
    });
  }

  for (const chunk of Object.values(chunks)) {
    chunk.bounds = Object.freeze(chunk.bounds);
    chunk.neighbours = Object.freeze(chunk.neighbours);
    chunk.counts = Object.freeze({ ...chunk.counts });
    chunk.itemIds = Object.freeze(Object.fromEntries(
      Object.entries(chunk.itemIds).map(([category, ids]) => [category, Object.freeze([...ids])])
    ));
    Object.freeze(chunk);
  }

  return Object.freeze({
    version: 1,
    id,
    chunkSize: size,
    columns,
    rows,
    world: normalizedWorld,
    chunkIds: Object.freeze(Object.keys(chunks)),
    chunks: Object.freeze(chunks)
  });
}
