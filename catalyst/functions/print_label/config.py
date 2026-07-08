import os

# No python-dotenv here on purpose: this runs as a Catalyst function, which
# injects environment variables directly -- there's no .env file to load,
# and load_dotenv() walking the filesystem looking for one was the likely
# cause of the FileNotFoundError seen at every request (it ran unconditionally
# at import time, before any request-specific code, which matched every
# request failing identically regardless of path or params).

ZOHO_CLIENT_ID = os.environ["ZOHO_CLIENT_ID"]
ZOHO_CLIENT_SECRET = os.environ["ZOHO_CLIENT_SECRET"]
ZOHO_REFRESH_TOKEN = os.environ["ZOHO_REFRESH_TOKEN"]
ZOHO_ORGANIZATION_ID = os.environ["ZOHO_ORGANIZATION_ID"]

ZOHO_ACCOUNTS_DOMAIN = os.environ.get("ZOHO_ACCOUNTS_DOMAIN", "https://accounts.zoho.com")
ZOHO_API_DOMAIN = os.environ.get("ZOHO_API_DOMAIN", "https://www.zohoapis.com")

PRINTER_NAME = os.environ.get("PRINTER_NAME", "GODEX_GE330")
LABEL_WIDTH_MM = float(os.environ.get("LABEL_WIDTH_MM", "30"))
LABEL_HEIGHT_MM = float(os.environ.get("LABEL_HEIGHT_MM", "19"))

# Custom module lookup is optional -- unset until the module API name and the
# field that links a module record back to an item are confirmed.
ZOHO_CUSTOM_MODULE_NAME = os.environ.get("ZOHO_CUSTOM_MODULE_NAME") or None
ZOHO_CUSTOM_MODULE_LINK_FIELD = os.environ.get("ZOHO_CUSTOM_MODULE_LINK_FIELD", "item_id")
