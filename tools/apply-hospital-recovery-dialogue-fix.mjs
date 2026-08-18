import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(path, before, after) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

const dataPath = "phaser/src/data/death-recovery.js";
replaceExact(
  dataPath,
  `  interactionRadius: 34,\n  lackeyLine: "You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.",`,
  `  interactionRadius: 34,\n  hospitalSettleMs: 320,\n  lackeyDepartureMs: 1100,\n  lackeySpeaker: "LACKEY",\n  lackeyLine: "You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.",\n  lackeyExitOffset: Object.freeze({ x: 74, y: -8 }),`
);

const recoveryPath = "phaser/src/combat/DeathRecoverySystem.js";
replaceExact(
  recoveryPath,
  `    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = null;`,
  `    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = null;\n    this.hospitalRecoveryIntroComplete = false;\n    this.recoveryPresentationPromise = null;`
);
replaceExact(
  recoveryPath,
  `    this.recovered = false;\n    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = Number(this.scene.cameras?.main?.zoom) || null;`,
  `    this.recovered = false;\n    this.hospitalRecoveryIntroComplete = false;\n    this.recoveryPresentationPromise = null;\n    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = Number(this.scene.cameras?.main?.zoom) || null;`
);
replaceExact(
  recoveryPath,
  `      existing.x = x;\n      existing.y = y;\n      existing.container?.setPosition?.(x, y).setVisible?.(true);`,
  `      existing.x = x;\n      existing.y = y;\n      existing.container?.setPosition?.(x, y).setAlpha?.(1).setVisible?.(true);`
);
replaceExact(
  recoveryPath,
  `    this.lackey = lackey;\n    return lackey;\n  }\n\n  placeBloodBag(spawn) {`,
  `    this.lackey = lackey;\n    return lackey;\n  }\n\n  lockRecoveryControls() {\n    const director = this.scene.tutorialDirector;\n    director?.setTip?.("", "");\n    director?.hideDialogue?.();\n    director?.setControlMode?.("locked");\n    if (director?.freezeWorld) {\n      director.freezeWorld(true);\n    } else {\n      this.scene.taskRevealCinematic ||= { active: false, queued: null, initialPlayed: true };\n      this.scene.taskRevealCinematic.active = true;\n      this.scene.registry?.set?.("taskRevealActive", true);\n    }\n    this.scene.inputSystem?.setControlMode?.("locked");\n    this.scene.inputSystem?.resetWorldEdges?.();\n  }\n\n  releaseRecoveryControls() {\n    const director = this.scene.tutorialDirector;\n    director?.hideDialogue?.();\n    director?.freezeWorld?.(false);\n    director?.setControlMode?.("full");\n    if (this.scene.taskRevealCinematic) this.scene.taskRevealCinematic.active = false;\n    this.scene.registry?.set?.("taskRevealActive", false);\n    this.scene.inputSystem?.setWorldEnabled?.(true);\n    this.scene.inputSystem?.setControlMode?.("full");\n    this.scene.inputSystem?.resetWorldEdges?.();\n    this.scene.game?.canvas?.focus?.({ preventScroll: true });\n  }\n\n  departLackey() {\n    const lackey = this.lackey;\n    if (!lackey || lackey.inactive) return Promise.resolve();\n    lackey.vx = 0;\n    lackey.vy = 0;\n    const offset = HOSPITAL_RECOVERY.lackeyExitOffset || { x: 74, y: -8 };\n    const targetX = lackey.x + (Number(offset.x) || 0);\n    const targetY = lackey.y + (Number(offset.y) || 0);\n    const finish = () => {\n      lackey.vx = 0;\n      lackey.vy = 0;\n      lackey.inactive = true;\n      lackey.active = false;\n      lackey.container?.setAlpha?.(0).setVisible?.(false);\n      this.scene.npcSystem?.rebuildSpatialIndex?.();\n    };\n    if (!this.scene.tweens?.add) {\n      lackey.x = targetX;\n      lackey.y = targetY;\n      finish();\n      return Promise.resolve();\n    }\n    return new Promise(resolve => {\n      this.scene.tweens.add({\n        targets: lackey,\n        x: targetX,\n        y: targetY,\n        duration: HOSPITAL_RECOVERY.lackeyDepartureMs,\n        ease: "Sine.easeInOut",\n        onUpdate: tween => {\n          lackey.container?.setPosition?.(lackey.x, lackey.y);\n          const progress = Math.max(0, Math.min(1, Number(tween.progress) || 0));\n          if (progress > 0.62) lackey.container?.setAlpha?.(1 - (progress - 0.62) / 0.38);\n        },\n        onComplete: () => {\n          finish();\n          resolve();\n        }\n      });\n    });\n  }\n\n  async runHospitalRecoveryBeat() {\n    const director = this.scene.tutorialDirector;\n    try {\n      await this.waitForPresentation(HOSPITAL_RECOVERY.hospitalSettleMs);\n      if (director?.showDialogue) {\n        await director.showDialogue({\n          speaker: HOSPITAL_RECOVERY.lackeySpeaker,\n          text: HOSPITAL_RECOVERY.lackeyLine,\n          kind: "spoken",\n          target: this.lackey\n        });\n      } else {\n        this.scene.lastActionText = \\`${HOSPITAL_RECOVERY.lackeySpeaker}: ${HOSPITAL_RECOVERY.lackeyLine}\\`;\n        await this.waitForPresentation(2200);\n      }\n      await this.departLackey();\n      return true;\n    } catch (error) {\n      console.error("Hospital lackey recovery beat failed", error);\n      return false;\n    } finally {\n      this.hospitalRecoveryIntroComplete = true;\n      this.releaseRecoveryControls();\n      this.scene.statePublisher?.setMany?.({\n        hospitalRecoveryIntroComplete: true,\n        hospitalBloodBagAvailable: !this.recoveryBagCollected\n      });\n      this.scene.events?.emit?.("death:hospital-recovery-ready", {\n        vehicleId: this.recoveryVehicleId,\n        bloodBagAvailable: !this.recoveryBagCollected\n      });\n    }\n  }\n\n  placeBloodBag(spawn) {`
);
replaceExact(
  recoveryPath,
  `    this.placeLackey(spawn);\n    this.placeBloodBag(spawn);\n    this.placeReplacementVehicle();\n    this.restoreAudio();\n\n    this.state = createDeathSequenceState();`,
  `    this.placeLackey(spawn);\n    this.placeBloodBag(spawn);\n    this.placeReplacementVehicle();\n    this.restoreAudio();\n    this.lockRecoveryControls();\n\n    this.state = createDeathSequenceState();`
);
replaceExact(
  recoveryPath,
  `      hospitalRecoveryActive: true,\n      policeReacquisitionGraceUntil: graceUntil\n    });\n    this.scene.lastActionText = \\`LACKEY: ${HOSPITAL_RECOVERY.lackeyLine}\\`;\n    this.scene.events?.emit?.("death:hospital-recovered", {`,
  `      hospitalRecoveryActive: true,\n      hospitalRecoveryIntroComplete: false,\n      hospitalBloodBagAvailable: false,\n      policeReacquisitionGraceUntil: graceUntil\n    });\n    this.scene.lastActionText = "Hospital recovery · listen to the lackey.";\n    this.scene.events?.emit?.("death:hospital-recovered", {`
);
replaceExact(
  recoveryPath,
  `      bloodBagAvailable: true\n    });\n    return true;\n  }\n\n  collectInteractions() {\n    if (!this.recovered || this.recoveryBagCollected || !this.bagContainer?.visible) return [];`,
  `      bloodBagAvailable: true\n    });\n    this.recoveryPresentationPromise = this.runHospitalRecoveryBeat();\n    return true;\n  }\n\n  collectInteractions() {\n    if (!this.recovered\n      || !this.hospitalRecoveryIntroComplete\n      || this.recoveryBagCollected\n      || !this.bagContainer?.visible) return [];`
);
replaceExact(
  recoveryPath,
  `    this.scene.tutorialDirector?.hideDialogue?.();\n    this.backdrop?.destroy?.();`,
  `    this.scene.tutorialDirector?.hideDialogue?.();\n    this.releaseRecoveryControls();\n    this.backdrop?.destroy?.();`
);

