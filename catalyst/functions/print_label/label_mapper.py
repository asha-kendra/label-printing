import json
from pathlib import Path

_RULES_PATH = Path(__file__).resolve().parent / "config" / "label_fields.json"
_RULES = json.loads(_RULES_PATH.read_text())


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
            "Pass label_type explicitly or update config/label_fields.json."
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
