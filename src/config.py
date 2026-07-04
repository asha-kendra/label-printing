import os

from dotenv import load_dotenv

load_dotenv()

ZOHO_CLIENT_ID = os.environ["ZOHO_CLIENT_ID"]
ZOHO_CLIENT_SECRET = os.environ["ZOHO_CLIENT_SECRET"]
ZOHO_REFRESH_TOKEN = os.environ["ZOHO_REFRESH_TOKEN"]
ZOHO_ORGANIZATION_ID = os.environ["ZOHO_ORGANIZATION_ID"]

ZOHO_ACCOUNTS_DOMAIN = os.environ.get("ZOHO_ACCOUNTS_DOMAIN", "https://accounts.zoho.com")
ZOHO_API_DOMAIN = os.environ.get("ZOHO_API_DOMAIN", "https://www.zohoapis.com")

PRINTER_NAME = os.environ.get("PRINTER_NAME", "GODEX_GE330")
LABEL_WIDTH_MM = float(os.environ.get("LABEL_WIDTH_MM", "65"))
LABEL_HEIGHT_MM = float(os.environ.get("LABEL_HEIGHT_MM", "31"))

# Custom module lookup is optional -- unset until the module API name and the
# field that links a module record back to an item are confirmed.
ZOHO_CUSTOM_MODULE_NAME = os.environ.get("ZOHO_CUSTOM_MODULE_NAME") or None
ZOHO_CUSTOM_MODULE_LINK_FIELD = os.environ.get("ZOHO_CUSTOM_MODULE_LINK_FIELD", "item_id")
