from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GRAPH_PATH = ROOT / "tools/city-compiler/city-road-graph-v1.js"
COMPILER_PATH = ROOT / "tools/city-compiler/road-graph.js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Unable to find {label}")
    return text.replace(old, new, 1)


def update_graph() -> None:
    text = GRAPH_PATH.read_text(encoding="utf-8")
    match = re.search(
        r'export const CITY_ROAD_GRAPH_VERSION = \d+;\nexport const cityRoadGraph = deepFreeze\((.*)\);\s*$',
        text,
        re.S,
    )
    if not match:
        raise RuntimeError("Unable to parse city road graph")
    graph = json.loads(match.group(1))

    removed_nodes = {
        "road-node:1770:2212",
        "road-node:1320:2290",
        "road-node:1680:2290",
        "road-node:1770:2290",
        "road-node:2340:2290",
        "road-node:1770:2346",
        "road-node:2340:2346",
    }
    removed_edges = {
        "road-edge:h:1680:2212:1770:2212",
        "road-edge:h:1770:2212:2340:2212",
        "road-edge:v:1680:2212:1680:2290",
        "road-edge:v:1770:2212:1770:2290",
        "road-edge:v:2340:2212:2340:2290",
        "road-edge:h:1320:2290:1680:2290",
        "road-edge:h:1680:2290:1770:2290",
        "road-edge:v:1680:2290:1680:2572",
        "road-edge:h:1770:2290:2340:2290",
        "road-edge:v:1770:2290:1770:2346",
        "road-edge:v:2340:2290:2340:2346",
        "road-edge:h:1770:2346:2340:2346",
        "road-edge:v:2340:2346:2340:2572",
    }
    replacement_edges = [
        {
            "id": "road-edge:h:1680:2212:2340:2212",
            "from": "road-node:1680:2212",
            "to": "road-node:2340:2212",
            "width": 64,
            "orientation": "horizontal",
            "roadClass": "alley",
            "kind": "alley",
            "label": "Foundry North Service",
            "sourceRoadIds": ["canalNorthService", "foundry:road:north-yard"],
            "generated": False,
        },
        {
            "id": "road-edge:v:1680:2212:1680:2572",
            "from": "road-node:1680:2212",
            "to": "road-node:1680:2572",
            "width": 64,
            "orientation": "vertical",
            "roadClass": "alley",
            "kind": "alley",
            "label": "Foundry Service Spine",
            "sourceRoadIds": ["foundryVertical"],
            "generated": False,
        },
        {
            "id": "road-edge:v:2340:2212:2340:2572",
            "from": "road-node:2340:2212",
            "to": "road-node:2340:2572",
            "width": 120,
            "orientation": "vertical",
            "roadClass": "major",
            "kind": "road",
            "label": "Civic Avenue",
            "sourceRoadIds": ["civicSpine"],
            "generated": False,
        },
    ]

    graph["nodes"] = [node for node in graph["nodes"] if node["id"] not in removed_nodes]
    retained_edges = [edge for edge in graph["edges"] if edge["id"] not in removed_edges]
    retained_ids = {edge["id"] for edge in retained_edges}
    for edge in replacement_edges:
        if edge["id"] not in retained_ids:
            retained_edges.append(edge)

    node_by_id = {node["id"]: node for node in graph["nodes"]}

    def edge_sort_key(edge: dict) -> tuple:
        start = node_by_id[edge["from"]]
        end = node_by_id[edge["to"]]
        first, second = sorted((start, end), key=lambda point: (point["y"], point["x"]))
        return (first["y"], first["x"], second["y"], second["x"], edge["id"])

    graph["edges"] = sorted(retained_edges, key=edge_sort_key)

    for corridor in graph.get("corridors", []):
        if corridor.get("id") != "foundry-hook":
            continue
        corridor.update({
            "label": "Foundry yard perimeter",
            "kind": "service",
            "geometry": "polyline",
            "curveHint": "rounded-corners",
            "points": [
                {"x": 1680, "y": 2212},
                {"x": 2340, "y": 2212},
                {"x": 2340, "y": 2572},
                {"x": 1680, "y": 2572},
                {"x": 1680, "y": 2212},
            ],
            "sourceRoadIds": [
                "foundry:road:north-yard",
                "civicSpine",
                "canalSouthService",
                "foundryVertical",
            ],
            "graphEdgeIds": [
                "road-edge:h:1680:2212:2340:2212",
                "road-edge:v:2340:2212:2340:2572",
                "road-edge:h:1680:2572:2340:2572",
                "road-edge:v:1680:2212:1680:2572",
            ],
        })

    for anchor in graph.get("pedestrianRouteAnchors", []):
        if anchor.get("id") != "foundry:pedestrian-route:works-loop":
            continue
        anchor.update({
            "name": "Foundry works perimeter loop",
            "bounds": {"x": 1640, "y": 2140, "w": 740, "h": 500},
            "center": {"x": 2010, "y": 2392},
        })

    source = '\n'.join([
        '"use strict";',
        '',
        'function deepFreeze(value) {',
        '  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;',
        '  for (const child of Object.values(value)) deepFreeze(child);',
        '  return Object.freeze(value);',
        '}',
        '',
        'export const CITY_ROAD_GRAPH_VERSION = 4;',
        f'export const cityRoadGraph = deepFreeze({json.dumps(graph, indent=2, ensure_ascii=False)});',
        '',
    ])
    GRAPH_PATH.write_text(source, encoding="utf-8")


