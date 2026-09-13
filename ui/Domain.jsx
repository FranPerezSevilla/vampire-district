import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { City } from "./CityMap.jsx";
import { Badge, Button, Empty, Icon, Locations, Meter, Metric, Requirements } from "./components.jsx";
import { ContactPrint, NightSeal, TapeLabel } from "./artwork.jsx";
import { BOOK_CHAPTERS, bookSummary, contactState, districtName, money, recommendationFile } from "./nightbook-model.js";
import { VAMPIRE_RULES as RULES } from "../phaser/src/vampire/VampireCatalog.js";

function ChapterHeading({ number, title, stamp }) {
  return <header className="nb-chapter-heading"><div><span className="vb-eyebrow">{number}</span><h2>{title}</h2></div>{stamp && <span className="nb-stamp">{stamp}</span>}</header>;
}
function Errand({ model, command, confirmation }) {
  const job = model.errand;
  if (!job) return <article className="nb-paper nb-task vb-errand">
    <TapeLabel>UNFINISHED BUSINESS</TapeLabel><span className="vb-eyebrow">No outstanding errand</span>
    <h3>{model.next.text}</h3><p className="nb-briefing">{model.next.why}</p>
    <Locations target={model.next.target} command={command}/>
    <div className="nb-task-foot"><Button onClick={() => command("tab", { tab: "network" })}>Contacts</Button></div>
  </article>;
  return <article className="nb-paper nb-task vb-errand">
    <TapeLabel>YOUR WORD</TapeLabel><span className="vb-eyebrow">FROM {job.issuer}</span>
    <h3>{job.current.title}</h3><p className="nb-briefing">{job.current.description}</p>
    <ol className="vb-errand-steps">{job.steps.map((step, i) => <li key={step.target} data-state={step.state}><span className="vb-step-number">{step.state === "done" ? "✓" : `0${i + 1}`}</span><span><small>{step.state === "current" ? "NEXT" : step.state === "done" ? "DONE" : "THEN"}</small><strong>{step.title}</strong></span></li>)}</ol>
    <div className="nb-payment"><Metric label="Your cut" value={money(job.cash)}/><Metric label="Trust" value={`+${job.trust}`}/>{job.repaid > 0 && <Metric label="Debt repaid" value={money(job.repaid)}/>}</div>
    <Locations command={command} target="delivery"/>
    <details className="nb-fine-print"><summary>The terms</summary><p>{job.cargo}. {money(job.reward)} total; {money(job.repaid)} against your debt, {money(job.cash)} in your pocket.</p><p>Finish this errand before taking another.</p></details>
    <div className="vb-abandon">{confirmation ? <div role="alert"><h4>Break your word?</h4><p>You lose the cargo, payment and your contact's trust. You cannot take it back.</p><div className="vb-actions"><Button danger onClick={() => command("confirm-abandon")}>Abandon errand</Button><Button primary onClick={() => command("cancel-confirm")}>Keep my word</Button></div></div> : <Button danger onClick={() => command("abandon")}>Abandon errand…</Button>}</div>
  </article>;
}
function Tonight({ model, snapshot, command }) {
  const summary = bookSummary(model);
  return <section className="vb-section nb-tonight">
    <ChapterHeading number="01" title="Tonight"/>
    <div className="nb-tonight-grid"><Errand model={model} command={command} confirmation={snapshot.confirmation}/>
      <aside className="nb-night-margin">
        <div className={`nb-condition ${model.hunger >= 85 ? "urgent" : ""}`}><div className="nb-condition-head"><Icon name="blood"/><span className="vb-eyebrow">THE BEAST</span></div><div className="nb-big-number">{model.hunger}<small>/ 100 hunger</small></div><Meter label="Tonight hunger" value={model.hunger} danger={model.hunger >= 85}/>{model.hunger >= 50 && <p>{model.hunger >= 85 ? "The Beast is close. At 100, you lose control." : "The hunger is growing."}</p>}<strong>{model.bags ? `${model.bags} ${model.bags === 1 ? "bag" : "bags"} on hand` : summary.ready.length ? `${summary.ready.length} donor ${summary.ready.length === 1 ? "is" : "are"} ready` : "No blood on hand. No donor ready."}</strong><Button icon="blood" onClick={() => command("tab", { tab: "feeding" })}>Find blood</Button></div>
        <div className="nb-incident-slip"><span className="vb-eyebrow">ON THE STREET</span><dl><div><dt>Police</dt><dd>{["Clear", "Searching", "Pursuit", "Air support"][snapshot.wanted] || "Unknown"}</dd></div><div><dt>The Veil</dt><dd>{snapshot.exposure.value}</dd></div></dl>{snapshot.capabilities?.incidentFile && <Button icon="eye" onClick={() => command("ledger")}>Incident file</Button>}</div>
      </aside>
    </div>
    <nav className="nb-essentials" aria-label="Tonight's essentials">
      <button type="button" onClick={() => command("tab", { tab: "city" })}><span className="nb-index">II</span><span><strong>City</strong><small>Hunting rights · {summary.permitted} / {model.districts.length} districts</small></span><Icon/></button>
      <button type="button" onClick={() => command("tab", { tab: "network" })}><span className="nb-index">III</span><span><strong>Contacts</strong><small>{summary.known} known{summary.suspended ? ` · ${summary.suspended} suspended` : ""}</small></span><Icon/></button>
      <button type="button" onClick={() => command("tab", { tab: "ledger" })}><span className="nb-index">V</span><span><strong>Accounts</strong><small>{summary.owned} business interests · {money(model.debt)} owed</small></span><Icon/></button>
    </nav>
  </section>;
}
function Network({ model, selection, command }) {
  const person = model.contacts.find(p => `contact:${p.id}` === selection) || model.contacts[0];
  if (!person) return <Empty title="No names yet"/>;
  const state = contactState(person), donors = model.herd.filter(p => p.contactId === person.id), assets = model.assets.filter(a => a.contactId === person.id);
  return <section className="nb-network">
    <div className="nb-file-index"><div className="nb-file-index-heading"><span className="vb-eyebrow">03</span><h2>Contacts</h2></div><div className="vb-contact-list" aria-label="Contact files">{model.contacts.map((p, i) => <button type="button" key={p.id} aria-pressed={p.id === person.id} onClick={() => command("select", { target: `contact:${p.id}` })}><ContactPrint id={p.id} small/><span><small>FILE {String(i + 1).padStart(2, "0")}</small><strong>{p.name}</strong><Badge tone={contactState(p).tone}>{contactState(p).label}</Badge></span></button>)}</div></div>
    <article className="vb-person-detail"><div className="nb-person-head"><div className="nb-photo"><ContactPrint id={person.id}/><span>{person.factionId === "first_estate" ? "FIRST ESTATE" : person.factionId === "gutter_crown" ? "GUTTER CROWN" : "INDEPENDENT HOUSE"}</span></div><div><TapeLabel>CONFIDENTIAL</TapeLabel><span className="vb-eyebrow">{person.role}</span><h2>{person.name}</h2><Badge tone={state.tone}>{state.label}</Badge><p className="nb-quote">“{person.greeting}”</p></div></div>
      <div className="vb-statline"><Metric label="Trust" value={person.trust}/><Metric label="You owe" value={money(person.debt)}/><Metric label="Errands done" value={person.jobs}/></div>
      <div className="nb-file-columns"><div><h3>Offers</h3><p>{person.benefits}</p></div><div><h3>{person.suspended ? "Make amends" : !person.available ? "An introduction" : person.met ? "Terms" : "First meeting"}</h3>{person.suspended ? <p className="vb-warning">{person.reason || "Settle it in person: work or compensation."}</p> : !person.available ? <Requirements items={person.requirements}/> : <p>{person.met ? "Work, debts and services. Face to face." : `Meet ${person.name} outside.`}</p>}</div></div>
      <div className="nb-address"><Icon name="city"/><span>{districtName(model, person.destination?.districtId || person.districtId)}</span></div><Locations command={command} target={`contact:${person.id}`}/>
      {(donors.length > 0 || assets.length > 0) && <section className="nb-linked-files"><h3>Connections</h3>{donors.map(d => <button type="button" key={d.id} onClick={() => command("tab", { tab: "feeding", target: `donor:${d.id}` })}><Icon name="blood"/><span><strong>{d.name} · donor</strong><small>{d.status}</small></span><Icon/></button>)}{assets.map(a => <button type="button" key={a.id} onClick={() => command("tab", { tab: "ledger", target: `asset:${a.id}` })}><Icon name="brief"/><span><strong>{a.name}</strong><small>{a.requirement}</small></span><Icon/></button>)}</section>}
    </article>
  </section>;
}
function Feeding({ model, snapshot, selection, command }) {
  const summary = bookSummary(model), selected = useRef(null);
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" }); }, [selection]);
  const donors = [...model.herd].sort((a, b) => Number(b.ready) - Number(a.ready));
  return <section className="vb-section nb-feeding"><ChapterHeading number="04" title="Blood"/>
    <div className="nb-pocket-card"><div><span className="vb-eyebrow">ON HAND</span><h3>{model.bags ? `${model.bags} ${model.bags === 1 ? "bag" : "bags"}` : "Empty pockets"}</h3><p>−{RULES.bagRelief} hunger per bag.</p></div><div className="nb-bag-rack" aria-hidden="true">{Array.from({length:RULES.carryCapacity},(_,i)=><span key={i} data-full={i<model.bags}><Icon name="blood"/></span>)}</div><div><Button primary icon="blood" disabled={!model.bags || model.hunger <= 0 || snapshot.frenzy} onClick={() => command("blood")}>Drink a bag</Button>{(!model.bags || model.hunger <= 0 || snapshot.frenzy) && <small>{snapshot.frenzy ? "The Beast has control." : !model.bags ? "No bags on hand." : "Not hungry."}</small>}</div></div>
    <div className="nb-subheading"><div><h3>Donors</h3><p>{summary.ready.length} ready · personal agreements</p></div></div>
    <div className="nb-donor-grid">{donors.map(person => <article key={person.id} ref={selection === `donor:${person.id}` ? selected : null} className="nb-donor-card" data-selected={selection === `donor:${person.id}`}><div className="nb-donor-head"><ContactPrint id={`donor:${person.id}`} small/><div><span className="vb-eyebrow">{districtName(model, person.districtId)}</span><h3>{person.name}</h3><Badge tone={person.ready ? "good" : person.refused || person.dead ? "danger" : "neutral"}>{person.status}</Badge></div></div><dl className="vb-facts"><div><dt>Consent</dt><dd>{person.permitted ? "Agreement active" : "No active agreement"}</dd></div><div><dt>Donation</dt><dd>−{person.relief} hunger</dd></div></dl><p>{person.reason || `Meet in person. Allow ${RULES.donorRecovery / 60} minutes between donations.`}</p><div className="nb-patron"><small>Introduced by</small><button type="button" onClick={() => command("tab", { tab: "network", target: `contact:${person.contactId}` })}>{person.patron} <span aria-hidden="true">↗</span></button></div>{person.dead ? <p className="vb-warning">Deceased.</p> : person.permitted ? <Locations command={command} target={`donor:${person.id}`}/> : <div className="vb-actions"><Button primary onClick={() => command("tab", { tab: "network", target: `contact:${person.contactId}` })}>Arrange an introduction</Button><Button onClick={() => command("locate", { target: `donor:${person.id}` })}>Locate</Button></div>}</article>)}</div>
    <div className="nb-supply-note"><div><span className="vb-eyebrow">RESERVES</span><h3>{summary.stored.length ? "Ready for collection" : "No blood in storage"}</h3><p>Collect reserves on site.</p></div>{summary.stored.map(asset => <div className="nb-supply-pickup" key={asset.id}><strong>{asset.name} · {asset.reserve} bags</strong><Button onClick={() => command("locate", { target: `asset:${asset.id}` })}>Locate</Button></div>)}<Button onClick={() => command("tab", { tab: "ledger" })}>Accounts</Button></div>
    <div className="nb-hunting-note"><Icon name="city"/><div><span className="vb-eyebrow">THE HUNT</span><h3>Hunting rights</h3><p>{summary.permitted} / {model.districts.length} districts. A permit is not consent. Protected prey remain off limits.</p></div><Button onClick={() => command("tab", { tab: "city", target: summary.district ? `district:${summary.district.id}` : null })}>Hunting map</Button></div>
    <details className="nb-fine-print"><summary>Mending</summary><p>+30 vitality, +12 hunger. No bag consumed.</p><Button disabled={model.vitality >= 100 || snapshot.frenzy || snapshot.exhausted} onClick={() => command("mend")}>Mend</Button></details>
  </section>;
}
function Power({ model, command }) {
  const completed = model.requirements.filter(r => r.met).length;
  return <section className="vb-power"><div className="nb-power-heading"><NightSeal/><div><span className="vb-eyebrow">STANDING</span><h3>{model.stage}</h3></div></div><div className="vb-power-path">{["Survivor", "Connected", "Investor", "Power broker", "Prince of the city"].map(stage => <span key={stage} data-current={model.stage === stage}>{stage}</span>)}</div><div className="nb-file-columns"><article><h4>Unfinished business</h4><p>{model.next.text}</p><p>{model.next.why}</p><Button onClick={() => command("tab", recommendationFile(model.next.target))}>Open file</Button></article><article><h4>The city compact</h4><p>{completed} / {model.requirements.length} conditions met</p><Meter value={completed} max={model.requirements.length || 1} label="City compact requirements"/><Requirements items={model.requirements}/><Button onClick={() => command("tab", { tab: "network", target: "contact:sire" })}>The Sire</Button></article></div></section>;
}
function Ledger({ model, snapshot, selection, command }) {
  const [powerOpen, setPowerOpen] = useState(snapshot.chapterFocus === "power"), selected = useRef(null);
  useEffect(() => { if (snapshot.chapterFocus === "power") setPowerOpen(true); }, [snapshot.chapterFocus]);
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" }); }, [selection]);
  return <section className="vb-section nb-ledger"><ChapterHeading number="05" title="Accounts"/><div className="nb-accounts"><Metric label="Cash" value={money(model.cash)}/><Metric label={`Income / ${RULES.businessPeriod}s`} value={money(model.income)}/><Metric label="Debt" value={money(model.debt)}/>{model.assets.some(a=>a.suspended) && <span>Suspended agreements earn nothing.</span>}</div>
    {model.contacts.some(p=>p.debt>0) && <div className="nb-debts"><h3>Debts</h3>{model.contacts.filter(p=>p.debt>0).map(p=><button type="button" key={p.id} onClick={()=>command("tab",{tab:"network",target:`contact:${p.id}`})}><span>{p.name}</span><strong>{money(p.debt)}</strong><span aria-hidden="true">↗</span></button>)}</div>}
    <div className="nb-subheading"><div><h3>Holdings</h3></div></div>
    <div className="nb-receipt-grid">{model.assets.map((asset,i) => <article key={asset.id} ref={selection === `asset:${asset.id}` ? selected : null} className="nb-receipt" data-selected={selection === `asset:${asset.id}`}><div className="nb-receipt-number">ACCOUNT 0{i+1}<span>{asset.suspended ? "SUSPENDED" : ["NOT OWNED", "INVESTOR", "CONTROLLED"][asset.level]}</span></div><span className="vb-eyebrow">{districtName(model, asset.districtId)}</span><h3>{asset.name}</h3><p>{asset.description}</p><dl><div><dt>Income / {RULES.businessPeriod}s</dt><dd>{money(asset.income)}</dd></div><div><dt>Blood / {RULES.businessPeriod}s</dt><dd>{asset.production} bags</dd></div><div><dt>Stored on site</dt><dd>{asset.reserve} / 12 bags</dd></div></dl><p className="nb-receipt-rule">{asset.requirement}</p><button type="button" className="nb-operator" onClick={() => command("tab", { tab: "network", target: `contact:${asset.contactId}` })}><small>OPERATOR</small><strong>{asset.operator} ↗</strong></button><Locations command={command} target={`asset:${asset.id}`}/><small>{asset.policy} · terms agreed in person</small></article>)}</div>
    <details className="nb-compact" open={powerOpen} onToggle={event => setPowerOpen(event.currentTarget.open)}><summary><span><small>THE LONG GAME</small><strong>Standing</strong></span><span>{model.stage} <b aria-hidden="true">+</b></span></summary><Power model={model} command={command}/></details>
    {model.notices.length>0 && <details className="nb-fine-print"><summary>Recent agreements</summary><div className="vb-history">{model.notices.map((n,i)=><p key={i}>{n.text}</p>)}</div></details>}
  </section>;
}
export function Domain({ snapshot, geometry, command }) {
  const model = snapshot.domain;
  if (!model) return <Empty title="The book is unavailable">Try opening it again.</Empty>;
  const summary = bookSummary(model);
  return <Tabs.Root className="vb-domain nb-book" value={snapshot.tab} onValueChange={tab => command("tab", { tab })} orientation="horizontal">
    <div className="vb-domain-rail"><div className="nb-cover"><NightSeal/><span className="vb-eyebrow">VICEBLOOD</span><strong>The<br/>Black Book<span>.</span></strong></div>
      <Tabs.List className="vb-domain-nav" aria-label="Black Book chapters">{BOOK_CHAPTERS.map((chapter,i)=><Tabs.Trigger className="vb-domain-tab" key={chapter.id} value={chapter.id} aria-label={chapter.label}><span className="nb-tab-number">0{i+1}</span><span><strong>{chapter.label}</strong></span><kbd>{i+1}</kbd></Tabs.Trigger>)}</Tabs.List>
      <div className="vb-rail-foot"><span className="vb-eyebrow">STANDING</span><strong>{model.stage}</strong><Button icon="close" onClick={()=>command("close")}>Back to the streets</Button></div>
    </div>
    <div className="vb-domain-main"><div className="vb-domain-summary"><span><Icon name="city"/>{summary.district?.name || "The city"}</span><span className="nb-book-objective">{model.guide?.label || "No destination"}</span><span>{money(model.cash)} <small>CASH</small></span></div>{snapshot.feedback && <p className="vb-feedback" role="status">{snapshot.feedback}</p>}
      <Tabs.Content value="tonight" className="vb-tab-panel scroll"><Tonight model={model} snapshot={snapshot} command={command}/></Tabs.Content>
      <Tabs.Content value="city" className="vb-tab-panel"><City model={model} geometry={geometry} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="network" className="vb-tab-panel scroll"><Network model={model} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="feeding" className="vb-tab-panel scroll"><Feeding model={model} snapshot={snapshot} selection={snapshot.selection} command={command}/></Tabs.Content>
      <Tabs.Content value="ledger" className="vb-tab-panel scroll"><Ledger model={model} snapshot={snapshot} selection={snapshot.selection} command={command}/></Tabs.Content>
      <footer className="nb-book-footer"><span><kbd>1–5</kbd> <kbd>Esc</kbd></span></footer>
    </div>
  </Tabs.Root>;
}
