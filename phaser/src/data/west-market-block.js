// Authored urban plan, consumed by the city compiler. All dimensions are world units.
// Keep roads untouched; public space, entrances and roof routes share these footprints.
export const WEST_MARKET_PREFIX = 'west-market:urban:';
// Reserve courts and circulation too; later generic infill must not fill them in.
export const WEST_MARKET_SITES = [
  {x:40,y:1258,w:448,h:565}, {x:620,y:1258,w:423,h:565}
];
const door = side => [{id: 'main', side, at: .5}];
const volume = (id, name, x, y, w, h, storeys, family, side, streetBlockId, extra = {}) => ({
  id, name, x, y, w, h, storeys, family, entrances: door(side), streetBlockId,
  districtId: 'west-market', authoredSiteFootprint: true, generated: false,
  color: 0x181d24, trim: 0x484d53, sign: '', ...extra
});

export const WEST_MARKET_VOLUMES = [
  volume('marketBlock', 'NIGHT MARKET', 264, 1280, 220, 180, 2, 'market', 'south', 'west-market:arcade', {sign: 'MARKET'}),
  volume('west-market:block:04', 'MARKET ARCADE', 84, 1280, 180, 180, 2, 'commercial', 'south', 'west-market:arcade'),
  volume('west-market:block:03', 'MERCER HOUSE', 84, 1516, 120, 196, 3, 'housing', 'east', 'west-market:service'),
  volume('west-market:block:01', 'MARKET WAREHOUSE', 264, 1620, 220, 180, 2, 'industrial', 'north', 'west-market:warehouse'),
  volume(WEST_MARKET_PREFIX + 'workshop', 'SERVICE WORKSHOP', 84, 1712, 120, 88, 1, 'industrial', 'east', 'west-market:service'),
  volume('tenementNorth', 'MERCER TENEMENTS', 640, 1280, 230, 210, 4, 'housing', 'south', 'west-market:frontage', {sign: 'FLATS'}),
  volume('shops', 'AFTER HOURS', 870, 1330, 169, 160, 3, 'commercial', 'south', 'west-market:frontage', {sign: 'SHOPS'}),
  volume('west-market:block:02', 'MERCER COURT', 640, 1720, 399, 80, 3, 'housing', 'north', 'west-market:court'),
  volume(WEST_MARKET_PREFIX + 'court-west-north', 'COURT NORTH LODGE', 640, 1554, 92, 56, 2, 'housing', 'east', 'west-market:court'),
  volume(WEST_MARKET_PREFIX + 'court-west-south', 'COURT SOUTH LODGE', 640, 1650, 92, 70, 2, 'housing', 'east', 'west-market:court'),
  volume(WEST_MARKET_PREFIX + 'court-east', 'COURT EAST WING', 947, 1554, 92, 166, 3, 'housing', 'west', 'west-market:court')
];

const paving = (id, name, x, y, w, h) => ({
  id: WEST_MARKET_PREFIX + id, name, x, y, w, h, geometry: 'rect',
  bandKind: 'pedestrian-court', districtId: 'west-market', trimEdges: [], generated: false
});
export const WEST_MARKET_SPACES = [
  paving('square', 'Market square', 204, 1460, 284, 160),
  paving('arcade-walk', 'Arcade passage', 40, 1460, 164, 56),
  paving('service-lane', 'Market service lane', 204, 1620, 60, 203),
  paving('west-walk', 'West service walk', 40, 1258, 44, 565),
  paving('north-walk', 'Market north walk', 84, 1258, 400, 22),
  paving('south-walk', 'Market south walk', 40, 1800, 444, 23),
  paving('promenade', 'Mercer shopfront promenade', 620, 1490, 423, 64),
  paving('courtyard', 'Mercer residential court', 732, 1554, 215, 166),
  paving('court-exit', 'Court service passage', 620, 1610, 112, 40),
  paving('court-west-walk', 'Court west walk', 620, 1554, 20, 269),
  paving('court-south-walk', 'Court south walk', 640, 1800, 399, 23)
];

// Reuse the three existing local loops and four waypoints each: no extra population.
const loop = (id, name, surface, coords) => ({
  id, name, sidewalkId: WEST_MARKET_PREFIX + surface, routeKind: 'pedestrian-court',
  generated: false, points: coords.map(([x, y]) => ({x, y}))
});
export const WEST_MARKET_PEDESTRIANS = [
  loop('west_market_vertical_loop', 'Market square walk', 'square', [[294,1480],[461,1480],[461,1595],[294,1595]]),
  loop('west_market_north_loop', 'Mercer shopfront walk', 'promenade', [[658,1509],[1016,1509],[1016,1533],[658,1533]]),
  loop('west_market_south_loop', 'Mercer courtyard walk', 'courtyard', [[755,1580],[925,1580],[925,1695],[755,1695]])
];

export const WEST_MARKET_ESCAPES = [
  {id: WEST_MARKET_PREFIX+'market-stair', name: 'Market roof access', street: {x:454,y:1480}, roof: {x:454,y:1438,layer:1}},
  {id: WEST_MARKET_PREFIX+'court-stair', name: 'Mercer roof access', street: {x:752,y:1700}, roof: {x:752,y:1744,layer:1}}
];
const jump = (id, ax, ay, bx, by) => ({id: WEST_MARKET_PREFIX+id, ax, ay, bx, by, aLayer:1, bLayer:1, aToB:'cross to next roof', bToA:'cross back'});
export const WEST_MARKET_ROOF_ROUTES = [
  jump('arcade-roofs', 286,1380, 242,1380),
  jump('market-rear-roofs', 154,1438, 154,1540),
  jump('workshop-roofs', 154,1688, 154,1736),
  jump('service-lane-roofs', 182,1755, 286,1755),
  jump('frontage-roofs', 846,1410, 894,1410),
  jump('east-court-roofs', 986,1466, 986,1578),
  jump('south-court-roofs', 986,1696, 986,1744),
  jump('west-court-roofs', 686,1744, 686,1696),
  jump('court-passage-roofs', 686,1674, 686,1586),
  jump('court-frontage-roofs', 686,1578, 686,1466)
];

export const WEST_MARKET_DROPS = WEST_MARKET_ESCAPES.map(e => ({
  id: e.id+'-drop', label: 'drop to street', roof: {...e.roof}, street: {...e.street}
}));