const testPath = "tests/hospital-death-recovery.test.js";
let tests = readFileSync(testPath, "utf8");
tests += `\n\ntest("hospital arrival holds control for conventional lackey dialogue, departure, then releases full input", () => {\n  const code = source("phaser/src/combat/DeathRecoverySystem.js");\n  assert.equal(HOSPITAL_RECOVERY.lackeySpeaker, "LACKEY");\n  assert.ok(HOSPITAL_RECOVERY.lackeyDepartureMs >= 700);\n  assert.match(code, /lockRecoveryControls\\(\\)/);\n  assert.match(code, /speaker: HOSPITAL_RECOVERY\\.lackeySpeaker/);\n  assert.match(code, /kind: "spoken"/);\n  assert.match(code, /await this\\.departLackey\\(\\)/);\n  assert.match(code, /setControlMode\\?\\.\\("locked"\\)/);\n  assert.match(code, /setControlMode\\?\\.\\("full"\\)/);\n  assert.match(code, /setWorldEnabled\\?\\.\\(true\\)/);\n  assert.match(code, /hospitalRecoveryIntroComplete/);\n  const departure = code.indexOf("await this.departLackey()");\n  const release = code.indexOf("this.releaseRecoveryControls()", departure);\n  assert.ok(departure >= 0 && release > departure);\n});\n`;
writeFileSync(testPath, tests);

const docsPath = "docs/PLAYTEST_ESCALATION_DAMAGE_RECOVERY.md";
replaceExact(
  docsPath,
  `- A static lackey appears beside the player with the recovery line:\n\n  **“You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.”**\n\n- A world-interactable blood bag restores **30 Vitality** and relieves up to **35 Hunger**; it deliberately does not reset Hunger to zero.`,
  `- A lackey appears beside the player while hospital arrival remains control-locked. He delivers the recovery line through the same conventional spoken-dialogue presentation used elsewhere in the game:\n\n  **“You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.”**\n\n- After the player dismisses the line, the lackey visibly walks away and fades out. Only after that departure completes does the recovery authority explicitly restore full control mode, world input and keyboard focus. The release runs from a fail-safe finalizer so a dialogue/presentation error cannot strand the player in a movement-locked state.\n- The blood bag is not interactable until the lackey recovery beat has completed. It then restores **30 Vitality** and relieves up to **35 Hunger**; it deliberately does not reset Hunger to zero.`
);
replaceExact(
  docsPath,
  `- The lackey, blood bag and replacement vehicle are present and usable.\n- Active police do not immediately kill the player again during the recovery beat.`,
  `- The lackey speaks in the conventional dialogue style, leaves before control returns, and no movement/input lock survives the recovery beat.\n- The lackey, blood bag and replacement vehicle are present and usable.\n- Active police do not immediately kill the player again during the recovery beat.`
);

console.log("Applied hospital recovery dialogue/control fix.");
