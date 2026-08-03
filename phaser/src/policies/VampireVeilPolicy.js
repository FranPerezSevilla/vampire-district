import { ExposureSystem } from "../systems/ExposureSystem.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";
import { WitnessSystem } from "../systems/WitnessSystem.js";

const MENTAL_DISCIPLINE_SOURCE = /^whisper(?::|_|$)/i;
const MENTAL_DISCIPLINE_LABEL = /whisper|vampiric command|compulsion/i;

function isMentalDiscipline({ sourceEvent = "", source = "", label = "" } = {}) {
  return MENTAL_DISCIPLINE_SOURCE.test(String(sourceEvent || source || ""))
    || MENTAL_DISCIPLINE_LABEL.test(String(label || ""));
}

export function installVampireVeilPolicy() {
  if (!WitnessSystem.prototype.__nbdVampireVeilPolicy) {
    const originalSuspiciousPower = WitnessSystem.prototype.onSuspiciousPower;
    WitnessSystem.prototype.onSuspiciousPower = function veilAwareSuspiciousPower(label, severity, radius, options = {}) {
      if (isMentalDiscipline({ label, sourceEvent: options.sourceEvent })) {
        return { witnesses: 0, witnessIds: [], evidenceId: null, institutionalObservers: 0 };
      }
      return originalSuspiciousPower.call(this, label, severity, radius, options);
    };
    Object.defineProperty(WitnessSystem.prototype, "__nbdVampireVeilPolicy", { value: true });
  }

  if (!ExposureSystem.prototype.__nbdVampireVeilPolicy) {
    const originalVisiblePowerUse = ExposureSystem.prototype.registerVisiblePowerUse;
    ExposureSystem.prototype.registerVisiblePowerUse = function veilAwareVisiblePowerUse(payload = {}) {
      if (isMentalDiscipline({ label: payload.label, sourceEvent: payload.sourceEvent })) return null;
      return originalVisiblePowerUse.call(this, payload);
    };
    Object.defineProperty(ExposureSystem.prototype, "__nbdVampireVeilPolicy", { value: true });
  }

  if (!PoliceSystem.prototype.__nbdVampireVeilPolicy) {
    const originalAddHeat = PoliceSystem.prototype.addHeat;
    PoliceSystem.prototype.addHeat = function veilAwareAddHeat(x, y, amount, reason, options = {}) {
      if (isMentalDiscipline({ label: reason, source: options.source })) return 0;
      return originalAddHeat.call(this, x, y, amount, reason, options);
    };
    Object.defineProperty(PoliceSystem.prototype, "__nbdVampireVeilPolicy", { value: true });
  }
}
