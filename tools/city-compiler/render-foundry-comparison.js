import { pointInRect, rectOverlapArea } from "./geometry.js";

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function center(item) {
  return { x: Number(item?.x || 0) + Number(item?.w || 0) / 2, y: Number(item?.y || 0) + Number(item?.h || 0) / 2 };
}

function intersects(item, bounds) {
  return rectOverlapArea(item, bounds) > 0.01;
}

function pointInside(item, bounds) {
  return pointInRect({ x: item.x, y: item.y }, bounds, 0.01);
}

function rect(item, attributes) {
  return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" ${attributes}/>`;
}

function candidatePanel(result, rank, panelX, scale) {
  const blueprint = result.blueprint;
  const runtime = blueprint.runtime;
  const bounds = blueprint.districts.find(item => item.id === "foundry").bounds;
  const panelWidth = bounds.w * scale;
  const panelHeight = bounds.h * scale;
  const groupTransform = `translate(${panelX} 118) scale(${scale}) translate(${-bounds.x} ${-bounds.y})`;
  const roads = runtime.roads.filter(item => intersects(item, bounds)).map(item => rect(item, `fill="${item.kind === "alley" ? "#29262e" : "#15171d"}" stroke="${item.generated ? "#ffb24a" : "#69636f"}" stroke-width="${item.generated ? 3 : 1}"`)).join("\n");
  const sidewalks = runtime.sidewalks.filter(item => intersects(item, bounds)).map(item => rect(item, 'fill="#55505a" opacity="0.4"')).join("\n");
  const crosswalks = runtime.crosswalks.filter(item => intersects(item, bounds)).map(item => rect(item, `fill="${item.generated ? "#ffd48a" : "#b8b2a6"}" opacity="0.72"`)).join("\n");
  const buildings = runtime.buildings.filter(item => intersects(item, bounds)).map(item => {
    const point = center(item);
    const generated = String(item.id).startsWith("foundry:");
    return `${rect(item, `fill="${generated ? "#251810" : "#0c0d13"}" stroke="${generated ? "#ff8d3d" : "#a58dba"}" stroke-width="${generated ? 3 : 2}"`)}
      <text x="${point.x}" y="${point.y}" text-anchor="middle" class="building">${escapeXml(item.sign || item.name || item.id)}</text>`;
  }).join("\n");
  const roofs = Object.values(runtime.roofAreas || {}).flat().filter(item => intersects(item, bounds)).map(item => rect(item, `fill="none" stroke="${String(item.id).startsWith("foundry:") ? "#d9b7ff" : "#7c6b8c"}" stroke-width="4" stroke-dasharray="8 5"`)).join("\n");
  const rooftopRoutes = runtime.rooftopRoutes.filter(route => pointInRect({ x: route.ax, y: route.ay }, bounds, 0.01) || pointInRect({ x: route.bx, y: route.by }, bounds, 0.01)).map(route => `<line x1="${route.ax}" y1="${route.ay}" x2="${route.bx}" y2="${route.by}" stroke="#eac8ff" stroke-width="5" stroke-dasharray="6 5"/>`).join("\n");
  const lights = runtime.lights.filter(item => pointInside(item, bounds)).map(item => `<circle cx="${item.x}" cy="${item.y}" r="5" fill="#ffe889" stroke="#fff" stroke-width="1"/>`).join("\n");
  const dumpsters = runtime.dumpsters.filter(item => pointInside(item, bounds)).map(item => `<rect x="${item.x - 7}" y="${item.y - 5}" width="14" height="10" fill="#69806b" stroke="#c6e6ca"/>`).join("\n");
  const vehicles = runtime.vehicles.filter(item => pointInside(item, bounds)).map(item => `<circle cx="${item.x}" cy="${item.y}" r="9" fill="#e15e66" stroke="#fff" stroke-width="2"/>`).join("\n");
  const shadows = runtime.shadowZones.filter(item => String(item.id).startsWith("foundry:") && intersects(item, bounds)).map(item => rect(item, 'fill="#09070c" opacity="0.5"')).join("\n");
  const accepted = result.foundryScore.accepted;

  return `<g class="panel">
    <rect x="${panelX - 12}" y="20" width="${panelWidth + 24}" height="${panelHeight + 175}" rx="10" fill="#111018" stroke="${accepted ? "#6fd59b" : "#d26f6f"}" stroke-width="3"/>
    <text x="${panelX}" y="50" class="rank">#${rank} · ${escapeXml(blueprint.seed)}</text>
    <text x="${panelX}" y="76" class="score">Foundry ${result.foundryScore.total} · City ${result.cityScore.total}</text>
    <text x="${panelX}" y="99" class="meta">${accepted ? "ACCEPTED" : "REJECTED"} · warnings ${result.validation.warnings.length}</text>
    <g transform="${groupTransform}">
      <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#211a18" stroke="#8f7250" stroke-width="3"/>
      ${shadows}
      ${sidewalks}
      ${roads}
      ${crosswalks}
      ${buildings}
      ${roofs}
      ${rooftopRoutes}
      ${lights}
      ${dumpsters}
      ${vehicles}
    </g>
    <text x="${panelX}" y="${panelHeight + 145}" class="meta">loops ${result.foundryScore.diagnostics.loopCount} · roofs ${result.foundryScore.diagnostics.roofs} · sewers ${result.foundryScore.diagnostics.sewerAccesses}</text>
    <text x="${panelX}" y="${panelHeight + 168}" class="meta">families ${escapeXml(result.foundryScore.diagnostics.families.join(", "))}</text>
  </g>`;
}

export function renderFoundryComparisonSvg(results = []) {
  const selected = results.slice(0, 3);
  if (!selected.length) throw new Error("Foundry comparison requires at least one candidate.");
  const bounds = selected[0].blueprint.districts.find(item => item.id === "foundry").bounds;
  const scale = 0.72;
  const panelWidth = bounds.w * scale + 52;
  const width = Math.ceil(panelWidth * selected.length + 40);
  const height = Math.ceil(bounds.h * scale + 215);
  const panels = selected.map((result, index) => candidatePanel(result, index + 1, 28 + index * panelWidth, scale)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: Arial, Helvetica, sans-serif; }
    .rank { fill: #fff; font-size: 20px; font-weight: 800; }
    .score { fill: #ffd48a; font-size: 17px; font-weight: 700; }
    .meta { fill: #cfc6d8; font-size: 13px; }
    .building { fill: #f0e4cf; font-size: 10px; font-weight: 700; }
  </style>
  <rect width="100%" height="100%" fill="#08090d"/>
  ${panels}
</svg>`;
}