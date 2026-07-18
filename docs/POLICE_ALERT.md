# Police violence alert escalation

_Status: implemented; browser regression remains pending._

## Purpose

Violence against police must escalate the wanted state rather than repeatedly forcing the same minimum level.

## Rules

- The first confirmed hit against a police officer establishes at least alert level 1.
- Neutralizing an officer establishes at least level 2.
- Neutralizing another officer while at level 2 raises alert to level 3.
- Level 3 is the current maximum gameplay alert and enables the strongest police response and helicopter support.
- The same officer can only grant the neutralization escalation once.
- Killing or draining through the remaining legacy interaction path uses the same neutralization rule.

## Stable thresholds

Alert levels use 25 exposure points per level. Police-violence escalation targets six points above the exact boundary:

- level 1 target: 31 exposure;
- level 2 target: 56 exposure;
- level 3 target: 81 exposure.

The buffer prevents a forced alert from falling back one level immediately when the player is standing in darkness and exposure cooling runs on the next frame.

## Local response

Police violence also adds local district heat:

- confirmed assault: 18 local heat;
- officer neutralized: 42 local heat.

The police system records the player's current street position, redirects nearby units and spawns reinforcements according to the resulting alert level.

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
  exposureAdded
}
```

## Automated coverage

`tests/police-alert.test.js` verifies:

- assault establishes level 1;
- neutralization raises the wanted level progressively;
- escalation stops at level 3;
- the stability buffer is included in required exposure.

## Manual regression

1. Hit one officer without downing them: HUD reaches level 1.
2. Down that officer: HUD reaches level 2.
3. Down a second officer: HUD reaches level 3 and helicopter support activates.
4. Drain or kill an already-accounted downed officer: the same officer does not increase the level twice.
5. Repeat while standing in a broken-light shadow: the new level does not disappear on the next frame.
