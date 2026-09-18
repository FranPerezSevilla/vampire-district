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

function Objective({ guide, playerScreen, announcement }) {
  if (!guide && !announcement) return null;
  return <>
    {announcement && <section className="vb-objective vb-street-objective" aria-label={`Tonight ${announcement}`}>
      <div className="vb-street-objective-paper"><span className="vb-street-objective-kicker">Tonight</span><strong>{announcement}</strong></div>
    </section>}
    {guide && playerScreen && <div className="vb-player-compass" aria-hidden="true">
      <Icon/>
    </div>}
  </>;
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
    <time className="vb-night-clock" aria-label="Time">{s.clock}</time>
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
    <kbd>[{prompt.key}]</kbd><span>{prompt.text}</span>
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

    <Objective guide={s.guide} playerScreen={s.playerScreen} announcement={s.announcement}/>
    <Attention wanted={s.wanted} exposure={s.exposure}/>
    <SurvivalPanel s={s} command={command}/>

    {s.vehicle ? <VehiclePanel vehicle={s.vehicle}/> : <section className="vb-equipment vb-street-equipment" aria-label="Weapon">
      <span>WEAPON</span><strong>{s.weapon.name}</strong><small>{s.weapon.ammoText} · AMMO</small>
    </section>}

    <Prompt prompt={s.prompt}/>

  </div>;
}
