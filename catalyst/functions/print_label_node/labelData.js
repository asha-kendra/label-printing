// Field mapping, inlined rather than read from a file -- Catalyst's deploy
// path doesn't reliably carry subdirectories alongside code files, and the
// Python version hit exactly that. Keep this in sync with
// ../../../config/label_fields.json if the mapping changes.
const RULES = {
  _category_match: {
    parcel: ["parcel"],
    certified: ["certified", "certificate"],
    jewellery: ["jewellery", "jewelry", "finished"],
    matching_pairs: ["matching pair", "pair"],
  },
  parcel: {
    sku: ["sku"],
    growth_type: ["growth type", "natural/lab", "type"],
    shape: ["shape"],
    size_ct_range: ["size", "carat range", "size (ct)"],
    colour: ["colour", "color"],
    clarity: ["clarity"],
    meas_mm_range: ["meas", "measurement range", "mm range", "size (mm)"],
    total_weight: ["total weight", "weight"],
  },
  certified: {
    sku: ["sku", "stock no", "stock #"],
    growth_type: ["producttype", "growth type", "natural/lab", "type"],
    shape: ["shape"],
    weight_ct: ["carat/units (in)", "weight", "wt (ct)", "carat weight"],
    colour: ["colour", "color"],
    clarity: ["clarity"],
    cut: ["cut"],
    polish: ["polish", "pol"],
    symmetry: ["symmetry", "sym"],
    fluorescence: ["fluorescence", "flu"],
    measurements_mm: ["measurement (mm)", "measurement(mm)", "measurements (mm)"],
    length_mm: ["length", "meas l", "length (mm)", "length(mm)"],
    width_mm: ["width", "meas w", "width (mm)", "width(mm)"],
    depth_mm: ["depth", "meas d", "depth (mm)", "depth(mm)"],
    table_pct: ["table %", "table"],
    depth_pct: ["depth %", "depth percent", "depth percentage"],
    ratio_pct: ["ratio", "ratio %"],
    certificate_no: ["gia certificate #", "certificate no", "cert no", "gia report number"],
    certificate_lab: ["lab", "certificate lab", "cert lab"],
  },
  jewellery: {
    sku: ["sku"],
    growth_type: ["growth type", "natural/lab", "type"],
    metal: ["metal", "metal & karat", "karat"],
    stone: ["stone", "stone type"],
    stone_weight_ct: ["stone weight", "carat"],
    description: ["description", "item name"],
    gross_weight_g: ["gross weight", "weight (g)", "weight in grams"],
    ring_size: ["ring size", "size"],
  },
  matching_pairs: {
    sku: ["sku"],
    shape: ["shape"],
    colour: ["colour", "color"],
    clarity: ["clarity"],
    pair_weight_ct: ["pair weight", "total weight", "weight"],
    qty: ["qty", "quantity"],
  },
};

function detectLabelType(item) {
  const haystack = `${(item.category_name || "").toLowerCase()} ${(item.group_name || "").toLowerCase()}`;
  for (const [labelType, substrings] of Object.entries(RULES._category_match)) {
    if (substrings.some((s) => haystack.includes(s))) return labelType;
  }
  return null;
}

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function buildLabelData(item, customFields, labelTypeOverride) {
  const labelType = labelTypeOverride || detectLabelType(item);
  if (!labelType || !RULES[labelType]) {
    throw new Error(
      `Could not determine label type for item ${item.item_id} ` +
        `(category=${item.category_name}, group=${item.group_name}). ` +
        `Pass label_type explicitly or update the RULES map in labelData.js.`
    );
  }
  const data = { label_type: labelType, item_id: item.item_id, name: item.name, sku: item.sku };
  const fieldMap = RULES[labelType];
  for (const [field, aliases] of Object.entries(fieldMap)) {
    let value = null;
    for (const alias of aliases) {
      if (!isEmpty(customFields[alias])) {
        value = customFields[alias];
        break;
      }
    }
    // "sku" (and any other pre-seeded key) is also a field-map entry, since
    // some orgs might only have it as a custom field -- don't let a miss
    // here clobber the value already seeded from the item's own properties.
    if (value !== null || !(field in data)) {
      data[field] = value;
    }
  }
  return data;
}

module.exports = { RULES, detectLabelType, buildLabelData, isEmpty };