def update_integrity_validation() -> None:
    text = COMPILER_PATH.read_text(encoding="utf-8")
    text = replace_once(
        text,
        'const ROAD_CLASS_PRIORITY = Object.freeze({ alley: 1, local: 2, major: 3 });\n',
        'const ROAD_CLASS_PRIORITY = Object.freeze({ alley: 1, local: 2, major: 3 });\n'
        'const MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH = 36;\n'
        'const MINIMUM_PARALLEL_ROAD_OVERLAP = 120;\n',
        "parallel-road constants",
    )
    validation = '''  for (let leftIndex = 0; leftIndex < edges.length; leftIndex++) {
    const leftEdge = edges[leftIndex];
    const leftFrom = nodes.get(leftEdge.from);
    const leftTo = nodes.get(leftEdge.to);
    if (!leftFrom || !leftTo) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex++) {
      const rightEdge = edges[rightIndex];
      if (leftEdge.orientation !== rightEdge.orientation) continue;
      const rightFrom = nodes.get(rightEdge.from);
      const rightTo = nodes.get(rightEdge.to);
      if (!rightFrom || !rightTo) continue;
      const horizontal = leftEdge.orientation === "horizontal";
      const leftFixed = horizontal ? finite(leftFrom.y) : finite(leftFrom.x);
      const rightFixed = horizontal ? finite(rightFrom.y) : finite(rightFrom.x);
      const centerlineGap = Math.abs(leftFixed - rightFixed);
      if (centerlineGap <= EPSILON) continue;
      const leftStart = horizontal ? Math.min(finite(leftFrom.x), finite(leftTo.x)) : Math.min(finite(leftFrom.y), finite(leftTo.y));
      const leftEnd = horizontal ? Math.max(finite(leftFrom.x), finite(leftTo.x)) : Math.max(finite(leftFrom.y), finite(leftTo.y));
      const rightStart = horizontal ? Math.min(finite(rightFrom.x), finite(rightTo.x)) : Math.min(finite(rightFrom.y), finite(rightTo.y));
      const rightEnd = horizontal ? Math.max(finite(rightFrom.x), finite(rightTo.x)) : Math.max(finite(rightFrom.y), finite(rightTo.y));
      const overlap = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
      const blockDepth = centerlineGap - (finite(leftEdge.width) + finite(rightEdge.width)) / 2;
      if (overlap >= MINIMUM_PARALLEL_ROAD_OVERLAP && blockDepth < MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH - EPSILON) {
        errors.push({
          code: "ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE",
          leftEdgeId: leftEdge.id,
          rightEdgeId: rightEdge.id,
          overlap: rounded(overlap),
          blockDepth: rounded(blockDepth),
          requiredBlockDepth: MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH
        });
      }
    }
  }
'''
    text = replace_once(
        text,
        '  if (compiled) {\n',
        validation + '  if (compiled) {\n',
        "parallel-road integrity validation",
    )
    COMPILER_PATH.write_text(text, encoding="utf-8")


update_graph()
update_integrity_validation()
print("Applied Foundry road-block simplification and density validation")
