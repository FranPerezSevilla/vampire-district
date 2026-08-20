import {
  DEFAULT_INPUT_BINDINGS,
  bindingLabel,
  normalizeInputBindings
} from "../input/bindings.js";

function key(bindings, action) {
  return bindingLabel(bindings[action] || DEFAULT_INPUT_BINDINGS[action] || "");
}

export function buildControlReference(candidateBindings = {}) {
  const bindings = normalizeInputBindings(candidateBindings);
  const movement = `${key(bindings, "w")}/${key(bindings, "a")}/${key(bindings, "s")}/${key(bindings, "d")}`;
  const arrows = `${key(bindings, "up")}/${key(bindings, "left")}/${key(bindings, "down")}/${key(bindings, "right")}`;

  return [
    "ON FOOT",
    `${movement} or ${arrows}  Move`,
    `${key(bindings, "quiet")}  Quiet movement`,
    `${key(bindings, "interact")}  Interact / dialogue / evidence`,
    `${key(bindings, "traverse")}  Traverse available routes`,
    "",
    "COMBAT & FEEDING",
    "Mouse  Aim",
    "Left mouse  Use equipped weapon",
    "Hold right mouse  Feed / Drain",
    "Mouse wheel  Change weapon",
    "",
    "POWERS",
    `${key(bindings, "dash")}  Dash · ${key(bindings, "whisper")}  Whisper`,
    `${key(bindings, "sense")}  Blood Sense · ${key(bindings, "beast")}  Give In`,
    "",
    "DRIVING",
    `${key(bindings, "w")}/${key(bindings, "s")}  Accelerate / brake · ${key(bindings, "a")}/${key(bindings, "d")}  Steer`,
    `${key(bindings, "traverse")}  Handbrake · ${key(bindings, "confirm")}  Enter / exit vehicle`,
    `${key(bindings, "horn")}  Horn`,
    "",
    "MENUS",
    `${key(bindings, "cancel")}  Pause / back · M  Mission · L  Night Ledger`
  ].join("\n");
}
