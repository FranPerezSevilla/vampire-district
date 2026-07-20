# Milestone 11.2 regression checklist

Use this checklist before marking direct mission authority and checkpoint restoration complete. Record browser, operating system, viewport, render quality, input device and commit SHA.

## Automated prerequisites

- `npm test` passes.
- `npm run test:browser` passes.
- GitHub Actions `unit-tests` and `browser-smoke` pass on the same PR head.
- `CampaignRuntimeBridge.js` is absent.
- `window.NBD_CAMPAIGN.snapshot().state.version` is `2`.
- `GameScene.missionSystem.campaign === GameScene.campaignSystem`.
- No runtime owner conflicts or browser page errors occur.

## Fresh campaign

- Clearing `vampire-district-campaign-v1` starts one opening mission.
- Active objective is `reach_police_roof`.
- Cash is zero.
- No checkpoint exists before an authored checkpoint boundary.
- Intro, tutorial, objective arrow and rooftop blocker behave as before.
- The journalist remains hidden before the informant sequence.

## Direct mission authority

Inspect campaign and world state after every transition:

- Three rooftop jumps are stored in mission metadata.
- Reaching the police roof activates `speak_to_informant`.
- Completing informant dialogue activates `reach_nightclub`.
- Entering the nightclub district activates `neutralize_journalist`.
- Killing the journalist records outcome `killed` once.
- Draining the journalist records outcome `drained` once.
- A duplicate neutralization event does not advance twice.
- The return objective activates from the runner rather than a mutable legacy step.
- Mission marker and HUD text match the current definition objective.
- A mission failure updates the runner record and grants no reward.

## Sire-first finale

Test killed and drained outcomes:

- Reaching the refuge before handling the journalist does nothing.
- Reaching it after handling him starts one finale only.
- Controls and world actions lock during the sire dialogue.
- No campaign completion or result modal appears before the final bubble is dismissed.
- `refuge:returned` completes the active runner objective.
- Rewards are granted exactly once.
- Completion checkpoint is captured before `REPORT ACCEPTED` opens.
- Closing the report restores armed and unarmed free roam.

## Safe checkpoint capture

For each authored boundary:

- `reach_nightclub` requests the post-informant checkpoint.
- `neutralize_journalist` requests the nightclub checkpoint.
- `return_to_refuge` requests the journalist-handled checkpoint.
- Mission completion requests/captures the report checkpoint.

A normal checkpoint must remain pending during:

- dialogue or task reveal;
- layer transition;
- interaction menu;
- feeding;
- active attack commitment;
- hit stun;
- wanted level above zero;
- an alarmed witness;
- a chase or enemy attack.

After those conditions clear, exactly one checkpoint is stored.

## Active checkpoint restoration

At the nightclub checkpoint, alter and save all of the following before reload:

- player street position;
- Hunger;
- selected Pistol;
- remaining Pistol ammunition;
- one broken streetlight;
- drained rooftop thug;
- departed informant;
- journalist active and alive;
- blood/evidence counters where applicable.

After reload:

- intro is closed;
- tutorial state is `complete`;
- full controls are active;
- player position and layer match the checkpoint;
- Hunger matches;
- weapon inventory, selected weapon and ammunition match;
- broken-light darkness remains;
- thug outcome remains;
- informant remains absent;
- journalist is alive and available;
- objective remains `neutralize_journalist`;
- no stale police, hunter, witness or attack state survives.

## Unsafe-progress rollback

- Capture a safe `neutralize_journalist` checkpoint.
- Neutralize the journalist while wanted, chased or observed.
- Confirm campaign autosave advances to `return_to_refuge` while the checkpoint remains older.
- Reload before reaching a safe state.
- Confirm the mission rolls back to `neutralize_journalist`.
- Confirm the journalist and world also roll back atomically.
- Confirm no reward or duplicate ledger entry is created.

## Failed-run retry

- Capture a safe active checkpoint.
- Fail through arrest, Veil break or frenzy.
- Reload or begin a same-mission retry.
- Confirm the failed record does not destroy the safe checkpoint.
- Confirm restoration returns to the checkpoint's active objective.
- Starting a different mission must clear the old checkpoint.

## Completed checkpoint

- Complete the opening mission once.
- Confirm cash `$500`, Blackglass `+5` and sire `+1`.
- Confirm one wallet ledger entry.
- Reload.
- Intro and report modal do not reopen.
- Tutorial remains complete.
- Free roam begins at the refuge.
- Cash, reputation and ledger are unchanged.
- The completion checkpoint reports `mission-complete`.
- An older active checkpoint is rejected when campaign state is already completed.

## Save migration and browser API

- Import a version-one save and confirm migration to version two.
- Recognized cash, reputation, mission and inventory values remain.
- A conservative checkpoint is synthesized when enough opening-mission information exists.
- Invalid JSON fails strict import and falls back safely during normal boot.
- A future unsupported schema version fails explicitly.
- `snapshot`, `export`, `checkpoint`, `save`, `reloadCheckpoint`, `discardCheckpoint`, `reset`, `import` and `safety` work.
- Exported state contains no functions, Phaser objects or circular data.

## Existing release-candidate regression

- `/` and `/phaser/` both boot.
- Intro camera and dialogue order remain correct on a fresh save.
- Rooftop thug can be downed and drained reliably.
- Weapon cycling remains locked until the tutorial completes.
- Police alert progresses 1 → 2 → 3.
- Helicopter, recovery and witness/hearing split remain functional.
- Journalist killed and drained golden paths pass.
- Post-report weapons, impacts and drain still work.
- Low, Ultra, wide, narrow and resized layouts remain valid.
- Accessibility and high-contrast aim tests remain green.

## Pass criteria

Milestone 11.2 may be marked accepted when:

- unit and browser jobs pass on the same final head;
- the two opening-mission outcomes pass with direct runner authority;
- active and completed checkpoint reloads pass;
- unsafe progress rolls back atomically;
- failed retry preserves a safe checkpoint;
- rewards remain idempotent;
- no bridge or parallel mutable mission state remains;
- current release-candidate behaviour has no critical regression.
