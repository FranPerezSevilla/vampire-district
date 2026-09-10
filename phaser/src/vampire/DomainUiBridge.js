import { buildDomainModel } from "./VampireDomainModel.js";
import { CITY_WORLD, buildings, roads } from "../data/district.js";

const DOMAIN_VIEW = "vampire-domain";
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function isDomainMenu(menu) {
  if (!menu) return false;
  if (menu.view === DOMAIN_VIEW) return true;
  if (String(menu.title || "").toLowerCase().includes("vampire domain")) return true;
  return Boolean(menu.options?.length && menu.options.every(option => String(option?.id || "").startsWith("domain:")));
}

function installDomainStyles(documentRef = globalThis.document) {
  if (!documentRef || documentRef.getElementById("viceblood-domain-dashboard-style")) return;
  const style = documentRef.createElement("style");
  style.id = "viceblood-domain-dashboard-style";
  style.textContent = `
    .vampire-domain-surface{box-sizing:border-box!important;container-type:size;}
    .vampire-domain-surface *{box-sizing:border-box;}
    .vampire-domain-surface .vd-shell{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:#0b1018;color:#edf4ef;}
    .vd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:clamp(9px,1.2vw,16px) clamp(10px,1.5vw,20px);border-bottom:1px solid #29363b;}
    .vd-head small,.vd-kicker{font-size:10px;letter-spacing:.15em;color:#93aaa3;text-transform:uppercase;}
    .vd-head h2{margin:2px 0 0;font-size:clamp(17px,2vw,25px);}
    .vd-tabs{display:flex;gap:6px;padding:8px clamp(8px,1.5vw,20px);overflow-x:auto;border-bottom:1px solid #29363b;scrollbar-width:thin;}
    .vd-tabs button,.vd-button{border:1px solid #40534e;background:#172422;color:#dceae4;padding:7px 10px;cursor:pointer;font:inherit;white-space:nowrap;}
    .vd-tabs button[aria-current=true]{background:#29463c;border-color:#81b79c;color:#fff;}
    .vd-main{flex:1;min-height:0;overflow:auto;padding:clamp(8px,1.3vw,18px);}
    .vd-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(240px,.72fr);gap:clamp(10px,1.3vw,18px);min-height:100%;}
    .vd-map-card,.vd-detail,.vd-card{background:#111b23;border:1px solid #2c3c43;min-width:0;}
    .vd-map-card{display:flex;flex-direction:column;padding:10px;min-height:0;}
    .vd-map{width:100%;height:100%;min-height:280px;max-height:68vh;background:#071019;border:1px solid #304149;cursor:pointer;}
    .vd-zone{cursor:pointer;transition:filter .12s ease,opacity .12s ease;stroke:#091118;stroke-width:14;}
    .vd-zone:hover{filter:brightness(1.22);}
    .vd-zone.open{fill:#285b45;}.vd-zone.known{fill:#705d2f;}.vd-zone.closed{fill:#4a2931;}.vd-zone.selected{stroke:#fff1b5;stroke-width:18;}
    .vd-zone-label{fill:#edf4ef;font:bold 70px Arial,sans-serif;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:#071019;stroke-width:9;stroke-linejoin:round;}
    .vd-road{fill:#33434c;pointer-events:none}.vd-building{fill:#111820;stroke:#43515b;stroke-width:3;pointer-events:none;}
    .vd-point.contact{fill:#f0c583}.vd-point.herd{fill:#9cdfb0}.vd-point.asset{fill:#aebdf3}.vd-point.player{fill:#fff}.vd-point{stroke:#071019;stroke-width:8;pointer-events:none;}
    .vd-detail{padding:clamp(12px,1.4vw,18px);overflow:auto;}
    .vd-detail h3,.vd-card h3{margin:4px 0 8px;font-size:clamp(16px,1.5vw,20px);}.vd-detail p,.vd-card p{color:#bac9c5;margin:7px 0 11px;}
    .vd-status{display:inline-block;padding:4px 7px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border:1px solid currentColor;}
    .vd-status.open{color:#9ee1b8}.vd-status.known{color:#e6c879}.vd-status.closed{color:#e69a9f;}
    .vd-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:8px;margin-bottom:12px;}
    .vd-stat{background:#111b23;border:1px solid #2c3c43;padding:10px;}.vd-stat strong{display:block;font-size:clamp(17px,2vw,24px)}.vd-stat small{color:#92a8a3;}
    .vd-list{display:grid;gap:8px;margin:12px 0}.vd-list-item{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;background:#0c151c;border-left:3px solid #43595a}.vd-list-item small{color:#8fa6a1;}
    .vd-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.vd-card{padding:14px}.vd-card.good{border-left:3px solid #68a984}.vd-card.warn{border-left:3px solid #c4a75d}.vd-card.bad{border-left:3px solid #a95d68;}
    .vd-errand{max-width:880px;margin:0 auto}.vd-step{display:grid;grid-template-columns:34px 1fr;gap:12px;padding:13px;margin:9px 0;background:#0c151c;border:1px solid #33434a}.vd-step>span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:1px solid #71857f}.vd-step.current{border-color:#d4bd72}.vd-step.done{border-color:#5d9c77;opacity:.8}.vd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.vd-button.primary{background:#2b4c40;border-color:#85ba9f;color:#fff}.vd-button.danger{border-color:#9d5560;color:#f0a6ac;background:#28161b;}
    .vd-legend{display:flex;gap:12px;flex-wrap:wrap;margin:8px 2px 0;color:#9eb0ac;font-size:10px}.vd-legend b{font-weight:800}.vd-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}.vd-dot.open{background:#285b45}.vd-dot.known{background:#705d2f}.vd-dot.closed{background:#4a2931}.vd-dot.contact{background:#f0c583}.vd-dot.herd{background:#9cdfb0}.vd-dot.asset{background:#aebdf3;}
    .vd-foot{padding:7px 12px;border-top:1px solid #29363b;color:#829691;font-size:10px;}
    @container (max-width:760px){.vd-layout{grid-template-columns:1fr}.vd-map{min-height:240px;max-height:48vh}.vd-stat-grid{grid-template-columns:repeat(2,1fr)}.vd-detail{overflow:visible}.vd-main{padding:6px}.vd-head{padding:8px 10px}.vd-tabs{padding:6px 8px}.vd-tabs button{padding:6px 8px;font-size:11px}}
    @container (max-height:560px){.vd-head{padding-block:6px}.vd-head h2{font-size:17px}.vd-tabs{padding-block:5px}.vd-main{padding:6px}.vd-map{min-height:220px;max-height:none}.vd-foot{display:none}.vd-detail{font-size:11px}.vd-detail p{margin:4px 0 7px}}
  `;
  documentRef.head.appendChild(style);
}

