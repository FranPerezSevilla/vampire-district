# Police violence alert escalation

_Status: implemented and migrated to Heat authority; automated regression active._

## Purpose

Violence against police must escalate the wanted state rather than repeatedly forcing the same minimum level. The resulting alert also feeds the Milestone 8 police-role system, so higher pressure produces an organized attacker/containment response rather than a stack of identical chasers.

## Rules

- The first confirmed hit against a police officer establishes at least alert level 1.
- Neutralizing an officer establishes at least level 2.
- Neutralizing another officer while at level 2 raises alert to level 3.
- Level 3 is the current maximum gameplay alert and enables the strongest police response and helicopter support.
- The same officer can only grant the neutralization escalation once.
- Killing or draining through the remaining legacy interaction path uses the same neutralization rule.

## Stable thresholds

Police violence now targets Heat levels directly:

- level 1 target: 18 Heat;
- level 2 target: 45 Heat;
- level 3 target: 75 Heat.

Heat is district-local and decays independently of supernatural evidence. Standing in darkness does not erase police knowledge or reported crime.

## Local response

Police violence submits district-local Heat incidents:

- confirmed assault: 18 local heat;
- officer neutralized: 42 local heat.

The police system records the player's current street position, redirects nearby units and spawns reinforcements according to the resulting alert level.

A downed officer is unavailable and does not count toward the active reinforcement target. Police may therefore replace the officer while the 18-second recovery timer is running. If that officer later recovers, the district can temporarily contain more units than the normal target, which is an intentional consequence of repeatedly escalating a police fight.

## Combat roles

When officers confirm the player visually:

- one ready officer becomes the stable `attacker`;
- only that officer may begin a baton telegraph;
- other visible officers take separate containment positions around the player;
- attack leadership can rotate after the current finite turn and cooldown;
- containment officers keep facing the player while circling, preventing accidental loss of contact;
- confirmed sight cancels a lower-priority heard-only `WTF` response.

Containment radii are 43, 49 and 55 units at alert levels 1, 2 and 3. The existing surrounded-arrest rule and level-3 helicopter remain active.

## Downed recovery

- police recovery delay: 18 seconds;
- restored resilience: 2 / 4;
- recovery begins with a short stagger;
- recovered police rejoin the search;
- starting a drain suppresses recovery;
- kill or completed drain resolves the officer permanently.

## Events

`police:violence-escalated` publishes:

```js
{
  officerId,
  weaponId,
  neutralized,
  previousLevel,
  targetLevel,
  level,
  heatAdded
}
```

Additional role/state events come from Milestone 8:

- `ai:state-changed`;
- `combat:entity-recovered`.

## Automated coverage

`tests/police-alert.test.js` verifies:

- assault establishes level 1;
- neutralization raises the wanted level progressively;
- escalation stops at level 3;
- the required Heat threshold is calculated deterministically.

`tests/ai.test.js` verifies deterministic attack leadership, containment geometry and police recovery timing/resilience.

## Manual regression

1. Hit one officer without downing them: HUD reaches level 1.
2. Down that officer: HUD reaches level 2.
3. Down a second officer: HUD reaches level 3 and helicopter support activates.
4. Confirm that one officer attacks while others contain rather than all telegraphing together.
5. Drain or kill an already-accounted downed officer: the same officer does not increase the level twice.
6. Leave a downed officer unresolved: a replacement may arrive and the original rises after about 18 seconds.
7. Repeat while standing in a concealed route: the new level does not disappear on the next frame.
