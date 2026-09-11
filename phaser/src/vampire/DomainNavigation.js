export const DOMAIN_TABS = Object.freeze(["City", "Contacts", "Herd", "Resources", "Errand", "Power"]);
export function domainTab(value) {
  if (value === "overview" || value === "map") return "city";
  return DOMAIN_TABS.some(tab => tab.toLowerCase() === value) ? value : "city";
}

// Presentation selection only. InteractionSystem owns the open menu and pause;
// React owns its pixels. This object never creates, moves or renders DOM nodes.
export class DomainNavigation {
  constructor(runtime) {
    this.runtime = runtime;
    this.tab = "city";
    this.selection = null;
    this.revision = 0;
    this.feedback = "";
  }
  invalidate() { this.revision++; }
  show(tab = "city", target = null) {
    this.tab = domainTab(tab);
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
