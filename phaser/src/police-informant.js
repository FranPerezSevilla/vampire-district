import { LAYERS } from "./data/district.js";
import { NPC_TYPES } from "./data/npcs.js";

const INFORMANT_ID = "police_roof_informant";
const INFORMANT_POSITION = Object.freeze({ x: 775, y: 150, layer: LAYERS.ROOF_LOW });

function installPoliceDialogueStyle() {
  if (document.getElementById("nbd-police-informant-style")) return;

  const style = document.createElement("style");
  style.id = "nbd-police-informant-style";
  style.textContent = `
    .tutorial-dialogue.police {
      border-color: rgba(77, 163, 255, .94);
      background: linear-gradient(145deg, rgba(13, 29, 52, .99), rgba(6, 9, 17, .985));
      box-shadow: 0 24px 86px rgba(0, 0, 0, .78), 0 0 34px rgba(77, 163, 255, .12);
    }

    .tutorial-dialogue.police .tutorial-dialogue__speaker {
      color: #9ed0ff;
    }

    .tutorial-dialogue.police .tutorial-dialogue__advance {
      border-top-color: rgba(77, 163, 255, .18);
      color: rgba(158, 208, 255, .76);
    }
  `;
  document.head.appendChild(style);
}

function findInformant(scene) {
  return scene.npcSystem?.npcs?.find(npc => npc.id === INFORMANT_ID) || null;
}

function createInformant(scene) {
  const existing = findInformant(scene);
  if (existing) return existing;

  const informant = scene.npcSystem.createNpc({
    id: INFORMANT_ID,
    type: NPC_TYPES.POLICE,
    x: INFORMANT_POSITION.x,
    y: INFORMANT_POSITION.y,
    layer: INFORMANT_POSITION.layer,
    behavior: "guard",
    speed: 0,
    dirX: -1,
    dirY: 0,
    missionInformant: true
  });

  informant.missionInformant = true;
  informant.container.setDepth(48);
  scene.npcSystem.npcs.push(informant);
  scene.npcSystem.refreshVisibility?.();
  return informant;
}

function excludeInformantFromPoliceAI(scene) {
  const policeSystem = scene.policeSystem;
  if (!policeSystem || policeSystem.__nbdInformantExcluded) return;

  const originalPolice = policeSystem.police.bind(policeSystem);
  policeSystem.police = function policeWithoutMissionInformant() {
    return originalPolice().filter(cop => !cop.missionInformant);
  };
  policeSystem.__nbdInformantExcluded = true;
}

function departInformant(scene, informant) {
  if (!informant || informant.inactive) return Promise.resolve();

  informant.behavior = "guard";
  informant.vx = 0;
  informant.vy = 0;

  return new Promise(resolve => {
    scene.tweens.add({
      targets: informant,
      x: 846,
      y: 148,
      duration: 1050,
      ease: "Sine.easeInOut",
      onUpdate: tween => {
        const progress = tween.progress || 0;
        informant.dirX = 1;
        informant.dirY = 0;
        informant.container?.setAlpha(progress < 0.58 ? 1 : 1 - ((progress - 0.58) / 0.42));
      },
      onComplete: () => {
        informant.inactive = true;
        informant.vx = 0;
        informant.vy = 0;
        informant.container?.setAlpha(0).setVisible(false);
        scene.npcSystem.refreshVisibility?.();
        resolve();
      }
    });
  });
}

function installMissionInteraction(scene, director, informant) {
  const mission = scene.missionSystem;
  if (!mission || mission.__nbdPoliceInformantPatch) return;

  const originalCollectInteractions = mission.collectInteractions.bind(mission);
  const originalCollectPoliceRoofTip = mission.collectPoliceRoofTip.bind(mission);

  mission.collectInteractions = function collectPoliceInformantInteraction() {
    const actions = originalCollectInteractions();
    const activeInformant = findInformant(scene);

    for (const action of actions) {
      if (action.id !== "mission_collect_police_roof_tip") continue;
      if (activeInformant && !activeInformant.inactive) {
        action.label = "Speak to the police informant";
        action.detail = "learn where the journalist is hiding";
        action.x = activeInformant.x;
        action.y = activeInformant.y;
        action.distance = Phaser.Math.Distance.Between(
          scene.player.x,
          scene.player.y,
          activeInformant.x,
          activeInformant.y
        );
      }
    }

    return actions;
  };

  mission.collectPoliceRoofTip = async function collectTipFromPoliceNpc() {
    if (this.completed || this.failed || this.step !== 0 || this.__nbdInformantConversationRunning) return;

    if (this.rooftopJumps < 3) {
      originalCollectPoliceRoofTip();
      return;
    }

    const activeInformant = findInformant(scene);
    if (!activeInformant || activeInformant.inactive) {
      originalCollectPoliceRoofTip();
      return;
    }

    this.__nbdInformantConversationRunning = true;
    director.busy = true;
    director.state = "police-informant";
    director.setControlMode?.("locked");
    director.setTip?.("", "");
    director.freezeWorld?.(true);

    try {
      await director.showDialogue({
        speaker: "POLICE INFORMANT",
        text: "The journalist is outside the nightclub, beneath the pink lights.",
        kind: "police",
        targetId: INFORMANT_ID
      });

      await director.showDialogue({
        speaker: "POLICE INFORMANT",
        text: "He plans to hand over everything he knows before dawn. Reach him first.",
        kind: "police",
        targetId: INFORMANT_ID
      });

      originalCollectPoliceRoofTip();
      await departInformant(scene, activeInformant);
      await director.runFinalSireMessage?.();
    } finally {
      this.__nbdInformantConversationRunning = false;
      if (director.state !== "complete") {
        director.busy = false;
        director.freezeWorld?.(false);
        director.setControlMode?.("full");
      }
    }
  };

  mission.__nbdPoliceInformantPatch = true;
}

function installPoliceInformant() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;

  if (!scene?.npcSystem || !scene?.missionSystem || !scene?.policeSystem
    || !director?.showDialogue?.__nbdAnchoredDialoguePatch
    || !director.__nbdFinalPostTipAdvicePatch) {
    window.requestAnimationFrame(installPoliceInformant);
    return;
  }

  if (scene.__nbdPoliceInformantInstalled) return;

  installPoliceDialogueStyle();
  const informant = createInformant(scene);
  excludeInformantFromPoliceAI(scene);
  installMissionInteraction(scene, director, informant);
  scene.__nbdPoliceInformantInstalled = true;
}

installPoliceInformant();
