# Building visual polish — M6 final review

Date: 2026-08-20  
Branch: `agent/building-visual-poc`  
PR: #63  
Final visual implementation/test head: `bd263451386ca89a0a6f942056bd135bc03c98f7`  
Final review workflow: `32355086754`  
Final review artifact: `building-visual-review`, artifact id `9401382945`  
Artifact URL: https://github.com/FranPerezSevilla/vampire-district/actions/runs/32355086754/artifacts/9401382945  
Netlify preview: https://deploy-preview-63--vampire-district.netlify.app

## Review package

The M6 browser review captures real authored buildings from the live city at the normal gameplay camera scale. The generated `manifest.json` records the selected building, authored bounds, family/profile, viewport and zoom for reproducibility.

- gameplay zoom: `1.847062190599483`;
- viewport: `1440 x 960`;
- world view: `780 x 520`;
- captures: `warehouse.png`, `industrial.png`, `police.png`, `medical.png`, `church.png`, `nightlife.png`, `generic.png`, `mixed-street.png`;
- mixed-street capture contains church, generic, residential, commercial and industrial families in one context.

The artifact is produced by the dedicated `browser-building-review` CI job and is not a synthetic fixture sheet.

## Acceptance rubric scorecard

The canonical rubric scores each category from 0 to 2. A representative profile is approved at an average of at least **1.6**, with no zero in silhouette, parapet, shadow or gameplay clarity.

| Capture | Silhouette | Parapet | Shadow | Material | Props | Family identity | Gameplay clarity | Average |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Warehouse | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **2.00** |
| Industrial | 1 | 2 | 2 | 2 | 2 | 2 | 2 | **1.86** |
| Police | 1 | 2 | 2 | 2 | 2 | 2 | 2 | **1.86** |
| Medical | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **2.00** |
| Church | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **2.00** |
| Nightlife | 1 | 2 | 2 | 2 | 2 | 2 | 2 | **1.86** |
| Generic | 1 | 2 | 2 | 2 | 2 | 1 | 2 | **1.71** |
| Mixed street | 2 | 2 | 2 | 2 | 2 | 2 | 1 | **1.86** |

Representative-family mean: **1.90**.  
Lowest representative-family score: **1.71** (`generic`).  
Blocking zeroes: **none**.

## M6 corrections made from review evidence

The first M6 review package was deliberately treated as evidence rather than as an automatic pass. It exposed several residual problems at gameplay zoom, which were fixed in bounded renderer-only passes.

### Church

- broad directional pitched-roof planes were added above the already validated ridge treatment;
- the nave/cross now reads as roof planes rather than a floor-plan outline;
- planner-owned silhouette and ridge coordinates remain unchanged.

### Nightlife

- the hero rooflight remains dominant;
- one dark asymmetric service deck balances the composition;
- neon remains a local accent instead of becoming a perimeter outline.

### Generic

- large neutral roofs group existing hero/support props in one low-frequency service court;
- small generic roofs remain deliberately sparse;
- no landmark semantics or new props were introduced.

### Industrial

- annex and HVAC are grouped by one mechanical plant deck;
- a first width cap failed the focused contract because the HVAC centre fell outside the deck;
- the final implementation sizes the deck from the real planned target centres while remaining inside the roof mass;
- focused contract and final visual review pass.

### Police

- the pre-final capture scored approximately `1.57`, just below the `1.6` threshold, because family organisation still depended too strongly on blue palette plus separate props;
- one restrained civic communications court now groups HVAC and antenna;
- no badge, text label, extra prop or full-roof accent was added;
- the final police capture scores `1.86`.

## Automated validation

Exact visual head `bd263451386ca89a0a6f942056bd135bc03c98f7` completed workflow `32355086754` fully green:

- unit tests: **success**;
- browser campaign: **success**;
- browser building review: **success**;
- browser boot: **success**;
- browser systems shard 1/3: **success**;
- browser systems shard 2/3: **success**;
- browser systems shard 3/3: **success**;
- Netlify deploy preview: **success**;
- no building-focused or unrelated regression remains in the exact final workflow.

## Technical boundary audit

Throughout M0–M6:

- authored `x`, `y`, `w`, `h` remained collision/navigation authority;
- no city topology, roads, sidewalks or generated-city geometry was changed by the polish initiative;
- no gameplay, AI, mission or interaction authority moved into the renderer;
- renderer-only shadows are the only presentation geometry allowed outside authored bounds;
- planned modules remain deterministic and contained;
- normal gameplay labels remain opt-in;
- medical profile classification remains visual-only and conservative/whole-word based.

## Final user validation and closure

Fran approved the final visual package on **2026-08-20**, noting that it is substantially better than the previous presentation and preferring to close the initiative now, with any future improvements handled as later iterations if needed.

M6 is therefore **complete** and the building-visual-polish initiative is closed.

PR #63 may now leave draft state and become ready for review. Merge remains a separate explicit user action and is not performed as part of this closure.
