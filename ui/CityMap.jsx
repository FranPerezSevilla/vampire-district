import { useEffect, useRef, useState } from "react";
import { Badge, Button, Locations, Requirements } from "./components.jsx";

export const OWNER_COLORS = { first_estate: "#7064a0", gutter_crown: "#bd7752", independent: "#637b7a" };
const RELATION_COLORS = { hostile: "#c3444b", restricted: "#b98857", watched: "#bca170", welcome: "#6caa8b", neutral: "#637b7a", tolerated: "#839974", friendly: "#6caa8b", allied: "#6caa8b" };
const relationshipLabel = value => ({ hostile: "Hostile", restricted: "Restricted", neutral: "Neutral", watched: "Watched", tolerated: "Tolerated", welcome: "Welcome", friendly: "Welcome", allied: "Allied" }[value] || value || "Unknown");
const within = (p, d) => p && p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h;
function Shape({ item, ...props }) {
  return item.points?.length ? <polygon points={item.points.map(p => `${p.x},${p.y}`).join(" ")} {...props}/> : <rect x={item.x} y={item.y} width={item.w} height={item.h} {...props}/>;
}
export function MapCanvas({ geometry, model, selection, onSelect, onMark }) {
  const [layer, setLayer] = useState("owner");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: geometry.world.width / 2, y: geometry.world.height / 2 });
  const drag = useRef(null), svg = useRef(null), didDrag = useRef(false);
  const points = [...model.contacts.map(p => ({ ...p.destination, name: p.name, kind: "contact" })),
    ...model.herd.map(p => ({ ...p.destination, name: p.name, kind: "donor" })),
    ...model.assets.map(p => ({ ...p.destination, name: p.name, kind: "asset" })),
    ...(model.errand ? [model.errand.current, ...model.errand.steps].map((p, i) => ({ ...p.destination, target: i === 0 ? "delivery" : p.target, name: p.title, kind: "errand" })) : []),
    ...model.markers.map(p => ({ ...p.destination, name: p.label, target: p.id, kind: "marker" }))].filter(p => Number.isFinite(p.x));
  const selectedPoint = points.find(p => p.target === selection);
  useEffect(() => {
    if (selectedPoint) { setCenter({ x: selectedPoint.x, y: selectedPoint.y }); setZoom(2); }
  }, [selection]);
  const width = geometry.world.width / zoom, height = geometry.world.height / zoom;
  const x = Math.max(0, Math.min(geometry.world.width - width, center.x - width / 2));
  const y = Math.max(0, Math.min(geometry.world.height - height, center.y - height / 2));
  const viewBox = `${x} ${y} ${width} ${height}`;
  const screenPoint = event => {
    const r = svg.current.getBoundingClientRect(), scale = Math.min(r.width / width, r.height / height);
    const px = event.clientX - r.left - (r.width - width * scale) / 2;
    const py = event.clientY - r.top - (r.height - height * scale) / 2;
    return px >= 0 && py >= 0 && px <= width * scale && py <= height * scale ? { x: x + px / scale, y: y + py / scale } : null;
  };
  const click = (event, target) => { event.stopPropagation(); if (!didDrag.current) onSelect(target); };
  const activate = (event, target) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onSelect(target); } };
  const color = d => layer === "owner" ? OWNER_COLORS[d.ownerId || "independent"] || OWNER_COLORS.independent : layer === "relationship" ? RELATION_COLORS[d.relationship] || "#637b7a" : d.permitted ? "#6caa8b" : "#8a7e6e";
  return <div className="vb-map-column">
    <div className="vb-map-tools" aria-label="Map layers"><span>MAP LAYER</span>{[["owner", "Control"], ["relationship", "Reception"], ["hunting", "Hunting rights"]].map(([id, label]) => <Button key={id} aria-pressed={layer === id} onClick={() => setLayer(id)}>{label}</Button>)}</div>
    <div className="vb-map-frame">
      <svg ref={svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-label="City districts and locations" className="vb-city-map"
        onPointerDown={event => { if (event.button !== 0) return; didDrag.current = false; drag.current = { x: event.clientX, y: event.clientY, center: { ...center } }; }}
        onPointerMove={event => { if (!drag.current) return; const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y; if (Math.hypot(dx, dy) < 5) return; didDrag.current = true; const r = svg.current.getBoundingClientRect(), scale = Math.min(r.width / width, r.height / height); setCenter({ x: Math.max(width / 2, Math.min(geometry.world.width - width / 2, drag.current.center.x - dx / scale)), y: Math.max(height / 2, Math.min(geometry.world.height - height / 2, drag.current.center.y - dy / scale)) }); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
        onDoubleClick={event => { const point = screenPoint(event); if (point) onMark(point); }}>
        <rect width={geometry.world.width} height={geometry.world.height} fill="#0c0e11"/>
        {model.districts.map(d => <g key={d.id} role="button" tabIndex={0} aria-label={`${d.name}, ${layer === "owner" ? d.ownerLabel : layer === "hunting" ? d.permitted ? "Permit held" : "No general permit" : relationshipLabel(d.relationship)}`} onClick={e => click(e, `district:${d.id}`)} onKeyDown={e => activate(e, `district:${d.id}`)} className="vb-map-district">
          <rect x={d.x + 6} y={d.y + 6} width={Math.max(0, d.w - 12)} height={Math.max(0, d.h - 12)} fill={color(d)} fillOpacity={selection === `district:${d.id}` ? .53 : .25} stroke={selection === `district:${d.id}` ? "#f1ede6" : color(d)} strokeWidth={selection === `district:${d.id}` ? 9 : 3}/>
        </g>)}
        <g fill="#07090c" pointerEvents="none">{geometry.roads.map((r, i) => <Shape key={i} item={r}/>)}</g>
        <g fill="#c7c2b2" opacity=".08" pointerEvents="none">{geometry.buildings.map((r, i) => <Shape key={i} item={r}/>)}</g>
        <g pointerEvents="none">{model.districts.map(d => <text key={d.id} x={d.x + d.w / 2} y={d.y + d.h / 2} textAnchor="middle" fill="#ddd6cc" stroke="#0c0e11" strokeWidth="5" paintOrder="stroke" fontSize={Math.max(26, Math.min(44, d.w / 15))} fontWeight="700">{d.name}</text>)}</g>
        {points.map((p, i) => <g key={`${p.target}:${i}`} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${p.kind}: ${p.name}`} onClick={e => click(e, p.target)} onKeyDown={e => activate(e, p.target)} className="vb-map-location">
          <circle r={34 / Math.sqrt(zoom)} fill="#0d0e11" stroke={p.target === selection ? "#efba74" : "#f1ede6"} strokeWidth="5"/>
          {p.kind === "asset" ? <rect x="-9" y="-9" width="18" height="18" fill="#f1ede6"/> : <circle r="10" fill={p.kind === "donor" ? "#cf414b" : "#f1ede6"}/>}
          <title>{p.name}</title>
        </g>)}
        {model.guide && <circle cx={model.guide.x} cy={model.guide.y} r={52 / Math.sqrt(zoom)} stroke="#efba74" strokeWidth="5" fill="none" pointerEvents="none"/>}
        <g transform={`translate(${model.player.x},${model.player.y})`} pointerEvents="none"><circle r="26" fill="#0c0e11" stroke="#edb65e" strokeWidth="4"/><path d="M0-19 12 13 0 7-12 13Z" fill="#edb65e"/></g>
      </svg>
      <div className="vb-map-zoom"><Button aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(z => Math.max(1, z / 2))}>−</Button><span>{zoom}×</span><Button aria-label="Zoom in" disabled={zoom === 4} onClick={() => setZoom(z => Math.min(4, z * 2))}>+</Button><Button onClick={() => { setCenter(model.player); setZoom(2); }}>You</Button><Button onClick={() => { setZoom(1); setCenter({ x: geometry.world.width / 2, y: geometry.world.height / 2 }); }}>Whole city</Button></div>
    </div>
    <div className="vb-map-legend">{layer === "owner" ? <><span><i style={{ background: OWNER_COLORS.first_estate }}/>First Estate</span><span><i style={{ background: OWNER_COLORS.gutter_crown }}/>Gutter Crown</span><span><i style={{ background: OWNER_COLORS.independent }}/>Independent / contested</span></> : layer === "hunting" ? <><span><i style={{ background: "#6caa8b" }}/>General permit held</span><span>No permit ≠ hostile</span></> : <><span>Colour reflects your relationship with the territorial owner.</span><span>Not your hunting permission.</span></>}<span>Drag to pan · double-click to save a waypoint</span></div>
  </div>;
}
export function City({ model, geometry, selection, command }) {
  const contacts = model.contacts.map(p => ({ ...p, target: `contact:${p.id}`, kind: "contact" }));
  const herd = model.herd.map(p => ({ ...p, target: `donor:${p.id}`, kind: "donor" }));
  const assets = model.assets.map(p => ({ ...p, target: `asset:${p.id}`, kind: "asset" }));
  const point = [...contacts, ...herd, ...assets, ...(model.errand ? [model.errand.current, ...model.errand.steps].map((p, i) => ({ ...p, target: i === 0 ? "delivery" : p.target, name: p.title, kind: "errand" })) : []), ...model.markers.map(m => ({ ...m, name: m.label, target: m.id, kind: "marker" }))].find(p => p.target === selection);
  const selectedDistrict = model.districts.find(d => selection === `district:${d.id}`) || model.districts.find(d => point?.destination ? within(point.destination, d) : within(model.player, d)) || model.districts[0];
  const local = items => items.filter(p => p.destination ? within(p.destination, selectedDistrict) : p.districtId === selectedDistrict.id);
  return <div className="vb-city-layout"><MapCanvas geometry={geometry} model={model} selection={selection} onSelect={target => command("select", { target })} onMark={point => command("save-marker", { point })}/><aside className="vb-city-detail">
    {point ? <><span className="vb-eyebrow">{point.kind}</span><h3>{point.name}</h3><p>{point.role || point.description || point.patron && `Patron: ${point.patron}` || "Saved location"}</p><Badge tone={point.suspended || point.refused ? "danger" : "neutral"}>{point.status || (point.level ? "Business interest" : "Location")}</Badge><p>{point.benefits || point.reason || point.requirement}</p>{point.requirements && <Requirements items={point.requirements}/>}
      <Locations target={point.target} command={command}/>{point.kind !== "marker" && <Button onClick={() => command("save-marker", { target: point.target })}>Save location</Button>}{point.kind === "marker" && <Button danger onClick={() => command("remove-marker", { id: point.id })}>Remove marker</Button>}<hr/></> : null}
    {selectedDistrict && <><span className="vb-eyebrow">DISTRICT DOSSIER</span><h3>{selectedDistrict.name}</h3><dl className="vb-facts"><div><dt>Territorial control</dt><dd>{selectedDistrict.ownerLabel}<small>{selectedDistrict.politicalStatus}</small></dd></div><div><dt>Your reception</dt><dd>{relationshipLabel(selectedDistrict.relationship)}{selectedDistrict.reputation != null && <small>Reputation {selectedDistrict.reputation}</small>}</dd></div><div><dt>Hunting rights</dt><dd>{selectedDistrict.permitted ? "General civilian permit" : "No general permit"}<small>Protected prey and consent have separate rules.</small></dd></div></dl>
      <h4>People in this district</h4>{[...local(contacts), ...local(herd)].map(p => <button key={p.id} className="vb-location-row" onClick={() => command("select", { target: p.target })}><strong>{p.name}</strong><span>{p.status}</span></button>)}{![...local(contacts), ...local(herd)].length && <p>No network contacts recorded here.</p>}
      <h4>Business interests</h4>{local(assets).map(p => <button key={p.id} className="vb-location-row" onClick={() => command("select", { target: p.target })}><strong>{p.name}</strong><span>{p.suspended ? "Suspended" : ["Not owned", "Investor", "Controlled"][p.level]}</span></button>)}{!local(assets).length && <p>No network businesses recorded here.</p>}</>}
  </aside></div>;
}
