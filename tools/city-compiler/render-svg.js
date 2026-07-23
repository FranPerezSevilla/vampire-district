const DISTRICT_COLORS = ["#241a33", "#1c2a3a", "#39251d", "#18323a", "#30243b", "#263421", "#1b2735", "#34241f"];

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rectElement(item, attributes = "") {
  return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" ${attributes}/>`;
}

function surfaceElement(item, attributes = "") {
  if (item?.geometry === "polygon" && Array.isArray(item.points) && item.points.length >= 3) {
    const points = item.points.map(point => `${point.x},${point.y}`).join(" ");
    return `<polygon points="${points}" ${attributes}/>`;
  }
  return rectElement(item, attributes);
}

function center(item) {
  return { x: Number(item.x || 0) + Number(item.w || 0) / 2, y: Number(item.y || 0) + Number(item.h || 0) / 2 };
}

function routePolyline(route) {
  const points = (route.points || []).map(point => `${point.x},${point.y}`).join(" ");
  return points ? `<polyline points="${points}" fill="none" stroke="#74d6a5" stroke-width="3" stroke-dasharray="8 5" opacity="0.9"/>` : "";
}

export function renderCityDebugSvg(blueprint, validation, score) {
  const { width, height } = blueprint.world;
  const runtime = blueprint.runtime;
  const legendX = width + 24;
  const canvasWidth = width + 420;
  const districtRects = blueprint.districts.map((district, index) => {
    const color = DISTRICT_COLORS[index % DISTRICT_COLORS.length];
    const label = `${district.name} · ${district.recipeId}`;
    return `${rectElement(district.bounds, `fill="${color}" stroke="#65577c" stroke-width="2" opacity="0.72"`)}
      <text x="${district.bounds.x + 12}" y="${district.bounds.y + 22}" class="district-label">${escapeXml(label)}</text>`;
  }).join("\n");

  const sidewalks = (runtime.sidewalks || []).map(item => rectElement(item, 'fill="#4c4850" opacity="0.45"')).join("\n");
  const roads = (runtime.roads || []).map(item => surfaceElement(
    item,
    `fill="${item.kind === "alley" ? "#24232a" : "#17181f"}" stroke="#69636f" stroke-width="1"`
  )).join("\n");
  const crosswalks = (runtime.crosswalks || []).map(item => rectElement(item, 'fill="#b8b2a6" opacity="0.65"')).join("\n");
  const sewers = (runtime.sewerTunnels || []).map(item => rectElement(item, 'fill="none" stroke="#487b70" stroke-width="2" stroke-dasharray="12 8" opacity="0.65"')).join("\n");
  const buildings = (runtime.buildings || []).map(item => {
    const point = center(item);
    return `${rectElement(item, 'fill="#0c0d13" stroke="#a58dba" stroke-width="2"')}
      <text x="${point.x}" y="${point.y}" text-anchor="middle" class="building-label">${escapeXml(item.sign || item.name || item.id)}</text>`;
  }).join("\n");
  const pedestrianRoutes = (runtime.pedestrianRoutes || []).map(routePolyline).join("\n");
  const rooftopRoutes = (runtime.rooftopRoutes || []).map(route => `<line x1="${route.ax}" y1="${route.ay}" x2="${route.bx}" y2="${route.by}" stroke="#d9b7ff" stroke-width="4" stroke-dasharray="5 5" opacity="0.9"/>`).join("\n");
  const lights = (runtime.lights || []).map(item => `<circle cx="${item.x}" cy="${item.y}" r="5" fill="#ffe889" stroke="#ffffff" stroke-width="1"/>`).join("\n");
  const dumpsters = (runtime.dumpsters || []).map(item => `<rect x="${item.x - 7}" y="${item.y - 5}" width="14" height="10" fill="#69806b" stroke="#c6e6ca" stroke-width="1"/>`).join("\n");
  const vehicles = (runtime.vehicles || []).map(item => `<circle cx="${item.x}" cy="${item.y}" r="8" fill="#e15e66" stroke="#ffffff" stroke-width="2"/>`).join("\n");
  const landmarks = (blueprint.landmarks || []).map(item => `<circle cx="${item.position.x}" cy="${item.position.y}" r="15" fill="none" stroke="#ffb02e" stroke-width="4"/><text x="${item.position.x + 18}" y="${item.position.y - 12}" class="landmark-label">${escapeXml(item.id)}</text>`).join("\n");
  const roadGraphNodes = (runtime.roadGraphNodes || []).map(item => `<circle cx="${item.x}" cy="${item.y}" r="3" fill="#61d7ff" opacity="0.75"/>`).join("\n");

  const componentRows = Object.entries(score.components || {}).map(([key, value], index) => `<text x="${legendX}" y="${154 + index * 25}" class="legend">${escapeXml(key)}: ${value}</text>`).join("\n");
  const warningRows = (validation.warnings || []).slice(0, 10).map((item, index) => `<text x="${legendX}" y="${365 + index * 20}" class="warning">• ${escapeXml(item.code)}</text>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${height}" viewBox="0 0 ${canvasWidth} ${height}">
  <style>
    text { font-family: Arial, Helvetica, sans-serif; }
    .district-label { fill: #f5ecff; font-size: 16px; font-weight: 700; }
    .building-label { fill: #ddd2e9; font-size: 11px; font-weight: 700; }
    .landmark-label { fill: #ffd68b; font-size: 13px; font-weight: 700; }
    .title { fill: #ffffff; font-size: 26px; font-weight: 800; }
    .legend { fill: #ded8e8; font-size: 16px; }
    .warning { fill: #ffcf87; font-size: 13px; }
  </style>
  <rect width="100%" height="100%" fill="#090a0f"/>
  <g id="districts">${districtRects}</g>
  <g id="sewers">${sewers}</g>
  <g id="sidewalks">${sidewalks}</g>
  <g id="roads">${roads}</g>
  <g id="road-graph-nodes">${roadGraphNodes}</g>
  <g id="crosswalks">${crosswalks}</g>
  <g id="buildings">${buildings}</g>
  <g id="pedestrian-routes">${pedestrianRoutes}</g>
  <g id="rooftop-routes">${rooftopRoutes}</g>
  <g id="lights">${lights}</g>
  <g id="dumpsters">${dumpsters}</g>
  <g id="vehicles">${vehicles}</g>
  <g id="landmarks">${landmarks}</g>
  <line x1="${width + 8}" y1="0" x2="${width + 8}" y2="${height}" stroke="#4e435c" stroke-width="2"/>
  <text x="${legendX}" y="44" class="title">City Compiler</text>
  <text x="${legendX}" y="78" class="legend">${escapeXml(blueprint.id)}</text>
  <text x="${legendX}" y="105" class="legend">Score ${score.total} · Grade ${score.grade}</text>
  <text x="${legendX}" y="130" class="legend">Valid: ${validation.valid} · errors ${validation.errors.length} · warnings ${validation.warnings.length}</text>
  ${componentRows}
  <text x="${legendX}" y="335" class="legend">Warnings</text>
  ${warningRows || `<text x="${legendX}" y="365" class="legend">None</text>`}
</svg>`;
}
