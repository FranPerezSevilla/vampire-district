import React from "react";
import { Button, Icon } from "./components.jsx";

const wantedLabel = ["Quiet", "Search", "Pursuit", "Manhunt"];
const wantedTone = ["quiet", "watch", "hot", "critical"];
const bloodBagAsset = new URL("../assets/ui/blood-bag-small.png", import.meta.url).href;

function Resource({ label, value, suffix = "", tone = "neutral", icon = null, compact = false }) {
  return <div className="vb-street-resource" data-tone={tone} data-compact={compact || undefined}>
    <div className="vb-street-resource-label">{icon && <Icon name={icon}/>}<span>{label}</span></div>
    <strong>{value}<small>{suffix}</small></strong>
  </div>;
}

function Objective({ guide }) {
  if (!guide) return null;
  return <section className="vb-objective vb-street-objective" aria-label={`Objective ${guide.label}, ${guide.arrived ? "nearby" : `${guide.distance} metres away`}`}>
    <div className="vb-street-objective-paper">
      <span className="vb-street-objective-kicker">Tonight</span>
      <strong>{guide.label}</strong>
      <small>{guide.arrived ? "Target nearby" : `${guide.distance} m · tracked`}</small>
    </div>
    <div className="vb-street-objective-pointer" aria-hidden="true">
      <Icon style={{ transform: `rotate(${guide.bearing}deg)` }}/>
      {!guide.arrived && <span>{guide.distance} m</span>}
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

function SurvivalPanel({ s, command }) {
  const hunger = Math.max(0, Math.min(100, Math.round(s.hunger)));
  const vitality = Math.max(0, Math.min(100, Math.round(s.vitality)));
  return <section className="vb-vitals vb-street-vitals" aria-label="Survival status">
    <div className="vb-street-vitals-body">
      <div className="vb-street-survival-row" data-tone={s.frenzy || hunger >= 70 ? "danger" : "normal"}>
        <strong>{s.frenzy ? "FRENZY" : "HUNGER"}</strong>
        <div className="vb-street-survival-track"><i style={{ width: `${hunger}%` }}/></div>
        <b>{hunger}</b>
      </div>
      <div className="vb-street-survival-row vitality" data-tone={vitality < 35 ? "danger" : "normal"}>
        <strong>VITALITY</strong>
        <div className="vb-street-survival-track"><i style={{ width: `${vitality}%` }}/></div>
        <b>{vitality}</b>
      </div>
      <div className="vb-street-survival-pocket">
        <button type="button" className="vb-street-blood" disabled={!s.bags || s.frenzy} onClick={() => command("blood")} aria-label={`Use carried blood, ${s.bags} bags`}>
          <img src={bloodBagAsset} alt="" aria-hidden="true"/><span>BLOOD</span><strong>{s.bags}</strong>
        </button>
        <div className="vb-street-cash"><span aria-hidden="true">$</span><small>CASH</small><strong>${s.cash}</strong></div>
      </div>
    </div>
  </section>;
}

function Prompt({ prompt }) {
  if (!prompt) return null;
  return <div className="vb-prompt vb-street-prompt" role="status">
    <kbd>{prompt.key}</kbd>
    <div><strong>{prompt.text}</strong><small>ACT NOW</small></div>
  </div>;
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
    <SurvivalPanel s={s} command={command}/>

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
