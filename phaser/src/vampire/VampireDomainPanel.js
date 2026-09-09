import { buildings, roads, CITY_WORLD } from "../data/district.js";
import { buildDomainModel, clientToMapPoint, domainDestination, mapViewBox } from "./VampireDomainModel.js";

export const DOMAIN_TABS = Object.freeze(["Overview", "Contacts", "Herd", "Resources", "Errand", "Map"]);
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const button = (action, label, target = "", disabled = false) => `<button type="button" data-action="${action}" data-target="${escape(target)}"${disabled ? " disabled" : ""}>${escape(label)}</button>`;
const badge = (text, good = false) => `<span class="domain-badge${good ? " good" : ""}">${escape(text)}</span>`;
const locationButtons = target => `<div class="domain-actions">${button("map", "Show on map", target)}${button("track", "Track & return", target)}</div>`;
const rectangle = area => `<rect x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}"/>`;
// Static geometry is generated once from the same city data used by gameplay.
const MAP_STREETS = `<g class="domain-roads">${roads.map(rectangle).join("")}</g><g class="domain-buildings">${buildings.map(rectangle).join("")}</g>`;

export class VampireDomainPanel {
  constructor(runtime, document = globalThis.document) {
    this.runtime = runtime;
    this.tab = "overview";
    this.selection = "contact:sire";
    this.zoom = 1;
    this.revision = 0;
    this.confirmAbandon = false;
    const host = document?.getElementById?.("game-ui");
    if (!host) return;
    this.root = document.createElement("section");
    this.root.className = "vampire-domain";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Your vampire domain");
    this.root.addEventListener("click", event => this.click(event));
    host.append(this.root);
  }
  invalidate() { this.revision++; }
  show(tab = "overview", target = null) {
    this.tab = DOMAIN_TABS.some(value => value.toLowerCase() === tab) ? tab : "overview";
    if (target) { this.selection = target; this.zoom = Math.max(2, this.zoom); }
    else if (this.tab === "map") this.selection = this.runtime.service.state.guide;
    this.confirmAbandon = false;
    this.feedback = "";
    this.invalidate();
  }
  render(menu, blocked = false) {
    if (!this.root) return;
    const visible = menu?.view === "vampire-domain" && !blocked;
    const opening = visible && this.root.hidden;
    this.root.hidden = !visible;
    if (!visible) {
      if (this.root.contains(this.root.ownerDocument?.activeElement)) this.root.ownerDocument.activeElement.blur?.();
      return;
    }
    const key = `${this.revision}:${menu.index}`;
    if (!opening && this.renderedKey === key) return;
    const focused = this.root.ownerDocument?.activeElement;
    const focusAction = this.root.contains(focused) ? focused?.dataset?.action : null;
    const focusTarget = focused?.dataset?.target;
    this.renderedKey = key;
    this.model = buildDomainModel(this.runtime);
    const m = this.model;
    const tabs = DOMAIN_TABS.map((label, index) => `<button type="button" role="tab" aria-selected="${this.tab === label.toLowerCase()}" data-action="tab" data-target="${label.toLowerCase()}" class="${menu.index === index ? "key-selected" : ""}">${index + 1} · ${label}${label === "Errand" && m.errand ? " ●" : ""}</button>`).join("");
    this.root.innerHTML = `<header class="domain-header"><div><small>VICEBLOOD · YOUR DOMAIN</small><h2>${escape(m.stage)}</h2></div>${button("close", "Return to city · Esc")}</header>
      <nav class="domain-tabs" role="tablist" aria-label="Domain sections">${tabs}</nav>
      <div class="domain-content" role="tabpanel" aria-label="${escape(this.tab)}">${this.feedback ? `<p class="domain-feedback" role="status">${escape(this.feedback)}</p>` : ""}${this.content(m)}</div>
      <footer>1–6 sections · W/S or arrows then E · Enter activates focused button · 7/Esc return · World paused</footer>`;
    if (opening) this.root.querySelector('[aria-selected="true"]')?.focus?.({ preventScroll: true });
    else if (focusAction) [...this.root.querySelectorAll("[data-action]")].find(node => node.dataset.action === focusAction && node.dataset.target === focusTarget)?.focus?.({ preventScroll: true });
  }
  metrics(m) {
    return `<div class="domain-metrics">${[[`$${m.cash}`, "Cash"], [`${m.bags}/4`, "Carried blood"], [`${m.herd.filter(d => d.ready).length}/${m.herd.filter(d => d.permitted).length}`, "Herd ready / permitted"], [`$${m.income}`, "Income / 90s"], [`$${m.debt}`, "Debt"]].map(([value, label]) => `<div><strong>${escape(value)}</strong><small>${label}</small></div>`).join("")}</div>`;
  }
  content(m) {
    if (this.tab === "contacts") return `<h3>Build your network</h3><p>Introductions are earned through work and investment. Services are negotiated in person.</p><div class="domain-grid">${m.contacts.map(c => `<article>${badge(c.status, c.available && !c.suspended)}<h3>${escape(c.name)}</h3><p>${escape(c.role)}</p><p>${escape(c.benefits)}</p>${c.available ? `<p>Trust <strong>${c.trust}</strong> · Debt <strong>$${c.debt}</strong> · Deliveries ${c.jobs}</p>${c.suspended ? `<p class="domain-warning">${escape(c.reason)} Repair through a delivery or compensation.</p>` : ""}` : this.requirements(c.requirements)}${locationButtons(`contact:${c.id}`)}</article>`).join("")}</div>`;
    if (this.tab === "herd") return `<h3>Your permitted herd</h3><p>These people consent through an agreement with their patron. Donation access and district hunting permissions are separate.</p><div class="domain-grid">${m.herd.map(d => `<article>${badge(d.status, d.ready)}<h3>${escape(d.name)}</h3><p>Patron: ${escape(d.patron)} · Hunger −${d.relief}</p><p>${escape(d.reason || "Ready now. Meet in person and press E to request a donation. Recovery: four minutes of active play.")}</p>${!d.permitted && !d.dead ? `<p>Meet the patron and earn trust 15. Keep the agreement intact.</p>${button("map", "Find the patron", `contact:${d.contactId}`)}` : ""}${locationButtons(`donor:${d.id}`)}</article>`).join("")}</div><h3>Permitted hunting grounds</h3><p>Green districts on the map have an active general civilian hunting permission. Keep feeding discreet and victims alive; protected individuals have their own rules.</p><div class="domain-actions">${m.districts.filter(d => d.permitted).map(d => badge(d.name, true)).join("") || "No district permission yet. Negotiate with a known contact at trust 15."}${button("tab", "View hunting map", "map")}</div>`;
    if (this.tab === "resources") return `${this.metrics(m)}<p>Hunger ${m.hunger}/100 · Vitality ${m.vitality}/100. Reserves remain at each business until collected. Staff work every 90 seconds of active play.</p><div class="domain-actions">${button("blood", "Use carried blood", "", !m.bags || m.hunger <= 0)}${button("mend", "Mend: +30 Vitality / +12 Hunger", "", m.vitality >= 100 || !this.runtime.frenzy.allowsPowers())}</div><div class="domain-grid">${m.assets.map(a => `<article>${badge(a.suspended ? "Suspended" : ["Not owned", "Investor", "Controlled"][a.level], a.level > 0 && !a.suspended)}<h3>${escape(a.name)}</h3><p>${escape(a.description)}</p><p>Operator: ${escape(a.operator)}</p><p>Income <strong>$${a.income}</strong> · Blood <strong>${a.production}</strong> / cycle<br>Stored: <strong>${a.reserve}/12</strong> bags · Policy: ${escape(a.policy)}</p><p>${escape(a.requirement)}</p>${locationButtons(`asset:${a.id}`)}</article>`).join("")}</div>`;
    if (this.tab === "errand") return this.errand(m);
    if (this.tab === "map") return this.map(m);
    return `${this.metrics(m)}<article class="domain-next"><small>NEXT STEP</small><h3>${escape(m.next.text)}</h3><p>${escape(m.next.why)}</p>${locationButtons(m.next.target)}</article>
      <div class="domain-grid"><article><h3>${m.errand ? "Active errand" : "No active errand"}</h3><p>${escape(m.errand ? `${m.errand.issuer} · ${m.errand.summary}` : "Work earns money, trust and introductions. You can carry one errand at a time.")}</p>${button("tab", m.errand ? "Open errand instructions" : "View contacts", m.errand ? "errand" : "contacts")}</article><article><h3>Path to Prince</h3>${this.requirements(m.requirements)}${button("map", "Find the Sire", "contact:sire")}</article></div>
      <h3>Introductions and influence</h3><div class="domain-progression">${m.contacts.map(c => `<article>${badge(c.met ? "Contact secured" : c.available ? "Ready to meet" : "Locked", c.available)}<h4>${escape(c.name)}</h4><p>${escape(c.available ? c.benefits : c.requirements.filter(r => !r.met).map(r => r.text).join(" · "))}</p>${button("map", "Locate", `contact:${c.id}`)}</article>`).join("")}</div>
      <h3>Recent agreements</h3>${m.notices.map(n => `<p class="domain-log">${escape(n.text)}</p>`).join("") || "Your first agreement starts with the Sire."}`;
  }
  requirements(items) { return `<ul class="domain-requirements">${items.map(item => `<li class="${item.met ? "done" : ""}">${item.met ? "✓" : "○"} ${escape(item.text)}</li>`).join("")}</ul>`; }
  errand(m) {
    const e = m.errand;
    if (!e) return `<article class="domain-next"><h3>No active errand</h3><p>Visit a known contact and accept one delivery. You must finish or abandon it before taking another.</p>${locationButtons(m.next.target)}${button("tab", "Contacts and opportunities", "contacts")}</article>`;
    return `<div class="domain-section-title"><div><small>ONE ACTIVE ERRAND</small><h3>Supply delivery · ${escape(e.issuer)}</h3></div>${badge(e.cargo, e.collected)}</div>
      <ol class="domain-steps">${e.steps.map((step, index) => `<li class="${step.state}"><span>${index + 1}</span><div><small>${step.state.toUpperCase()}</small><h3>${step.title}</h3><p>${escape(step.description)}</p><p>${escape(m.direction(step.destination))}</p>${locationButtons(step.target)}</div></li>`).join("")}</ol>
      <article><h3>Agreement and reward</h3><p>Payment <strong>$${e.reward}</strong> = <strong>$${e.cash} cash</strong> + <strong>$${e.repaid} debt repaid</strong>. Trust +${e.trust}; a completed delivery repairs this operator's agreement.</p><p>Payment happens at the final handoff. Abandoning the errand or dying forfeits the cargo and costs 10 trust. No other errand can be accepted while this one is active.</p><div class="domain-actions">${button("track", "Track current objective & return", "delivery")}${button("map", "Current objective on map", "delivery")}${button("abandon", this.confirmAbandon ? "Confirm abandonment · lose 10 trust" : "Abandon this errand")}${this.confirmAbandon ? button("keep", "Keep the errand") : ""}</div></article>`;
  }
  map(m) {
    const points = [...m.contacts.map(c => ({ ...c.destination, status: c.status, detail: c.benefits, locked: !c.available })), ...m.herd.map(d => ({ ...d.destination, status: d.status, detail: d.reason || `Permitted donation: Hunger −${d.relief}`, locked: !d.permitted })), ...m.assets.map(a => ({ ...a.destination, status: a.suspended ? "Suspended" : ["Not owned", "Investor", "Controlled"][a.level], detail: `${a.description} ${a.requirement}`, locked: a.level === 0 || a.suspended }))];
    for (const marker of m.markers) {
      const source = points.find(point => point.target === marker.target);
      points.push({ ...marker.destination, status: source ? `Saved · ${source.status}` : "Saved marker", detail: source?.detail || "A saved destination. Tracking gives directions; it does not move you.", locked: source?.locked });
    }
    if (m.errand) points.push({ ...domainDestination(this.runtime, "delivery"), status: "Current errand objective", detail: m.errand.current.description });
    let selected = points.find(point => point.target === this.selection) || domainDestination(this.runtime, this.selection);
    if (this.selection === "player") selected = { ...m.player, target: "player", label: "Your position", kind: "player", status: "You are here", detail: "Select a destination or save this position as a waypoint." };
    if (!selected) selected = points[0];
    const district = m.districts.find(d => selected.x >= d.x && selected.x <= d.x + d.w && selected.y >= d.y && selected.y <= d.y + d.h);
    this.view = mapViewBox(selected || m.player, this.zoom);
    const view = this.view, size = 42 / this.zoom;
    const marker = (point, chosen = false) => `<g data-action="select" data-target="${escape(point.target)}" class="domain-map-point ${escape(point.kind)}${point.locked ? " locked" : ""}${chosen ? " selected" : ""}" aria-label="${escape(point.label)}"><title>${escape(point.label)} · ${escape(point.status || "Destination")}</title><circle class="hit" cx="${point.x}" cy="${point.y}" r="${size * 2}"/><circle cx="${point.x}" cy="${point.y}" r="${size}"/>${chosen ? `<circle class="selection-ring" cx="${point.x}" cy="${point.y}" r="${size * 1.7}"/>` : ""}</g>`;
    const zones = m.districts.map(d => `<g class="domain-zone${d.permitted ? " permitted" : ""}">${rectangle(d)}<text x="${d.x + d.w / 2}" y="${d.y + 100}">${escape(d.name)}</text></g>`).join("");
    const tracked = m.guide ? `<path class="domain-map-guide" d="M ${m.player.x} ${m.player.y} L ${m.guide.x} ${m.guide.y}"/><circle class="domain-map-destination" cx="${m.guide.x}" cy="${m.guide.y}" r="${size * 2.2}"/>` : "";
    return `<div class="domain-map-layout"><aside><small>SELECTED DESTINATION</small><h3>${escape(selected.label)}</h3>${badge(selected.status || "Destination")}<p>${escape(selected.detail || "Visit this location in the city.")}</p><p>${escape(m.direction(selected))}</p>${district ? `<p>${escape(district.name)}<br>${district.permitted ? "General hunting permission granted" : "No general hunting permission"}</p>` : ""}<div class="domain-actions">${selected.kind === "player" ? "" : button("track", "Track & return", selected.target)}${selected.kind === "marker" ? button("remove-marker", "Remove marker", selected.target) : button("save-marker", "Save marker", selected.target)}</div>
      <h4>Map locations</h4><div class="domain-map-locations">${points.map(point => `<button type="button" data-action="select" data-target="${escape(point.target)}" aria-pressed="${point.target === selected.target}"><span>${escape(point.label)}</span><small>${escape(point.status)}</small></button>`).join("")}</div></aside>
      <div><div class="domain-map-tools">${button("zoom-out", "− Zoom")}${button("zoom-in", "+ Zoom")}${button("city", "Whole city")}${button("player", "Locate me")}<span>${this.zoom}× · N ↑</span></div>
      <svg class="domain-city-map" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" role="img" aria-label="City map. Select a location or click empty space to save a waypoint."><rect class="domain-map-ground" width="${CITY_WORLD.width}" height="${CITY_WORLD.height}"/>${zones}${MAP_STREETS}${tracked}${points.map(p => marker(p)).join("")}${marker(selected, true)}<circle class="domain-map-player" cx="${m.player.x}" cy="${m.player.y}" r="${size}"/></svg>
      <p class="domain-map-legend">● Contacts · <span>● Herd</span> · <span class="resource">● Resources</span> · <span class="player">● You</span> · Grey: locked · Green areas: hunting permission</p><p>Click an empty map location to save a waypoint (${m.markers.length}/8). Zoom around the selected destination. The dashed line indicates a bearing, not a walkable route.</p></div></div>`;
  }
  click(event) {
    const node = event.target.closest?.("[data-action]");
    if (node?.dataset.action === "close") { this.runtime.scene.interactionSystem.close("Back to the city."); return; }
    if (!this.runtime.available()) return;
    const action = node?.dataset.action, target = node?.dataset.target;
    if (action === "tab") this.runtime.openDomain(target);
    else if (action === "map") this.runtime.openDomain("map", target);
    else if (action === "track") { this.runtime.track(target); this.runtime.scene.interactionSystem.close("Destination marked. Follow the HUD guide."); }
    else if (action === "select") { this.selection = target; }
    else if (action === "zoom-in") this.zoom = Math.min(4, this.zoom * 2);
    else if (action === "zoom-out") this.zoom = Math.max(1, this.zoom / 2);
    else if (action === "city") this.zoom = 1;
    else if (action === "player") { this.selection = "player"; this.zoom = 2; }
    else if (action === "save-marker") this.runtime.saveMarker(target);
    else if (action === "remove-marker") { this.runtime.outcome(this.runtime.service.removeMarker(target)); this.selection = this.runtime.service.state.guide; }
    else if (action === "blood") this.runtime.useBlood();
    else if (action === "mend") {
      if (this.runtime.mendBlood()) this.runtime.scene.interactionSystem.close("Blood mending completed.");
    }
    else if (action === "keep") this.confirmAbandon = false;
    else if (action === "abandon") {
      if (this.confirmAbandon) { this.runtime.outcome(this.runtime.service.abandonDelivery()); this.confirmAbandon = false; }
      else this.confirmAbandon = true;
    } else if (!node && this.tab === "map") {
      const svg = event.target.closest?.("svg.domain-city-map");
      if (svg) {
        const point = clientToMapPoint({ x: event.clientX, y: event.clientY }, svg.getBoundingClientRect(), this.view);
        if (point) { const result = this.runtime.saveMarker(null, point); if (result?.marker) this.selection = result.marker.id; }
      }
    }
    this.invalidate();
    this.render(this.runtime.scene.interactionSystem.menu);
  }
  destroy() { this.root?.remove?.(); }
}
