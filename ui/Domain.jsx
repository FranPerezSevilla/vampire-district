import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { City } from "./CityMap.jsx";
import { Badge, Button, Empty, Icon, Locations, Meter, Metric, Requirements } from "./components.jsx";
import { ContactPrint, NightSeal, TapeLabel } from "./artwork.jsx";
import { BOOK_CHAPTERS, bookSummary, contactState, distanceTo, districtName, money, recommendationFile } from "./nightbook-model.js";
import { VAMPIRE_RULES as RULES } from "../phaser/src/vampire/VampireCatalog.js";

function ChapterHeading({ number, title, children, stamp }) {
  return <header className="nb-chapter-heading"><div><span className="vb-eyebrow">PRIVATE COPY / CHAPTER {number}</span><h2>{title}</h2><p>{children}</p></div>{stamp && <span className="nb-stamp">{stamp}</span>}</header>;
}
function Errand({ model, command, confirmation }) {
  const job = model.errand;
  if (!job) return <article className="nb-paper nb-task vb-errand">
    <TapeLabel>YOUR NEXT MOVE</TapeLabel><span className="vb-eyebrow">No outstanding errand</span>
    <h3>{model.next.text}</h3><p className="nb-briefing">{model.next.why}</p>
    <Locations target={model.next.target} command={command}/>
    <div className="nb-task-foot"><span>Work buys trust.<br/>Trust opens doors.</span><Button onClick={() => command("tab", { tab: "network" })}>Find a contact</Button></div>
  </article>;
  return <article className="nb-paper nb-task vb-errand">
    <TapeLabel>ONE ERRAND. YOUR WORD.</TapeLabel><span className="vb-eyebrow">FROM {job.issuer} / {job.collected ? "02" : "01"} OF 02</span>
    <h3>{job.current.title}</h3><p className="nb-briefing">{job.current.description}</p>
    <ol className="vb-errand-steps">{job.steps.map((step, i) => <li key={step.target} data-state={step.state}><span className="vb-step-number">{step.state === "done" ? "✓" : `0${i + 1}`}</span><span><small>{step.state === "current" ? "DO THIS NOW" : step.state === "done" ? "DONE" : "THEN"}</small><strong>{step.title}</strong></span></li>)}</ol>
    <div className="nb-payment"><Metric label="Cash to you" value={money(job.cash)}/><Metric label="Trust earned" value={`+${job.trust}`}/>{job.repaid > 0 && <Metric label="Debt repaid" value={money(job.repaid)}/>}</div>
    <Locations command={command} target="delivery"/>
    <details className="nb-fine-print"><summary>Cargo & payment details</summary><p>{job.cargo}. Total reward {money(job.reward)}; {money(job.repaid)} goes towards your debt and {money(job.cash)} goes into your pocket.</p><p>You can hold one errand at a time.</p></details>
    <div className="vb-abandon">{confirmation ? <div role="alert"><h4>Abandon this errand?</h4><p>You lose the cargo, reward and your contact's trust. This cannot be undone.</p><div className="vb-actions"><Button danger onClick={() => command("confirm-abandon")}>Abandon errand</Button><Button primary onClick={() => command("cancel-confirm")}>Keep working</Button></div></div> : <Button danger onClick={() => command("abandon")}>Abandon errand…</Button>}</div>
  </article>;
}
function Tonight({ model, snapshot, command }) {
  const summary = bookSummary(model);
  return <section className="vb-section nb-tonight">
    <ChapterHeading number="01" title="The city doesn't sleep." stamp="ONE MORE NIGHT">Your next move. Your blood. The price of getting caught.</ChapterHeading>
    <div className="nb-tonight-grid"><Errand model={model} command={command} confirmation={snapshot.confirmation}/>
      <aside className="nb-night-margin">
        <div className={`nb-condition ${model.hunger >= 85 ? "urgent" : ""}`}><div className="nb-condition-head"><Icon name="blood"/><span className="vb-eyebrow">KEEP THE BEAST QUIET</span></div><div className="nb-big-number">{model.hunger}<small>/ 100 hunger</small></div><Meter label="Tonight hunger" value={model.hunger} danger={model.hunger >= 85}/><p>{model.hunger >= 85 ? "Hunger is critical. At 100 the Beast can take over." : model.hunger >= 50 ? "You are getting hungry. Know your next source." : "Keep a source of blood within reach."}</p><strong>{model.bags ? `${model.bags} carried ${model.bags === 1 ? "bag" : "bags"}` : summary.ready.length ? `${summary.ready.length} donor ${summary.ready.length === 1 ? "is" : "are"} ready` : "No carried blood. No donor ready."}</strong><Button icon="blood" onClick={() => command("tab", { tab: "feeding" })}>Find blood</Button></div>
        <div className="nb-incident-slip"><span className="vb-eyebrow">ATTENTION ON THE STREET</span><dl><div><dt>Police</dt><dd>{["Clear", "Searching", "Pursuit", "Air support"][snapshot.wanted] || "Unknown"}</dd></div><div><dt>Veil exposure</dt><dd>{snapshot.exposure.value}</dd></div></dl>{snapshot.capabilities?.incidentFile ? <Button icon="eye" onClick={() => command("ledger")}>Read incident file</Button> : <p>Police respond to crime. The Veil records supernatural exposure.</p>}</div>
      </aside>
    </div>
    <nav className="nb-essentials" aria-label="Tonight's essentials">
      <button type="button" onClick={() => command("tab", { tab: "city" })}><span className="nb-index">II</span><span><strong>Read the streets</strong><small>{summary.permitted} of {model.districts.length} districts · general hunting permit held</small></span><Icon/></button>
      <button type="button" onClick={() => command("tab", { tab: "network" })}><span className="nb-index">III</span><span><strong>Know your people</strong><small>{summary.known} known contacts{summary.suspended ? ` · ${summary.suspended} suspended` : " · favours open doors"}</small></span><Icon/></button>
      <button type="button" onClick={() => command("tab", { tab: "ledger" })}><span className="nb-index">V</span><span><strong>Make the city yours</strong><small>{summary.owned} business interests · {money(model.debt)} owed</small></span><Icon/></button>
    </nav>
  </section>;
}
function Network({ model, selection, command }) {
  const person = model.contacts.find(p => `contact:${p.id}` === selection) || model.contacts[0];
  if (!person) return <Empty title="No contact files">Your network has not been recorded yet.</Empty>;
  const state = contactState(person), donors = model.herd.filter(p => p.contactId === person.id), assets = model.assets.filter(a => a.contactId === person.id);
  return <section className="nb-network">
    <div className="nb-file-index"><div className="nb-file-index-heading"><span className="vb-eyebrow">CHAPTER 03 / NETWORK</span><h2>Names open doors.</h2><p>Contacts are power.<br/>Donors are a different agreement.</p></div><div className="vb-contact-list" aria-label="Contact files">{model.contacts.map((p, i) => <button type="button" key={p.id} aria-pressed={p.id === person.id} onClick={() => command("select", { target: `contact:${p.id}` })}><ContactPrint id={p.id} small/><span><small>FILE {String(i + 1).padStart(2, "0")}</small><strong>{p.name}</strong><Badge tone={contactState(p).tone}>{contactState(p).label}</Badge></span></button>)}</div></div>
    <article className="vb-person-detail"><div className="nb-person-head"><div className="nb-photo"><ContactPrint id={person.id}/><span>{person.factionId === "first_estate" ? "FIRST ESTATE" : person.factionId === "gutter_crown" ? "GUTTER CROWN" : "INDEPENDENT HOUSE"}</span></div><div><TapeLabel>PERSONAL FILE / DO NOT COPY</TapeLabel><span className="vb-eyebrow">{person.role}</span><h2>{person.name}</h2><Badge tone={state.tone}>{state.label}</Badge><p className="nb-quote">“{person.greeting}”</p></div></div>
      <div className="vb-statline"><Metric label="Trust" value={person.trust}/><Metric label="You owe" value={money(person.debt)}/><Metric label="Jobs done" value={person.jobs}/></div>
      <div className="nb-file-columns"><div><h3>What they offer</h3><p>{person.benefits}</p></div><div><h3>{person.suspended ? "Repair the agreement" : !person.available ? "First, earn an introduction" : person.met ? "Keep your word" : "Make the introduction"}</h3>{person.suspended ? <p className="vb-warning">{person.reason || "Complete work or arrange compensation in person."}</p> : !person.available ? <Requirements items={person.requirements}/> : <p>{person.met ? "Negotiate work, debts and services face to face. This file records the relationship; it doesn't make the deal." : `Meet ${person.name} at the marked street frontage. Press E to talk.`}</p>}</div></div>
      <div className="nb-address"><Icon name="city"/><span>{districtName(model, person.destination?.districtId || person.districtId)}<small>Services are negotiated in person.</small></span></div><Locations command={command} target={`contact:${person.id}`}/>
      {(donors.length > 0 || assets.length > 0) && <section className="nb-linked-files"><h3>What this relationship connects to</h3>{donors.map(d => <button type="button" key={d.id} onClick={() => command("tab", { tab: "feeding", target: `donor:${d.id}` })}><Icon name="blood"/><span><strong>{d.name} · donor agreement</strong><small>{d.status}. Personal consent, not a hunting permit.</small></span><Icon/></button>)}{assets.map(a => <button type="button" key={a.id} onClick={() => command("tab", { tab: "ledger", target: `asset:${a.id}` })}><Icon name="brief"/><span><strong>{a.name}</strong><small>{a.requirement}</small></span><Icon/></button>)}</section>}
    </article>
  </section>;
}
function Feeding({ model, snapshot, selection, command }) {
  const summary = bookSummary(model), selected = useRef(null);
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" }); }, [selection]);
  const donors = [...model.herd].sort((a, b) => Number(b.ready) - Number(a.ready));
  return <section className="vb-section nb-feeding"><ChapterHeading number="04" title="Blood. Without the noise." stamp="PERSONAL & CONFIDENTIAL">Carried supplies, consenting donors, then the streets. Three different arrangements.</ChapterHeading>
    <div className="nb-pocket-card"><div><span className="vb-eyebrow">01 / ALREADY ON YOU</span><h3>{model.bags ? `${model.bags} ${model.bags === 1 ? "bag" : "bags"} in your pocket.` : "Nothing in your pocket."}</h3><p>One bag relieves {RULES.bagRelief} hunger. No hunt required.</p></div><div className="nb-bag-rack" aria-hidden="true">{Array.from({length:RULES.carryCapacity},(_,i)=><span key={i} data-full={i<model.bags}><Icon name="blood"/></span>)}</div><div><Button primary icon="blood" disabled={!model.bags || model.hunger <= 0 || snapshot.frenzy} onClick={() => command("blood")}>Use carried blood</Button><small>{!model.bags ? "No bag carried. Arrange a supply below." : model.hunger <= 0 ? "You are not hungry." : "Closes the book; consumes one bag in play."}</small></div></div>
    <div className="nb-subheading"><div><span className="vb-eyebrow">02 / YOUR HERD</span><h3>People, not hunting grounds.</h3><p>{summary.ready.length} ready now. Consent belongs to the person, not the district.</p></div><span className="nb-stamp subtle">ASK. DON'T TAKE.</span></div>
    <div className="nb-donor-grid">{donors.map(person => <article key={person.id} ref={selection === `donor:${person.id}` ? selected : null} className="nb-donor-card" data-selected={selection === `donor:${person.id}`}><div className="nb-donor-head"><span className="nb-donor-initial" aria-hidden="true">{person.name.charAt(0)}</span><div><span className="vb-eyebrow">{districtName(model, person.districtId)}</span><h3>{person.name}</h3><Badge tone={person.ready ? "good" : person.refused || person.dead ? "danger" : "neutral"}>{person.status}</Badge></div></div><dl className="vb-facts"><div><dt>Personal consent</dt><dd>{person.permitted ? "Agreement active" : "No active agreement"}</dd></div><div><dt>Donation</dt><dd>−{person.relief} hunger</dd></div></dl><p>{person.reason || `Ask for a donation in person. Recovery takes ${RULES.donorRecovery / 60} minutes of active play.`}</p><div className="nb-patron"><small>Introduced through</small><button type="button" onClick={() => command("tab", { tab: "network", target: `contact:${person.contactId}` })}>{person.patron} <span>↗ Open file</span></button></div>{person.dead ? <p className="vb-warning">This donor is no longer available.</p> : person.permitted ? <><Locations command={command} target={`donor:${person.id}`}/>{!person.ready && <small>Visiting does not bypass recovery or refusal.</small>}</> : <div className="vb-actions"><Button primary onClick={() => command("tab", { tab: "network", target: `contact:${person.contactId}` })}>Arrange access</Button><Button onClick={() => command("locate", { target: `donor:${person.id}` })}>Locate</Button></div>}</article>)}</div>
    <div className="nb-supply-note"><div><span className="vb-eyebrow">STORED SUPPLY</span><h3>{summary.stored.length ? "Blood waiting to be collected." : "Build a supply of your own."}</h3><p>Business reserves are not carried blood. Collect them on site.</p></div>{summary.stored.map(asset => <div className="nb-supply-pickup" key={asset.id}><strong>{asset.name} · {asset.reserve} bags</strong><Button onClick={() => command("locate", { target: `asset:${asset.id}` })}>Locate reserve</Button></div>)}<Button onClick={() => command("tab", { tab: "ledger" })}>Open supply ledger</Button></div>
    <div className="nb-hunting-note"><Icon name="city"/><div><span className="vb-eyebrow">03 / HUNTING THE STREETS</span><h3>A permit is not consent.</h3><p>{summary.permitted} of {model.districts.length} districts grant you a general hunting permit. Protected prey, witnesses and personal consent still have separate rules.</p></div><Button onClick={() => command("tab", { tab: "city", target: summary.district ? `district:${summary.district.id}` : null })}>Check hunting rights</Button></div>
    <details className="nb-fine-print"><summary>Use blood to mend your body</summary><p>Mending restores 30 vitality and adds 12 hunger. It does not consume a bag.</p><Button disabled={model.vitality >= 100 || snapshot.frenzy || snapshot.exhausted} onClick={() => command("mend")}>Mend · return to play</Button></details>
  </section>;
}
function Power({ model, command }) {
  const completed = model.requirements.filter(r => r.met).length;
  return <section className="vb-power"><div className="nb-power-heading"><NightSeal/><div><span className="vb-eyebrow">FROM SURVIVAL TO SOVEREIGNTY</span><h3>{model.stage}</h3><p>Power is a network of people who need you.</p></div></div><div className="vb-power-path">{["Survivor", "Connected", "Investor", "Power broker", "Prince of the city"].map(stage => <span key={stage} data-current={model.stage === stage}>{stage}</span>)}</div><div className="nb-file-columns"><article><h4>Your next move</h4><p>{model.next.text}</p><p>{model.next.why}</p><Button onClick={() => command("tab", recommendationFile(model.next.target))}>Open relevant file</Button></article><article><h4>The city compact</h4><p>{completed} of {model.requirements.length} requirements met</p><Meter value={completed} max={model.requirements.length || 1} label="City compact requirements"/><Requirements items={model.requirements}/><Button onClick={() => command("tab", { tab: "network", target: "contact:sire" })}>Read the Sire's file</Button></article></div></section>;
}
function Ledger({ model, snapshot, selection, command }) {
  const [powerOpen, setPowerOpen] = useState(snapshot.chapterFocus === "power"), selected = useRef(null);
  useEffect(() => { if (snapshot.chapterFocus === "power") setPowerOpen(true); }, [snapshot.chapterFocus]);
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" }); }, [selection]);
  return <section className="vb-section nb-ledger"><ChapterHeading number="05" title="Everything has a price." stamp="ACCOUNTS / PRIVATE">What you own. What it earns. Who you still owe.</ChapterHeading><div className="nb-accounts"><Metric label="Cash on hand" value={money(model.cash)}/><Metric label="Income / cycle" value={money(model.income)}/><Metric label="Outstanding debt" value={money(model.debt)}/><span>One cycle = {RULES.businessPeriod}s of active play.<br/>Suspended agreements produce nothing.</span></div>
    {model.contacts.some(p=>p.debt>0) && <div className="nb-debts"><h3>People you owe</h3>{model.contacts.filter(p=>p.debt>0).map(p=><button type="button" key={p.id} onClick={()=>command("tab",{tab:"network",target:`contact:${p.id}`})}><span>{p.name}</span><strong>{money(p.debt)}</strong><span>Open file ↗</span></button>)}</div>}
    <div className="nb-subheading"><div><span className="vb-eyebrow">BUSINESS INTERESTS</span><h3>Make the city work for you.</h3></div></div>
    <div className="nb-receipt-grid">{model.assets.map((asset,i) => <article key={asset.id} ref={selection === `asset:${asset.id}` ? selected : null} className="nb-receipt" data-selected={selection === `asset:${asset.id}`}><div className="nb-receipt-number">ACCOUNT 0{i+1}<span>{asset.suspended ? "SUSPENDED" : ["NOT OWNED", "INVESTOR", "CONTROLLED"][asset.level]}</span></div><span className="vb-eyebrow">{districtName(model, asset.districtId)}</span><h3>{asset.name}</h3><p>{asset.description}</p><dl><div><dt>Income / cycle</dt><dd>{money(asset.income)}</dd></div><div><dt>Blood / cycle</dt><dd>{asset.production} bags</dd></div><div><dt>Stored on site</dt><dd>{asset.reserve} / 12 bags</dd></div></dl><p className="nb-receipt-rule">{asset.requirement}</p><button type="button" className="nb-operator" onClick={() => command("tab", { tab: "network", target: `contact:${asset.contactId}` })}><small>YOUR OPERATOR</small><strong>{asset.operator} ↗</strong></button><Locations command={command} target={`asset:${asset.id}`}/><small>Policy: {asset.policy}. Changes are agreed in person.</small></article>)}</div>
    <details className="nb-compact" open={powerOpen} onToggle={event => setPowerOpen(event.currentTarget.open)}><summary><span><small>THE LONG GAME</small><strong>Your claim on the city</strong></span><span>{model.stage} <b aria-hidden="true">+</b></span></summary><Power model={model} command={command}/></details>
    {model.notices.length>0 && <details className="nb-fine-print"><summary>Recent agreements</summary><div className="vb-history">{model.notices.map((n,i)=><p key={i}>{n.text}</p>)}</div></details>}
  </section>;
}
export function Domain({ snapshot, geometry, command }) {
  const model = snapshot.domain;
  if (!model) return <Empty title="Your network is not ready">The campaign has not supplied a domain snapshot.</Empty>;
  const summary = bookSummary(model);
  return <Tabs.Root className="vb-domain nb-book" value={snapshot.tab} onValueChange={tab => command("tab", { tab })} orientation="horizontal">
    <div className="vb-domain-rail"><div className="nb-cover"><NightSeal/><span className="vb-eyebrow">VICEBLOOD / PRIVATE EDITION</span><strong>The<br/>Black Book<span>.</span></strong><small>Keep your friends close.<br/>Keep this closer.</small></div>
      <Tabs.List className="vb-domain-nav" aria-label="Black Book chapters">{BOOK_CHAPTERS.map((chapter,i)=><Tabs.Trigger className="vb-domain-tab" key={chapter.id} value={chapter.id} aria-label={chapter.label}><span className="nb-tab-number">0{i+1}</span><span><strong>{chapter.label}</strong><small>{chapter.question}</small></span><kbd>{i+1}</kbd></Tabs.Trigger>)}</Tabs.List>
      <div className="vb-rail-foot"><span className="vb-eyebrow">YOUR STANDING</span><strong>{model.stage}</strong><small>WORLD PAUSED / NO TIME LOST</small><Button icon="close" onClick={()=>command("close")}>Return to the streets</Button></div>
    </div>
    <div className="vb-domain-main"><div className="vb-domain-summary"><span><Icon name="city"/>{summary.district?.name || "The city"}</span><span className="nb-book-objective"><small>TRACKED</small>{model.guide?.label || "No destination selected"}</span><span>{money(model.cash)} <small>CASH</small></span></div>{snapshot.feedback && <p className="vb-feedback" role="status">{snapshot.feedback}</p>}
      <Tabs.Content value="tonight" className="vb-tab-panel scroll"><Tonight model={model} snapshot={snapshot} command={command}/></Tabs.Content>
      <Tabs.Content value="city" className="vb-tab-panel"><City model={model} geometry={geometry} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="network" className="vb-tab-panel scroll"><Network model={model} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="feeding" className="vb-tab-panel scroll"><Feeding model={model} snapshot={snapshot} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="ledger" className="vb-tab-panel scroll"><Ledger model={model} snapshot={snapshot} selection={snapshot.selection} command={command}/></Tabs.Content>
      <footer className="nb-book-footer"><span><b>Go here</b> sets your arrow & returns to play. <b>Locate</b> only inspects the map.</span><span><kbd>1–5</kbd> chapters <kbd>Esc</kbd> close</span></footer>
    </div>
  </Tabs.Root>;
}