function inside(zone, point) {
  return Boolean(point && point.x >= zone.x && point.x <= zone.x + zone.w && point.y >= zone.y && point.y <= zone.y + zone.h);
}

function zoneSummary(zone, model) {
  const contacts = model.contacts.filter(item => inside(zone, item.destination));
  const herd = model.herd.filter(item => inside(zone, item.destination));
  const assets = model.assets.filter(item => inside(zone, item.destination));
  const known = contacts.filter(item => item.met);
  const trusted = known.filter(item => item.trust >= 15 && !item.suspended);
  const standing = zone.permitted || trusted.length ? "open" : known.length ? "known" : "closed";
  const label = zone.permitted ? "WELCOME · HUNTING PERMITTED" : trusted.length ? "CONNECTED · NO HUNTING RIGHT" : known.length ? "KNOWN · NO HUNTING RIGHT" : "UNSECURED · NO HUNTING RIGHT";
  return { ...zone, contacts, herd, assets, known, trusted, standing, label };
}

function mapMarkup(model, selectedId) {
  const zones = model.districts.map(zone => zoneSummary(zone, model));
  const selected = zones.find(zone => zone.id === selectedId) || zones.find(zone => inside(zone, model.player)) || zones[0];
  const zoneSvg = zones.map(zone => `<g data-domain-district="${esc(zone.id)}"><rect class="vd-zone ${zone.standing}${zone.id === selected?.id ? " selected" : ""}" x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="22"/><text class="vd-zone-label" x="${zone.x + zone.w / 2}" y="${zone.y + Math.min(120, zone.h / 2)}">${esc(zone.name)}</text></g>`).join("");
  const roadSvg = roads.map(road => `<rect class="vd-road" x="${road.x}" y="${road.y}" width="${road.w}" height="${road.h}"/>`).join("");
  const buildingSvg = buildings.map(item => `<rect class="vd-building" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}"/>`).join("");
  const points = [
    ...model.contacts.filter(item => item.destination && (item.met || item.available)).map(item => ({ ...item.destination, kind: "contact" })),
    ...model.herd.filter(item => item.destination && item.permitted).map(item => ({ ...item.destination, kind: "herd" })),
    ...model.assets.filter(item => item.destination && item.level > 0).map(item => ({ ...item.destination, kind: "asset" }))
  ];
  const pointSvg = points.map(point => `<circle class="vd-point ${point.kind}" cx="${point.x}" cy="${point.y}" r="34"><title>${esc(point.label)}</title></circle>`).join("");
  const detail = selected ? zoneDetail(selected, model) : "";
  return { selectedId: selected?.id || "", markup: `<div class="vd-layout"><section class="vd-map-card"><svg class="vd-map" viewBox="0 0 ${CITY_WORLD.width} ${CITY_WORLD.height}" role="img" aria-label="ViceBlood city influence map"><rect width="${CITY_WORLD.width}" height="${CITY_WORLD.height}" fill="#071019"/>${zoneSvg}${roadSvg}${buildingSvg}${pointSvg}<circle class="vd-point player" cx="${model.player.x}" cy="${model.player.y}" r="38"><title>You are here</title></circle></svg><div class="vd-legend"><span><i class="vd-dot open"></i>welcomed / permitted</span><span><i class="vd-dot known"></i>known</span><span><i class="vd-dot closed"></i>unsecured</span><span><i class="vd-dot contact"></i>contact</span><span><i class="vd-dot herd"></i>herd</span><span><i class="vd-dot asset"></i>asset</span></div></section><aside class="vd-detail">${detail}</aside></div>` };
}

