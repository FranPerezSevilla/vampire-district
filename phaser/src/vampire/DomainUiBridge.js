const DOMAIN_VIEW = "vampire-domain";

function isDomainMenu(menu) {
  if (!menu) return false;
  if (menu.view === DOMAIN_VIEW) return true;
  if (String(menu.title || "").toLowerCase().includes("vampire domain")) return true;
  return Boolean(menu.options?.length && menu.options.every(option => String(option?.id || "").startsWith("domain:")));
}

function fallbackMarkup(menu) {
  const rows = (menu?.options || []).map((option, index) => {
    const selected = index === Number(menu?.index || 0) ? " aria-current=\"true\"" : "";
    return `<button type="button" data-domain-index="${index}"${selected}>${index + 1} · ${String(option?.label || "Section")}</button>`;
  }).join("");
  return `<header class="domain-header"><div><small>VICEBLOOD · YOUR DOMAIN</small><h2>DOMAIN</h2></div></header>
    <nav class="domain-tabs" aria-label="Domain sections">${rows}</nav>
    <div class="domain-content"><article class="domain-next"><small>DOMAIN</small><h3>Your vampire network</h3><p>Select Overview, Contacts, Herd, Resources, Errand or Map. The city is paused while DOMAIN is open.</p></article></div>
    <footer>1–6 sections · 7/Esc return · World paused</footer>`;
}

function applyDomainSurface(node) {
  node.classList.add("vampire-domain-surface");
  Object.assign(node.style, {
    display: "flex",
    position: "absolute",
    inset: "16px",
    left: "16px",
    top: "16px",
    width: "auto",
    maxHeight: "none",
    transform: "none",
    padding: "0",
    overflow: "hidden",
    zIndex: "39",
    pointerEvents: "auto",
    flexDirection: "column",
    background: "#0c111b",
    border: "1px solid #44534e",
    borderTop: "2px solid var(--accent)"
  });
}

function clearDomainSurface(node) {
  node.classList.remove("vampire-domain-surface");
  for (const property of ["display", "position", "inset", "left", "top", "width", "max-height", "transform", "padding", "overflow", "z-index", "pointer-events", "flex-direction", "background", "border", "border-top"]) {
    node.style.removeProperty(property);
  }
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
    const panel = runtime?.domain;
    const liveMenu = gameScene?.interactionSystem?.menu || menu;
    let markup = "";
    try {
      if (panel) {
        panel.render({ ...liveMenu, view: DOMAIN_VIEW, index: Number(menu?.index ?? liveMenu?.index ?? 0) }, false);
        markup = panel.root?.innerHTML || "";
      }
    } catch (error) {
      console.error("ViceBlood DOMAIN bridge render failed", error);
    }

    node.classList.add("open");
    applyDomainSurface(node);
    const nextMarkup = markup || fallbackMarkup(menu);
    if (this.lastInteractionMarkup !== nextMarkup || node.innerHTML !== nextMarkup) {
      node.innerHTML = nextMarkup;
      this.lastInteractionMarkup = nextMarkup;
    }

    if (!node.__vicebloodDomainPointerBridge) {
      node.__vicebloodDomainPointerBridge = true;
      node.addEventListener("pointerdown", event => {
        const currentGame = this.scene?.get?.("GameScene");
        const currentPanel = currentGame?.vampireRuntime?.domain;
        const indexNode = event.target?.closest?.("[data-domain-index]");
        if (indexNode && currentGame?.interactionSystem?.menu) {
          event.preventDefault();
          const index = Number(indexNode.dataset.domainIndex);
          const option = currentGame.interactionSystem.menu.options?.[index];
          if (option) currentGame.interactionSystem.runOption(option);
          return;
        }
        if (event.target?.closest?.("[data-action]")) {
          event.preventDefault();
          currentPanel?.click?.(event);
        }
      });
    }
  };

  Object.defineProperty(proto, "__vicebloodDomainUiBridge", { value: true, configurable: true });
}

export { isDomainMenu };
