// Authored presentation only. These are visual identities, not gameplay roles,
// demographic inference from names, random NPC generation or a save schema.
const profiles = [
  { id: 'sire', face: 'gaunt', hair: 'widow', wear: 'cravat', skin: '#d2c5ad', shade: '#958577', ink: '#22202a', accent: '#763849', eyes: 'deep', nose: 'aquiline', mouth: 'thin', mark: 'age', accessory: 'pin' },
  { id: 'vesper', face: 'heart', hair: 'waves', wear: 'velvet', skin: '#ac8872', shade: '#765948', ink: '#1c1822', accent: '#5a4059', eyes: 'winged', nose: 'wide', mouth: 'full', mark: 'beauty', accessory: 'drop' },
  { id: 'rook', face: 'square', hair: 'mohawk', wear: 'leather', skin: '#c1ae8d', shade: '#8e795e', ink: '#211b20', accent: '#72313c', eyes: 'heavy', nose: 'broken', mouth: 'crooked', mark: 'scar', accessory: 'rings' },
  { id: 'mara', face: 'round', hair: 'bob', wear: 'blazer', skin: '#bda387', shade: '#8b7265', ink: '#282329', accent: '#657477', eyes: 'level', nose: 'short', mouth: 'thin', mark: 'creases', accessory: 'glasses' },
  { id: 'donor_iris', face: 'oval', hair: 'coils', wear: 'choker', skin: '#997861', shade: '#655041', ink: '#211923', accent: '#734954', eyes: 'winged', nose: 'broad', mouth: 'full', mark: 'liner', accessory: 'hoops' },
  { id: 'donor_eli', face: 'soft', hair: 'crop', wear: 'denim', skin: '#d8c5b0', shade: '#a18c7d', ink: '#29212c', accent: '#5a687d', eyes: 'open', nose: 'straight', mouth: 'soft', mark: 'freckles', accessory: 'bar' },
  { id: 'print_07', face: 'broad', hair: 'bald', wear: 'coat', skin: '#a48065', shade: '#725542', ink: '#282027', accent: '#756a4c', eyes: 'deep', nose: 'wide', mouth: 'thin', mark: 'beard', accessory: 'pin' },
  { id: 'print_08', face: 'tapered', hair: 'locs', wear: 'denim', skin: '#917862', shade: '#615145', ink: '#201b23', accent: '#544a6b', eyes: 'level', nose: 'broad', mouth: 'full', mark: 'none', accessory: 'rings' },
  { id: 'print_09', face: 'round', hair: 'sweep', wear: 'velvet', skin: '#d1b99a', shade: '#998071', ink: '#272029', accent: '#6e4948', eyes: 'open', nose: 'short', mouth: 'soft', mark: 'creases', accessory: 'square-glasses' },
  { id: 'print_10', face: 'heart', hair: 'shaved', wear: 'leather', skin: '#b39378', shade: '#806451', ink: '#201921', accent: '#6c566a', eyes: 'heavy', nose: 'straight', mouth: 'crooked', mark: 'liner', accessory: 'hoops' }
].map(profile => Object.freeze(profile));
export const PORTRAIT_PROFILES = Object.freeze(profiles);
const byId = new Map(profiles.map(p => [p.id, p]));
export function portraitProfile(value = 'sire') {
  const id = String(value || 'sire').replace(/^(contact|donor):/, '');
  if (byId.has(id)) return byId.get(id);
  // Stable fallback for future files; order, refresh and RNG never change a face.
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return profiles[6 + hash % 4];
}