function zoneDetail(zone, model) {
  const list = (items, empty, formatter) => items.length ? `<div class="vd-list">${items.map(formatter).join("")}</div>` : `<p>${empty}</p>`;
  const here = inside(zone, model.player);
  return `<span class="vd-status ${zone.standing}">${esc(zone.label)}</span><h3>${esc(zone.name)}${here ? " · YOU ARE HERE" : ""}</h3>
    <p><strong>Hunting:</strong> ${zone.permitted ? "General civilian hunting is permitted here." : "You do not currently have a general hunting right here."}</p>
    <div class="vd-stat-grid"><div class="vd-stat"><strong>${zone.known.length}</strong><small>known contacts</small></div><div class="vd-stat"><strong>${zone.herd.filter(item => item.permitted).length}</strong><small>herd access</small></div><div class="vd-stat"><strong>${zone.assets.filter(item => item.level > 0).length}</strong><small>assets</small></div><div class="vd-stat"><strong>${zone.trusted.length}</strong><small>trusted locals</small></div></div>
    <span class="vd-kicker">Contacts here</span>${list(zone.contacts, "No network contact is currently mapped to this district.", item => `<div class="vd-list-item"><span><strong>${esc(item.name)}</strong><br><small>${esc(item.role)}</small></span><span>Trust ${item.trust}</span></div>`)}
    <span class="vd-kicker">Assets & herd</span>${list([...zone.assets.filter(item => item.level > 0), ...zone.herd.filter(item => item.permitted)], "No controlled asset or permitted donor here yet.", item => `<div class="vd-list-item"><span><strong>${esc(item.name)}</strong><br><small>${esc(item.description || item.status || "Network resource")}</small></span></div>`)}
    ${model.errand && inside(zone, model.errand.current?.destination) ? `<div class="vd-card warn"><span class="vd-kicker">Current errand</span><h3>${esc(model.errand.current.title)}</h3><p>${esc(model.errand.current.description)}</p><div class="vd-actions"><button class="vd-button primary" data-domain-objective="delivery">Set as objective · show HUD arrow</button></div></div>` : ""}`;
}

function stats(model) {
  return `<div class="vd-stat-grid"><div class="vd-stat"><strong>$${model.cash}</strong><small>cash</small></div><div class="vd-stat"><strong>${model.bags}/4</strong><small>blood carried</small></div><div class="vd-stat"><strong>$${model.income}</strong><small>income / cycle</small></div><div class="vd-stat"><strong>$${model.debt}</strong><small>debt</small></div></div>`;
}

