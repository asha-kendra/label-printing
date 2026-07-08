from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_template(name):
    return (TEMPLATES_DIR / name).read_text()


def render_certified_ezpl(data):
    """Fill in the real EZPL template (templates/certified.ezpl) -- the
    printer's own native command language, exported from the existing
    system -- rather than reconstructing the layout via PDF/CSS."""
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

    ezpl = _load_template("certified.ezpl")
    for placeholder, value in substitutions.items():
        ezpl = ezpl.replace(placeholder, str(value))
    return ezpl


def render_jewellery_ezpl(data):
    """Fill in templates/jewellery.ezpl -- deliberately mirrors
    certified.ezpl's exact structure and positions (bold SKU header +
    growth-type line + 4-row label/value list + 2 lines under the QR),
    with jewellery's own fields slotted into those same rows: Stone/Wt
    (stone + carat)/Mtl/Ring in the field list, Description + gross
    weight under the QR. Diamond Single Stone (certified.ezpl) and
    Jewellery are different item categories with different fields, but
    should look like the same family of label."""
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

    ezpl = _load_template("jewellery.ezpl")
    for placeholder, value in substitutions.items():
        ezpl = ezpl.replace(placeholder, str(value))
    return ezpl
