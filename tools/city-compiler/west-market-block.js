import {
  WEST_MARKET_PREFIX, WEST_MARKET_VOLUMES, WEST_MARKET_SPACES,
  WEST_MARKET_PEDESTRIANS, WEST_MARKET_ESCAPES, WEST_MARKET_ROOF_ROUTES, WEST_MARKET_DROPS
} from '../../phaser/src/data/west-market-block.js';

const ids = new Set(WEST_MARKET_VOLUMES.map(b => b.id));
export const ownsWestMarketVolume = id => ids.has(id) || id.startsWith(WEST_MARKET_PREFIX);
const replaceRoutes = (current, authored) => [...current.filter(r => !r.id.startsWith(WEST_MARKET_PREFIX)), ...authored];

export function compileWestMarketBlock(city) {
  const buildings = [...city.buildings.filter(b => !ownsWestMarketVolume(b.id)), ...WEST_MARKET_VOLUMES];
  const roofAreas = Object.fromEntries(Object.entries(city.roofAreas).map(([layer, areas]) => [
    layer, areas.filter(r => !ownsWestMarketVolume(r.buildingId || ''))
  ]));
  const roofIds = {marketBlock:'marketRoof', tenementNorth:'tenementRoof', shops:'shopsRoof'};
  roofAreas[1].push(...WEST_MARKET_VOLUMES.map(b => ({
    id: roofIds[b.id] || b.id+'Roof', buildingId:b.id,
    x:b.x+6, y:b.y+6, w:b.w-12, h:b.h-12,
    color:0x222930, label:b.name, generated:false, districtId:'west-market'
  })));
  return {...city, buildings, roofAreas,
    fireEscapes: replaceRoutes(city.fireEscapes, WEST_MARKET_ESCAPES),
    roofDrops: replaceRoutes(city.roofDrops, WEST_MARKET_DROPS),
    rooftopRoutes: replaceRoutes(city.rooftopRoutes, WEST_MARKET_ROOF_ROUTES),
    pedestrianSurfaces: WEST_MARKET_SPACES,
    authoredPedestrianRoutes: WEST_MARKET_PEDESTRIANS
  };
}
