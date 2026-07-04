import time

import requests

from . import config

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


def flatten_custom_fields(item):
    fields = {}
    for cf in item.get("custom_fields", []):
        label = (cf.get("label") or cf.get("customfield_name") or "").strip().lower()
        if label:
            fields[label] = cf.get("value")
    return fields