function errandMarkup(model) {
  const e = model.errand;
  if (!e) return `<div class="vd-errand">${stats(model)}<div class="vd-card"><span class="vd-kicker">Current errand</span><h3>No active errand</h3><p>Visit a known contact and accept one job. You can only carry one errand at a time.</p></div></div>`;
  return `<div class="vd-errand">${stats(model)}<div class="vd-card warn"><span class="vd-kicker">Current errand · ${esc(e.issuer)}</span><h3>${esc(e.summary)}</h3><p>${esc(e.current.description)}</p><div class="vd-actions"><button class="vd-button primary" data-domain-objective="delivery">Set as objective · show HUD arrow</button></div></div>${e.steps.map((step,index)=>`<div class="vd-step ${step.state}"><span>${index+1}</span><div><small class="vd-kicker">${esc(step.state)}</small><h3>${esc(step.title)}</h3><p>${esc(step.description)}</p></div></div>`).join("")}<div class="vd-card"><h3>Reward</h3><p>$${e.reward} total · $${e.cash} cash · $${e.repaid} debt repaid · Trust +${e.trust}</p><div class="vd-actions"><button class="vd-button danger" data-domain-abandon>Abandon errand</button></div></div></div>`;
}

function contactsMarkup(model) {
  return `${stats(model)}<div class="vd-cards">${model.contacts.map(item => `<article class="vd-card ${item.suspended ? "bad" : item.met ? "good" : "warn"}"><span class="vd-kicker">${esc(item.status)}</span><h3>${esc(item.name)}</h3><p>${esc(item.role)}</p><p>${esc(item.benefits)}</p><p>Trust <strong>${item.trust}</strong> · Debt <strong>$${item.debt}</strong></p></article>`).join("")}</div>`;
}

function herdMarkup(model) {
  return `${stats(model)}<div class="vd-cards">${model.herd.map(item => `<article class="vd-card ${item.ready ? "good" : item.permitted ? "warn" : "bad"}"><span class="vd-kicker">${esc(item.status)}</span><h3>${esc(item.name)}</h3><p>Patron: ${esc(item.patron)} · Hunger −${item.relief}</p><p>${esc(item.reason || "Donation available now.")}</p></article>`).join("")}</div>`;
}

function resourcesMarkup(model) {
  return `${stats(model)}<div class="vd-cards">${model.assets.map(item => `<article class="vd-card ${item.level > 0 && !item.suspended ? "good" : item.suspended ? "bad" : "warn"}"><span class="vd-kicker">${item.suspended ? "Suspended" : ["Not owned","Investor","Controlled"][item.level]}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p>Income <strong>$${item.income}</strong> · Blood <strong>${item.production}</strong>/cycle · Stored <strong>${item.reserve}/12</strong></p><p>${esc(item.requirement)}</p></article>`).join("")}</div>`;
}

function fallbackMarkup(menu) {
  const rows = (menu?.options || []).map((option, index) => `<button type="button" data-domain-index="${index}"${index === Number(menu?.index || 0) ? " aria-current=\"true\"" : ""}>${index + 1} · ${esc(option?.label || "Section")}</button>`).join("");
  return `<div class="vd-shell"><header class="vd-head"><div><small>VICEBLOOD · YOUR DOMAIN</small><h2>DOMAIN</h2></div></header><nav class="vd-tabs">${rows}</nav><main class="vd-main"><div class="vd-card"><h3>Domain data unavailable</h3><p>The city dashboard could not read the current vampire state.</p></div></main></div>`;
}

function dashboardMarkup(runtime, menu, selectedDistrict) {
  const model = buildDomainModel(runtime);
  const index = Number(menu?.index || 0);
  const labels = ["City", "Contacts", "Herd", "Resources", "Errand", "Map"];
  const tabs = labels.map((label, i) => `<button type="button" data-domain-index="${i}" aria-current="${i === index}">${i + 1} · ${label}</button>`).join("");
  let body = "";
  let districtId = selectedDistrict;
  if (index === 0 || index === 5) {
    const map = mapMarkup(model, selectedDistrict);
    body = index === 0 ? `${stats(model)}${map.markup}` : map.markup;
    districtId = map.selectedId;
  } else if (index === 1) body = contactsMarkup(model);
  else if (index === 2) body = herdMarkup(model);
  else if (index === 3) body = resourcesMarkup(model);
  else if (index === 4) body = errandMarkup(model);
  return { districtId, markup: `<div class="vd-shell"><header class="vd-head"><div><small>VICEBLOOD · CITY POWER</small><h2>${esc(model.stage)} · ${esc(labels[index] || "City")}</h2></div><button class="vd-button" data-domain-close>Return to city · Esc</button></header><nav class="vd-tabs" aria-label="Domain sections">${tabs}</nav><main class="vd-main">${body}</main><footer class="vd-foot">Click a district for status · “Set as objective” activates the HUD arrow · 1–6 switch sections · Esc returns</footer></div>` };
}

