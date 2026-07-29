function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function joined(values, fallback = "None") {
  const items = (Array.isArray(values) ? values : []).filter(Boolean);
  return items.length ? items.join(", ") : fallback;
}

function metric(value, label, tone = "") {
  return `<div class="ledger-metric${tone ? ` ${tone}` : ""}"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></div>`;
}

function factionCard(faction) {
  const rights = faction.activeRightsCount
    ? faction.activeRights.map(right => right.districtName).join(", ")
    : "No active hunting rights";
  return `
    <article class="ledger-faction-card ${escapeHtml(faction.id)}" data-ledger-faction="${escapeHtml(faction.id)}">
      <header class="ledger-faction-header">
        <div>
          <p class="ledger-card-kicker">${escapeHtml(faction.identity || "major faction")}</p>
          <h4>${escapeHtml(faction.name)}</h4>
        </div>
        <span class="ledger-tier">${escapeHtml(faction.reputation.tierLabel)}</span>
      </header>
      <p class="ledger-doctrine">${escapeHtml(faction.doctrine)}</p>
      <div class="ledger-reputation" aria-label="${escapeHtml(faction.name)} reputation ${escapeHtml(faction.reputation.value)}">
        <strong>${escapeHtml(faction.reputation.value)}</strong>
        <div class="ledger-reputation-track" aria-hidden="true"><span style="width:${faction.reputation.percent.toFixed(1)}%"></span></div>
      </div>
      <div class="ledger-metrics">
        ${metric(faction.controlledDistrictCount, "Districts")}
        ${metric(faction.activeRightsCount, "Rights")}
        ${metric(faction.latentViolationCount, "Hidden", faction.latentViolationCount ? "warning" : "")}
        ${metric(faction.knownViolationCount, "Known", faction.knownViolationCount ? "danger" : "")}
      </div>
      <p class="ledger-territory-list"><strong>Controls:</strong> ${escapeHtml(joined(faction.controlledDistrictNames, "No controlled districts"))}</p>
      <p class="ledger-rights-list"><strong>Hunting rights:</strong> ${escapeHtml(rights)}</p>
    </article>
  `;
}

function pressureBar(label, value, percent) {
  return `
    <div class="ledger-exposure">
      <div class="ledger-exposure-copy"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
      <div class="ledger-exposure-track" aria-hidden="true"><span style="width:${Number(percent || 0).toFixed(1)}%"></span></div>
    </div>
  `;
}

function policeCard(police, severity) {
  return `
    <article class="ledger-police-card ${escapeHtml(severity)}" data-ledger-police-state="${escapeHtml(police.stateLabel)}">
      <header class="ledger-police-header">
        <div>
          <p class="ledger-card-kicker">POLICE / HEAT</p>
          <h3>${escapeHtml(police.stateLabel)}</h3>
        </div>
        <span class="ledger-police-level">LEVEL ${escapeHtml(police.level)}</span>
      </header>
      ${pressureBar("Heat", `${Math.round(police.heatValue)}/${Math.round(police.heatMax)}`, police.heatPercent)}
      <p class="ledger-police-reason">${escapeHtml(police.lastReason)}</p>
      <div class="ledger-police-metrics">
        ${metric(police.footOfficers, "Foot police")}
        ${metric(police.chasingOfficers, "Chasing", police.chasingOfficers ? "danger" : "")}
        ${metric(`${police.motorizedUnits}/${police.desiredMotorizedUnits}`, "Cruisers", police.motorizedUnits ? "warning" : "")}
        ${metric(police.fleeingWitnesses, "Witnesses", police.fleeingWitnesses ? "warning" : "")}
        ${metric(police.witnessReports, "Reports", police.witnessReports ? "danger" : "")}
      </div>
      <p class="ledger-police-note"><strong>Hot zone:</strong> ${escapeHtml(police.hottestZoneName)} · heat ${escapeHtml(police.hottestZoneHeat)}<br>
      <strong>Why police care:</strong> ordinary crimes, direct sightings and completed reports.</p>
    </article>
  `;
}

function evidenceRows(exposure) {
  if (!exposure.records?.length) return `<div class="ledger-empty">No active supernatural evidence.</div>`;
  return `<ul class="ledger-incident-list ledger-evidence-list">${exposure.records.map(record => `
    <li class="ledger-incident ${record.state === "institutional" ? "danger" : record.state === "reported" ? "warning" : "stable"}" data-ledger-evidence="${escapeHtml(record.kind)}">
      <div><strong>${escapeHtml(record.label)}</strong><p>${escapeHtml(record.districtName)} · weight ${escapeHtml(record.weight)}</p></div>
      <em>${escapeHtml(record.state.toUpperCase())}</em>
    </li>
  `).join("")}</ul>`;
}

