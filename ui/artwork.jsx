import { memo, useId } from 'react';
import { portraitProfile } from './portrait-profiles.js';

// Original ink prints. Non-interactive decoration, with no fetched artwork.
export function NightSeal({ className = '' }) {
  return <svg className={`nb-seal ${className}`} viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="74" fill="none" stroke="currentColor" strokeWidth="1"/><circle cx="90" cy="90" r="68" fill="none" stroke="currentColor" strokeDasharray="1 7"/><path d="M90 8v28m0 108v28M8 90h28m108 0h28M36 36l14 14m80 80 14 14M36 144l14-14m80-80 14-14" fill="none" stroke="currentColor"/><path d="M90 39 110 73l29-12-14 42-23 12-12 28-12-28-23-12-14-42 29 12Z" fill="currentColor" opacity=".2"/><path d="M90 48s-24 29-24 44a24 24 0 1 0 48 0c0-15-24-44-24-44Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M74 94c0 13 8 18 16 18M90 30v18m0 73v28M49 90h15m52 0h15" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
}
const faces = {
  gaunt: 'M77 61 98 42 128 48 143 70 137 110 124 139 108 152 89 136 76 101Z',
  heart: 'M73 66Q79 39 113 41Q146 45 147 75L139 115 112 143 87 123 72 94Z',
  square: 'M64 68 81 47 125 45 151 68 152 111 139 139 91 144 66 120Z',
  round: 'M69 73Q71 44 109 43Q147 45 149 76L146 111Q139 144 111 149Q78 144 69 115Z',
  oval: 'M73 68Q80 41 111 43Q142 44 147 69L141 108Q132 142 110 146Q85 135 76 106Z',
  soft: 'M72 65Q83 46 113 47Q142 49 146 74L140 111 128 134Q109 147 93 134L78 113Z',
  broad: 'M62 68Q69 38 109 39Q147 40 156 70L153 111 141 139 115 153 86 140 66 114Z',
  tapered: 'M74 65Q87 41 116 46L143 65 140 106 125 133 107 149 89 133 75 98Z'
};
function Hair({ p, back = false }) {
  const backPaths = {
    widow: 'M70 108 66 61 83 35 118 33 147 54 151 127 136 111 135 69 84 62 81 108Z',
    waves: 'M59 172 54 135 61 98 55 79 68 45Q91 24 122 34L152 47 162 83 155 110 170 158 148 176 135 149 82 144 79 181Z',
    bob: 'M58 143 56 91 66 52 95 31 129 35 153 56 160 146 140 156 73 157Z',
    locs: 'M56 172 57 72Q59 34 109 28Q156 31 158 75L175 175 144 163 136 92 84 79 80 178Z',
    sweep: 'M62 134 58 86 72 44 125 36 149 59 153 128 137 139 76 142Z'
  };
  if (back) {
    if (p.hair === 'coils') return <g fill={p.ink}>{[[69,57,22],[94,41,24],[122,39,22],[149,55,23],[61,83,20],[161,80,19],[60,106,20],[157,105,20],[72,128,16],[146,130,17]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r}/>)}</g>;
    return backPaths[p.hair] ? <path d={backPaths[p.hair]} fill={p.ink}/> : null;
  }
  const paths = {
    widow: 'M68 83 71 58 86 36 120 35 142 52 148 82 132 69 113 54 103 72 89 55 80 90Z',
    waves: 'M61 104 67 63Q68 29 111 35L141 47 156 78 135 72 121 53 101 67 91 91 76 112 71 147 61 140Z',
    mohawk: 'M67 77 71 54 85 50 88 24 100 35 106 12 115 28 129 18 130 42 148 59 146 77 129 58 91 63 82 85Z',
    bob: 'M59 111 67 54 94 33 129 38 153 69 143 100 134 74 114 66 82 71 77 135 65 137Z',
    coils: 'M69 72Q51 50 82 32Q108 18 134 34Q163 33 153 71L132 60 120 71 105 56 91 75 78 64Z',
    crop: 'M64 81 68 52 90 31 122 34 150 47 153 75 139 88 127 61 114 80 101 61 86 83 77 69 78 102Z',
    bald: 'M65 88 61 69 72 54 77 54 70 92Zm82-2 8-24 2 31-8 12Z',
    locs: 'M61 88 63 53 82 30 120 28 148 41 158 74 150 101 138 78 133 52 120 56 124 85 112 99 108 55 99 58 91 101 82 113 85 58 76 63 69 112Z',
    sweep: 'M60 98 65 53 100 28 139 44 158 70 139 72 116 57 95 81 84 113 72 137Z',
    shaved: 'M66 77 73 52 96 34 130 34 150 47 157 81 142 128 133 108 138 63 123 51 111 70 87 62 79 82Z'
  };
  return <g data-hair={p.hair}><path d={paths[p.hair]} fill={p.ink}/>{p.hair === 'widow' && <path d="m73 68 8-18 9-6-8 16-4 26m51-43 10 15 5 21-11-13" stroke="#a9a09a" strokeWidth="3" fill="none"/>}{p.hair === 'mohawk' && <path d="m91 48 5-16 9 12 3-16 8 11 9-10-2 19Z" fill={p.accent}/>}</g>;
}
function Clothes({ p }) {
  const common = <path d="M13 250 29 185 75 159 91 143h37l17 16 48 27 22 64Z" fill={p.ink}/>;
  const neck = <path d="m90 133-5 30 24 28 26-30-8-29Z" fill={p.skin}/>;
  const details = {
    cravat: <><path d="m70 155 18-17 19 55-28-17Zm70 0-14-17-17 55 30-17Z" fill="#d2c5ad"/><path d="m96 166 13 13 11-15-4 39-9 18-11-18Z" fill={p.accent}/><path d="m53 180 27 19-13 30m98-47-28 17 13 29" stroke="#70616b" strokeWidth="3" fill="none"/></>,
    velvet: <><path d="M66 161Q107 201 150 160L140 204 107 225 75 205Z" fill={p.skin}/><path d="m54 174 25 44 28 17 36-21 24-40 29 60H26Z" fill={p.ink}/><path d="M87 160q22 16 46-1m-45 6q20 14 43 0" stroke="#201621" strokeWidth="4" fill="none"/><path d="m108 177 6 8-6 12-6-12Z" fill={p.accent}/></>,
    leather: <><path d="m75 153 29 63-43-19 13-18-26 1Zm70 1-37 63 48-16-15-24 28 6Z" fill="#66555e"/><path d="m63 210 54-25M126 217l42-26" stroke="#d4c7ae" strokeWidth="3"/>{[43,56,69,166,179].map(x=><path key={x} d={`m${x} 180 4-10 4 10Z`} fill="#cec6b5"/>)}</>,
    blazer: <><path d="m88 154 22 22 21-24 5 85H83Z" fill="#c5bba7"/><path d="m72 158 19 29-17 20 8 32H37l-7-43Zm74 0-17 30 18 18-13 33h57l-2-42Z" fill="#5b5963"/><path d="m111 180 2 57m-61-26h21" stroke={p.ink} strokeWidth="3"/><circle cx="115" cy="208" r="2.5" fill={p.ink}/></>,
    choker: <><path d="M81 152q29 18 55 0l-5 34H86Z" fill={p.skin}/><path d="M86 156q23 12 46-1" stroke={p.ink} strokeWidth="9" fill="none"/><circle cx="110" cy="161" r="4" fill="#d8c9ae"/><path d="m68 167-4 26 38 16 41-17 8-22 22 24 3 44H38l7-43Z" fill="#494047"/><path d="m87 215 33 1-12 14Z" fill={p.accent}/></>,
    denim: <><path d="m90 152 20 21 21-21 9 86H76Z" fill="#77707b"/><path d="m67 158 30 30-16 15 2 37H21l13-49Zm81 1-26 29 17 17-2 35h68l-17-49Z" fill="#525768"/><path d="m66 170 19 18-15 14m83-34-20 20 15 15M46 211h20m84 0h23" stroke="#b8b0a1" strokeWidth="2" fill="none"/><circle cx="158" cy="190" r="6" fill={p.accent}/></>,
    coat: <><path d="m65 154 27 53-22 18-28-42m112-29-31 53 26 19 27-43" stroke="#74605c" strokeWidth="11" fill="none"/><path d="m89 146 24 26 20-25-6 52h-29Z" fill="#514343"/></>
  };
  return <g data-wear={p.wear}>{common}{neck}{details[p.wear]}</g>;
}
function Features({ p }) {
  const eyes = {
    deep: 'm80 83 20-5-2 8-16 1m36-8 19 5-2 6-17-4',
    winged: 'm78 81 12 6 12-7-4 11-13-1Zm40 3 13 4 11-6-7 12-15-2Z',
    heavy: 'm74 81 27 1-2 9-23-3m40-6 26-4-1 9-25 3',
    level: 'm78 85q10-7 23 0l-1 4-20 1Zm39 0q12-6 25 2l-4 4-21-3Z',
    open: 'M80 88q11-13 23 0-12 7-23 0m37-1q11-12 22 0-10 8-22 0',
  };
  const noses = { aquiline:'m111 83-6 15 8 10-11 3 15 2', wide:'m113 91-6 14-10 7 9 6 14-3', broken:'m111 90-7 8 9 5-13 8 18 3', short:'m108 98-7 12 17 1', broad:'m110 91-5 13-10 6 10 7 18-6-5-7', straight:'m113 89-6 22 11 1' };
  const mouths = { thin:'m94 126 25-1-4 4-17-1Z', full:'m94 125 9-3 7 2 8-2 9 5-15 8-11-3Z', crooked:'m90 126 24 2 11-6-4 9-27 0Z', soft:'m96 123 14 3 12-3-8 7-10-1Z' };
  return <g data-face={p.face} data-eyes={p.eyes} data-nose={p.nose} data-mark={p.mark}>
    <path d={eyes[p.eyes]} fill={p.ink}/>{p.eyes==='open' && <g fill={p.skin}><circle cx="91" cy="86" r="2"/><circle cx="127" cy="85" r="2"/></g>}
    <path d={noses[p.nose]} fill="none" stroke={p.ink} strokeWidth="2" strokeLinejoin="round"/>
    <path d={mouths[p.mouth]} fill={p.eyes==='winged' ? '#682d40' : p.ink}/>
    {p.mark==='age' && <path d="m80 95 15 3m30-1 13-3M81 105l9 8m37-5-4 9M91 72l12-2m17-1 10 4M95 135l8 5m12-2 8-7" stroke={p.ink} strokeWidth="1.8" opacity=".65" fill="none"/>}
    {p.mark==='creases' && <path d="m78 98 12 2m39 0 12-2m-49 17-4 8m36-9 5 9m-22 14 12-2" stroke={p.ink} strokeWidth="1.5" opacity=".6" fill="none"/>}
    {p.mark==='scar' && <path d="m137 79-12 27m8-20 7 2m-11 9 7 2" stroke="#e4d7bd" strokeWidth="2.5" fill="none"/>}
    {p.mark==='beauty' && <circle cx="128" cy="121" r="2" fill={p.ink}/>}
    {p.mark==='liner' && <path d="m84 93 6 12 1-12m35-1 3 8 3-9" fill={p.ink}/>}
    {p.mark==='freckles' && <g fill={p.shade}>{[[82,101],[90,104],[95,99],[125,100],[132,104],[138,99]].map(([x,y])=><circle key={x} cx={x} cy={y} r="1.3"/>)}</g>}
    {p.mark==='beard' && <path d="m70 107 16 13 11 16 16 5 22-15 16-20-7 35-27 18-30-14Z" fill={p.ink}/>}
  </g>;
}
function Accessories({ p }) {
  if (p.accessory==='glasses' || p.accessory==='square-glasses') return <g fill="none" stroke="#b7b1a8" strokeWidth="2.7">{p.accessory==='glasses' ? <><ellipse cx="91" cy="88" rx="17" ry="12"/><ellipse cx="129" cy="88" rx="17" ry="12"/></> : <><rect x="74" y="78" width="32" height="21" rx="3"/><rect x="114" y="78" width="32" height="21" rx="3"/></>}<path d="M108 86h4m-39-2-8-3m82 3 6-3"/></g>;
  if (p.accessory==='hoops') return <g stroke="#d6c8b0" strokeWidth="3" fill="none"><ellipse cx="69" cy="111" rx="8" ry="14"/><ellipse cx="148" cy="111" rx="8" ry="14"/></g>;
  if (p.accessory==='rings') return <g stroke="#d6c8b0" strokeWidth="2.6" fill="none"><circle cx="153" cy="91" r="4"/><circle cx="153" cy="102" r="4"/><path d="M101 116q5 6 8 0"/></g>;
  if (p.accessory==='bar') return <path d="m132 74 4 6m-59 28 6-1" stroke="#dfd0b5" strokeWidth="3"/>;
  if (p.accessory==='drop') return <g fill="#cbbca5"><path d="m146 106 4 15-4 9-4-9Zm-73 0 4 15-4 9-4-9Z"/></g>;
  return <path d="m147 189 5-7 5 7-5 8Z" fill={p.accent} stroke="#b5a68e" strokeWidth="1.5"/>;
}
export const ContactPrint = memo(function ContactPrint({ id = 'sire', small = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const p = portraitProfile(id);
  return <svg className={`nb-portrait ${small ? 'small' : ''}`} viewBox="0 0 220 240" aria-hidden="true" focusable="false" data-portrait={p.id}>
    <defs><pattern id={`dots${uid}`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#261c26"/></pattern><clipPath id={`clip${uid}`}><rect x="9" y="9" width="202" height="222"/></clipPath></defs>
    <g clipPath={`url(#clip${uid})`}><rect width="220" height="240" fill="#b9ada0"/><path d="M0 25 220 0v45L0 92Zm0 120 220-82v28L0 183Z" fill="#877979"/>
      <circle cx="137" cy="87" r="69" fill={p.accent}/>
      <Hair p={p} back/><Clothes p={p}/>
      <path data-silhouette={p.face} d={faces[p.face]} fill={p.skin}/>
      <path d="m116 53-11 40 12 13-4 33 19-22 12-38-11-22Z" fill={p.shade} opacity=".68"/>
      <Features p={p}/><Hair p={p}/><Accessories p={p}/>
      <rect width="220" height="240" fill={`url(#dots${uid})`} opacity=".19"/>
      <path d="M15 199h29m119-176h40M17 26h15m152 190h25M8 231l42-3 27 4 39-4 41 3 55-4" stroke="#dbcfb5" opacity=".5"/>
    </g><path d="M9 37V9h28m147 0h27v28M9 203v28h28m147 0h27v-28" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>;
});
export function TapeLabel({ children }) { return <span className="nb-tape-label">{children}</span>; }
