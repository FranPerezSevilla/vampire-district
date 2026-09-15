import { VAMPIRE_CONTACTS } from "./VampireCatalog.js";

export function createVampireSites(buildings, canStandAt = () => true) {
  const ids = new Set(VAMPIRE_CONTACTS.flatMap(contact => [contact.buildingId, contact.pickup, contact.delivery]));
  const sites = {};
  for (const id of ids) {
    const building = buildings.find(value => value.id === id);
    if (!building) throw new Error(`Vampire site requires city building ${id}`);
    const candidates = [18, 30, 46, 62].flatMap(offset => [
      { x: building.x + building.w / 2, y: building.y + building.h + offset },
      { x: building.x - offset, y: building.y + building.h / 2 },
      { x: building.x + building.w + offset, y: building.y + building.h / 2 },
      { x: building.x + building.w / 2, y: building.y - offset }
    ]);
    const point = candidates.find(value => canStandAt(value.x, value.y));
    if (!point) throw new Error(`No walkable frontage for vampire site ${id}`);
    sites[id] = { id, name: building.name || building.label || id, districtId: building.districtId, ...point };
  }
  return sites;
}

export function directionTo(from, to) {
  if (!from || !to) return "";
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 45) return "HERE";
  const vertical = Math.abs(dy) > Math.abs(dx) * 0.4 ? (dy > 0 ? "S" : "N") : "";
  const horizontal = Math.abs(dx) > Math.abs(dy) * 0.4 ? (dx > 0 ? "E" : "W") : "";
  return `${vertical}${horizontal} · ${Math.round(Math.hypot(dx, dy))} m`;
}
