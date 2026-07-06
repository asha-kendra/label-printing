# Jewellery label printing (GODEX GE330)

Fetches an item from Zoho Inventory (plus its linked custom-module record)
and prints a jewellery label sized for the GODEX GE330 thermal printer.

**This must run on a machine that has:**
- Normal internet access to `zohoapis.eu` / `accounts.zoho.eu`
- The GE330 set up as a CUPS printer using `printer/godex-ge330.ppd`

It will not work inside this dev sandbox -- outbound access to Zoho is
blocked by this environment's network policy, and there's no printer
attached here. Everything below is written and unit-tested against mocked
Zoho responses; run it for real on your own machine.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Zoho credentials
```

Required in `.env`:
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ORGANIZATION_ID`
- `ZOHO_ACCOUNTS_DOMAIN` / `ZOHO_API_DOMAIN` -- set to your data center
  (this account is on the EU DC: `accounts.zoho.eu` / `www.zohoapis.eu`)
- `PRINTER_NAME` -- the CUPS queue name for the GE330
- `ZOHO_CUSTOM_MODULE_NAME` / `ZOHO_CUSTOM_MODULE_LINK_FIELD` -- only needed
  once the jewellery custom module's API name is confirmed (see below)

## Printer setup (one-time, on the print machine)

```bash
lpadmin -p GODEX_GE330 -E -v <device-uri> -P printer/godex-ge330.ppd
```

Replace `<device-uri>` with the printer's USB/network CUPS device URI
(`lpinfo -v` lists available devices).

## Usage

```bash
python -m src.cli <item_id>                      # fetch, render, print
python -m src.cli <item_id> --no-print --out l.pdf   # render only, inspect first
python -m src.cli <item_id> --label-type certified   # override auto-detected type
python -m src.cli <item_id> --ezpl               # certified only: use the real EZPL
                                                  # template (templates/certified.ezpl)
                                                  # and send it raw, instead of the PDF path
```

## Label types

Type is auto-detected from the item's `category_name`/`group_name` in Zoho
(see `_category_match` in `config/label_fields.json`). Four types are
supported: `parcel`, `certified`, `jewellery`, `matching_pairs`.

## Known gaps / things to confirm on first real run

1. **Custom module endpoint is unverified.** `src/zoho_client.py:get_custom_module_record`
   assumes `GET /inventory/v1/{module_name}?organization_id=...&{link_field}=<item_id>`,
   inferred from Zoho Books' custom-modules API docs (Zoho blocks automated
   fetches of the Inventory-specific docs). Confirm the real shape against a
   live call and adjust if it 404s or returns something different.
2. **Field label mapping is a first draft** (`config/label_fields.json`),
   based on photographed label samples, not live Zoho data. Edit the alias
   lists there (no code changes needed) once you see real custom-field names
   for Certified/Jewellery/Matching Pairs items.
3. **Category-match substrings** (`parcel`, `certified`, `jewellery`,
   `matching pair`) assume those words appear in the item's category or item
   group name in Zoho -- confirm and adjust in the same config file.
4. **`<COLOR>` in `templates/certified.ezpl`** (row 2, right under the item
   number) is mapped to `growth_type` in `src/ezpl_renderer.py` since that's
   the closest match to what real label photos show there -- but the
   template's own naming suggests it might be meant for a fancy-color grade
   instead. Confirm against a live print.
5. **EZPL units are unconfirmed.** `templates/certified.ezpl` is the real
   template exported from the existing system, used as-is without knowing
   whether its `^Q152,24`/`^W280` units line up with 300dpi or another
   resolution -- test a real print before trusting the physical size.
