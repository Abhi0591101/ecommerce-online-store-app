/**
 * Grocery / supermarket unit master list
 * Source: grocery_unit_abbreviation_full_name_list.txt
 *
 * Default active groups for product forms: WEIGHT, VOLUME, COUNT, PACKAGING, REGIONAL_*
 * Other groups remain available but marked inactive (still searchable if enabled).
 */

const UNIT_ROWS = [
  // WEIGHT / MASS
  ['mcg', 'Microgram', 'WEIGHT', true],
  ['mg', 'Milligram', 'WEIGHT', true],
  ['g', 'Gram', 'WEIGHT', true],
  ['kg', 'Kilogram', 'WEIGHT', true],
  ['qtl', 'Quintal', 'WEIGHT', true],
  ['MT', 'Metric Tonne', 'WEIGHT', true],
  ['oz', 'Ounce', 'WEIGHT', true],
  ['lb', 'Pound', 'WEIGHT', true],
  ['ct', 'Carat', 'WEIGHT', true],

  // VOLUME / LIQUID
  ['uL', 'Microlitre', 'VOLUME', true],
  ['mL', 'Millilitre', 'VOLUME', true],
  ['cL', 'Centilitre', 'VOLUME', true],
  ['L', 'Litre', 'VOLUME', true],
  ['kL', 'Kilolitre', 'VOLUME', true],
  ['tsp', 'Teaspoon', 'VOLUME', true],
  ['tbsp', 'Tablespoon', 'VOLUME', true],
  ['cup', 'Cup', 'VOLUME', true],
  ['fl oz', 'Fluid Ounce', 'VOLUME', true],
  ['pt', 'Pint', 'VOLUME', true],
  ['qt', 'Quart', 'VOLUME', true],
  ['gal', 'Gallon', 'VOLUME', true],

  // COUNT / QUANTITY
  ['pc', 'Piece', 'COUNT', true],
  ['pcs', 'Pieces', 'COUNT', true],
  ['ea', 'Each', 'COUNT', true],
  ['unit', 'Unit', 'COUNT', true],
  ['no', 'Number', 'COUNT', true],
  ['doz', 'Dozen', 'COUNT', true],
  ['half-doz', 'Half Dozen', 'COUNT', true],
  ['pair', 'Pair', 'COUNT', true],
  ['set', 'Set', 'COUNT', true],
  ['score', 'Score (20 pieces)', 'COUNT', true],
  ['gross', 'Gross (144 pieces)', 'COUNT', true],
  ['head', 'Head', 'COUNT', true],
  ['clove', 'Clove', 'COUNT', true],
  ['slice', 'Slice', 'COUNT', true],
  ['stick', 'Stick', 'COUNT', true],
  ['bar', 'Bar', 'COUNT', true],
  ['loaf', 'Loaf', 'COUNT', true],
  ['bunch', 'Bunch', 'COUNT', true],
  ['bundle', 'Bundle', 'COUNT', true],
  ['sheet', 'Sheet', 'COUNT', true],
  ['roll', 'Roll', 'COUNT', true],
  ['tablet', 'Tablet', 'COUNT', true],
  ['capsule', 'Capsule', 'COUNT', true],
  ['egg', 'Egg', 'COUNT', true],
  ['serving', 'Serving', 'COUNT', true],
  ['portion', 'Portion', 'COUNT', true],
  ['scoop', 'Scoop', 'COUNT', true],
  ['sprig', 'Sprig', 'COUNT', true],
  ['stalk', 'Stalk', 'COUNT', true],
  ['pod', 'Pod', 'COUNT', true],
  ['bulb', 'Bulb', 'COUNT', true],
  ['cob', 'Cob', 'COUNT', true],
  ['leaf', 'Leaf', 'COUNT', true],
  ['pad', 'Pad', 'COUNT', true],
  ['wipe', 'Wipe', 'COUNT', true],
  ['diaper', 'Diaper', 'COUNT', true],

  // PACKAGING / SELLING UNITS
  ['pkt', 'Packet', 'PACKAGING', true],
  ['pack', 'Pack', 'PACKAGING', true],
  ['m-pack', 'Multipack', 'PACKAGING', true],
  ['pouch', 'Pouch', 'PACKAGING', true],
  ['sach', 'Sachet', 'PACKAGING', true],
  ['bag', 'Bag', 'PACKAGING', true],
  ['sack', 'Sack', 'PACKAGING', true],
  ['box', 'Box', 'PACKAGING', true],
  ['ctn', 'Carton', 'PACKAGING', true],
  ['case', 'Case', 'PACKAGING', true],
  ['crate', 'Crate', 'PACKAGING', true],
  ['tray', 'Tray', 'PACKAGING', true],
  ['btl', 'Bottle', 'PACKAGING', true],
  ['jar', 'Jar', 'PACKAGING', true],
  ['tin', 'Tin', 'PACKAGING', true],
  ['can', 'Can', 'PACKAGING', true],
  ['tub', 'Tub', 'PACKAGING', true],
  ['cont', 'Container', 'PACKAGING', true],
  ['strip', 'Strip', 'PACKAGING', true],
  ['blister', 'Blister Pack', 'PACKAGING', true],
  ['tube', 'Tube', 'PACKAGING', true],
  ['tetra', 'Tetra Pack', 'PACKAGING', true],
  ['drum', 'Drum', 'PACKAGING', true],
  ['barrel', 'Barrel', 'PACKAGING', true],
  ['bucket', 'Bucket', 'PACKAGING', true],
  ['basket', 'Basket', 'PACKAGING', true],
  ['sleeve', 'Sleeve', 'PACKAGING', true],
  ['wrap', 'Wrap', 'PACKAGING', true],
  ['wrapper', 'Wrapper', 'PACKAGING', true],
  ['envelope', 'Envelope', 'PACKAGING', true],
  ['refill', 'Refill Pack', 'PACKAGING', true],
  ['combo', 'Combo Pack', 'PACKAGING', true],
  ['bulk', 'Bulk Pack', 'PACKAGING', true],
  ['gift', 'Gift Pack', 'PACKAGING', true],
  ['family', 'Family Pack', 'PACKAGING', true],
  ['value', 'Value Pack', 'PACKAGING', true],
  ['trial', 'Trial Pack', 'PACKAGING', true],
  ['jumbo', 'Jumbo Pack', 'PACKAGING', true],
  ['mesh-bag', 'Mesh Bag', 'PACKAGING', true],
  ['net', 'Net Pack', 'PACKAGING', true],
  ['clamshell', 'Clamshell Pack', 'PACKAGING', true],
  ['vacuum-pack', 'Vacuum Pack', 'PACKAGING', true],
  ['stick-pack', 'Stick Pack', 'PACKAGING', true],
  ['brick-pack', 'Brick Pack', 'PACKAGING', true],
  ['retort-pouch', 'Retort Pouch', 'PACKAGING', true],
  ['reel', 'Reel', 'PACKAGING', true],
  ['spool', 'Spool', 'PACKAGING', true],
  ['tote', 'Tote', 'PACKAGING', true],
  ['bin', 'Bin', 'PACKAGING', true],

  // LENGTH (optional / inactive by default)
  ['mm', 'Millimetre', 'LENGTH', false],
  ['cm', 'Centimetre', 'LENGTH', false],
  ['m', 'Metre', 'LENGTH', false],
  ['km', 'Kilometre', 'LENGTH', false],
  ['in', 'Inch', 'LENGTH', false],
  ['ft', 'Foot', 'LENGTH', false],
  ['yd', 'Yard', 'LENGTH', false],

  // AREA
  ['cm2', 'Square Centimetre', 'AREA', false],
  ['m2', 'Square Metre', 'AREA', false],
  ['sq ft', 'Square Foot', 'AREA', false],
  ['sq in', 'Square Inch', 'AREA', false],
  ['sq yd', 'Square Yard', 'AREA', false],
  ['acre', 'Acre', 'AREA', false],
  ['ha', 'Hectare', 'AREA', false],

  // VOLUME / SPACE
  ['cm3', 'Cubic Centimetre', 'SPACE', false],
  ['m3', 'Cubic Metre', 'SPACE', false],
  ['cu ft', 'Cubic Foot', 'SPACE', false],
  ['cu in', 'Cubic Inch', 'SPACE', false],
  ['cu yd', 'Cubic Yard', 'SPACE', false],

  // REGIONAL INDIAN UNITS
  ['tola', 'Tola', 'REGIONAL_WEIGHT', true],
  ['seer', 'Seer', 'REGIONAL_WEIGHT', true],
  ['maund', 'Maund', 'REGIONAL_WEIGHT', true],
  ['pav', 'Pav', 'REGIONAL_WEIGHT', true],
  ['chatak', 'Chatak', 'REGIONAL_WEIGHT', true],
  ['bora', 'Bora / Large Sack', 'REGIONAL_PACKAGING', true],
  ['katta', 'Katta / Sack', 'REGIONAL_PACKAGING', true],
  ['dabba', 'Dabba / Container', 'REGIONAL_PACKAGING', true],
  ['dibba', 'Dibba / Box', 'REGIONAL_PACKAGING', true],
  ['katori', 'Katori / Small Bowl', 'REGIONAL_VOLUME', true],
  ['glass', 'Glass', 'REGIONAL_VOLUME', true],
  ['spoon', 'Spoon', 'REGIONAL_VOLUME', true],
  ['gaj', 'Gaj', 'REGIONAL_LENGTH', true],

  // TEMPERATURE
  ['C', 'Degree Celsius', 'TEMPERATURE', false],
  ['F', 'Degree Fahrenheit', 'TEMPERATURE', false],
  ['K', 'Kelvin', 'TEMPERATURE', false],

  // TIME
  ['sec', 'Second', 'TIME', false],
  ['min', 'Minute', 'TIME', false],
  ['hr', 'Hour', 'TIME', false],
  ['day', 'Day', 'TIME', false],
  ['wk', 'Week', 'TIME', false],
  ['mo', 'Month', 'TIME', false],
  ['yr', 'Year', 'TIME', false]
];

