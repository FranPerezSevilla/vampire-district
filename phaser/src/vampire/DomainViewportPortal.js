const DOMAIN_VIEW = "vampire-domain";

function isDomainMenu(menu) {
  if (!menu) return false;
  if (menu.view === DOMAIN_VIEW) return true;
  if (String(menu.title || "").toLowerCase().includes("vampire domain")) return true;
  return Boolean(menu.options?.length && menu.options.every(option => String(option?.id || "").startsWith("domain:")));
}

function portal(node, documentRef = globalThis.document) {
  if (!node || !documentRef?.body) return;
  if (!node.__vicebloodDomainPortalParent) {
    node.__vicebloodDomainPortalParent = node.parentNode || null;
    node.__vicebloodDomainPortalNext = node.nextSibling || null;
  }
  if (node.parentNode !== documentRef.body) documentRef.body.appendChild(node);
  node.classList.add("vampire-domain-viewport");
  Object.assign(node.style, {
    position: "fixed",
    inset: "clamp(8px, 1.2vw, 18px)",
    left: "clamp(8px, 1.2vw, 18px)",
    top: "clamp(8px, 1.2vw, 18px)",
    right: "clamp(8px, 1.2vw, 18px)",
    bottom: "clamp(8px, 1.2vw, 18px)",
    width: "auto",
    height: "auto",
    maxWidth: "none",
    maxHeight: "none",
    transform: "none",
    transformOrigin: "center",
    zIndex: "2147482000",
    overflow: "hidden",
    pointerEvents: "auto"
  });
}

function restore(node) {
  if (!node) return;
  node.classList.remove("vampire-domain-viewport");
  for (const property of [
    "position", "inset", "left", "top", "right", "bottom", "width", "height",
    "max-width", "max-height", "transform", "transform-origin", "z-index", "overflow", "pointer-events"
  ]) node.style.removeProperty(property);

  const parent = node.__vicebloodDomainPortalParent;
  const next = node.__vicebloodDomainPortalNext;
  if (parent && node.parentNode !== parent) {
    if (next?.parentNode === parent) parent.insertBefore(node, next);
    else parent.appendChild(node);
  }
  node.__vicebloodDomainPortalParent = null;
  node.__vicebloodDomainPortalNext = null;
}

export function installDomainViewportPortal(UIScene) {
  const proto = UIScene?.prototype;
  if (!proto || proto.__vicebloodDomainViewportPortal) return;
  const original = proto.renderInteractionMenu;
  if (typeof original !== "function") return;

  proto.renderInteractionMenu = function viewportAwareInteractionMenu(menu) {
    const node = this.dom?.interactionMenu;
    if (!isDomainMenu(menu)) restore(node);
    const result = original.call(this, menu);
    if (isDomainMenu(menu) && !this.modalBlocksInput?.()) portal(node, globalThis.document);
    else restore(node);
    return result;
  };

  Object.defineProperty(proto, "__vicebloodDomainViewportPortal", { value: true, configurable: true });
}

export { isDomainMenu as isDomainViewportMenu };
