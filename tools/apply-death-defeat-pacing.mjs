import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(path, before, after) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

function replaceRegex(path, pattern, replacement) {
  const source = readFileSync(path, "utf8");
  if (!pattern.test(source)) throw new Error(`Expected pattern not found in ${path}: ${pattern}`);
  writeFileSync(path, source.replace(pattern, replacement));
}

const dataPath = "phaser/src/data/death-recovery.js";
replaceExact(dataPath,
`export const DEATH_BEAT = Object.freeze({\n  masterHoldMs: 1100,\n  fadeMs: 900\n});`,
`export const DEATH_BEAT = Object.freeze({\n  zoomHoldMs: 2000,\n  masterHoldMs: 1,\n  fadeMs: 900,\n  fallbackDialogueMs: 1800,\n  masterSpeaker: "YOUR SIRE · IN YOUR MIND",\n  masterLine: "Pathetic. You are supposed to be the predator, not the prey."\n});`);
replaceExact(dataPath,
`  if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) return 0.28;\n  const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));\n  const progress = Math.max(0, Math.min(1, state.elapsedMs / duration));\n  return 0.28 + progress * 0.72;`,
`  if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) return 0;\n  const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));\n  return Math.max(0, Math.min(1, state.elapsedMs / duration));`);
replaceRegex(dataPath,
/export function deathDialogueAlpha\(state, timings = DEATH_BEAT\) \{[\s\S]*?\n\}/,
`export function deathDialogueAlpha() {\n  // Death now reuses the conventional TutorialDirector dialogue surface.\n  return 0;\n}`);

