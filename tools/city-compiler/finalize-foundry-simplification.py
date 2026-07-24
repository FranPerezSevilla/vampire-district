from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_required(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    if old not in text:
        raise RuntimeError(f"Unable to update {label} in {path.relative_to(ROOT)}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def replace_optional(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


unit_path = ROOT / "tests/road-graph.test.js"
browser_path = ROOT / "tests/browser/road-graph-geometry.spec.js"

replace_required(unit_path, "assert.equal(compiled.stats.graphNodeCount, 114);", "assert.equal(compiled.stats.graphNodeCount, 107);", "unit graph node metric")
replace_required(unit_path, "assert.equal(compiled.stats.graphEdgeCount, 158);", "assert.equal(compiled.stats.graphEdgeCount, 148);", "unit graph edge metric")
replace_required(unit_path, "assert.equal(compiled.stats.roadSegmentCount, 147);", "assert.equal(compiled.stats.roadSegmentCount, 144);", "unit road segment metric")
replace_required(unit_path, "assert.equal(compiled.stats.sidewalkCount, 778);", "assert.equal(compiled.stats.sidewalkCount, 776);", "unit sidewalk metric")
replace_required(unit_path, "assert.equal(compiled.stats.roadEdgeBandSourceCount, 294);", "assert.equal(compiled.stats.roadEdgeBandSourceCount, 288);", "unit band source metric")
replace_required(unit_path, "assert.equal(compiled.stats.absorbedShortApproachCount, 6);", "assert.equal(compiled.stats.absorbedShortApproachCount, 1);", "unit absorbed approach metric")
replace_required(unit_path, "assert.equal(compiled.stats.propExclusionZoneCount, 557);", "assert.equal(compiled.stats.propExclusionZoneCount, 536);", "unit exclusion metric")
replace_required(unit_path, "assert.equal(compiled.stats.lightCount, 126);", "assert.equal(compiled.stats.lightCount, 128);", "unit light metric")

unit_text = unit_path.read_text(encoding="utf-8")
density_test = '''\ntest("integrity rejects long parallel roads that leave no usable city block", () => {
  const dense = graph(
    [
      { id: "north-west", x: 40, y: 150 },
      { id: "north-east", x: 560, y: 150 },
      { id: "south-west", x: 40, y: 220 },
      { id: "south-east", x: 560, y: 220 }
    ],
    [
      { id: "north-road", from: "north-west", to: "north-east", width: 60, orientation: "horizontal", roadClass: "local", kind: "road", sourceRoadIds: ["north-road"] },
      { id: "south-road", from: "south-west", to: "south-east", width: 60, orientation: "horizontal", roadClass: "local", kind: "road", sourceRoadIds: ["south-road"] }
    ]
  );
  const integrity = roadGraphIntegrity(dense);

  assert.equal(integrity.valid, false);
  assert.equal(
    integrity.errors.some(error => error.code === "ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE"),
    true
  );
});
'''
marker = '\ntest("dumpsters are snapped after layout outside junction and crosswalk exclusions", () => {'
if density_test.strip() not in unit_text:
    if marker not in unit_text:
        raise RuntimeError("Unable to insert parallel-road integrity regression")
    unit_text = unit_text.replace(marker, density_test + marker, 1)

full_city_marker = "  assert.equal(roadGraphNodes.length, cityRoadGraph.nodes.length);"
foundry_assertions = '''  const retiredFoundrySources = new Set([
    "foundryService",
    "foundry:road:north-drop",
    "foundry:road:east-link"
  ]);
  assert.equal(
    cityRoadGraph.edges.some(edge => (edge.sourceRoadIds || []).some(sourceId => retiredFoundrySources.has(sourceId))),
    false
  );
  assert.equal(cityRoadGraph.edges.some(edge => edge.id === "road-edge:h:1680:2212:2340:2212"), true);
  assert.equal(cityRoadGraph.edges.some(edge => edge.id === "road-edge:v:1680:2212:1680:2572"), true);
  assert.equal(cityRoadGraph.edges.some(edge => edge.id === "road-edge:v:2340:2212:2340:2572"), true);

'''
if foundry_assertions.strip() not in unit_text:
    if full_city_marker not in unit_text:
        raise RuntimeError("Unable to insert Foundry perimeter assertions")
    unit_text = unit_text.replace(full_city_marker, foundry_assertions + full_city_marker, 1)
unit_path.write_text(unit_text, encoding="utf-8")

browser_replacements = [
    ("expect(result.geometryVersion).toBe(3);", "expect(result.geometryVersion).toBe(4);"),
    ("expect(result.graphNodes).toBe(114);", "expect(result.graphNodes).toBe(107);"),
    ("expect(result.graphEdges).toBe(158);", "expect(result.graphEdges).toBe(148);"),
    ("expect(result.roadSegments).toBe(147);", "expect(result.roadSegments).toBe(144);"),
    ("expect(result.junctionPieces).toBe(104);", "expect(result.junctionPieces).toBe(103);"),
    ("expect(result.sidewalks).toBe(778);", "expect(result.sidewalks).toBe(776);"),
    ("expect(result.roadEdgeBandSources).toBe(294);", "expect(result.roadEdgeBandSources).toBe(288);"),
    ("expect(result.absorbedShortApproaches).toBe(6);", "expect(result.absorbedShortApproaches).toBe(1);"),
    ("expect(result.junctionSidewalks).toBe(469);", "expect(result.junctionSidewalks).toBe(467);"),
    ("expect(result.propExclusionZones).toBe(557);", "expect(result.propExclusionZones).toBe(536);"),
    ("expect(result.lights).toBe(126);", "expect(result.lights).toBe(128);"),
    ("expect(result.stats.roadGeometryVersion).toBe(3);", "expect(result.stats.roadGeometryVersion).toBe(4);"),
]
for old, new in browser_replacements:
    replace_required(browser_path, old, new, f"browser metric {old}")

browser_text = browser_path.read_text(encoding="utf-8")
return_marker = "      invalidDumpsters,\n      generatedRouteLengths:"
return_replacement = '''      invalidDumpsters,
      retiredFoundryRoads: district.roadGraphEdges
        .filter(edge => (edge.sourceRoadIds || []).some(sourceId => [
          "foundryService",
          "foundry:road:north-drop",
          "foundry:road:east-link"
        ].includes(sourceId)))
        .map(edge => edge.id),
      generatedRouteLengths:'''
if "retiredFoundryRoads:" not in browser_text:
    if return_marker not in browser_text:
        raise RuntimeError("Unable to add Foundry browser regression result")
    browser_text = browser_text.replace(return_marker, return_replacement, 1)
assert_marker = "  expect(result.invalidDumpsters).toEqual([]);\n"
assert_replacement = assert_marker + "  expect(result.retiredFoundryRoads).toEqual([]);\n"
if "expect(result.retiredFoundryRoads).toEqual([]);" not in browser_text:
    if assert_marker not in browser_text:
        raise RuntimeError("Unable to add Foundry browser regression assertion")
    browser_text = browser_text.replace(assert_marker, assert_replacement, 1)
browser_path.write_text(browser_text, encoding="utf-8")

road_doc = ROOT / "docs/ROAD_GRAPH_GEOMETRY.md"
replace_optional(road_doc, [
    ("geometry v3 now guarantees continuous road-edge bands", "geometry v4 now guarantees continuous road-edge bands and usable road-block depth"),
    ("horizontal | vertical in geometry v3", "horizontal | vertical in geometry v4"),
    ("diagonal edges in axis-aligned geometry v3", "diagonal edges in axis-aligned geometry v4"),
    ("graph nodes                  114\nsingle/cluster authorities   104\nmulti-node clusters           10", "graph nodes                  107\njunction authority pieces     103"),
    ("straight segments   147\njunction pieces     104", "straight segments   144\njunction pieces     103"),
    ("all road pieces     251", "all road pieces     247"),
    ("road-edge band sources      294", "road-edge band sources      288"),
    ("junction-owned surfaces     469", "junction-owned surfaces     467"),
    ("total sidewalk surfaces     778", "total sidewalk surfaces     776"),
    ("absorbed micro-approaches      6", "absorbed micro-approaches      1"),
    ("post-layout lights   126", "post-layout lights   128"),
    ("prop exclusion zones   557", "prop exclusion zones   536"),
    ("Road geometry v3 is deliberately axis-aligned", "Road geometry v4 is deliberately axis-aligned"),
])
road_text = road_doc.read_text(encoding="utf-8")
integrity_marker = "- disconnected road components.\n"
integrity_note = integrity_marker + "- parallel road pairs overlapping at least 120 units when they leave less than 36 units of usable block depth.\n"
if "less than 36 units of usable block depth" not in road_text:
    road_text = road_text.replace(integrity_marker, integrity_note, 1)
phase_marker = "### Phase 2 — Node classification\n"
foundry_note = '''### Foundry industrial-yard simplification

Geometry v4 removes the redundant Foundry Works Road, north-drop and east-link micro-grid. The district now uses a legible perimeter formed by Foundry North Service, Foundry Service Spine, Civic Avenue and Canal South Service. The enclosed space is an industrial loading yard rather than another public-road block.

The rule is graph-level and independent from streaming chunks: chunks only partition the generated surfaces and never create additional roads.

'''
if "### Foundry industrial-yard simplification" not in road_text:
    road_text = road_text.replace(phase_marker, foundry_note + phase_marker, 1)
validation_marker = "ROAD_GRAPH_DISCONNECTED\n"
if "ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE" not in road_text:
    road_text = road_text.replace(validation_marker, validation_marker + "ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE\n", 1)
road_doc.write_text(road_text, encoding="utf-8")

common_docs = [
    ROOT / "docs/CITY_TOPOLOGY_V2.md",
    ROOT / "docs/PROJECT_BLUEPRINT.md",
    ROOT / "docs/PROJECT_SNAPSHOT.md",
    ROOT / "docs/ROADMAP.md",
    ROOT / "docs/TECHNICAL_ARCHITECTURE.md",
    ROOT / "docs/TESTING_STRATEGY.md",
]
common_replacements = [
    ("geometry v3", "geometry v4"),
    ("Geometry v3", "Geometry v4"),
    ("114-node / 158-edge", "107-node / 148-edge"),
    ("114 nodes / 158 edges", "107 nodes / 148 edges"),
    ("114 road nodes and 158 edges", "107 road nodes and 148 edges"),
    ("147 clipped segments and 104 junction authorities", "144 clipped segments and 103 junction authorities"),
    ("147 clipped straight road pieces and 104 junction authorities", "144 clipped straight road pieces and 103 junction authorities"),
    ("778 sidewalk surfaces: 309 continuous road-edge bands from 294 sources plus 469 junction-owned surfaces", "776 sidewalk surfaces: 309 continuous road-edge bands from 288 sources plus 467 junction-owned surfaces"),
    ("778 (309 edge bands / 469 junction-owned)", "776 (309 edge bands / 467 junction-owned)"),
    ("126 post-layout lights", "128 post-layout lights"),
    ("557 prop-exclusion zones", "536 prop-exclusion zones"),
    ("absorbs six micro-approaches", "absorbs one remaining micro-approach"),
]
for path in common_docs:
    replace_optional(path, common_replacements)

changelog = ROOT / "CHANGELOG.md"
if changelog.exists():
    text = changelog.read_text(encoding="utf-8")
    entry = '''\n## 2026-07-24 — Foundry industrial road-block simplification

- Removed the redundant Foundry Works Road, north-drop and east-link micro-grid.
- Preserved a four-edge perimeter around a usable industrial loading yard.
- Added graph validation for parallel roads that leave less than 36 units of block depth.
- Migrated the Foundry semantic corridor and pedestrian route anchor to the perimeter.
- Regenerated City Topology V2 and all affected chunks from road geometry v4.
'''
    if "## 2026-07-24 — Foundry industrial road-block simplification" not in text:
        first_break = text.find("\n")
        text = text[:first_break + 1] + entry + text[first_break + 1:]
        changelog.write_text(text, encoding="utf-8")

for relative in [
    ".github/workflows/apply-foundry-road-simplification.yml",
    "tools/city-compiler/apply-foundry-simplification.py",
    "tools/city-compiler/finalize-foundry-simplification.py",
    "foundry-topology.log",
    "foundry-metrics.json",
]:
    path = ROOT / relative
    if path.exists():
        path.unlink()

print("Finalized Foundry simplification tests, documentation and temporary-file cleanup")
