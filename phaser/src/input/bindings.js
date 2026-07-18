export const INPUT_BINDING_STORAGE_KEY = "nbd-input-bindings-v1";

export const DEFAULT_INPUT_BINDINGS = Object.freeze({
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  w: "W",
  a: "A",
  s: "S",
  d: "D",
  quiet: "SHIFT",
  interact: "E",
  dash: "Q",
  whisper: "R",
  sense: "F",
  confirm: "ENTER",
  cancel: "ESC",
  traverse: "SPACE",
  debugStreet: "ONE",
  debugRoofLow: "TWO",
  debugRoofHigh: "THREE",
  debugSewer: "FOUR",
  menuFive: "FIVE",
  menuSix: "SIX",
  menuSeven: "SEVEN",
  menuEight: "EIGHT",
  menuNine: "NINE"
});

export const REMAPPABLE_INPUT_ACTIONS = Object.freeze([
  "w",
  "a",
  "s",
  "d",
  "quiet",
  "interact",
  "dash",
  "whisper",
  "sense",
  "confirm",
  "cancel",
  "traverse"
]);

const SAFE_CODE = /^[A-Z][A-Z0-9_]*$/;

export function normalizeBindingCode(value, fallback = "") {
  const code = String(value || "").trim().toUpperCase();
  if (!code || !SAFE_CODE.test(code)) return String(fallback || "").trim().toUpperCase();
  return code;
}

export function normalizeInputBindings(candidate = {}, defaults = DEFAULT_INPUT_BINDINGS) {
  const result = {};
  for (const [action, fallback] of Object.entries(defaults)) {
    result[action] = normalizeBindingCode(candidate?.[action], fallback);
  }
  return result;
}

export function loadInputBindings(storage = globalThis?.localStorage, defaults = DEFAULT_INPUT_BINDINGS) {
  if (!storage?.getItem) return normalizeInputBindings({}, defaults);
  try {
    const raw = storage.getItem(INPUT_BINDING_STORAGE_KEY);
    if (!raw) return normalizeInputBindings({}, defaults);
    const parsed = JSON.parse(raw);
    return normalizeInputBindings(parsed, defaults);
  } catch {
    return normalizeInputBindings({}, defaults);
  }
}

export function saveInputBindings(bindings, storage = globalThis?.localStorage, defaults = DEFAULT_INPUT_BINDINGS) {
  const normalized = normalizeInputBindings(bindings, defaults);
  if (!storage?.setItem) return normalized;
  try {
    storage.setItem(INPUT_BINDING_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The runtime can still use the supplied bindings for the current page.
  }
  return normalized;
}

export function resetInputBindings(storage = globalThis?.localStorage, defaults = DEFAULT_INPUT_BINDINGS) {
  if (storage?.removeItem) {
    try {
      storage.removeItem(INPUT_BINDING_STORAGE_KEY);
    } catch {
      // Returning defaults is enough when storage is unavailable.
    }
  }
  return normalizeInputBindings({}, defaults);
}

export function bindingConflicts(bindings, actions = REMAPPABLE_INPUT_ACTIONS) {
  const normalized = normalizeInputBindings(bindings);
  const byCode = new Map();
  for (const action of actions) {
    const code = normalized[action];
    if (!code) continue;
    const list = byCode.get(code) || [];
    list.push(action);
    byCode.set(code, list);
  }
  return [...byCode.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([code, owners]) => ({ code, actions: [...owners] }));
}

export function bindingLabel(code) {
  const value = normalizeBindingCode(code);
  const labels = {
    UP: "↑",
    DOWN: "↓",
    LEFT: "←",
    RIGHT: "→",
    SHIFT: "Shift",
    SPACE: "Space",
    ENTER: "Enter",
    ESC: "Esc"
  };
  if (labels[value]) return labels[value];
  if (/^(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)$/.test(value)) {
    return String(["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"].indexOf(value) + 1);
  }
  return value.length === 1 ? value : value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