function exposureCard(exposure) {
  const tone = exposure.level >= 3 ? "danger" : exposure.value > 0 || exposure.latentCount > 0 ? "warning" : "stable";
  return `
    <article class="ledger-police-card ledger-exposure-card ${tone}" data-ledger-exposure-level="${escapeHtml(exposure.level)}">
      <header class="ledger-police-header">
        <div>
          <p class="ledger-card-kicker">VEIL / EVIDENCE</p>
          <h3>EXPOSURE ${escapeHtml(exposure.level)}</h3>
        </div>
        <span class="ledger-police-level">${Math.round(exposure.percent)}%</span>
      </header>
      ${pressureBar("Known proof", `${Math.round(exposure.value)}/${Math.round(exposure.max)}`, exposure.percent)}
      <p class="ledger-police-reason">${escapeHtml(exposure.lastReason)}</p>
      <div class="ledger-police-metrics">
        ${metric(exposure.knownCount, "Known", exposure.knownCount ? "danger" : "")}
        ${metric(exposure.latentCount, "Latent", exposure.latentCount ? "warning" : "")}
        ${metric(exposure.institutionalCount, "Institutional", exposure.institutionalCount ? "danger" : "")}
        ${metric(exposure.bodiesHidden, "Bodies hidden")}
        ${metric(exposure.bloodEvidence, "Blood traces")}
      </div>
      ${evidenceRows(exposure)}
      <p class="ledger-police-note"><strong>Other pressure:</strong> ${escapeHtml(exposure.hunterSummary)}</p>
    </article>
  `;
}

function incidentList(incidents) {
  if (!incidents?.length) return `<div class="ledger-empty">No recent incidents. The night is quiet—for now.</div>`;
  return `<ul class="ledger-incident-list">${incidents.map(incident => `
    <li class="ledger-incident ${escapeHtml(incident.severity)}" data-ledger-incident="${escapeHtml(incident.kind)}">
      <div><strong>${escapeHtml(incident.title)}</strong><p>${escapeHtml(incident.detail)} · ${escapeHtml(incident.timeLabel)}</p></div>
      <em>${escapeHtml(incident.status)}</em>
    </li>
  `).join("")}</ul>`;
}

export function renderNightLedgerMarkup(model) {
  if (!model?.ready) return `<div class="ledger-empty">Night Ledger data is still loading.</div>`;
  const district = model.currentDistrict;
  const districtAuthority = district?.ownerLabel || (district?.status ? district.status.toUpperCase() : "UNCLAIMED");
  const relationship = district?.ownerLabel ? district.relationship : district?.status || "neutral";
  const houseText = model.independentHouses.contactCount
    ? `${model.independentHouses.contactCount} independent contact${model.independentHouses.contactCount === 1 ? "" : "s"} tracked`
    : "No independent House contacts registered yet";
  return `
    <div class="ledger-status-strip ${escapeHtml(model.severity)}">
      <div class="ledger-status-item"><small>Current territory</small><strong>${escapeHtml(district?.name || "Unknown district")}</strong><span>${escapeHtml(districtAuthority)} · ${escapeHtml(relationship)}</span></div>
      <div class="ledger-status-item ledger-pressure"><small>Police / Heat</small><strong>${escapeHtml(model.police.stateLabel)}</strong><span>${Math.round(model.police.heatValue)}/${Math.round(model.police.heatMax)} local Heat</span></div>
      <div class="ledger-status-item"><small>Veil / Exposure</small><strong>LEVEL ${escapeHtml(model.exposure.level)}</strong><span>${escapeHtml(model.exposure.knownCount)} known · ${escapeHtml(model.exposure.latentCount)} latent evidence</span></div>
      <div class="ledger-status-item"><small>Political violations</small><strong>${escapeHtml(model.knownViolationCount + model.latentViolationCount)}</strong><span>${escapeHtml(model.knownViolationCount)} known · ${escapeHtml(model.latentViolationCount)} hidden</span></div>
    </div>

    <section class="ledger-section" aria-labelledby="ledger-factions-heading">
      <header class="ledger-section-heading"><div><p>RELATIONSHIPS</p><h3 id="ledger-factions-heading">Factions</h3></div><span>Reputation, territory and hunting law</span></header>
      <div class="ledger-faction-grid">${model.factions.map(factionCard).join("")}</div>
      <div class="ledger-houses"><strong>Independent Houses</strong><span>${escapeHtml(houseText)}</span></div>
    </section>

    <section class="ledger-section" aria-labelledby="ledger-pressure-heading">
      <header class="ledger-section-heading"><div><p>CITY RESPONSE</p><h3 id="ledger-pressure-heading">Heat, evidence & incidents</h3></div><span>Game pauses while the ledger is open</span></header>
      <div class="ledger-lower-grid">
        ${policeCard(model.police, model.police.level >= 2 ? "danger" : model.police.level >= 1 ? "warning" : "stable")}
        ${exposureCard(model.exposure)}
        <article class="ledger-incidents-card">
          <p class="ledger-card-kicker">RECENT INCIDENTS</p>
          ${incidentList(model.incidents)}
        </article>
      </div>
    </section>
  `;
}
