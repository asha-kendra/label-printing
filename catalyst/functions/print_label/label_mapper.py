# Inlined from config/label_fields.json rather than read from a file --
# Catalyst's deploy path doesn't reliably carry subdirectories alongside
# the .py files, so nothing here should depend on bundled non-code files.
# Keep this in sync with ../../../config/label_fields.json (and the
# standalone config/label_fields.json copy kept in this folder for
# local/CLI testing) if the field mapping changes.
_RULES = {
    "_category_match": {
        "parcel": ["parcel"],
        "certified": ["certified", "certificate"],
        "jewellery": ["jewellery", "jewelry", "finished"],
        "matching_pairs": ["matching pair", "pair"],
    },
    "parcel": {
        "sku": ["sku"],
        "growth_type": ["growth type", "natural/lab", "type"],
        "shape": ["shape"],
        "size_ct_range": ["size", "carat range", "size (ct)"],
        "colour": ["colour", "color"],
        "clarity": ["clarity"],
        "meas_mm_range": ["meas", "measurement range", "mm range", "size (mm)"],
        "total_weight": ["total weight", "weight"],
    },
    "certified": {
        "sku": ["sku", "stock no", "stock #"],
        "growth_type": ["producttype", "growth type", "natural/lab", "type"],
        "shape": ["shape"],
        "weight_ct": ["carat/units (in)", "weight", "wt (ct)", "carat weight"],
        "colour": ["colour", "color"],
        "clarity": ["clarity"],
        "cut": ["cut"],
        "polish": ["polish", "pol"],
        "symmetry": ["symmetry", "sym"],
        "fluorescence": ["fluorescence", "flu"],
        "measurements_mm": ["measurement (mm)", "measurement(mm)", "measurements (mm)"],
        "length_mm": ["length", "meas l", "length (mm)", "length(mm)"],
        "width_mm": ["width", "meas w", "width (mm)", "width(mm)"],
        "depth_mm": ["depth", "meas d", "depth (mm)", "depth(mm)"],
        "table_pct": ["table %", "table"],
        "depth_pct": ["depth %", "depth percent", "depth percentage"],
        "ratio_pct": ["ratio", "ratio %"],
        "certificate_no": ["gia certificate #", "certificate no", "cert no", "gia report number"],
        "certificate_lab": ["lab", "certificate lab", "cert lab"],
    },
    "jewellery": {
        "sku": ["sku"],
        "growth_type": ["growth type", "natural/lab", "type"],
        "metal": ["metal", "metal & karat", "karat"],
        "stone": ["stone", "stone type"],
        "stone_weight_ct": ["stone weight", "carat"],
        "description": ["description", "item name"],
        "gross_weight_g": ["gross weight", "weight (g)", "weight in grams"],
        "ring_size": ["ring size", "size"],
    },
    "matching_pairs": {
        "sku": ["sku"],
        "shape": ["shape"],
        "colour": ["colour", "color"],
        "clarity": ["clarity"],
        "pair_weight_ct": ["pair weight", "total weight", "weight"],
        "qty": ["qty", "quantity"],
    },
}


def detect_label_type(item):
    category_name = (item.get("category_name") or "").lower()
    group_name = (item.get("group_name") or "").lower()
    haystack = f"{category_name} {group_name}"

    for label_type, substrings in _RULES["_category_match"].items():
        if label_type.startswith("_"):
            continue
        if any(s in haystack for s in substrings):
            return label_type
    return None


def build_label_data(item, custom_fields, label_type=None):
    label_type = label_type or detect_label_type(item)
    if label_type is None or label_type not in _RULES:
        raise ValueError(
            f"Could not determine label type for item {item.get('item_id')} "
            f"(category={item.get('category_name')!r}, group={item.get('group_name')!r}). "
            "Pass label_type explicitly or update the _RULES dict in this file."
        )

    field_map = _RULES[label_type]
    data = {
        "label_type": label_type,
        "item_id": item.get("item_id"),
        "name": item.get("name"),
        "sku": item.get("sku"),
    }
    for field, aliases in field_map.items():
        value = None
        for alias in aliases:
            if alias in custom_fields and custom_fields[alias] not in (None, ""):
                value = custom_fields[alias]
                break
        if value is not None or field not in data:
            data[field] = value
    return data