export const ALL_PRODUCT_UNIT_TYPES = UNIT_ROWS.map(([value, fullName, group, active]) => ({
  value,
  fullName,
  group,
  active,
  label: `${value} — ${fullName}`,
  keywords: `${value} ${fullName} ${group}`
}));

/** Active units shown in product forms (WEIGHT / VOLUME / COUNT / PACKAGING / REGIONAL) */
export const PRODUCT_UNIT_TYPES = ALL_PRODUCT_UNIT_TYPES.filter((u) => u.active);

const byValueLower = new Map(
  ALL_PRODUCT_UNIT_TYPES.map((u) => [u.value.toLowerCase(), u])
);

/** Common legacy aliases → master abbreviation */
const UNIT_ALIASES = {
  ml: 'mL',
  millilitre: 'mL',
  milliliter: 'mL',
  litre: 'L',
  liter: 'L',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  piece: 'pc',
  pieces: 'pcs',
  dozen: 'doz',
  bottle: 'btl',
  packet: 'pkt',
  sachet: 'sach',
  carton: 'ctn'
};

function resolveUnitType(rawType) {
  const t = String(rawType || '').trim();
  if (!t) return 'pc';
  const alias = UNIT_ALIASES[t.toLowerCase()];
  if (alias) return alias;
  const known = byValueLower.get(t.toLowerCase());
  return known?.value || t;
}

/** Build stored unit string, e.g. "250 mL", "1 kg", "4 pack" */
export function formatProductUnit(amount, unitType) {
  const qty = String(amount ?? '').trim();
  const type = String(unitType ?? '').trim();
  if (!qty || !type) return '';
  return `${qty} ${type}`;
}

/** Split a stored unit back into amount + type when possible */
export function parseProductUnit(unit = '') {
  const raw = String(unit || '').trim();
  if (!raw) return { amount: '', unitType: 'pc' };

  const packOf = raw.match(/^pack\s+of\s+(\d+(?:\.\d+)?)$/i);
  if (packOf) return { amount: packOf[1], unitType: 'pack' };

  // Prefer known abbreviation match after the quantity
  const qtyMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (qtyMatch) {
    const amount = qtyMatch[1];
    const rest = qtyMatch[2].trim();
    return { amount, unitType: resolveUnitType(rest) };
  }

  const gluedOnly = raw.match(/^(\d+(?:\.\d+)?)([a-zA-Zμµ]+)$/);
  if (gluedOnly) {
    return {
      amount: gluedOnly[1],
      unitType: resolveUnitType(gluedOnly[2])
    };
  }

  return { amount: raw, unitType: 'pc' };
}