const deathPath = "phaser/src/combat/DeathRecoverySystem.js";
replaceExact(deathPath,
`  deathDialogueAlpha,\n  deathFadeAlpha,`,
`  deathFadeAlpha,`);
replaceRegex(deathPath,
/    this\.audioSnapshot = null;\n\n    this\.backdrop = scene\.add\.rectangle[\s\S]*?    this\.dialogueLabel\.setStroke\?\.\("#05060b", 2\);/,
`    this.audioSnapshot = null;\n    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = null;\n\n    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x000000, 1)\n      .setOrigin(0, 0)\n      .setScrollFactor(0)\n      .setDepth(980)\n      .setAlpha(0)\n      .setVisible(false);`);
replaceExact(deathPath,
`    this.audioFadeStarted = false;\n    this.fadeCompleteEmitted = false;\n    this.recovered = false;\n    this.audioSnapshot = {`,
`    this.audioFadeStarted = false;\n    this.fadeCompleteEmitted = false;\n    this.recovered = false;\n    this.masterPresentationComplete = false;\n    this.masterPresentationPromise = null;\n    this.cameraZoomSnapshot = Number(this.scene.cameras?.main?.zoom) || null;\n    this.audioSnapshot = {`);
replaceExact(deathPath,
`      deathSequenceActive: true,\n      deathSequencePhase: this.state.phase,\n      deathSequenceText: "MASTER · Pathetic."\n    });`,
`      deathSequenceActive: true,\n      deathSequencePhase: this.state.phase,\n      deathSequenceText: "Death sequence · closing in"\n    });`);
replaceExact(deathPath,
`    this.syncPresentation();\n    return true;\n  }\n\n  update(dt) {\n    if (!this.isActive()) return;\n    const before = this.state.phase;`,
`    this.syncPresentation();\n    this.masterPresentationPromise = this.runMasterDeathBeat();\n    return true;\n  }\n\n  update(dt) {\n    if (!this.isActive()) return;\n    if (this.state.phase === DEATH_SEQUENCE_PHASES.MASTER && !this.masterPresentationComplete) {\n      this.syncPresentation();\n      this.scene.statePublisher?.setMany?.({\n        deathSequenceActive: true,\n        deathSequencePhase: this.state.phase,\n        deathSequenceText: "Death sequence · sire"\n      });\n      return;\n    }\n    if (this.state.phase === DEATH_SEQUENCE_PHASES.MASTER) {\n      this.state.elapsedMs = DEATH_BEAT.masterHoldMs;\n    }\n    const before = this.state.phase;`);
replaceExact(deathPath,
`      deathSequenceText: this.state.phase === DEATH_SEQUENCE_PHASES.BLACK\n        ? "Death sequence · black"\n        : "MASTER · Pathetic."`,
`      deathSequenceText: this.state.phase === DEATH_SEQUENCE_PHASES.BLACK\n        ? "Death sequence · black"\n        : "Death sequence · fading"`);
replaceExact(deathPath,
`  beginAudioFade() {`,
`  waitForPresentation(ms) {\n    const duration = Math.max(0, Number(ms) || 0);\n    if (!duration) return Promise.resolve();\n    return new Promise(resolve => {\n      if (this.scene.time?.delayedCall) {\n        this.scene.time.delayedCall(duration, resolve);\n        return;\n      }\n      globalThis.setTimeout?.(resolve, duration);\n    });\n  }\n\n  async runMasterDeathBeat() {\n    const director = this.scene.tutorialDirector;\n    try {\n      director?.setTip?.("", "");\n      director?.hideDialogue?.();\n      if (director?.zoomToPlayer) await director.zoomToPlayer();\n      await this.waitForPresentation(DEATH_BEAT.zoomHoldMs);\n\n      if (director?.showDialogue) {\n        await director.showDialogue({\n          speaker: DEATH_BEAT.masterSpeaker,\n          text: DEATH_BEAT.masterLine,\n          kind: "thought",\n          target: this.scene.player\n        });\n      } else {\n        this.scene.lastActionText = \`\${DEATH_BEAT.masterSpeaker}: \${DEATH_BEAT.masterLine}\`;\n        await this.waitForPresentation(DEATH_BEAT.fallbackDialogueMs);\n      }\n      return true;\n    } catch (error) {\n      console.error("Death sire dialogue failed", error);\n      return false;\n    } finally {\n      director?.hideDialogue?.();\n      this.masterPresentationComplete = true;\n    }\n  }\n\n  beginAudioFade() {`);
replaceExact(deathPath,
`    this.scene.playerDamageSystem?.revive?.({ vitality: HOSPITAL_RECOVERY.reviveVitality });\n    this.scene.cameras?.main?.startFollow?.(this.scene.player, true, 0.12, 0.12);`,
`    this.scene.playerDamageSystem?.revive?.({ vitality: HOSPITAL_RECOVERY.reviveVitality });\n    const camera = this.scene.cameras?.main;\n    const worldBounds = this.scene.physics?.world?.bounds;\n    if (camera) {\n      if (worldBounds) {\n        camera.setBounds?.(\n          Number(worldBounds.x) || 0,\n          Number(worldBounds.y) || 0,\n          Number(worldBounds.width) || camera.width,\n          Number(worldBounds.height) || camera.height\n        );\n      }\n      if (this.cameraZoomSnapshot) camera.setZoom?.(this.cameraZoomSnapshot);\n      camera.startFollow?.(this.scene.player, true, 0.12, 0.12);\n    }`);
replaceExact(deathPath,
`    this.state = createDeathSequenceState();\n    this.syncPresentation();`,
`    this.state = createDeathSequenceState();\n    this.masterPresentationPromise = null;\n    this.masterPresentationComplete = false;\n    this.cameraZoomSnapshot = null;\n    this.syncPresentation();`);
replaceRegex(deathPath,
/  syncPresentation\(\) \{[\s\S]*?\n  \}\n\n  isActive\(\) \{/,
`  syncPresentation() {\n    const width = Math.max(1, Number(this.scene.scale?.width) || Number(this.scene.cameras?.main?.width) || 960);\n    const height = Math.max(1, Number(this.scene.scale?.height) || Number(this.scene.cameras?.main?.height) || 540);\n    const overlayAlpha = deathFadeAlpha(this.state);\n    const show = this.state.phase === DEATH_SEQUENCE_PHASES.FADE\n      || this.state.phase === DEATH_SEQUENCE_PHASES.BLACK;\n\n    this.backdrop\n      .setPosition(0, 0)\n      .setSize(width, height)\n      .setDisplaySize(width, height)\n      .setAlpha(overlayAlpha)\n      .setVisible(show);\n  }\n\n  isActive() {`);
replaceExact(deathPath,
`    this.backdrop?.destroy?.();\n    this.panel?.destroy?.();\n    this.speakerLabel?.destroy?.();\n    this.dialogueLabel?.destroy?.();\n    this.bagContainer?.destroy?.();`,
`    this.scene.tutorialDirector?.hideDialogue?.();\n    this.backdrop?.destroy?.();\n    this.bagContainer?.destroy?.();`);

const testPath = "tests/death-recovery-beat.test.js";
replaceExact(testPath,
`  assert.equal(deathDialogueAlpha(state), 1);\n  assert.equal(deathFadeAlpha(state), 0.28);`,
`  assert.equal(deathDialogueAlpha(state), 0);\n  assert.equal(deathFadeAlpha(state), 0);`);
replaceExact(testPath,
`  assert.ok(deathDialogueAlpha(state) < 1);\n  assert.ok(deathFadeAlpha(state) > 0.28);`,
`  assert.equal(deathDialogueAlpha(state), 0);\n  assert.ok(deathFadeAlpha(state) > 0);`);
replaceRegex(testPath,
/test\("runtime death presentation listens to the authoritative player death event and fades audio", \(\) => \{[\s\S]*?\n\}\);/,
`test("runtime death presentation uses the conventional Sire dialogue after a readable zoom hold", () => {\n  const code = source("phaser/src/combat/DeathRecoverySystem.js");\n  assert.match(code, /"player:died"/);\n  assert.ok(DEATH_BEAT.zoomHoldMs >= 1500);\n  assert.match(DEATH_BEAT.masterLine, /predator.*prey/i);\n  assert.equal(DEATH_BEAT.masterSpeaker, "YOUR SIRE · IN YOUR MIND");\n  assert.match(code, /tutorialDirector/);\n  assert.match(code, /zoomToPlayer/);\n  assert.match(code, /showDialogue/);\n  assert.match(code, /kind: "thought"/);\n  assert.match(code, /DEATH_BEAT\\.zoomHoldMs/);\n  assert.doesNotMatch(code, /scene\\.add\\.text\\(0, 0, "Pathetic\\."/);\n  assert.match(code, /death:sequence-started/);\n  assert.match(code, /death:fade-complete/);\n  assert.match(code, /RawAudio\\.stopAllVehicleEngines/);\n  assert.match(code, /linearRampToValueAtTime\\(0\\.0001, end\\)/);\n});`);

const docsPath = "docs/PLAYTEST_ESCALATION_DAMAGE_RECOVERY.md";
replaceExact(docsPath,
`- A fixed screen-space master popup shows **“Pathetic.”** for 1.1 seconds.\n- The scene then fades to full black over 0.9 seconds while the RawAudio world and narrative masters ramp down together; active vehicle-engine, skid and feeding loops are stopped before the fade.`,
`- Death first eases the camera into the same close player zoom used by the conventional dialogue director, then holds on the defeated body for **2.0 seconds** before anyone speaks.\n- The Sire then uses the **normal in-game thought-dialogue presentation**, not a bespoke death popup: **“Pathetic. You are supposed to be the predator, not the prey.”**\n- Only after that dialogue is completed does the scene fade to full black over 0.9 seconds while the RawAudio world and narrative masters ramp down together; active vehicle-engine, skid and feeding loops are stopped before the fade.\n- Hospital recovery restores the pre-death camera zoom/follow framing before control returns.`);
replaceExact(docsPath,
`- The death sequence cannot trigger twice or leave input/audio loops running.`,
`- The death sequence cannot trigger twice or leave input/audio loops running.\n- Defeat has a readable zoom-and-hold beat before the Sire speaks, and the dialogue uses the established conventional thought-bubble style rather than a one-off death panel.`);

console.log("Applied death defeat pacing and conventional Sire dialogue.");
