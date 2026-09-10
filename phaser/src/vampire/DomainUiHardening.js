import { DOMAIN_TABS, VampireDomainPanel } from "./VampireDomainPanel.js";

const proto = VampireDomainPanel.prototype;

if (!proto.__vicebloodDomainHardening) {
  const originalShow = proto.show;
  const originalRender = proto.render;

  function ensureRoot(panel) {
    if (panel.root) return panel.root;
    const document = globalThis.document;
    const host = document?.getElementById?.("game-ui");
    if (!host) return null;
    const root = document.createElement("section");
    root.className = "vampire-domain";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Your vampire domain");
    root.addEventListener("click", event => panel.click(event));
    host.append(root);
    panel.root = root;
    return root;
  }

  function shell(panel, message = "Loading domain…") {
    const tabs = DOMAIN_TABS.map((label, index) => {
      const active = panel.tab === label.toLowerCase();
      return `<button type="button" role="tab" aria-selected="${active}" data-action="tab" data-target="${label.toLowerCase()}">${index + 1} · ${label}</button>`;
    }).join("");
    return `<header class="domain-header"><div><small>VICEBLOOD · YOUR DOMAIN</small><h2>${panel.tab.toUpperCase()}</h2></div><button type="button" data-action="close">Return to city · Esc</button></header>
      <nav class="domain-tabs" role="tablist" aria-label="Domain sections">${tabs}</nav>
      <div class="domain-content" role="tabpanel"><article class="domain-next"><small>DOMAIN</small><h3>${message}</h3><p>The city is paused while this panel is open.</p></article></div>
      <footer>1–6 sections · 7/Esc return · World paused</footer>`;
  }

  proto.show = function hardenedShow(tab = "overview", target = null) {
    originalShow.call(this, tab, target);
    const root = ensureRoot(this);
    if (!root) return;
    root.style.zIndex = "38";
    root.hidden = false;
    root.innerHTML = shell(this);
  };

  proto.render = function hardenedRender(menu, blocked = false) {
    const root = ensureRoot(this);
    if (!root) return;
    try {
      originalRender.call(this, menu, blocked);
    } catch (error) {
      console.error("ViceBlood DOMAIN render failed", error);
      if (menu?.view !== "vampire-domain" || blocked) {
        root.hidden = true;
        return;
      }
      root.style.zIndex = "38";
      root.hidden = false;
      const detail = String(error?.message || error || "Unknown render error")
        .replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
      root.innerHTML = shell(this, `DOMAIN UI error · ${detail}`);
    }
  };

  Object.defineProperty(proto, "__vicebloodDomainHardening", {
    value: true,
    configurable: true
  });
}
