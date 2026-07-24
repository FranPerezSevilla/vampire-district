"use strict";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const CITY_ROAD_GRAPH_VERSION = 4;
export const cityRoadGraph = deepFreeze({
  "version": 1,
  "geometry": "axis-aligned-centreline-graph",
  "nodes": [
    {
      "id": "road-node:1140:0",
      "x": 1140,
      "y": 0,
      "sourceRoadIds": [
        "westSpine"
      ]
    },
    {
      "id": "road-node:2340:0",
      "x": 2340,
      "y": 0,
      "sourceRoadIds": [
        "civicSpine"
      ]
    },
    {
      "id": "road-node:3540:0",
      "x": 3540,
      "y": 0,
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4500:0",
      "x": 4500,
      "y": 0,
      "sourceRoadIds": [
        "harborSpine"
      ]
    },
    {
      "id": "road-node:3540:180",
      "x": 3540,
      "y": 180,
      "sourceRoadIds": [
        "campusWestLane",
        "cathedralNorthLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4280:180",
      "x": 4280,
      "y": 180,
      "sourceRoadIds": [
        "cathedralEastLane",
        "cathedralNorthLane"
      ]
    },
    {
      "id": "road-node:1360:200",
      "x": 1360,
      "y": 200,
      "sourceRoadIds": [
        "civicNorthLane",
        "policeWestLane"
      ]
    },
    {
      "id": "road-node:2080:200",
      "x": 2080,
      "y": 200,
      "sourceRoadIds": [
        "civicNorthLane",
        "policeEastLane"
      ]
    },
    {
      "id": "road-node:2340:200",
      "x": 2340,
      "y": 200,
      "sourceRoadIds": [
        "civicNorthLane",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2480:200",
      "x": 2480,
      "y": 200,
      "sourceRoadIds": [
        "civicNorthLane",
        "hallWestLane"
      ]
    },
    {
      "id": "road-node:3080:200",
      "x": 3080,
      "y": 200,
      "sourceRoadIds": [
        "civicNorthLane",
        "hallEastLane"
      ]
    },
    {
      "id": "road-node:3540:200",
      "x": 3540,
      "y": 200,
      "sourceRoadIds": [
        "campusWestLane",
        "civicNorthLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:162:202",
      "x": 162,
      "y": 202,
      "sourceRoadIds": [
        "hospitalNorthRoad",
        "hospitalWestRoad"
      ]
    },
    {
      "id": "road-node:918:202",
      "x": 918,
      "y": 202,
      "sourceRoadIds": [
        "hospitalEastRoad",
        "hospitalNorthRoad"
      ]
    },
    {
      "id": "road-node:918:466",
      "x": 918,
      "y": 466,
      "sourceRoadIds": [
        "hospitalEastRoad",
        "hospitalEmergencyApproach"
      ]
    },
    {
      "id": "road-node:1140:466",
      "x": 1140,
      "y": 466,
      "sourceRoadIds": [
        "hospitalEmergencyApproach",
        "westSpine"
      ]
    },
    {
      "id": "road-node:162:738",
      "x": 162,
      "y": 738,
      "sourceRoadIds": [
        "hospitalSouthRoad",
        "hospitalWestRoad"
      ]
    },
    {
      "id": "road-node:918:738",
      "x": 918,
      "y": 738,
      "sourceRoadIds": [
        "hospitalEastRoad",
        "hospitalSouthRoad"
      ]
    },
    {
      "id": "road-node:1360:740",
      "x": 1360,
      "y": 740,
      "sourceRoadIds": [
        "civicSouthLane",
        "policeWestLane"
      ]
    },
    {
      "id": "road-node:2080:740",
      "x": 2080,
      "y": 740,
      "sourceRoadIds": [
        "civicSouthLane",
        "policeEastLane"
      ]
    },
    {
      "id": "road-node:2340:740",
      "x": 2340,
      "y": 740,
      "sourceRoadIds": [
        "civicSouthLane",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2480:740",
      "x": 2480,
      "y": 740,
      "sourceRoadIds": [
        "civicSouthLane",
        "hallWestLane"
      ]
    },
    {
      "id": "road-node:3080:740",
      "x": 3080,
      "y": 740,
      "sourceRoadIds": [
        "civicSouthLane",
        "hallEastLane"
      ]
    },
    {
      "id": "road-node:3540:740",
      "x": 3540,
      "y": 740,
      "sourceRoadIds": [
        "campusWestLane",
        "civicSouthLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:3540:760",
      "x": 3540,
      "y": 760,
      "sourceRoadIds": [
        "campusWestLane",
        "cathedralSouthLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4280:760",
      "x": 4280,
      "y": 760,
      "sourceRoadIds": [
        "cathedralEastLane",
        "cathedralSouthLane"
      ]
    },
    {
      "id": "road-node:0:960",
      "x": 0,
      "y": 960,
      "sourceRoadIds": [
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:554:960",
      "x": 554,
      "y": 960,
      "sourceRoadIds": [
        "northBoulevard",
        "westMarketVertical"
      ]
    },
    {
      "id": "road-node:1140:960",
      "x": 1140,
      "y": 960,
      "sourceRoadIds": [
        "northBoulevard",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1754:960",
      "x": 1754,
      "y": 960,
      "sourceRoadIds": [
        "northBoulevard",
        "oldQuarterVertical"
      ]
    },
    {
      "id": "road-node:2340:960",
      "x": 2340,
      "y": 960,
      "sourceRoadIds": [
        "civicSpine",
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:2954:960",
      "x": 2954,
      "y": 960,
      "sourceRoadIds": [
        "glassVertical",
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:3540:960",
      "x": 3540,
      "y": 960,
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine",
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:4500:960",
      "x": 4500,
      "y": 960,
      "sourceRoadIds": [
        "harborSpine",
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:4800:960",
      "x": 4800,
      "y": 960,
      "sourceRoadIds": [
        "northBoulevard"
      ]
    },
    {
      "id": "road-node:3540:1156",
      "x": 3540,
      "y": 1156,
      "sourceRoadIds": [
        "campusNorthLane",
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4284:1156",
      "x": 4284,
      "y": 1156,
      "sourceRoadIds": [
        "campusEastLane",
        "campusNorthLane"
      ]
    },
    {
      "id": "road-node:120:1192",
      "x": 120,
      "y": 1192,
      "sourceRoadIds": [
        "marketLane"
      ]
    },
    {
      "id": "road-node:554:1192",
      "x": 554,
      "y": 1192,
      "sourceRoadIds": [
        "marketLane",
        "westMarketVertical"
      ]
    },
    {
      "id": "road-node:1140:1192",
      "x": 1140,
      "y": 1192,
      "sourceRoadIds": [
        "marketLane",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1320:1574",
      "x": 1320,
      "y": 1574,
      "sourceRoadIds": [
        "oldQuarterLane"
      ]
    },
    {
      "id": "road-node:1754:1574",
      "x": 1754,
      "y": 1574,
      "sourceRoadIds": [
        "oldQuarterLane",
        "oldQuarterVertical"
      ]
    },
    {
      "id": "road-node:2340:1574",
      "x": 2340,
      "y": 1574,
      "sourceRoadIds": [
        "civicSpine",
        "oldQuarterLane"
      ]
    },
    {
      "id": "road-node:3540:1636",
      "x": 3540,
      "y": 1636,
      "sourceRoadIds": [
        "campusSouthLane",
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4284:1636",
      "x": 4284,
      "y": 1636,
      "sourceRoadIds": [
        "campusEastLane",
        "campusSouthLane"
      ]
    },
    {
      "id": "road-node:0:1920",
      "x": 0,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard"
      ]
    },
    {
      "id": "road-node:554:1920",
      "x": 554,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "westMarketVertical"
      ]
    },
    {
      "id": "road-node:752:1920",
      "x": 752,
      "y": 1920,
      "sourceRoadIds": [
        "canalWestVertical",
        "centralBoulevard"
      ]
    },
    {
      "id": "road-node:1140:1920",
      "x": 1140,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1680:1920",
      "x": 1680,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "foundryVertical"
      ]
    },
    {
      "id": "road-node:1754:1920",
      "x": 1754,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "oldQuarterVertical"
      ]
    },
    {
      "id": "road-node:2340:1920",
      "x": 2340,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2912:1920",
      "x": 2912,
      "y": 1920,
      "sourceRoadIds": [
        "canalEastVertical",
        "centralBoulevard"
      ]
    },
    {
      "id": "road-node:2954:1920",
      "x": 2954,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "glassVertical"
      ]
    },
    {
      "id": "road-node:3540:1920",
      "x": 3540,
      "y": 1920,
      "sourceRoadIds": [
        "campusWestLane",
        "centralBoulevard",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4112:1920",
      "x": 4112,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "harborVertical"
      ]
    },
    {
      "id": "road-node:4500:1920",
      "x": 4500,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard",
        "harborSpine"
      ]
    },
    {
      "id": "road-node:4800:1920",
      "x": 4800,
      "y": 1920,
      "sourceRoadIds": [
        "centralBoulevard"
      ]
    },
    {
      "id": "road-node:120:2212",
      "x": 120,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:752:2212",
      "x": 752,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "canalWestVertical",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:1140:2212",
      "x": 1140,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1680:2212",
      "x": 1680,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard",
        "foundryVertical"
      ]
    },
    {
      "id": "road-node:2340:2212",
      "x": 2340,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "civicSpine",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:2912:2212",
      "x": 2912,
      "y": 2212,
      "sourceRoadIds": [
        "canalEastVertical",
        "canalNorthService",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:3540:2212",
      "x": 3540,
      "y": 2212,
      "sourceRoadIds": [
        "campusWestLane",
        "canalNorthService",
        "eastSpine",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:4112:2212",
      "x": 4112,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard",
        "harborVertical"
      ]
    },
    {
      "id": "road-node:4320:2212",
      "x": 4320,
      "y": 2212,
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ]
    },
    {
      "id": "road-node:3540:2390",
      "x": 3540,
      "y": 2390,
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine",
        "harborService"
      ]
    },
    {
      "id": "road-node:4112:2390",
      "x": 4112,
      "y": 2390,
      "sourceRoadIds": [
        "harborService",
        "harborVertical"
      ]
    },
    {
      "id": "road-node:4500:2390",
      "x": 4500,
      "y": 2390,
      "sourceRoadIds": [
        "harborService",
        "harborSpine"
      ]
    },
    {
      "id": "road-node:120:2572",
      "x": 120,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService"
      ]
    },
    {
      "id": "road-node:752:2572",
      "x": 752,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService",
        "canalWestVertical"
      ]
    },
    {
      "id": "road-node:1140:2572",
      "x": 1140,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1680:2572",
      "x": 1680,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService",
        "foundryVertical"
      ]
    },
    {
      "id": "road-node:2340:2572",
      "x": 2340,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2912:2572",
      "x": 2912,
      "y": 2572,
      "sourceRoadIds": [
        "canalEastVertical",
        "canalSouthService"
      ]
    },
    {
      "id": "road-node:3540:2572",
      "x": 3540,
      "y": 2572,
      "sourceRoadIds": [
        "campusWestLane",
        "canalSouthService",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4112:2572",
      "x": 4112,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService",
        "harborVertical"
      ]
    },
    {
      "id": "road-node:4320:2572",
      "x": 4320,
      "y": 2572,
      "sourceRoadIds": [
        "canalSouthService"
      ]
    },
    {
      "id": "road-node:0:2820",
      "x": 0,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard"
      ]
    },
    {
      "id": "road-node:752:2820",
      "x": 752,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "canalWestVertical"
      ]
    },
    {
      "id": "road-node:1140:2820",
      "x": 1140,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1680:2820",
      "x": 1680,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "foundryVertical"
      ]
    },
    {
      "id": "road-node:2340:2820",
      "x": 2340,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2912:2820",
      "x": 2912,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "canalEastVertical"
      ]
    },
    {
      "id": "road-node:3540:2820",
      "x": 3540,
      "y": 2820,
      "sourceRoadIds": [
        "campusWestLane",
        "canalBoulevard",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4112:2820",
      "x": 4112,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "harborVertical"
      ]
    },
    {
      "id": "road-node:4500:2820",
      "x": 4500,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard",
        "harborSpine"
      ]
    },
    {
      "id": "road-node:4800:2820",
      "x": 4800,
      "y": 2820,
      "sourceRoadIds": [
        "canalBoulevard"
      ]
    },
    {
      "id": "road-node:120:3052",
      "x": 120,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterWestLane"
      ]
    },
    {
      "id": "road-node:1140:3052",
      "x": 1140,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterWestLane",
        "westSpine"
      ]
    },
    {
      "id": "road-node:1320:3052",
      "x": 1320,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterMidLane"
      ]
    },
    {
      "id": "road-node:2340:3052",
      "x": 2340,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterMidLane",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:2520:3052",
      "x": 2520,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterEastLane"
      ]
    },
    {
      "id": "road-node:3540:3052",
      "x": 3540,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterEastLane",
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4080:3052",
      "x": 4080,
      "y": 3052,
      "sourceRoadIds": [
        "blackwaterEastLane",
        "harborFreightLane"
      ]
    },
    {
      "id": "road-node:4500:3052",
      "x": 4500,
      "y": 3052,
      "sourceRoadIds": [
        "harborFreightLane",
        "harborSpine"
      ]
    },
    {
      "id": "road-node:0:3340",
      "x": 0,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ]
    },
    {
      "id": "road-node:1140:3340",
      "x": 1140,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard",
        "westSpine"
      ]
    },
    {
      "id": "road-node:2340:3340",
      "x": 2340,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard",
        "civicSpine"
      ]
    },
    {
      "id": "road-node:3540:3340",
      "x": 3540,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard",
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4500:3340",
      "x": 4500,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard",
        "harborSpine"
      ]
    },
    {
      "id": "road-node:4800:3340",
      "x": 4800,
      "y": 3340,
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ]
    },
    {
      "id": "road-node:1140:3600",
      "x": 1140,
      "y": 3600,
      "sourceRoadIds": [
        "westSpine"
      ]
    },
    {
      "id": "road-node:2340:3600",
      "x": 2340,
      "y": 3600,
      "sourceRoadIds": [
        "civicSpine"
      ]
    },
    {
      "id": "road-node:3540:3600",
      "x": 3540,
      "y": 3600,
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ]
    },
    {
      "id": "road-node:4500:3600",
      "x": 4500,
      "y": 3600,
      "sourceRoadIds": [
        "harborSpine"
      ]
    }
  ],
  "edges": [
    {
      "id": "road-edge:v:1140:0:1140:466",
      "from": "road-node:1140:0",
      "to": "road-node:1140:466",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:0:2340:200",
      "from": "road-node:2340:0",
      "to": "road-node:2340:200",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:0:3540:180",
      "from": "road-node:3540:0",
      "to": "road-node:3540:180",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:0:4500:960",
      "from": "road-node:4500:0",
      "to": "road-node:4500:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:180:4280:180",
      "from": "road-node:3540:180",
      "to": "road-node:4280:180",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Cathedral Rise",
      "sourceRoadIds": [
        "cathedralNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:180:3540:200",
      "from": "road-node:3540:180",
      "to": "road-node:3540:200",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4280:180:4280:760",
      "from": "road-node:4280:180",
      "to": "road-node:4280:760",
      "width": 80,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Bell Tower Road",
      "sourceRoadIds": [
        "cathedralEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1360:200:2080:200",
      "from": "road-node:1360:200",
      "to": "road-node:2080:200",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic North Lane",
      "sourceRoadIds": [
        "civicNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1360:200:1360:740",
      "from": "road-node:1360:200",
      "to": "road-node:1360:740",
      "width": 80,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Constable Lane",
      "sourceRoadIds": [
        "policeWestLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2080:200:2340:200",
      "from": "road-node:2080:200",
      "to": "road-node:2340:200",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic North Lane",
      "sourceRoadIds": [
        "civicNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2080:200:2080:740",
      "from": "road-node:2080:200",
      "to": "road-node:2080:740",
      "width": 80,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Bluegate Lane",
      "sourceRoadIds": [
        "policeEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:200:2480:200",
      "from": "road-node:2340:200",
      "to": "road-node:2480:200",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic North Lane",
      "sourceRoadIds": [
        "civicNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:200:2340:740",
      "from": "road-node:2340:200",
      "to": "road-node:2340:740",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2480:200:3080:200",
      "from": "road-node:2480:200",
      "to": "road-node:3080:200",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic North Lane",
      "sourceRoadIds": [
        "civicNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2480:200:2480:740",
      "from": "road-node:2480:200",
      "to": "road-node:2480:740",
      "width": 80,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Charter Lane",
      "sourceRoadIds": [
        "hallWestLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3080:200:3540:200",
      "from": "road-node:3080:200",
      "to": "road-node:3540:200",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic North Lane",
      "sourceRoadIds": [
        "civicNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3080:200:3080:740",
      "from": "road-node:3080:200",
      "to": "road-node:3080:740",
      "width": 80,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Archive Lane",
      "sourceRoadIds": [
        "hallEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:200:3540:740",
      "from": "road-node:3540:200",
      "to": "road-node:3540:740",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:162:202:918:202",
      "from": "road-node:162:202",
      "to": "road-node:918:202",
      "width": 84,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Mercy North Road",
      "sourceRoadIds": [
        "hospitalNorthRoad"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:162:202:162:738",
      "from": "road-node:162:202",
      "to": "road-node:162:738",
      "width": 84,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Mercy West Road",
      "sourceRoadIds": [
        "hospitalWestRoad"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:918:202:918:466",
      "from": "road-node:918:202",
      "to": "road-node:918:466",
      "width": 84,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Mercy East Road",
      "sourceRoadIds": [
        "hospitalEastRoad"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:466:918:466",
      "from": "road-node:1140:466",
      "to": "road-node:918:466",
      "width": 72,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Emergency Approach",
      "sourceRoadIds": [
        "hospitalEmergencyApproach"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:918:466:918:738",
      "from": "road-node:918:466",
      "to": "road-node:918:738",
      "width": 84,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Mercy East Road",
      "sourceRoadIds": [
        "hospitalEastRoad"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:466:1140:960",
      "from": "road-node:1140:466",
      "to": "road-node:1140:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:162:738:918:738",
      "from": "road-node:162:738",
      "to": "road-node:918:738",
      "width": 84,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Mercy South Road",
      "sourceRoadIds": [
        "hospitalSouthRoad"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1360:740:2080:740",
      "from": "road-node:1360:740",
      "to": "road-node:2080:740",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic South Lane",
      "sourceRoadIds": [
        "civicSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2080:740:2340:740",
      "from": "road-node:2080:740",
      "to": "road-node:2340:740",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic South Lane",
      "sourceRoadIds": [
        "civicSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:740:2480:740",
      "from": "road-node:2340:740",
      "to": "road-node:2480:740",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic South Lane",
      "sourceRoadIds": [
        "civicSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:740:2340:960",
      "from": "road-node:2340:740",
      "to": "road-node:2340:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2480:740:3080:740",
      "from": "road-node:2480:740",
      "to": "road-node:3080:740",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic South Lane",
      "sourceRoadIds": [
        "civicSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3080:740:3540:740",
      "from": "road-node:3080:740",
      "to": "road-node:3540:740",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Civic South Lane",
      "sourceRoadIds": [
        "civicSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:740:3540:760",
      "from": "road-node:3540:740",
      "to": "road-node:3540:760",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:760:4280:760",
      "from": "road-node:3540:760",
      "to": "road-node:4280:760",
      "width": 80,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "Reliquary Lane",
      "sourceRoadIds": [
        "cathedralSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:760:3540:960",
      "from": "road-node:3540:760",
      "to": "road-node:3540:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:0:960:554:960",
      "from": "road-node:0:960",
      "to": "road-node:554:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:960:554:960",
      "from": "road-node:1140:960",
      "to": "road-node:554:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:554:1192:554:960",
      "from": "road-node:554:1192",
      "to": "road-node:554:960",
      "width": 68,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "West Market Lane",
      "sourceRoadIds": [
        "westMarketVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:960:1754:960",
      "from": "road-node:1140:960",
      "to": "road-node:1754:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:1192:1140:960",
      "from": "road-node:1140:1192",
      "to": "road-node:1140:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1754:960:2340:960",
      "from": "road-node:1754:960",
      "to": "road-node:2340:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1754:1574:1754:960",
      "from": "road-node:1754:1574",
      "to": "road-node:1754:960",
      "width": 68,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Old Quarter Lane",
      "sourceRoadIds": [
        "oldQuarterVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:960:2954:960",
      "from": "road-node:2340:960",
      "to": "road-node:2954:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:1574:2340:960",
      "from": "road-node:2340:1574",
      "to": "road-node:2340:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2954:960:3540:960",
      "from": "road-node:2954:960",
      "to": "road-node:3540:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2954:1920:2954:960",
      "from": "road-node:2954:1920",
      "to": "road-node:2954:960",
      "width": 68,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Glasshouse Lane",
      "sourceRoadIds": [
        "glassVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:960:4500:960",
      "from": "road-node:3540:960",
      "to": "road-node:4500:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:1156:3540:960",
      "from": "road-node:3540:1156",
      "to": "road-node:3540:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4500:960:4800:960",
      "from": "road-node:4500:960",
      "to": "road-node:4800:960",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Vesper North Boulevard",
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:1920:4500:960",
      "from": "road-node:4500:1920",
      "to": "road-node:4500:960",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:1156:4284:1156",
      "from": "road-node:3540:1156",
      "to": "road-node:4284:1156",
      "width": 72,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "University North Walk",
      "sourceRoadIds": [
        "campusNorthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:1156:3540:1636",
      "from": "road-node:3540:1156",
      "to": "road-node:3540:1636",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4284:1156:4284:1636",
      "from": "road-node:4284:1156",
      "to": "road-node:4284:1636",
      "width": 72,
      "orientation": "vertical",
      "roadClass": "local",
      "kind": "road",
      "label": "Observatory Road",
      "sourceRoadIds": [
        "campusEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:120:1192:554:1192",
      "from": "road-node:120:1192",
      "to": "road-node:554:1192",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Market Service Lane",
      "sourceRoadIds": [
        "marketLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:1192:554:1192",
      "from": "road-node:1140:1192",
      "to": "road-node:554:1192",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Market Service Lane",
      "sourceRoadIds": [
        "marketLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:554:1192:554:1920",
      "from": "road-node:554:1192",
      "to": "road-node:554:1920",
      "width": 68,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "West Market Lane",
      "sourceRoadIds": [
        "westMarketVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:1192:1140:1920",
      "from": "road-node:1140:1192",
      "to": "road-node:1140:1920",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1320:1574:1754:1574",
      "from": "road-node:1320:1574",
      "to": "road-node:1754:1574",
      "width": 68,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Old Quarter Service Lane",
      "sourceRoadIds": [
        "oldQuarterLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1754:1574:2340:1574",
      "from": "road-node:1754:1574",
      "to": "road-node:2340:1574",
      "width": 68,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Old Quarter Service Lane",
      "sourceRoadIds": [
        "oldQuarterLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1754:1574:1754:1920",
      "from": "road-node:1754:1574",
      "to": "road-node:1754:1920",
      "width": 68,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Old Quarter Lane",
      "sourceRoadIds": [
        "oldQuarterVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:1574:2340:1920",
      "from": "road-node:2340:1574",
      "to": "road-node:2340:1920",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:1636:4284:1636",
      "from": "road-node:3540:1636",
      "to": "road-node:4284:1636",
      "width": 72,
      "orientation": "horizontal",
      "roadClass": "local",
      "kind": "road",
      "label": "University South Walk",
      "sourceRoadIds": [
        "campusSouthLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:1636:3540:1920",
      "from": "road-node:3540:1636",
      "to": "road-node:3540:1920",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:0:1920:554:1920",
      "from": "road-node:0:1920",
      "to": "road-node:554:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:554:1920:752:1920",
      "from": "road-node:554:1920",
      "to": "road-node:752:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:1920:752:1920",
      "from": "road-node:1140:1920",
      "to": "road-node:752:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:752:1920:752:2212",
      "from": "road-node:752:1920",
      "to": "road-node:752:2212",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal West Lane",
      "sourceRoadIds": [
        "canalWestVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:1920:1680:1920",
      "from": "road-node:1140:1920",
      "to": "road-node:1680:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:1920:1140:2212",
      "from": "road-node:1140:1920",
      "to": "road-node:1140:2212",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1680:1920:1754:1920",
      "from": "road-node:1680:1920",
      "to": "road-node:1754:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1680:1920:1680:2212",
      "from": "road-node:1680:1920",
      "to": "road-node:1680:2212",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Foundry Service Spine",
      "sourceRoadIds": [
        "foundryVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1754:1920:2340:1920",
      "from": "road-node:1754:1920",
      "to": "road-node:2340:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:1920:2912:1920",
      "from": "road-node:2340:1920",
      "to": "road-node:2912:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:1920:2340:2212",
      "from": "road-node:2340:1920",
      "to": "road-node:2340:2212",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2912:1920:2954:1920",
      "from": "road-node:2912:1920",
      "to": "road-node:2954:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2912:1920:2912:2212",
      "from": "road-node:2912:1920",
      "to": "road-node:2912:2212",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal East Lane",
      "sourceRoadIds": [
        "canalEastVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2954:1920:3540:1920",
      "from": "road-node:2954:1920",
      "to": "road-node:3540:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:1920:4112:1920",
      "from": "road-node:3540:1920",
      "to": "road-node:4112:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:1920:3540:2212",
      "from": "road-node:3540:1920",
      "to": "road-node:3540:2212",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4112:1920:4500:1920",
      "from": "road-node:4112:1920",
      "to": "road-node:4500:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4112:1920:4112:2212",
      "from": "road-node:4112:1920",
      "to": "road-node:4112:2212",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Lane",
      "sourceRoadIds": [
        "harborVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4500:1920:4800:1920",
      "from": "road-node:4500:1920",
      "to": "road-node:4800:1920",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Saint Orison Boulevard",
      "sourceRoadIds": [
        "centralBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:1920:4500:2390",
      "from": "road-node:4500:1920",
      "to": "road-node:4500:2390",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:120:2212:752:2212",
      "from": "road-node:120:2212",
      "to": "road-node:752:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2212:752:2212",
      "from": "road-node:1140:2212",
      "to": "road-node:752:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:752:2212:752:2572",
      "from": "road-node:752:2212",
      "to": "road-node:752:2572",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal West Lane",
      "sourceRoadIds": [
        "canalWestVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2212:1680:2212",
      "from": "road-node:1140:2212",
      "to": "road-node:1680:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:2212:1140:2572",
      "from": "road-node:1140:2212",
      "to": "road-node:1140:2572",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1680:2212:2340:2212",
      "from": "road-node:1680:2212",
      "to": "road-node:2340:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Foundry North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
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
      "sourceRoadIds": [
        "foundryVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:2212:2912:2212",
      "from": "road-node:2340:2212",
      "to": "road-node:2912:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
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
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2912:2212:3540:2212",
      "from": "road-node:2912:2212",
      "to": "road-node:3540:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2912:2212:2912:2572",
      "from": "road-node:2912:2212",
      "to": "road-node:2912:2572",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal East Lane",
      "sourceRoadIds": [
        "canalEastVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:2212:4112:2212",
      "from": "road-node:3540:2212",
      "to": "road-node:4112:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:2212:3540:2390",
      "from": "road-node:3540:2212",
      "to": "road-node:3540:2390",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4112:2212:4320:2212",
      "from": "road-node:4112:2212",
      "to": "road-node:4320:2212",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal North Service",
      "sourceRoadIds": [
        "canalNorthService",
        "foundry:road:north-yard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4112:2212:4112:2390",
      "from": "road-node:4112:2212",
      "to": "road-node:4112:2390",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Lane",
      "sourceRoadIds": [
        "harborVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:2390:4112:2390",
      "from": "road-node:3540:2390",
      "to": "road-node:4112:2390",
      "width": 60,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Road",
      "sourceRoadIds": [
        "harborService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:2390:3540:2572",
      "from": "road-node:3540:2390",
      "to": "road-node:3540:2572",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4112:2390:4500:2390",
      "from": "road-node:4112:2390",
      "to": "road-node:4500:2390",
      "width": 60,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Road",
      "sourceRoadIds": [
        "harborService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4112:2390:4112:2572",
      "from": "road-node:4112:2390",
      "to": "road-node:4112:2572",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Lane",
      "sourceRoadIds": [
        "harborVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:2390:4500:2820",
      "from": "road-node:4500:2390",
      "to": "road-node:4500:2820",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:120:2572:752:2572",
      "from": "road-node:120:2572",
      "to": "road-node:752:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2572:752:2572",
      "from": "road-node:1140:2572",
      "to": "road-node:752:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:752:2572:752:2820",
      "from": "road-node:752:2572",
      "to": "road-node:752:2820",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal West Lane",
      "sourceRoadIds": [
        "canalWestVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2572:1680:2572",
      "from": "road-node:1140:2572",
      "to": "road-node:1680:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:2572:1140:2820",
      "from": "road-node:1140:2572",
      "to": "road-node:1140:2820",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1680:2572:2340:2572",
      "from": "road-node:1680:2572",
      "to": "road-node:2340:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1680:2572:1680:2820",
      "from": "road-node:1680:2572",
      "to": "road-node:1680:2820",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Foundry Service Spine",
      "sourceRoadIds": [
        "foundryVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:2572:2912:2572",
      "from": "road-node:2340:2572",
      "to": "road-node:2912:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:2572:2340:2820",
      "from": "road-node:2340:2572",
      "to": "road-node:2340:2820",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2912:2572:3540:2572",
      "from": "road-node:2912:2572",
      "to": "road-node:3540:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2912:2572:2912:2820",
      "from": "road-node:2912:2572",
      "to": "road-node:2912:2820",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal East Lane",
      "sourceRoadIds": [
        "canalEastVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:2572:4112:2572",
      "from": "road-node:3540:2572",
      "to": "road-node:4112:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:2572:3540:2820",
      "from": "road-node:3540:2572",
      "to": "road-node:3540:2820",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4112:2572:4320:2572",
      "from": "road-node:4112:2572",
      "to": "road-node:4320:2572",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Canal South Service",
      "sourceRoadIds": [
        "canalSouthService"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4112:2572:4112:2820",
      "from": "road-node:4112:2572",
      "to": "road-node:4112:2820",
      "width": 64,
      "orientation": "vertical",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Service Lane",
      "sourceRoadIds": [
        "harborVertical"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:0:2820:752:2820",
      "from": "road-node:0:2820",
      "to": "road-node:752:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2820:752:2820",
      "from": "road-node:1140:2820",
      "to": "road-node:752:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:2820:1680:2820",
      "from": "road-node:1140:2820",
      "to": "road-node:1680:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:2820:1140:3052",
      "from": "road-node:1140:2820",
      "to": "road-node:1140:3052",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1680:2820:2340:2820",
      "from": "road-node:1680:2820",
      "to": "road-node:2340:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:2820:2912:2820",
      "from": "road-node:2340:2820",
      "to": "road-node:2912:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:2820:2340:3052",
      "from": "road-node:2340:2820",
      "to": "road-node:2340:3052",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2912:2820:3540:2820",
      "from": "road-node:2912:2820",
      "to": "road-node:3540:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:2820:4112:2820",
      "from": "road-node:3540:2820",
      "to": "road-node:4112:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:2820:3540:3052",
      "from": "road-node:3540:2820",
      "to": "road-node:3540:3052",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4112:2820:4500:2820",
      "from": "road-node:4112:2820",
      "to": "road-node:4500:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4500:2820:4800:2820",
      "from": "road-node:4500:2820",
      "to": "road-node:4800:2820",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Canal Boulevard",
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:2820:4500:3052",
      "from": "road-node:4500:2820",
      "to": "road-node:4500:3052",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:3052:120:3052",
      "from": "road-node:1140:3052",
      "to": "road-node:120:3052",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Blackwater West Lane",
      "sourceRoadIds": [
        "blackwaterWestLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:3052:1140:3340",
      "from": "road-node:1140:3052",
      "to": "road-node:1140:3340",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1320:3052:2340:3052",
      "from": "road-node:1320:3052",
      "to": "road-node:2340:3052",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Blackwater Mid Lane",
      "sourceRoadIds": [
        "blackwaterMidLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:3052:2340:3340",
      "from": "road-node:2340:3052",
      "to": "road-node:2340:3340",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2520:3052:3540:3052",
      "from": "road-node:2520:3052",
      "to": "road-node:3540:3052",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Blackwater East Lane",
      "sourceRoadIds": [
        "blackwaterEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:3052:4080:3052",
      "from": "road-node:3540:3052",
      "to": "road-node:4080:3052",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Blackwater East Lane",
      "sourceRoadIds": [
        "blackwaterEastLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:3052:3540:3340",
      "from": "road-node:3540:3052",
      "to": "road-node:3540:3340",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4080:3052:4500:3052",
      "from": "road-node:4080:3052",
      "to": "road-node:4500:3052",
      "width": 64,
      "orientation": "horizontal",
      "roadClass": "alley",
      "kind": "alley",
      "label": "Harbor Freight Lane",
      "sourceRoadIds": [
        "harborFreightLane"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:3052:4500:3340",
      "from": "road-node:4500:3052",
      "to": "road-node:4500:3340",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:0:3340:1140:3340",
      "from": "road-node:0:3340",
      "to": "road-node:1140:3340",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Blackwater Boulevard",
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:1140:3340:2340:3340",
      "from": "road-node:1140:3340",
      "to": "road-node:2340:3340",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Blackwater Boulevard",
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:1140:3340:1140:3600",
      "from": "road-node:1140:3340",
      "to": "road-node:1140:3600",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Mourning Avenue",
      "sourceRoadIds": [
        "westSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:2340:3340:3540:3340",
      "from": "road-node:2340:3340",
      "to": "road-node:3540:3340",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Blackwater Boulevard",
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:2340:3340:2340:3600",
      "from": "road-node:2340:3340",
      "to": "road-node:2340:3600",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Civic Avenue",
      "sourceRoadIds": [
        "civicSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:3540:3340:4500:3340",
      "from": "road-node:3540:3340",
      "to": "road-node:4500:3340",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Blackwater Boulevard",
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:3540:3340:3540:3600",
      "from": "road-node:3540:3340",
      "to": "road-node:3540:3600",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Foundry Avenue",
      "sourceRoadIds": [
        "campusWestLane",
        "eastSpine"
      ],
      "generated": false
    },
    {
      "id": "road-edge:h:4500:3340:4800:3340",
      "from": "road-node:4500:3340",
      "to": "road-node:4800:3340",
      "width": 120,
      "orientation": "horizontal",
      "roadClass": "major",
      "kind": "road",
      "label": "Blackwater Boulevard",
      "sourceRoadIds": [
        "blackwaterBoulevard"
      ],
      "generated": false
    },
    {
      "id": "road-edge:v:4500:3340:4500:3600",
      "from": "road-node:4500:3340",
      "to": "road-node:4500:3600",
      "width": 120,
      "orientation": "vertical",
      "roadClass": "major",
      "kind": "road",
      "label": "Harbor Avenue",
      "sourceRoadIds": [
        "harborSpine"
      ],
      "generated": false
    }
  ],
  "corridors": [
    {
      "id": "hospital-ring",
      "label": "Mercy Ring",
      "kind": "site-loop",
      "geometry": "polyline",
      "curveHint": "rounded-corners",
      "points": [
        {
          "x": 162,
          "y": 202
        },
        {
          "x": 918,
          "y": 202
        },
        {
          "x": 918,
          "y": 738
        },
        {
          "x": 162,
          "y": 738
        },
        {
          "x": 162,
          "y": 202
        }
      ],
      "sourceRoadIds": [
        "hospitalNorthRoad",
        "hospitalEastRoad",
        "hospitalSouthRoad",
        "hospitalWestRoad"
      ],
      "graphEdgeIds": [
        "road-edge:h:162:202:918:202",
        "road-edge:v:162:202:162:738",
        "road-edge:v:918:202:918:466",
        "road-edge:v:918:466:918:738",
        "road-edge:h:162:738:918:738"
      ]
    },
    {
      "id": "north-east-bend",
      "label": "North civic-to-harbor bend",
      "kind": "arterial",
      "geometry": "polyline",
      "curveHint": "future-spline",
      "points": [
        {
          "x": 1140,
          "y": 960
        },
        {
          "x": 2340,
          "y": 960
        },
        {
          "x": 3540,
          "y": 960
        },
        {
          "x": 4500,
          "y": 960
        }
      ],
      "sourceRoadIds": [
        "northBoulevard"
      ],
      "graphEdgeIds": [
        "road-edge:h:0:960:554:960",
        "road-edge:h:1140:960:554:960",
        "road-edge:h:1140:960:1754:960",
        "road-edge:h:1754:960:2340:960",
        "road-edge:h:2340:960:2954:960",
        "road-edge:h:2954:960:3540:960",
        "road-edge:h:3540:960:4500:960",
        "road-edge:h:4500:960:4800:960"
      ]
    },
    {
      "id": "canal-arc",
      "label": "Canal cross-city corridor",
      "kind": "arterial",
      "geometry": "polyline",
      "curveHint": "future-spline",
      "points": [
        {
          "x": 1140,
          "y": 2820
        },
        {
          "x": 2340,
          "y": 2820
        },
        {
          "x": 3540,
          "y": 2820
        },
        {
          "x": 4500,
          "y": 2820
        }
      ],
      "sourceRoadIds": [
        "canalBoulevard"
      ],
      "graphEdgeIds": [
        "road-edge:h:0:2820:752:2820",
        "road-edge:h:1140:2820:752:2820",
        "road-edge:h:1140:2820:1680:2820",
        "road-edge:h:1680:2820:2340:2820",
        "road-edge:h:2340:2820:2912:2820",
        "road-edge:h:2912:2820:3540:2820",
        "road-edge:h:3540:2820:4112:2820",
        "road-edge:h:4112:2820:4500:2820",
        "road-edge:h:4500:2820:4800:2820"
      ]
    },
    {
      "id": "foundry-hook",
      "label": "Foundry yard perimeter",
      "kind": "service",
      "geometry": "polyline",
      "curveHint": "rounded-corners",
      "points": [
        {
          "x": 1680,
          "y": 2212
        },
        {
          "x": 2340,
          "y": 2212
        },
        {
          "x": 2340,
          "y": 2572
        },
        {
          "x": 1680,
          "y": 2572
        },
        {
          "x": 1680,
          "y": 2212
        }
      ],
      "sourceRoadIds": [
        "foundry:road:north-yard",
        "civicSpine",
        "canalSouthService",
        "foundryVertical"
      ],
      "graphEdgeIds": [
        "road-edge:h:1680:2212:2340:2212",
        "road-edge:v:2340:2212:2340:2572",
        "road-edge:h:1680:2572:2340:2572",
        "road-edge:v:1680:2212:1680:2572"
      ]
    }
  ],
  "authoredLightAnchors": [
    {
      "id": "lampCrossA",
      "x": 1068,
      "y": 889,
      "radius": 78,
      "name": "west market north sidewalk light"
    },
    {
      "id": "lampCrossB",
      "x": 1210,
      "y": 1031,
      "radius": 78,
      "name": "west market south sidewalk light"
    },
    {
      "id": "lampPolice",
      "x": 2080,
      "y": 688,
      "radius": 78,
      "name": "police gate light"
    },
    {
      "id": "lampClub",
      "x": 1840,
      "y": 1535,
      "radius": 70,
      "name": "club service light"
    },
    {
      "id": "lampChurch",
      "x": 2411,
      "y": 1720,
      "radius": 70,
      "name": "parish sidewalk light"
    },
    {
      "id": "lampWarehouse",
      "x": 250,
      "y": 2535,
      "radius": 64,
      "name": "canal warehouse light"
    },
    {
      "id": "lampNorth",
      "x": 500,
      "y": 138,
      "radius": 66,
      "name": "hospital north light"
    }
  ],
  "pedestrianRouteAnchors": [
    {
      "id": "core_market_loop",
      "name": "West market and Civic boulevard loop",
      "bounds": {
        "x": 1140,
        "y": 889,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 1740,
        "y": 960
      }
    },
    {
      "id": "east_promenade_loop",
      "name": "Civic and Cathedral promenade loop",
      "bounds": {
        "x": 2340,
        "y": 889,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 2940,
        "y": 960
      }
    },
    {
      "id": "north_harbor_loop",
      "name": "Cathedral and Harbor north loop",
      "bounds": {
        "x": 3540,
        "y": 889,
        "w": 960,
        "h": 142
      },
      "center": {
        "x": 4020,
        "y": 960
      }
    },
    {
      "id": "old_quarter_loop",
      "name": "Old Quarter avenue loop",
      "bounds": {
        "x": 1140,
        "y": 1849,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 1740,
        "y": 1920
      }
    },
    {
      "id": "glasshouse_loop",
      "name": "Glasshouse avenue loop",
      "bounds": {
        "x": 2340,
        "y": 1849,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 2940,
        "y": 1920
      }
    },
    {
      "id": "university_loop",
      "name": "University district avenue loop",
      "bounds": {
        "x": 3540,
        "y": 1849,
        "w": 960,
        "h": 142
      },
      "center": {
        "x": 4020,
        "y": 1920
      }
    },
    {
      "id": "canal_loop",
      "name": "Canal Boulevard loop",
      "bounds": {
        "x": 2340,
        "y": 2749,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 2940,
        "y": 2820
      }
    },
    {
      "id": "harbor_loop",
      "name": "Harbor avenue and canal loop",
      "bounds": {
        "x": 3540,
        "y": 2749,
        "w": 960,
        "h": 142
      },
      "center": {
        "x": 4020,
        "y": 2820
      }
    },
    {
      "id": "blackwater_loop",
      "name": "Blackwater Boulevard loop",
      "bounds": {
        "x": 1140,
        "y": 3269,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 1740,
        "y": 3340
      }
    },
    {
      "id": "blackwater_east_loop",
      "name": "Blackwater east loop",
      "bounds": {
        "x": 2340,
        "y": 3269,
        "w": 1200,
        "h": 142
      },
      "center": {
        "x": 2940,
        "y": 3340
      }
    },
    {
      "id": "foundry:pedestrian-route:works-loop",
      "name": "Foundry works perimeter loop",
      "bounds": {
        "x": 1640,
        "y": 2140,
        "w": 740,
        "h": 500
      },
      "center": {
        "x": 2010,
        "y": 2392
      }
    }
  ]
});
