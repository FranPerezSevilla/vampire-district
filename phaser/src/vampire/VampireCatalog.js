export const VAMPIRE_RULES = Object.freeze({
  carryCapacity: 4, bagRelief: 35, bagPrice: 80, donorRelief: 28,
  donorRecovery: 240, repairCost: 180, investmentTrust: 15,
  endorsementTrust: 40, princeCost: 1200, businessPeriod: 90,
  savePeriod: 12, frenzyRecoveryHunger: 70, frenzySeconds: 10,
  frenzyExhaustion: 15, frenzyRetry: 35
});

export const VAMPIRE_CONTACTS = Object.freeze([
  { id: "sire", name: "The Sire", role: "Patron", buildingId: "refugeTower", factionId: "first_estate", districtId: "old-quarter", greeting: "Start by carrying supplies. Earn access, invest in the city, and one night others will depend on you.", pickup: "hospital", delivery: "club", reward: 180 },
  { id: "vesper", name: "Vesper Vale", role: "First Estate · hunting steward", buildingId: "club", factionId: "first_estate", districtId: "old-quarter", greeting: "My guests must survive. Keep your feeding discreet and I can open doors for you.", pickup: "hospital", delivery: "saintOrisonHotel", reward: 230 },
  { id: "rook", name: "Rook Mercer", role: "Gutter Crown · territorial broker", buildingId: "warehouse", factionId: "gutter_crown", districtId: "canal-west", greeting: "Move our supplies, keep your word, and this district can become your business.", pickup: "marketBlock", delivery: "warehouse", reward: 250 },
  { id: "mara", name: "Mara Voss", role: "Independent House · blood supplier", buildingId: "hospital", factionId: null, districtId: "hospital-district", greeting: "Blood is supply, access and bargaining power. Buy a bag today; own the supply tomorrow.", pickup: "warehouse", delivery: "hospital", reward: 270 }
]);

export const VAMPIRE_ASSETS = Object.freeze([
  { id: "club", name: "Club feeding rooms", contactId: "vesper", buildingId: "club", districtId: "old-quarter", price: 600, income: 85, bags: 0, description: "Discreet hunting access and admission income." },
  { id: "depot", name: "Canal distribution depot", contactId: "rook", buildingId: "warehouse", districtId: "canal-west", price: 800, income: 115, bags: 1, description: "A protected refuge, distribution income and blood reserves." },
  { id: "supply", name: "Hospital blood supply", contactId: "mara", buildingId: "hospital", districtId: "hospital-district", price: 1000, income: 130, bags: 2, description: "Blood production and a reliable supply business." }
]);

export const VAMPIRE_DONORS = Object.freeze([
  { id: "donor_iris", name: "Iris", contactId: "vesper", buildingId: "club", districtId: "old-quarter" },
  { id: "donor_eli", name: "Eli", contactId: "mara", buildingId: "hospital", districtId: "hospital-district" }
]);

export const contactById = id => VAMPIRE_CONTACTS.find(contact => contact.id === id);
export const assetById = id => VAMPIRE_ASSETS.find(asset => asset.id === id);
export const donorById = id => VAMPIRE_DONORS.find(donor => donor.id === id);

export function powerStage(state) {
  if (state.prince) return "Prince of the city";
  const assets = Object.values(state.assets || {});
  if (assets.filter(asset => asset.level >= 2).length >= 2) return "Power broker";
  if (assets.some(asset => asset.level > 0)) return "Investor";
  if (Object.values(state.contacts || {}).filter(contact => contact.met).length >= 3) return "Connected";
  return "Survivor";
}
