// Authored urban composition. Rectangles are intentional volumes, not generated infill.
// The compiler owns collision/streamed copies; renderers consume these same definitions.
export const DISTRICT_URBAN_PREFIX='district-urban:';
const V=(id,name,x,y,w,h,storeys,kit,side='south',group=null)=>({id,name,x,y,w,h,storeys,architectureKit:kit,
 entrances:[{id:'main',side,at:.5}],streetBlockId:group||id,authoredSiteFootprint:true,generated:false,sign:'',
 family:['factory','depot','warehouse','workshop'].includes(kit)?'industrial':['luxury','after-hours','arcade'].includes(kit)?'commercial':'housing',
 color:0x171c23,trim:0x444a52});
const S=(id,name,x,y,w,h)=>({id:DISTRICT_URBAN_PREFIX+id,name,x,y,w,h,geometry:'rect',bandKind:'pedestrian-court',trimEdges:[],generated:false});
const D=(id,kind,x,y,w,h,height,vertical=false)=>({id:DISTRICT_URBAN_PREFIX+id,kind,x,y,w,h,height,vertical});
const P=(id,name,intent,volumes,spaces,decor=[],review)=>({id,name,intent,volumes:volumes.map(v=>({...v,districtId:id})),spaces:spaces.map(s=>({...s,districtId:id})),decor:decor.map(d=>({...d,districtId:id})),review});

