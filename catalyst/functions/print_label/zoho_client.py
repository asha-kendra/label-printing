import time

import requests

import config

_token_cache = {"access_token": None, "expires_at": 0}


def _get_access_token():
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["access_token"]

    resp = requests.post(
        f"{config.ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token",
        params={
            "refresh_token": config.ZOHO_REFRESH_TOKEN,
            "client_id": config.ZOHO_CLIENT_ID,
            "client_secret": config.ZOHO_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        raise RuntimeError(f"Zoho token refresh failed: {data}")

    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600) - 60
    return _token_cache["access_token"]


def get_item(item_id):
    token = _get_access_token()
    resp = requests.get(
        f"{config.ZOHO_API_DOMAIN}/inventory/v1/items/{item_id}",
        headers={"Authorization": f"Zoho-oauthtoken {token}"},
        params={"organization_id": config.ZOHO_ORGANIZATION_ID},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho API error for item {item_id}: {data.get('message')}")
    return data["item"]


def get_custom_module_record(item_id, module_name=None, link_field=None):
    """Fetch the custom-module record linked to an item, if a module is configured.

    NOTE: the endpoint shape (`/inventory/v1/{module_name}`) is inferred from
    Zoho Books' documented custom-modules API, since Zoho blocks automated
    fetches of its Inventory custom-modules docs. Confirm this against a real
    call once ZOHO_CUSTOM_MODULE_NAME is set -- adjust the path/params here if
    the actual endpoint differs.
    """
    module_name = module_name or config.ZOHO_CUSTOM_MODULE_NAME
    if not module_name:
        return None
    link_field = link_field or config.ZOHO_CUSTOM_MODULE_LINK_FIELD

    token = _get_access_token()
    resp = requests.get(
        f"{config.ZOHO_API_DOMAIN}/inventory/v1/{module_name}",
        headers={"Authorization": f"Zoho-oauthtoken {token}"},
        params={
            "organization_id": config.ZOHO_ORGANIZATION_ID,
            link_field: item_id,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Zoho custom module error for item {item_id}: {data.get('message')}")

    records = data.get(module_name) or data.get("data") or []
    return records[0] if records else None


def flatten_custom_fields(item):
    fields = {}
    for cf in item.get("custom_fields", []):
        label = (cf.get("label") or cf.get("customfield_name") or "").strip().lower()
        if label:
            fields[label] = cf.get("value")
    return fields


def get_item_with_fields(item_id):
    """Fetch an item and merge in its custom-module fields (if configured).

    Custom-module fields win on key collisions, since they hold the more
    detailed jewellery-specific attributes (GIA cert, ring size, etc.) while
    the item's own custom fields hold the simpler ones (shape/colour/clarity).
    """
    item = get_item(item_id)
    fields = flatten_custom_fields(item)

    module_record = get_custom_module_record(item_id)
    if module_record:
        skip_keys = {"id", "item_id", config.ZOHO_CUSTOM_MODULE_LINK_FIELD.lower()}
        for key, value in module_record.items():
            if key.strip().lower() not in skip_keys:
                fields[key.strip().lower()] = value

    return item, fields
