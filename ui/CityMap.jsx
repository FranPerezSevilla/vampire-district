import { memo, useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Locations, Requirements } from "./components.jsx";
import { recommendationFile } from "./nightbook-model.js";

export const OWNER_COLORS = { first_estate: "#7064a0", gutter_crown: "#bd7752", independent: "#637b7a" };
const RELATION_COLORS = { hostile: "#c3444b", restricted: "#b98857", watched: "#bca170", welcome: "#6caa8b", neutral: "#637b7a", tolerated: "#839974", friendly: "#6caa8b", allied: "#6caa8b" };
const relationshipLabel = value => ({ hostile: "Hostile", restricted: "Restricted", neutral: "Neutral", watched: "Watched", tolerated: "Tolerated", welcome: "Welcome", friendly: "Welcome", allied: "Allied" }[value] || value || "Unknown");
const within = (p, d) => p && p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h;
function Shape({ item, ...props }) {
  return item.points?.length ? <polygon points={item.points.map(p => `${p.x},${p.y}`).join(" ")} {...props}/> : <rect x={item.x} y={item.y} width={item.w} height={item.h} {...props}/>;
}
const StreetInk = memo(function StreetInk({ geometry }) {
  return <><g fill="#e8dac0" stroke="#6d5963" strokeWidth="1.5" pointerEvents="none">{geometry.roads.map((r,i)=><Shape key={i} item={r}/>)}</g><g fill="#433440" opacity=".21" pointerEvents="none">{geometry.buildings.map((r,i)=><Shape key={i} item={r}/>)}</g></>;
});
export function MapCanvas({ geometry, model, selection, onSelect, onMark }) {
  const [layer, setLayer] = useState("hunting");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: geometry.world.width / 2, y: geometry.world.height / 2 });
  const drag = useRef(null), svg = useRef(null), didDrag = useRef(false);
  const gridId = useId().replaceAll(":", "");
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const measure = () => { const r = svg.current?.getBoundingClientRect(); if (r?.width > 0 && r.height > 0) setSize(old => old.width === r.width && old.height === r.height ? old : { width: r.width, height: r.height }); };
    measure();
    const observer = globalThis.ResizeObserver ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(svg.current); else window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
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
  const labelSize = 12 / Math.max(.02, Math.min(size.width / width, size.height / height));
  const screenPoint = event => {
    const r = svg.current.getBoundingClientRect(), scale = Math.min(r.width / width, r.height / height);
    const px = event.clientX - r.left - (r.width - width * scale) / 2;
    const py = event.clientY - r.top - (r.height - height * scale) / 2;
    return px >= 0 && py >= 0 && px <= width * scale && py <= height * scale ? { x: x + px / scale, y: y + py / scale } : null;
  };
  const click = (event, target) => { event.stopPropagation(); if (!didDrag.current) onSelect(target); };
  const activate = (event, target) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onSelect(target); } };
  const color = d => layer === "owner" ? OWNER_COLORS[d.ownerId || "independent"] || OWNER_COLORS.independent : layer === "relationship" ? RELATION_COLORS[d.relationship] || "#637b7a" : d.permitted ? "#659079" : "#938075";
  return <div className="vb-map-column">
    <div className="vb-map-tools" aria-label="Map layers">{[["hunting", "Hunting rights"], ["owner", "Control"], ["relationship", "Reception"]].map(([id, label]) => <Button key={id} aria-pressed={layer === id} onClick={() => setLayer(id)}>{label}</Button>)}</div>
    <div className="vb-map-frame">
      <svg ref={svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-label="City districts and locations" className="vb-city-map"
        onPointerDown={event => { if (event.button !== 0) return; didDrag.current = false; drag.current = { x: event.clientX, y: event.clientY, center: { ...center } }; }}
        onPointerMove={event => { if (!drag.current) return; const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y; if (Math.hypot(dx, dy) < 5) return; didDrag.current = true; const r = svg.current.getBoundingClientRect(), scale = Math.min(r.width / width, r.height / height); setCenter({ x: Math.max(width / 2, Math.min(geometry.world.width - width / 2, drag.current.center.x - dx / scale)), y: Math.max(height / 2, Math.min(geometry.world.height - height / 2, drag.current.center.y - dy / scale)) }); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
        onDoubleClick={event => { const point = screenPoint(event); if (point) onMark(point); }}>
        <defs><pattern id={`atlas-${gridId}`} width="160" height="160" patternUnits="userSpaceOnUse"><path d="M160 0H0v160" fill="none" stroke="#47323e" strokeWidth="1" opacity=".18"/></pattern></defs>
        <rect width={geometry.world.width} height={geometry.world.height} fill="#cbbda2"/>
        <rect width={geometry.world.width} height={geometry.world.height} fill={`url(#atlas-${gridId})`}/>

        {model.districts.map(d => <g key={d.id} role="button" tabIndex={0} aria-label={`${d.name}, ${layer === "owner" ? d.ownerLabel : layer === "hunting" ? d.permitted ? "Permit held" : "No general permit" : relationshipLabel(d.relationship)}`} onClick={e => click(e, `district:${d.id}`)} onKeyDown={e => activate(e, `district:${d.id}`)} className="vb-map-district">
          <rect x={d.x + 6} y={d.y + 6} width={Math.max(0, d.w - 12)} height={Math.max(0, d.h - 12)} fill={color(d)} fillOpacity={selection === `district:${d.id}` ? .7 : .43} stroke={selection === `district:${d.id}` ? "#8e2340" : color(d)} strokeWidth={selection === `district:${d.id}` ? 9 : 3}/>
        </g>)}
        <StreetInk geometry={geometry}/>
        <g pointerEvents="none">{model.districts.map(d => <text key={d.id} x={d.x+d.w/2} y={d.y+d.h/2} textAnchor="middle" fill="#352733" stroke="#dfd2b6" strokeWidth={labelSize*.12} paintOrder="stroke" fontFamily="Courier New, monospace" fontSize={labelSize} fontWeight="700">{d.name.split(/\s+/).map((word,i,words)=><tspan key={i} x={d.x+d.w/2} dy={i===0 ? -(words.length-1)*labelSize*.45 : labelSize*1.1}>{word}</tspan>)}</text>)}</g>
        {points.map((p, i) => <g key={`${p.target}:${i}`} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${p.kind}: ${p.name}`} onClick={e => click(e, p.target)} onKeyDown={e => activate(e, p.target)} className="vb-map-location">
          <circle r={Math.max(28, labelSize * .82)} fill="#251824" stroke={p.target === selection ? "#b73549" : "#eddbc1"} strokeWidth="5"/>
          <text textAnchor="middle" dominantBaseline="central" fontSize={labelSize} fontFamily="Arial, sans-serif" fill={p.kind === "donor" ? "#ee9bab" : "#f3e4ca"}>{p.kind === "asset" ? "▣" : p.kind === "donor" ? "♦" : p.kind === "contact" ? "●" : "×"}</text>
          <title>{p.name}</title>
        </g>)}
        {model.guide && <circle cx={model.guide.x} cy={model.guide.y} r={52 / Math.sqrt(zoom)} stroke="#efba74" strokeWidth="5" fill="none" pointerEvents="none"/>}
        <g transform={`translate(${model.player.x},${model.player.y})`} pointerEvents="none"><circle r="26" fill="#0c0e11" stroke="#edb65e" strokeWidth="4"/><path d="M0-19 12 13 0 7-12 13Z" fill="#edb65e"/></g>
      </svg>
      <div className="vb-map-zoom"><Button aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(z => Math.max(1, z / 2))}>−</Button><span>{zoom}×</span><Button aria-label="Zoom in" disabled={zoom === 4} onClick={() => setZoom(z => Math.min(4, z * 2))}>+</Button><Button onClick={() => { setCenter(model.player); setZoom(2); }}>You</Button><Button onClick={() => { setZoom(1); setCenter({ x: geometry.world.width / 2, y: geometry.world.height / 2 }); }}>Whole city</Button></div>
    </div>
    <div className="vb-map-legend">{layer === "owner" ? <><span><i style={{ background: OWNER_COLORS.first_estate }}/>First Estate</span><span><i style={{ background: OWNER_COLORS.gutter_crown }}/>Gutter Crown</span><span><i style={{ background: OWNER_COLORS.independent }}/>Independent / contested</span></> : layer === "hunting" ? <><span><i style={{ background: "#6caa8b" }}/>General permit held</span><span>No permit ≠ hostile</span></> : <><span>Standing with the local power</span><span>Hunting rights are separate</span></>}</div><div className="nb-map-key" aria-label="Location symbols"><span><b>●</b> contact</span><span><b>♦</b> donor</span><span><b>▣</b> business</span><span><b>×</b> task / marker</span></div>
  </div>;
}
export function City({ model, geometry, selection, command }) {
  const contacts = model.contacts.map(p => ({ ...p, target: `contact:${p.id}`, kind: "contact" }));
  const herd = model.herd.map(p => ({ ...p, target: `donor:${p.id}`, kind: "donor" }));
  const assets = model.assets.map(p => ({ ...p, target: `asset:${p.id}`, kind: "asset" }));
  const point = [...contacts, ...herd, ...assets, ...(model.errand ? [model.errand.current, ...model.errand.steps].map((p, i) => ({ ...p, target: i === 0 ? "delivery" : p.target, name: p.title, kind: "errand" })) : []), ...model.markers.map(m => ({ ...m, name: m.label, target: m.id, kind: "marker" }))].find(p => p.target === selection);
  const selectedDistrict = model.districts.find(d => selection === `district:${d.id}`) || model.districts.find(d => point?.destination ? within(point.destination, d) : within(model.player, d)) || model.districts[0];
  const local = items => selectedDistrict ? items.filter(p => p.destination ? within(p.destination, selectedDistrict) : p.districtId === selectedDistrict.id) : [];
  return <div className="vb-city-layout"><MapCanvas geometry={geometry} model={model} selection={selection} onSelect={target => command("select", { target })} onMark={point => command("save-marker", { point })}/><aside className="vb-city-detail">
    <label className="nb-district-picker"><span className="vb-eyebrow">DISTRICT</span><select aria-label="Inspect a district" value={selectedDistrict?.id || ""} onChange={event=>command("select",{target:`district:${event.target.value}`})}>{model.districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    {point ? <div className="nb-map-file"><span className="vb-eyebrow">{point.kind === "asset" ? "Business" : point.kind === "errand" ? "Errand" : point.kind}</span><h3>{point.name}</h3><p>{point.role || point.description || point.patron && `Patron: ${point.patron}` || "Saved location"}</p><Badge tone={point.suspended || point.refused ? "danger" : "neutral"}>{point.status || (point.level ? "Business interest" : "Location")}</Badge><p>{point.benefits || point.reason || point.requirement}</p>
      <Locations target={point.target} command={command} disabled={point.dead}/>{["contact","donor","asset"].includes(point.kind) && <Button onClick={()=>command("tab",recommendationFile(point.target))}>Open file</Button>}{point.kind !== "marker" && <Button onClick={() => command("save-marker", { target: point.target })}>Save location</Button>}{point.kind === "marker" && <Button danger onClick={() => command("remove-marker", { id: point.id })}>Remove marker</Button>}<hr/></div> : null}
    {selectedDistrict && <><h3>{selectedDistrict.name}</h3><div className="nb-permit" data-permitted={selectedDistrict.permitted}>{selectedDistrict.permitted ? "HUNTING PERMITTED" : "NO HUNTING PERMIT"}</div><p>Protected prey remain off limits. A permit is not consent.</p><dl className="vb-facts"><div><dt>Control</dt><dd>{selectedDistrict.ownerLabel}<small>{selectedDistrict.politicalStatus}</small></dd></div><div><dt>Reception</dt><dd>{relationshipLabel(selectedDistrict.relationship)}{selectedDistrict.reputation != null && <small>Reputation {selectedDistrict.reputation}</small>}</dd></div></dl>
      <h4>Contacts</h4>{local(contacts).map(p => <button type="button" key={p.id} className="vb-location-row" onClick={() => command("tab", { tab:"network", target: p.target })}><strong>{p.name} ↗</strong><span>{p.status}</span></button>)}{!local(contacts).length && <p>No contacts here.</p>}
      <h4>Donors</h4>{local(herd).map(p => <button type="button" key={p.id} className="vb-location-row" onClick={() => command("tab", { tab:"feeding", target: p.target })}><strong>{p.name} ↗</strong><span>{p.status}</span></button>)}{!local(herd).length && <p>No donors here.</p>}
      <h4>Holdings</h4>{local(assets).map(p => <button type="button" key={p.id} className="vb-location-row" onClick={() => command("tab", { tab:"ledger", target: p.target })}><strong>{p.name} ↗</strong><span>{p.suspended ? "Suspended" : ["Not owned", "Investor", "Controlled"][p.level]}</span></button>)}{!local(assets).length && <p>No holdings here.</p>}</>}
  </aside></div>;
}