export const DISTRICT_BLOCK_PLANS=[
 P('hospital-district','Hospital Ward','A quiet institutional island with staff housing, a chapel walk and a visitor court; preserve the accepted hospital and ambulance approach.',[
  V('district-urban:hospital-residence','NURSES HOUSE',270,36,180,70,3,'court-house'),
  V('district-urban:hospital-pharmacy','NIGHT DISPENSARY',530,36,250,70,2,'academic'),
  V('district-urban:hospital-lodge','CARETAKER LODGE',24,350,64,150,2,'court-lodge','east'),
  V('district-urban:hospital-chapel','OLD HOSPICE',24,570,64,110,2,'academic','east')
 ],[
  S('hospital-north-walk','Staff promenade',240,106,600,28),S('hospital-staff-court','Staff court',450,36,80,70),
  S('hospital-west-walk','Hospice walk',88,314,26,390)
 ],[D('hospital-staff-bench','bench',488,52,32,10,14),D('hospital-staff-lamp','lamp',491,113,7,7,49)],{x:489,y:119,zoom:2.2}),
 P('civic-center','Civic Centre','Institutional frontages, a formal hall forecourt and a narrow archive service street; retain the police compound.',[
  V('cityHall','CITY HALL',2578,320,342,240,4,'civic','south','civic:hall'),
  V('district-urban:civic-west-pavilion','RECORDS PAVILION',2578,610,96,50,2,'civic','east'),
  V('district-urban:civic-east-pavilion','COURT PAVILION',2824,610,96,50,2,'civic','west'),
  V('district-urban:civic-archive','JUDICIAL ARCHIVE',2160,340,72,260,4,'civic','west'),
  V('district-urban:civic-north-homes','CLERKS TERRACE',1460,36,260,84,3,'court-house'),
  V('district-urban:civic-north-office','MUNICIPAL OFFICES',1800,36,240,84,3,'civic'),
  V('district-urban:hall-north-office','REVENUE HOUSE',2610,36,270,84,3,'civic')
 ],[
  S('hall-plaza','Civic forecourt',2578,560,342,50),S('hall-axis','Ceremonial approach',2674,610,150,78),
  S('archive-walk','Archive service walk',2138,320,22,310),S('civic-north-walk','Clerks promenade',1436,120,600,10),
  S('civic-clerks-court','Clerks courtyard',1720,36,80,84),S('hall-north-walk','Revenue walk',2552,120,408,10)
 ],[D('hall-bench-west','bench',2648,586,40,10,14),D('hall-bench-east','bench',2850,586,40,10,14),D('hall-lamp-west','lamp',2690,650,7,7,49),D('hall-lamp-east','lamp',2808,650,7,7,49)],{x:2749,y:603,zoom:1.9}),
 P('cathedral-hill','Cathedral Hill','A narrow precinct court beside the cathedral, with a reading house and former church workshops; preserve the traversable cathedral.',[
  V('cathedral-hill:block:04','CHAPTER LIBRARY',3160,330,279,90,3,'academic'),
  V('cathedral-hill:block:01','SACRISTANS HOUSE',3160,460,85,195,3,'court-house','east'),
  V('district-urban:cathedral-workshop','STONEWORKERS HOUSE',3350,460,89,195,2,'workshop','west'),
  V('cathedral-hill:block:05','PRECINCT BOOKSHOP',3200,38,230,88,2,'arcade')
 ],[
  S('chapter-walk','Chapter passage',3160,420,279,40),S('chapter-court','Chapter court',3245,460,105,210),
  S('chapter-south-walk','Precinct approach',3160,655,279,15),S('chapter-north-walk','Booksellers walk',3160,126,279,4)
 ],[D('chapter-bench','bench',3328,495,40,10,14,true),D('chapter-candle','candle',3260,610,5,5,16),D('cathedral-plaza-bench','bench',3732,636,40,10,14),D('cathedral-plaza-lamp','lamp',4102,645,7,7,49)],{x:3297,y:558,zoom:2.1}),
 P('north-harbor','North Harbor','A linear port approach with alternating service courts and a continuous personnel walk.',[
  V('north-harbor:block:02','BONDED STORE',4640,80,128,200,2,'depot','west'),
  V('north-harbor:block:03','DOCKWORKERS BOARDING HOUSE',4630,380,145,160,3,'canal-house','west'),
  V('north-harbor:block:01','PUMP WORKS',4630,680,145,150,2,'factory','west'),
  V('district-urban:north-port-office','PORT CONTROL',4354,500,36,210,2,'civic','east')
 ],[
  S('north-port-walk','Port personnel walk',4598,60,32,800),S('north-port-loading','Bonded store court',4630,280,145,100),
  S('north-port-yard','Pump service court',4630,540,145,140),S('north-port-control','Control walk',4390,470,12,270)
 ],[D('north-port-cargo','cargo',4734,333,30,18,18),D('north-port-transformer','transformer',4748,591,20,16,22),D('north-port-lamp','lamp',4615,597,7,7,49)],{x:4615,y:585,zoom:2.2}),
 P('west-market','West Market','Preserve the approved market square, shop promenade, residential court and connected roof route.',[],[],[
  D('market-court-bench','bench',911,1600,34,10,14,true),D('market-square-cargo','cargo',272,1592,24,16,14)
 ],{x:838,y:1610,zoom:2.1}),
 P('old-quarter','Old Quarter','Printworks court, small back lanes and a night frontage opposite Vesper; retain the refuge, club yard and skyline access.',[
  V('oldBlock','MOURNING TENEMENTS',1380,1644,280,175,4,'tenement','north'),
  V('old-quarter:block:01','NIGHT TERRACE',1824,1644,246,175,3,'court-house','north'),
  V('old-quarter:block:02','STAGE LODGINGS',2040,1140,170,50,2,'court-lodge','north'),
  V('old-quarter:block:03','OCCUPIED PRINTWORKS',1260,1170,220,100,3,'warehouse'),
  V('old-quarter:block:04','LATE BAR',2100,1720,139,99,2,'after-hours','north'),
  V('old-quarter:block:05','VESPER TENEMENTS',1830,1110,180,80,3,'court-house','north'),
  V('district-urban:old-quarter-lodge','PRINTWORKERS HOUSE',1260,1370,140,114,3,'court-house','east'),
  V('district-urban:old-quarter-pawn','PAWNBROKER',1260,1644,84,175,2,'workshop','east')
 ],[
  S('print-court','Printworks court',1260,1270,210,100),S('print-alley','Refuge back passage',1400,1370,70,144),
  S('print-west-walk','Printworks side walk',1238,1170,22,344),S('old-front','Tenement front walk',1344,1628,340,16),
  S('pawn-passage','Pawnbrokers passage',1344,1644,36,185),S('late-court','Night bar court',2070,1644,169,76),
  S('late-side','Service alley',2070,1720,30,109),S('stage-walk','Stage lodgings walk',1824,1190,410,14),
  S('stage-front','Lodgings front walk',1824,1060,410,50),S('stage-east-walk','Lodgings east approach',2010,1110,224,30)
 ],[D('print-bench','bench',1290,1322,34,10,14,true),D('print-cargo','cargo',1438,1290,25,17,16),D('print-lamp','lamp',1420,1468,7,7,49),D('late-bench','bench',2208,1698,30,10,14)],{x:1398,y:1341,zoom:2.1}),
 P('glasshouse','Glasshouse','A continuous gallery promenade, intimate commercial courts and a hotel service alley; polished darkness rather than neon.',[
  V('glassArcade','GLASS ARCADE',2520,1260,300,170,3,'luxury'),
  V('saintOrisonHotel','SAINT ORISON HOTEL',3040,1260,300,170,5,'luxury'),
  V('neonCourt','VELVET COURT',3024,1640,276,170,3,'luxury','north'),
  V('glasshouse:block:02','GLASSHOUSE OFFICES',3030,1070,290,160,4,'civic'),
  V('glasshouse:block:03','PRIVATE SALON',3070,1490,240,120,2,'luxury','north'),
  V('glasshouse:block:04','ARCADE APARTMENTS',2520,1490,140,100,3,'court-house','east'),
  V('glasshouse:block:05','BRASS HOUSE',2610,1070,220,160,4,'luxury'),
  V('glasshouse:block:06','GALLERY ANNEX',2740,1610,144,140,2,'luxury','west'),
  V('glasshouse:block:07','ANTIQUARIAN',2760,1490,124,100,2,'arcade','west'),
  V('district-urban:hotel-service','HOTEL SERVICE WING',3350,1500,80,260,2,'civic','west'),
  V('church','PARISH OF ASH',2441,1640,219,160,3,'academic')
 ],[
  S('glass-promenade','Glass arcade promenade',2440,1430,444,60),S('glass-court','Gallery court',2660,1490,100,120),
  S('glass-cross','Gallery cross passage',2440,1590,444,20),S('glass-rear','Parish passage',2660,1610,80,210),
  S('glass-west','Arcade west passage',2440,1230,80,200),S('glass-north','Brass passage',2520,1230,364,30),
  S('parish-front','Parish front walk',2440,1800,300,23),S('hotel-front','Hotel promenade',3024,1430,406,60),S('hotel-service','Hotel service alley',3310,1490,40,330),
  S('velvet-walk','Velvet court passage',3024,1610,286,30),S('hotel-north','Hotel rear walk',3024,1230,406,30)
 ],[D('glass-bench','bench',2694,1570,30,10,14),D('glass-lamp','lamp',2704,1460,7,7,49),D('hotel-lamp','lamp',3185,1460,7,7,49),D('hotel-transformer','transformer',3331,1728,18,14,20)],{x:2710,y:1519,zoom:2}),
 P('university-district','University District','Library forecourt framed by two academic wings, with student accommodation and workrooms across the street.',[
  V('university','VESPER CITY UNIVERSITY',3700,1280,360,220,4,'academic','south','university:front'),
  V('district-urban:university-west','WEST READING WING',3641,1280,59,260,3,'academic','south','university:front'),
  V('district-urban:university-east','ANATOMY WING',4060,1280,60,260,3,'academic','south','university:front'),
  V('university-district:block:01','STUDENTS UNION',4130,1710,260,100,2,'arcade','north'),
  V('university-district:block:03','STUDENT RESIDENCE',3730,1710,270,90,4,'canal-house','north'),
  V('university-district:block:02','GRADUATE HOUSE',4630,1460,145,100,3,'canal-house','west'),
  V('university-district:block:04','ALL NIGHT CAFE',4630,1700,145,100,2,'after-hours','west'),
  V('university-district:block:05','SCIENCE WORKROOMS',4630,1240,139,110,2,'workshop','west')
 ],[
  S('university-court','Reading court',3700,1500,360,64),S('university-front','Campus front walk',3640,1540,480,24),
  S('university-north','Campus rear walk',3640,1230,480,50),S('university-south','Student promenade',3640,1690,759,20),
  S('university-east-walk','Student side walk',4600,1210,30,610),S('university-student-court','Student court',4630,1560,145,140)
 ],[D('university-bench-west','bench',3743,1522,38,10,14),D('university-bench-east','bench',4014,1522,38,10,14),D('university-lamp-west','lamp',3720,1551,7,7,49),D('university-lamp-east','lamp',4040,1551,7,7,49),D('student-bench','bench',4726,1622,32,10,14)],{x:3880,y:1544,zoom:1.8}),
 P('canal-west','Canal West','A warehouse conversion and workers housing define a service court, with a quieter residential street to the east.',[
  V('warehouse','CANAL WAREHOUSE',250,2300,300,180,3,'warehouse','east'),
  V('canal-west:block:01','CANAL TERRACE',410,2060,272,82,3,'canal-house'),
  V('canal-west:block:02','RIVERSIDE TENEMENTS',850,2320,189,182,4,'canal-house','west'),
  V('canal-west:block:03','LAUNDRY HOUSE',850,2642,189,77,2,'workshop','north'),
  V('canal-west:block:04','OLD DYE WORKS',90,2070,290,72,2,'factory'),
  V('canal-west:block:05','COAL STORE',500,2642,150,77,1,'depot','north'),
  V('canal-west:block:06','CANAL TAPROOM',160,2642,230,77,2,'after-hours','north'),
  V('canal-west:block:07','WAREHOUSE LODGINGS',70,2320,160,182,3,'canal-house','east'),
  V('district-urban:canal-east-homes','CANAL ROW',834,2030,205,112,3,'canal-house')
 ],[
  S('canal-warehouse-court','Warehouse conversion court',550,2300,132,202),S('canal-warehouse-walk','Warehouse approach',230,2282,452,18),
  S('canal-lodging-alley','Lodging alley',230,2300,20,202),S('canal-back-walk','Warehouse south walk',250,2480,300,22),
  S('canal-east-walk','Canal residential walk',820,2282,30,240),S('canal-north-passage','Dye works passage',380,2030,30,112)
 ],[D('canal-bench','bench',610,2340,38,10,14,true),D('canal-lamp','lamp',640,2476,7,7,49),D('canal-cargo','cargo',572,2399,28,18,17)],{x:616,y:2406,zoom:2.1}),
 P('foundry','Foundry Ward','Parallel works halls and cross-yard loading lanes, with sawtooth roofs and physical chimney/plant objects.',[
  V('foundry:block-01:machine-shop','NORTH MACHINE SHOP',1420,2021,190,121,2,'factory'),
  V('foundry:block-02:west-works','WEST WORKS',1380,2380,230,122,2,'factory','north','foundry:west'),
  V('foundry:block-03:east-loading','EAST LOADING',1750,2380,290,122,2,'depot','north','foundry:east'),
  V('foundry:block-04:west-yard','WEST YARD',1380,2642,230,77,2,'factory','north'),
  V('foundry:block-05:east-works','EAST WORKS',1750,2642,290,77,2,'factory','north'),
  V('foundry:block:01','FURNACE HALL',1840,2030,300,112,3,'factory'),
  V('foundry:block:02','TOOL STORE',1250,2030,150,112,1,'depot'),
  V('district-urban:foundry-west-hall','WEST MACHINE ANNEX',1380,2282,230,60,2,'factory'),
  V('district-urban:foundry-east-hall','LOADING ANNEX',1750,2282,290,60,1,'depot')
 ],[
  S('foundry-west-yard','West loading court',1242,2342,368,38),S('foundry-east-yard','East loading court',1750,2342,300,38),
  S('foundry-west-walk','Works side passage',1242,2282,138,220),S('foundry-east-walk','Furnace service walk',2040,2282,160,220)
 ],[D('foundry-transformer','transformer',1325,2320,26,22,26),D('foundry-cargo','cargo',2160,2428,40,22,20),D('foundry-lamp','lamp',2070,2358,7,7,49)],{x:2078,y:2365,zoom:1.8}),
 P('canal-east','Canal East','Service infrastructure and cold stores enclose a hard working yard; housing forms the eastern edge.',[
  V('canal-east:block:01','SERVICE TENEMENTS',2982,2350,188,150,3,'canal-house','east'),
  V('canal-east:block:02','COLD STORE',2610,2330,210,120,2,'depot'),
  V('canal-east:block:03','REPAIR SHOP',3210,2420,170,82,2,'workshop','north'),
  V('canal-east:block:04','COMPRESSOR HOUSE',2460,2040,270,102,2,'factory'),
  V('canal-east:block:05','SOUTH SERVICE DEPOT',3120,2642,220,77,1,'depot','north'),
  V('canal-east:block:06','CONTROL HOUSE',3170,2030,160,112,3,'civic'),
  V('canal-east:block:07','MAINTENANCE LODGINGS',3250,2282,180,98,3,'canal-house'),
  V('district-urban:canal-cold-wing','REFRIGERATION PLANT',2460,2282,110,220,2,'factory','east'),
  V('district-urban:canal-maintenance','PUBLIC WORKS DEPOT',2460,2642,280,77,2,'depot','north')
 ],[
  S('cold-store-yard','Cold store court',2570,2450,250,52),S('cold-store-passage','Plant service passage',2570,2282,40,168),
  S('canal-east-square','Repair court',3170,2380,269,40),S('canal-east-side','Maintenance side passage',3170,2282,40,98),
  S('canal-east-lodging-walk','Service tenement walk',3170,2420,40,82),
  S('canal-east-south','South depot yard',2740,2642,100,100)
 ],[D('cold-transformer','transformer',2600,2490,22,16,22),D('cold-cargo','cargo',2787,2474,25,16,18),D('repair-lamp','lamp',3408,2398,7,7,49)],{x:2710,y:2480,zoom:2}),
 P('harbor-north','Harbor North','A customs frontage and a chain of inspection courts; modest offices sit between larger store sheds.',[
  V('harborRegistry','HARBOR REGISTRY',3720,2021,300,121,3,'civic'),
  V('harbor-north:block:01','BONDED DEPOT',4630,2040,145,210,2,'depot','west'),
  V('harbor-north:block:02','CUSTOMS OFFICES',3660,2642,210,77,3,'civic','north'),
  V('harbor-north:block:03','INSPECTION SHED',4190,2642,209,77,1,'depot','north'),
  V('harbor-north:block:04','SEIZED GOODS STORE',4210,2030,189,112,2,'warehouse'),
  V('harbor-north:block:05','DOCK CANTEEN',4630,2310,145,100,2,'workshop','west'),
  V('harbor-north:block:06','MANIFEST OFFICE',3830,2460,170,42,1,'civic','south'),
  V('harbor-north:block:07','PORT LODGINGS',4630,2480,145,140,3,'canal-house','west')
 ],[
  S('harbor-registry-west','Registry side court',3640,2021,80,121),S('harbor-bonded-walk','Customs personnel walk',4600,2020,30,650),
  S('harbor-inspection','Inspection court',4630,2250,145,60),S('harbor-canteen','Dockworkers court',4630,2410,145,70),
  S('harbor-manifest-yard','Manifest service court',3670,2460,160,42)
 ],[D('customs-cargo','cargo',4744,2281,30,20,20),D('customs-bench','bench',4720,2440,35,10,14),D('registry-lamp','lamp',3690,2090,7,7,49)],{x:4615,y:2428,zoom:2.1}),
 P('blackwater','Blackwater Industrial','Long industrial fronts are broken by purposeful plant yards, service cuts and low ancillary buildings.',[
  V('blackwaterTerminal','BLACKWATER TERMINAL',2600,3122,600,117,3,'depot'),
  V('blackwater:block:01','WEST FREIGHT HALL',430,3122,300,117,2,'factory','south','blackwater:west'),
  V('blackwater:block:02','SHIFT HOUSE',1241,3122,229,117,2,'canal-house'),
  V('blackwater:block:03','TREATMENT WORKS',2690,3441,290,119,2,'factory','north'),
  V('blackwater:block:04','BOILER HOUSE',1780,3122,240,117,3,'factory'),
  V('blackwater:block:05','ENGINEERS STORE',820,3122,219,117,1,'depot'),
  V('blackwater:block:06','WEST MACHINE WING',250,3122,180,117,1,'factory','south','blackwater:west'),
  V('blackwater:block:07','SOUTH FREIGHT SHED',1440,3441,320,119,2,'depot','north'),
  V('blackwater:block:08','MAINTENANCE WORKS',430,3441,220,119,2,'factory','north'),
  V('blackwater:block:09','CHANGING HOUSE',1520,3122,190,117,2,'workshop'),
  V('blackwater:block:10','COMPRESSOR ANNEX',2050,3122,189,117,1,'depot'),
  V('blackwater:block:11','PLANT CONTROL',2470,3441,190,119,3,'civic','north'),
  V('blackwater:block:12','PUMP HALL',1970,3441,180,119,2,'factory','north'),
  V('blackwater:block:13','TERMINAL OFFICE',3270,3122,169,117,2,'civic'),
  V('blackwater:block:14','SOUTH MOTOR SHOP',730,3441,309,119,2,'depot','north')
 ],[
  S('blackwater-west-yard','West plant yard',730,3122,90,117),S('blackwater-shift-yard','Shift change court',1470,3122,50,117),
  S('blackwater-boiler-cut','Boiler service cut',1710,3122,70,117),S('blackwater-terminal-yard','Terminal yard',3200,3122,70,117),
  S('blackwater-south-yard','South machinery court',1760,3441,210,119),S('blackwater-motor-cut','Motor shop service cut',650,3441,80,119)
 ],[D('blackwater-transformer','transformer',780,3152,25,23,28),D('blackwater-cargo','cargo',3234,3160,28,18,18),D('blackwater-plant','transformer',1830,3515,28,24,30),D('blackwater-lamp','lamp',1920,3460,7,7,49)],{x:1853,y:3460,zoom:1.9}),
 P('harbor-south','South Harbor','Paired freight halls frame a large cargo court; lower maintenance buildings leave clear loading approaches.',[
  V('harbor-south:block:01','WEST FREIGHT SHED',3660,3122,210,117,2,'depot','south','south-harbor:freight'),
  V('harbor-south:block:02','EAST FREIGHT SHED',3870,3122,190,117,2,'warehouse','south','south-harbor:freight'),
  V('harbor-south:block:03','BOND STORE',4190,3122,209,117,3,'depot','west'),
  V('harbor-south:block:04','REPAIR HALL',3660,3441,250,115,2,'factory','east'),
  V('harbor-south:block:05','CARGO WAREHOUSE',4130,3441,269,115,2,'warehouse','west'),
  V('district-urban:south-harbor-gatehouse','FREIGHT OFFICE',3930,3515,180,41,1,'civic','north')
 ],[
  S('south-harbor-loading','Bond store loading court',4060,3122,130,117),S('south-harbor-repair','Repair court',3910,3441,220,74),
  S('south-harbor-west-cut','Freight office passage',3910,3515,20,45),S('south-harbor-east-cut','Warehouse passage',4110,3515,20,45)
 ],[D('south-harbor-cargo-a','cargo',4094,3170,32,24,20),D('south-harbor-cargo-b','cargo',4094,3200,32,22,18),D('south-harbor-transformer','transformer',3930,3480,20,18,22),D('south-harbor-lamp','lamp',4107,3460,7,7,49)],{x:4020,y:3475,zoom:2})
];

export const DISTRICT_URBAN_VOLUMES=DISTRICT_BLOCK_PLANS.flatMap(p=>p.volumes);
export const DISTRICT_URBAN_SPACES=DISTRICT_BLOCK_PLANS.flatMap(p=>p.spaces);
export const DISTRICT_URBAN_DECOR=DISTRICT_BLOCK_PLANS.flatMap(p=>p.decor);
export const DISTRICT_URBAN_LAMPS=DISTRICT_URBAN_DECOR.filter(p=>p.kind==='lamp').map(p=>({...p,radius:48}));
