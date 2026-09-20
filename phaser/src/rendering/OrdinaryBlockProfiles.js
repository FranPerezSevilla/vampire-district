// Shared presentation metadata. WorldScale consumes these storey defaults for
// canonical and streamed copies alike; generated footprints stay authoritative.
const TRIAL={tenementNorth:'tenement',marketBlock:'arcade',shops:'after-hours',
 'west-market:block:01':'warehouse','west-market:block:02':'court-house','west-market:block:03':'court-house',
 'west-market:block:04':'arcade-wing','west-market:urban:workshop':'workshop',
 'west-market:urban:court-west-north':'court-lodge','west-market:urban:court-west-south':'court-lodge',
 'west-market:urban:court-east':'court-house'};
const PROFILES={
 tenement:{name:'tenement',storeys:4,roof:'mansard',insetMetres:2.2,riseMetres:2.4},
 arcade:{name:'arcade',storeys:2,roof:'market',insetMetres:1.15,riseMetres:.55},
 'after-hours':{name:'after-hours',storeys:3,roof:'terrace',insetMetres:.45,riseMetres:.32},
 'arcade-wing':{name:'arcade',storeys:2,roof:'zinc',insetMetres:1.15,riseMetres:.55},
 'court-house':{name:'court',storeys:3,roof:'mansard',insetMetres:1.8,riseMetres:2.1},
 'court-lodge':{name:'court',storeys:2,roof:'zinc',insetMetres:.8,riseMetres:.45},
 warehouse:{name:'warehouse',storeys:2,roof:'market',insetMetres:1.15,riseMetres:.7},
 workshop:{name:'workshop',storeys:1,roof:'zinc',insetMetres:.75,riseMetres:.45},
 civic:{name:'civic',storeys:3,roof:'zinc',insetMetres:1.05,riseMetres:.7},
 academic:{name:'academic',storeys:3,roof:'mansard',insetMetres:1.6,riseMetres:2.2},
 luxury:{name:'luxury',storeys:4,roof:'terrace',insetMetres:.9,riseMetres:.55},
 'canal-house':{name:'canal-house',storeys:3,roof:'mansard',insetMetres:1.25,riseMetres:1.7},
 factory:{name:'factory',storeys:2,roof:'sawtooth',insetMetres:.7,riseMetres:.35},
 depot:{name:'depot',storeys:2,roof:'gable',insetMetres:.7,riseMetres:.35}
};
export function ordinaryBlockProfile(b){return PROFILES[b.architectureKit??TRIAL[b.id]]||null;}
