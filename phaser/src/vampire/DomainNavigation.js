export const DOMAIN_TABS = Object.freeze(["Tonight", "City", "Network", "Feeding", "Ledger"]);
const aliases = Object.freeze({ overview: "tonight", errand: "tonight", map: "city", contacts: "network", herd: "feeding", resources: "ledger", power: "ledger" });
export function domainTab(value) {
  const key = String(value || "").toLowerCase();
  return aliases[key] || (DOMAIN_TABS.some(tab => tab.toLowerCase() === key) ? key : "tonight");
}

// Presentation selection only. Existing gameplay callers keep their legacy
// section names; five player-facing chapters do not add a persistence owner.
export class DomainNavigation {
  constructor(runtime) {
    this.runtime = runtime;
    this.tab = "tonight";
    this.focus = null;
    this.selection = null;
    this.revision = 0;
    this.feedback = "";
  }
  invalidate() { this.revision++; }
  show(tab = "tonight", target = null) {
    this.tab = domainTab(tab);
    this.focus = tab === "power" ? "power" : null;
    if (target) this.selection = target;
    this.feedback = "";
    this.invalidate();
  }
  navigate(tab, target = null) {
    this.show(tab, target);
    const interaction = this.runtime.scene.interactionSystem;
    if (interaction?.menu?.view === "vampire-domain") {
      interaction.menu.index = DOMAIN_TABS.findIndex(label => label.toLowerCase() === this.tab);
      interaction.publish();
    }
  }
  destroy() {}
}