function applyDomainSurface(node) {
  installDomainStyles(node.ownerDocument);
  node.classList.add("vampire-domain-surface");
  Object.assign(node.style, {
    display: "flex", position: "absolute", inset: "clamp(4px, 1.2vw, 16px)", left: "clamp(4px, 1.2vw, 16px)", top: "clamp(4px, 1.2vw, 16px)",
    width: "auto", height: "auto", maxHeight: "none", transform: "none", padding: "0", overflow: "hidden", zIndex: "39", pointerEvents: "auto", flexDirection: "column",
    background: "#0c111b", border: "1px solid #44534e", borderTop: "2px solid var(--accent)"
  });
}

function clearDomainSurface(node) {
  node.classList.remove("vampire-domain-surface");
  for (const property of ["display","position","inset","left","top","width","height","max-height","transform","padding","overflow","z-index","pointer-events","flex-direction","background","border","border-top"]) node.style.removeProperty(property);
}

export function installDomainUiBridge(UIScene) {
  const proto = UIScene?.prototype;
  if (!proto || proto.__vicebloodDomainUiBridge) return;
  const original = proto.renderInteractionMenu;
  if (typeof original !== "function") return;

  proto.renderInteractionMenu = function renderDomainOnCanonicalUi(menu) {
    const node = this.dom?.interactionMenu;
    if (!node) return original.call(this, menu);
    if (!isDomainMenu(menu) || this.modalBlocksInput?.()) {
      clearDomainSurface(node);
      return original.call(this, menu);
    }

    const gameScene = this.scene?.get?.("GameScene");
    const runtime = gameScene?.vampireRuntime;
    node.classList.add("open");
    applyDomainSurface(node);
    let rendered;
    try { rendered = runtime ? dashboardMarkup(runtime, menu, this.__vicebloodDomainDistrict) : null; }
    catch (error) { console.error("ViceBlood DOMAIN dashboard render failed", error); }
    if (rendered?.districtId) this.__vicebloodDomainDistrict = rendered.districtId;
    const nextMarkup = rendered?.markup || fallbackMarkup(menu);
    if (this.lastInteractionMarkup !== nextMarkup || node.innerHTML !== nextMarkup) {
      node.innerHTML = nextMarkup;
      this.lastInteractionMarkup = nextMarkup;
    }

    if (!node.__vicebloodDomainPointerBridge) {
      node.__vicebloodDomainPointerBridge = true;
      node.addEventListener("pointerdown", event => {
        const currentGame = this.scene?.get?.("GameScene");
        const interaction = currentGame?.interactionSystem;
        const district = event.target?.closest?.("[data-domain-district]");
        if (district) {
          event.preventDefault();
          this.__vicebloodDomainDistrict = district.dataset.domainDistrict;
          this.lastInteractionMarkup = "";
          this.renderInteractionMenu(interaction?.snapshot?.() || interaction?.menu);
          return;
        }
        const indexNode = event.target?.closest?.("[data-domain-index]");
        if (indexNode && interaction?.menu) {
          event.preventDefault();
          const index = Number(indexNode.dataset.domainIndex);
          const option = interaction.menu.options?.[index];
          if (option) interaction.runOption(option);
          return;
        }
        const objective = event.target?.closest?.("[data-domain-objective]");
        if (objective) {
          event.preventDefault();
          currentGame?.vampireRuntime?.track?.(objective.dataset.domainObjective);
          interaction?.close?.("Objective set. Follow the HUD arrow.");
          return;
        }
        if (event.target?.closest?.("[data-domain-close]")) {
          event.preventDefault();
          interaction?.close?.("Back to the city.");
          return;
        }
        if (event.target?.closest?.("[data-domain-abandon]")) {
          event.preventDefault();
          const service = currentGame?.vampireRuntime?.service;
          if (service?.state?.job && globalThis.confirm?.("Abandon the current errand? You will lose the cargo and 10 trust.")) {
            currentGame.vampireRuntime.outcome(service.abandonDelivery());
            this.lastInteractionMarkup = "";
            this.renderInteractionMenu(interaction?.snapshot?.() || interaction?.menu);
          }
        }
      });
    }
  };

  Object.defineProperty(proto, "__vicebloodDomainUiBridge", { value: true, configurable: true });
}

export { isDomainMenu, zoneSummary };
