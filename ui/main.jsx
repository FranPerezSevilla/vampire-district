import React, { useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Badge, Button, Empty, Icon, Meter, Metric, Window } from "./components.jsx";
import { Domain } from "./Domain.jsx";
import { NightSeal } from "./artwork.jsx";
import "./interface.css";

const wantedLabel = ["Clear", "Search", "Pursuit", "Air support"];
function Hud({ s, command }) {
  if (!s.visible || s.mode) return null;
  return <div className="vb-hud" data-viceblood-ui="hud">
    <header className="vb-hud-place"><span>{s.district}</span><small>{s.stage}</small></header>
    <div className="vb-hud-nav"><Button icon="moon" className="nb-book-toggle" aria-label="Black Book M" onClick={() => command("open", { tab: "tonight" })}>Black Book <kbd>M</kbd>{s.errand && <i className="vb-active-dot"/>}</Button><Button icon="city" aria-label="City" onClick={() => command("open", { tab: "city" })}>Map</Button><Button icon="menu" aria-label="Pause" onClick={() => command("pause")}/></div>
    {s.guide && <div className="vb-objective" aria-label={`Objective ${s.guide.label}, ${s.guide.arrived ? "nearby" : `${s.guide.distance} metres away`}`}><Icon style={{ transform: `rotate(${s.guide.bearing}deg)` }}/><div><small>CURRENT DESTINATION</small><strong>{s.guide.label}</strong><span>{s.guide.arrived ? "Destination reached" : `${s.guide.distance} m`}</span></div></div>}
    <div className="vb-attention"><span data-danger={s.wanted > 0}>POLICE <strong>{wantedLabel[s.wanted]}</strong><i>{"◆".repeat(s.wanted)}{"◇".repeat(3 - s.wanted)}</i></span>{s.exposure.value > 0 && <span data-danger={s.exposure.level > 0}>VEIL <strong>{s.exposure.value}</strong></span>}</div>
    <div className={`vb-vitals ${s.frenzy ? "frenzy" : ""}`}><div className="vb-hunger"><Icon name="blood"/><div><small>{s.frenzy ? "FRENZY" : "HUNGER"}</small><strong>{Math.round(s.hunger)}<span>/100</span></strong></div></div><Meter value={s.hunger} label="Hunger" danger={s.hunger >= 85}/><div className="vb-vitality"><small>VITALITY</small><strong>{Math.round(s.vitality)}</strong><Meter value={s.vitality} label="Vitality" danger={s.vitality < 30}/></div><div className="vb-pocket"><span>${s.cash}</span><button type="button" disabled={!s.bags || s.frenzy} onClick={() => command("blood")} aria-label={`Use carried blood, ${s.bags} bags`}><Icon name="blood"/>{s.bags}/4</button></div></div>
    <div className="vb-powers" aria-label="Powers">{s.powers.map(power => <div key={power.id} className="vb-power-slot" data-locked={power.locked} data-active={power.active}><kbd>{power.key}</kbd><strong>{power.name}</strong><small>{power.locked ? "Locked" : power.active ? "Active" : power.cooldown ? `${power.cooldown}s` : "Ready"}</small></div>)}</div>
    <div className="vb-equipment">{s.vehicle ? <><small>{s.vehicle.name}</small><strong>{Math.round(s.vehicle.speed)}<span>km/h</span></strong><p>Gear {s.vehicle.gear} · Hull {Math.round(s.vehicle.hull)}%</p><small>Radio · {s.vehicle.radio || "Off"}</small><small>Enter · exit / Space · handbrake</small></> : <><small>EQUIPPED</small><strong>{s.weapon.name}</strong><span>{s.weapon.ammoText} <small>AMMO</small></span><small>Mouse wheel · change weapon</small></>}</div>
    {s.prompt && <div className="vb-prompt" role="status"><kbd>{s.prompt.key}</kbd>{s.prompt.text}</div>}
    {(s.guidance?.text || s.notice) && <div className="vb-notice" role="status">{s.guidance?.text || s.notice}</div>}
  </div>;
}
function Ledger({ model }) {
  if (!model?.ready) return <Empty title="No ledger available">Campaign evidence has not loaded.</Empty>;
  return <div className="vb-section"><span className="vb-eyebrow">TWO KINDS OF ATTENTION</span><h2>Police & the Veil</h2><div className="vb-power-grid"><article><h3>Police · {model.police.stateLabel}</h3><Meter value={model.police.heatPercent} label="Police heat" danger/><p>{model.police.lastReason}</p><div className="vb-statline"><Metric label="Foot officers" value={model.police.footOfficers}/><Metric label="Cruisers" value={model.police.motorizedUnits}/><Metric label="Reports" value={model.police.witnessReports}/></div></article><article><h3>Supernatural exposure</h3><Meter value={model.exposure.percent} label="Veil exposure" danger/><p>{model.exposure.lastReason}</p><div className="vb-statline"><Metric label="Known evidence" value={model.exposure.knownCount}/><Metric label="Latent clues" value={model.exposure.latentCount}/></div></article></div><h3>Evidence trail</h3><div className="vb-history">{model.exposure.records.map(e => <p key={e.id}><strong>{e.label}</strong> · {e.districtName} <Badge>{e.state}</Badge></p>)}{!model.exposure.records.length && <p>No active supernatural evidence.</p>}</div><h3>Recent incidents</h3>{model.incidents.slice(0, 8).map(i => <p key={i.id}><small>{i.timeLabel}</small> · <strong>{i.title}</strong> · {i.detail}</p>)}</div>;
}
function Garage({ s, command }) {
  const model = s.external;
  return <section className="vb-section"><p className="vb-lead">Repair here. Recover an owned wreck from anywhere in the city.</p><Metric label="Available cash" value={`$${model.balance}`}/><div className="vb-editorial-grid">{model.vehicles.map(q => <article key={q.vehicleId} className="vb-editorial-card"><h3>{q.name}</h3><Badge>{q.atGarage ? "At the refuge" : `${Math.round(q.distanceToGarage)} m from garage`}</Badge><p>Hull {q.health}/{q.maxHealth}</p><Meter label={`${q.name} hull`} value={q.healthPercent}/><p>{q.reason}</p><Button primary disabled={!q.available || model.busy} onClick={() => command("external", { action: q.action, vehicleId: q.vehicleId })}>{q.action === "recover" ? "Recover" : "Repair"} · ${q.cost}</Button></article>)}</div><p role="status">{model.status}</p></section>;
}
function App({ store, command, overlay, geometry, controls }) {
  const s = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const firstChoice = useRef(null);
  if (!s.ready) return null;
  const titles = { domain: "The Black Book", pause: "The night can wait.", interaction: s.interaction?.title || "Choose", ledger: "Incident file", garage: "Refuge garage", intro: "Welcome to the night", result: s.result?.title || "Night report", dialogue: s.external?.speaker || "Voice in the dark", error: "Interface interrupted" };
  return <><Hud s={s} command={command}/>{s.mode && <Window title={titles[s.mode] || "ViceBlood"} description={s.mode === "domain" ? "A private record of blood, promises and unpaid debts." : s.interaction?.detail || "World paused"} overlay={overlay} wide={s.mode === "domain"} close={() => command("close")} initialFocus={s.mode === "interaction" ? firstChoice : undefined}>
    {s.mode === "domain" && <Domain snapshot={s} geometry={geometry} command={command}/>}
    {s.mode === "interaction" && <div className="vb-choices"><div className="nb-exchange-title"><span>FACE TO FACE</span><p className="vb-eyebrow">E / ENTER TO CHOOSE · 1–9 SHORTCUTS</p></div>{s.interaction.options.map((option, i) => <button type="button" key={option.id} ref={i === s.interaction.index ? firstChoice : null} className="vb-choice" data-selected={i === s.interaction.index} disabled={option.disabled} onClick={() => command("choose", { id: option.id })}><span className="vb-choice-index">{String(i + 1).padStart(2, "0")}</span><span><strong>{option.label}</strong><small>{option.detail}</small></span><span aria-hidden="true">↗</span></button>)}</div>}
    {s.mode === "pause" && <section className="vb-section nb-pause"><NightSeal/><span className="vb-eyebrow">SIDE B / A MOMENT OFF THE STREETS</span><h2>Hold the night.</h2><div className="vb-actions"><Button primary onClick={() => command("close")}>Resume night</Button><Button icon="moon" onClick={() => command("open", { tab: "tonight" })}>Open Black Book</Button><Button icon="city" onClick={() => command("open", { tab: "city" })}>Your city</Button>{s.capabilities?.incidentFile && <Button onClick={() => command("ledger")}>Police & the Veil</Button>}</div><h3>Accessibility</h3><Button aria-pressed={s.highContrast} onClick={() => command("contrast")}>High-contrast aim · {s.highContrast ? "On" : "Off"}</Button><p>A larger black-and-white reticle. Saved on this device.</p><details className="vb-controls"><summary>Controls</summary><pre>{controls}</pre></details></section>}
    {s.mode === "ledger" && <><div className="nb-file-back"><Button onClick={() => command("open", { tab: "tonight" })}>Back to Black Book</Button></div><Ledger model={s.ledger}/></>}
    {s.mode === "garage" && <Garage s={s} command={command}/>}
    {s.mode === "dialogue" && <section className="vb-section vb-narrative"><p className="vb-lead">{s.external?.text}</p><Button primary onClick={() => command("external", { action: "continue" })}>Continue</Button></section>}
    {s.mode === "error" && <Empty title="The interface could not read the game state" action={<Button primary onClick={() => location.reload()}>Reload ViceBlood</Button>}>{s.error}</Empty>}
    {s.mode === "result" && <section className="vb-section"><p>{s.result?.subtitle}</p><Button primary onClick={() => s.result?.status === "failed" ? location.reload() : command("close")}>{s.result?.status === "failed" ? "Reload" : "Continue"}</Button></section>}
  </Window>}</>;
}
class UiErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("ViceBlood interface render error", error); this.props.command("ui-error", { message: String(error.message || error) }); }
  render() {
    if (this.state.error) return <div className="vb-render-error" role="alert"><h2>Interface interrupted</h2><p>{String(this.state.error.message || this.state.error)}</p><Button primary onClick={() => location.reload()}>Reload ViceBlood</Button></div>;
    return this.props.children;
  }
}
export function mount(node, options) {
  const root = createRoot(node);
  // Commit the first tree inside the scene's CREATE boundary. Later store
  // updates stay asynchronous; only startup needs an actual mounted interface.
  flushSync(() => root.render(<UiErrorBoundary command={options.command}><App {...options}/></UiErrorBoundary>));
  return { unmount: () => root.unmount() };
}
