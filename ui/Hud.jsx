import React from "react";
import { Button, Icon } from "./components.jsx";

const wantedLabel = ["Quiet", "Search", "Pursuit", "Manhunt"];
const wantedTone = ["quiet", "watch", "hot", "critical"];

function Resource({ label, value, suffix = "", tone = "neutral", icon = null, compact = false }) {
  return <div className="vb-street-resource" data-tone={tone} data-compact={compact || undefined}>
    <div className="vb-street-resource-label">{icon && <Icon name={icon}/>}<span>{label}</span></div>
    <strong>{value}<small>{suffix}</small></strong>
  </div>;
}

function Hunger({ value, frenzy }) {
  const rounded = Math.round(value);
  const tone = frenzy || rounded >= 90 ? "critical" : rounded >= 70 ? "hot" : rounded >= 45 ? "watch" : "quiet";
  return <section className="vb-street-hunger" data-tone={tone} aria-label={`Hunger ${rounded} of 100`}>
    <div className="vb-street-hunger-copy">
      <span>{frenzy ? "FRENZY" : "HUNGER"}</span>
      <strong>{rounded}</strong>
      <small>/100</small>
    </div>
    <div className="vb-street-hunger-track" aria-hidden="true"><i style={{ "--hud-fill": `${rounded}%` }}/></div>
  </section>;
}

function Objective({ guide }) {
  if (!guide) return null;
  return <section className="vb-objective vb-street-objective" aria-label={`Objective ${guide.label}, ${guide.arrived ? "nearby" : `${guide.distance} metres away`}`}>
    <span className="vb-street-objective-kicker">Tonight</span>
    <div className="vb-street-objective-main">
      <Icon style={{ transform: `rotate(${guide.bearing}deg)` }}/>
      <div><strong>{guide.label}</strong><span>{guide.arrived ? "Nearby" : `${guide.distance} m`}</span></div>
    </div>
  </section>;
}

function Attention({ wanted, exposure }) {
  if (!wanted && !exposure?.value) return null;
  return <aside className="vb-street-attention" aria-label="Night attention">
    {wanted > 0 && <div className="vb-street-alert" data-tone={wantedTone[wanted]}>
      <span>POLICE</span><strong>{wantedLabel[wanted]}</strong><i>{"◆".repeat(wanted)}{"◇".repeat(3 - wanted)}</i>
    </div>}
    {exposure?.value > 0 && <div className="vb-street-alert" data-tone={exposure.level > 0 ? "critical" : "watch"}>
      <span>VEIL</span><strong>{exposure.level > 0 ? "Exposed" : "Rumours"}</strong><i>{Math.round(exposure.value)}</i>
    </div>}
  </aside>;
}

function VehiclePanel({ vehicle }) {
  if (!vehicle) return null;
  return <section className="vb-street-vehicle" aria-label={`${vehicle.name}, ${Math.round(vehicle.speed)} kilometres per hour`}>
    <div><span>{vehicle.name}</span><strong>{Math.round(vehicle.speed)}<small>km/h</small></strong></div>
    <p><b>GEAR {vehicle.gear}</b><span>HULL {Math.round(vehicle.hull)}%</span></p>
    {vehicle.radio && <small>RADIO · {vehicle.radio}</small>}
  </section>;
}

function Pocket({ s, command }) {
  return <section className="vb-street-pocket" aria-label="Carried resources">
    <Resource label="Cash" value={`$${s.cash}`} compact/>
    <button type="button" className="vb-street-blood" disabled={!s.bags || s.frenzy} onClick={() => command("blood")} aria-label={`Use carried blood, ${s.bags} bags`}>
      <Icon name="blood"/><span>BLOOD</span><strong>{s.bags}<small>/4</small></strong>
    </button>
  </section>;
}

function Prompt({ prompt }) {
  if (!prompt) return null;
  return <div className="vb-prompt vb-street-prompt" role="status"><kbd>{prompt.key}</kbd><strong>{prompt.text}</strong></div>;
}

function Notice({ guidance, notice }) {
  const text = guidance?.text || notice;
  if (!text) return null;
  return <div className="vb-notice vb-street-notice" role="status"><span>NOTE</span><p>{text}</p></div>;
}

export function Hud({ s, command }) {
  if (!s.visible || s.mode) return null;
  return <div className="vb-hud vb-street-hud" data-viceblood-ui="hud" data-frenzy={s.frenzy || undefined}>
    <div className="vb-street-grain" aria-hidden="true"/>

    <header className="vb-hud-place vb-street-place">
      <div><small>DISTRICT</small><strong>{s.district}</strong></div>
      <span>{s.stage}</span>
    </header>

    <nav className="vb-hud-nav vb-street-nav" aria-label="Game menu">
      <Button icon="moon" className="nb-book-toggle" aria-label="Black Book M" onClick={() => command("open", { tab: "tonight" })}>Black Book <kbd>M</kbd>{s.errand && <i className="vb-active-dot"/>}</Button>
      <Button icon="city" aria-label="City" onClick={() => command("open", { tab: "city" })}>City</Button>
      <Button icon="menu" aria-label="Pause" onClick={() => command("pause")}/>
    </nav>

    <Objective guide={s.guide}/>
    <Attention wanted={s.wanted} exposure={s.exposure}/>

    <section className="vb-vitals vb-street-vitals" aria-label="Survival status">
      <Hunger value={s.hunger} frenzy={s.frenzy}/>
      <Resource label="Vitality" value={Math.round(s.vitality)} suffix="%" tone={s.vitality < 30 ? "critical" : s.vitality < 60 ? "watch" : "quiet"}/>
      <Pocket s={s} command={command}/>
    </section>

    {s.vehicle ? <VehiclePanel vehicle={s.vehicle}/> : <section className="vb-equipment vb-street-equipment" aria-label="Weapon">
      <span>ARMED</span><strong>{s.weapon.name}</strong><small>{s.weapon.ammoText} · AMMO</small>
    </section>}

    <div className="vb-powers vb-street-powers" aria-label="Powers">{s.powers.map(power => <div key={power.id} className="vb-power-slot vb-street-power" data-locked={power.locked} data-active={power.active}>
      <kbd>{power.key}</kbd><span>{power.name}</span><small>{power.locked ? "—" : power.active ? "LIVE" : power.cooldown ? `${power.cooldown}s` : "READY"}</small>
    </div>)}</div>

    <Prompt prompt={s.prompt}/>
    <Notice guidance={s.guidance} notice={s.notice}/>
  </div>;
}
