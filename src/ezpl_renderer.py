from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_template(name):
    return (TEMPLATES_DIR / name).read_text()


def render_certified_ezpl(data):
    """Fill in the real EZPL template (templates/certified.ezpl) -- the
    printer's own native command language, exported from the existing
    system -- rather than reconstructing the layout via PDF/CSS."""
    length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
    dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
    if depth not in (None, ""):
        dims = f"{dims}x{depth}" if dims else str(depth)
    measurements = f"{dims}mm" if dims else ""

    cert_no = data.get("certificate_no")
    cert_field = f"GIA-{cert_no}" if cert_no else ""

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
    """Fill in templates/jewellery.ezpl -- the full 6-line jewellery field
    set (matching the real label photo: SKU, growth type, stone+carat,
    description, metal, gross weight+ring size), not the 3-field
    Product-Name/SKU/Weight subset from the ZPL reference file, which was
    only a simplified example. Same field-combining logic as the PDF
    renderer's render_jewellery (stone+carat on one line, weight+ring
    size on one line)."""
    stone_line = ""
    if data.get("stone"):
        stone_line = data["stone"]
        if data.get("stone_weight_ct"):
            stone_line += f" - {data['stone_weight_ct']} ct"

    weight_ring_line = ""
    if data.get("gross_weight_g"):
        weight_ring_line = f"{data['gross_weight_g']} gms"
        if data.get("ring_size"):
            weight_ring_line += f" | Ring Size: {data['ring_size']}"
    elif data.get("ring_size"):
        weight_ring_line = f"Ring Size: {data['ring_size']}"

    substitutions = {
        "<SKU>": data.get("sku") or "",
        "<GROWTH_TYPE>": data.get("growth_type") or "Natural",
        "<STONE_LINE>": stone_line,
        "<DESCRIPTION>": data.get("description") or "",
        "<METAL>": data.get("metal") or "",
        "<WEIGHT_RING_LINE>": weight_ring_line,
        "<QR_DATA>": data.get("sku") or "",
    }

    ezpl = _load_template("jewellery.ezpl")
    for placeholder, value in substitutions.items():
        ezpl = ezpl.replace(placeholder, str(value))
    return ezpl
