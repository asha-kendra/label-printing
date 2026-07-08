# Templates inlined as strings rather than read from templates/*.ezpl --
# Catalyst's deploy path doesn't reliably carry subdirectories alongside
# the .py files, so nothing here should depend on bundled non-code files.
# Keep these in sync with ../../../templates/*.ezpl (and the standalone
# templates/ copy kept in this folder for local/CLI testing) if the real
# templates change.

_CERTIFIED_TEMPLATE = """^Q152,24
^W240
^H10
^P1
^S2
^AT
^AD
^C1
^R0
~Q+0
^O0
^D0
^E12

AA,16,28,1,1,0,0E,<ITEM_NO>
AA,16,46,1,1,0,0E,<COLOR>

AA,16,72,1,1,0,0E,Shp.
AA,72,72,1,1,0,0E,<SHAPE>

AA,16,93,1,1,0,0E,Wt
AA,72,93,1,1,0,0E,<WEIGHT>

AA,16,111,1,1,0,0E,Col
AA,72,111,1,1,0,0E,<COLOR_GRADE>

AA,16,129,1,1,0,0E,Cla
AA,72,129,1,1,0,0E,<CLARITY>

AA,136,108,1,1,0,0E,<CERT_NO>
AA,136,129,1,1,0,0E,<MEASUREMENTS>

BQ,136,18,2,5,M,0
MA,<QR_DATA>

E
"""

_JEWELLERY_TEMPLATE = """^Q152,24
^W240
^H10
^P1
^S2
^AT
^AD
^C1
^R0
~Q+0
^O0
^D0
^E12

AA,12,24,1,1,0,0E,<SKU>
AA,12,45,1,1,0,0E,<GROWTH_TYPE>

AA,12,78,1,1,0,0E,Stone
AA,68,78,1,1,0,0E,<STONE>

AA,12,98,1,1,0,0E,Wt
AA,68,98,1,1,0,0E,<STONE_WEIGHT>

AA,12,119,1,1,0,0E,Mtl
AA,68,119,1,1,0,0E,<METAL>

AA,12,140,1,1,0,0E,Ring
AA,68,140,1,1,0,0E,<RING_SIZE>

AA,164,87,1,1,0,0E,<DESCRIPTION>
AA,164,108,1,1,0,0E,<GROSS_WEIGHT>

BQ,164,12,2,5,M,0
MA,<QR_DATA>

E
"""


def render_certified_ezpl(data):
    """Fill in the real EZPL template -- the printer's own native command
    language, exported from the existing system -- rather than
    reconstructing the layout via PDF/CSS."""
    measurements_mm = data.get("measurements_mm")
    if measurements_mm:
        # Zoho's own combined field (e.g. "7.13x6.76x4.39") -- swap the ASCII
        # "x" for U+00D7 (×, matches the reference mockup, in Latin-1 which
        # the PPD declares -- but confirm on a real print) and append the unit,
        # since the field's value doesn't include either.
        measurements = f"{str(measurements_mm).replace('x', '×')}mm"
    else:
        # Fall back to combining the separate L/W/D fields, for orgs/items
        # that don't have the combined field.
        length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
        dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
        if depth not in (None, ""):
            dims = f"{dims}×{depth}" if dims else str(depth)
        measurements = f"{dims}mm" if dims else ""

    cert_no = data.get("certificate_no")
    lab = data.get("certificate_lab") or "GIA"
    cert_field = f"{lab}-{cert_no}" if cert_no else ""

    weight_ct = data.get("weight_ct")
    weight_field = f"{weight_ct} ct" if weight_ct else ""

    substitutions = {
        "<ITEM_NO>": data.get("sku") or "",
        "<COLOR>": data.get("growth_type") or "Natural",
        "<SHAPE>": data.get("shape") or "",
        "<WEIGHT>": weight_field,
        "<COLOR_GRADE>": data.get("colour") or "",
        "<CLARITY>": data.get("clarity") or "",
        "<CERT_NO>": cert_field,
        "<MEASUREMENTS>": measurements,
        "<QR_DATA>": data.get("sku") or "",
    }

    ezpl = _CERTIFIED_TEMPLATE
    for placeholder, value in substitutions.items():
        ezpl = ezpl.replace(placeholder, str(value))
    return ezpl


def render_jewellery_ezpl(data):
    """Fill in the jewellery template -- deliberately mirrors the
    certified template's exact structure and positions (bold SKU header +
    growth-type line + 4-row label/value list + 2 lines under the QR),
    with jewellery's own fields slotted into those same rows: Stone/Wt
    (stone + carat)/Mtl/Ring in the field list, Description + gross
    weight under the QR. Diamond Single Stone (certified) and Jewellery
    are different item categories with different fields, but should look
    like the same family of label."""
    stone_weight = f"{data['stone_weight_ct']} ct" if data.get("stone_weight_ct") else ""
    gross_weight = f"{data['gross_weight_g']} gms" if data.get("gross_weight_g") else ""

    substitutions = {
        "<SKU>": data.get("sku") or "",
        "<GROWTH_TYPE>": data.get("growth_type") or "Natural",
        "<STONE>": data.get("stone") or "",
        "<STONE_WEIGHT>": stone_weight,
        "<METAL>": data.get("metal") or "",
        "<RING_SIZE>": data.get("ring_size") or "",
        "<DESCRIPTION>": data.get("description") or "",
        "<GROSS_WEIGHT>": gross_weight,
        "<QR_DATA>": data.get("sku") or "",
    }

    ezpl = _JEWELLERY_TEMPLATE
    for placeholder, value in substitutions.items():
        ezpl = ezpl.replace(placeholder, str(value))
    return ezpl
