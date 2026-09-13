import { useId } from 'react';

// Original two-ink identity prints, not photographic portraits or fetched assets.
// Each ornament is non-interactive and excluded from the accessibility tree.
export function NightSeal({ className = '' }) {
  return <svg className={`nb-seal ${className}`} viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="74" fill="none" stroke="currentColor" strokeWidth="1"/><circle cx="90" cy="90" r="68" fill="none" stroke="currentColor" strokeDasharray="1 7"/><path d="M90 8v28m0 108v28M8 90h28m108 0h28M36 36l14 14m80 80 14 14M36 144l14-14m80-80 14-14" fill="none" stroke="currentColor"/><path d="M90 39 110 73l29-12-14 42-23 12-12 28-12-28-23-12-14-42 29 12Z" fill="currentColor" opacity=".2"/><path d="M90 48s-24 29-24 44a24 24 0 1 0 48 0c0-15-24-44-24-44Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M74 94c0 13 8 18 16 18M90 30v18m0 73v28M49 90h15m52 0h15" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
}
export function ContactPrint({ id = 'sire', small = false }) {
  const uid = useId().replaceAll(':','');
  const punk = id === 'rook', bob = id === 'mara', long = id === 'vesper';
  return <svg className={`nb-portrait ${small ? 'small' : ''}`} viewBox="0 0 220 240" aria-hidden="true">
    <defs><pattern id={`dots${uid}`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor"/></pattern><clipPath id={`clip${uid}`}><rect x="9" y="9" width="202" height="222"/></clipPath></defs>
    <g clipPath={`url(#clip${uid})`}><rect width="220" height="240" fill="#b9ada0"/><path d="M0 25 220 0v45L0 92Zm0 120 220-82v28L0 183Z" fill="#877979"/>
      <circle cx="137" cy="87" r="69" fill={punk ? '#72313c' : long ? '#5a4059' : '#6f6261'}/>
      <path d="M17 250 39 175 79 153 84 129h48l9 24 40 23 29 74Z" fill="#171419"/>
      <path d={punk ? 'M73 67 87 39 96 55 107 25 117 49 137 39 142 72 134 124 118 151 89 133 77 106Z' : bob ? 'M58 111 65 61 90 39 131 44 149 70 160 129 138 153 123 136 82 145 59 131Z' : long ? 'M60 156 65 76 77 49 111 37 139 52 148 83 159 170 128 163 78 166Z' : 'M61 156 66 70 82 46 123 42 145 61 152 146 134 167 79 169Z'} fill="#19151b"/>
      <path d="M85 70 119 55 137 77 134 111 116 139 96 130 81 102Z" fill="#d2c5ad"/>
      <path d="m115 63-8 39 11 3-7 24 17-11 6-22 1-20Z" fill="#8e8175"/><path d="m85 86 15-4-2 6-12 2m35-8 12 4-1 4-11-3m-23 24 19 3-8 4Z" fill="#252026"/>
      <path d={punk ? 'M72 81 76 56l36-12 26 14-5 19-18-13-29 7Z' : bob ? 'M69 105 71 63l25-22 33 10 15 29-31-12-7 20-25 9-6 36Z' : long ? 'M70 139 72 74l11-22 31-13 26 21-24 4-29 21-4 41Z' : 'm70 126 2-54 17-29 40 1 20 27-31-14-29 31-5 38Z'} fill="#171419"/>
      <path d="m78 147 29 62-38-23 8-18-18 2m79-22-31 61 39-22-8-19 19 3" fill="#6d5d62"/><path d="m95 153 12 56 21-56-20 16Z" fill="#c2b59f"/><path d="m108 169-5 34 5 20 9-19-6-35Z" fill="#7c2b3e"/>
      {punk && <g fill="#d5c7b1"><path d="m49 181 5-12 5 12Zm11-5 5-12 5 12Zm98 3 5-12 5 12Z"/><circle cx="134" cy="99" r="4" fill="none" stroke="#d5c7b1" strokeWidth="2"/></g>}
      <rect width="220" height="240" fill={`url(#dots${uid})`} opacity=".24"/><path d="M15 199h29m119-176h40M17 26h15m152 190h25M8 231l42-3 27 4 39-4 41 3 55-4" stroke="#dbcfb5" opacity=".5"/>
    </g><path d="M9 37V9h28m147 0h27v28M9 203v28h28m147 0h27v-28" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>;
}
export function TapeLabel({ children }) { return <span className="nb-tape-label">{children}</span>; }
