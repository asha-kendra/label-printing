from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from . import config

QR_SIZE_MM = 8
MARGIN_MM = 0.8
FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

HEADER_BOLD_SIZE = 5.5
HEADER_SIZE = 4.3
BODY_SIZE = 4.2
ROW_GAP = 2.0
LABEL_W = 5.5


def _draw_border(c, width_mm, height_mm, inset_mm=0.5):
    c.setLineWidth(0.5)
    c.rect(inset_mm * mm, inset_mm * mm, (width_mm - 2 * inset_mm) * mm, (height_mm - 2 * inset_mm) * mm, stroke=1, fill=0)


def _draw_qr(c, data, x_mm, y_mm, size_mm=QR_SIZE_MM):
    widget = QrCodeWidget(data or "")
    bounds = widget.getBounds()
    box_size = bounds[2] - bounds[0]
    scale = (size_mm * mm) / box_size
    drawing = Drawing(size_mm * mm, size_mm * mm, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x_mm * mm, y_mm * mm)


def _text_col(c, lines, x_mm, top_y_mm, line_gap_mm=ROW_GAP, font_size=BODY_SIZE, label_width_mm=LABEL_W):
    y = top_y_mm
    for label, value in lines:
        if value in (None, ""):
            continue
        c.setFont(FONT_BOLD, font_size)
        c.drawString(x_mm * mm, y * mm, f"{label}:")
        c.setFont(FONT, font_size)
        c.drawString((x_mm + label_width_mm) * mm, y * mm, str(value))
        y -= line_gap_mm


def _text_width_mm(c, text, font, size):
    return c.stringWidth(text, font, size) / mm


def _qr_x(c, width_mm, height_mm, header_specs, band_rows=None, label_width_mm=LABEL_W, font_size=BODY_SIZE, gap_mm=1.5):
    """Pull the QR left toward the header text instead of pinning it to the
    right edge, without letting it overlap whatever else shares its row band
    (the header lines, and -- on templates where field rows sit high enough
    to be beside the QR rather than below it -- those rows too).
    """
    widths = [_text_width_mm(c, text, font, size) for font, size, text in header_specs if text]
    for label, value in (band_rows or []):
        if value not in (None, ""):
            widths.append(label_width_mm + _text_width_mm(c, str(value), FONT, font_size))
    max_w = max(widths) if widths else 0
    default_x = width_mm - QR_SIZE_MM - MARGIN_MM
    return min(default_x, MARGIN_MM + max_w + gap_mm)


def render_parcel(c, data, width_mm, height_mm):
    """At 30x19mm there isn't room for the Meas/Total-Weight side block
    (with its ↕↕ icon) beside the header without it running into the QR --
    even just "Meas: 0.30-0.70mm" needs more width than's available before
    the QR's rightmost position. So Meas and Total Weight become two more
    rows in the same field list instead of a separate side block."""
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    fields = [
        ("Shp", data.get("shape")),
        ("Size", data.get("size_ct_range")),
    ]
    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, HEADER_BOLD_SIZE, sku), (FONT, HEADER_SIZE, growth_type)],
        band_rows=fields,
    )
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, HEADER_BOLD_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 2.3) * mm, sku)
    c.setFont(FONT, HEADER_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 4.3) * mm, growth_type)

    fields += [
        ("Col", data.get("colour")),
        ("Cla", data.get("clarity")),
        ("Meas", data.get("meas_mm_range")),
        ("Wt", data.get("total_weight")),
    ]
    _text_col(c, fields, MARGIN_MM, height_mm - 6.5)


def render_certified_simple(c, data, width_mm, height_mm):
    """The plainer certified layout: single Shp/Wt/Col/Cla column, with the
    GIA cert # and combined measurements as two lines under the QR instead
    of a 4-column grid. The 4-column grid doesn't fit legibly at 30x19mm,
    so this is the standard Certified template at this label size."""
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    top_y = height_mm - 6.5

    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, HEADER_BOLD_SIZE, sku), (FONT, HEADER_SIZE, growth_type)],
        band_rows=[("Shp", data.get("shape"))],
    )
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, HEADER_BOLD_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 2.3) * mm, sku)
    c.setFont(FONT, HEADER_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 4.3) * mm, growth_type)

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Wt", f"{data['weight_ct']} ct" if data.get("weight_ct") else None),
            ("Col", data.get("colour")),
            ("Cla", data.get("clarity")),
        ],
        MARGIN_MM, top_y,
    )

    gia_line = f"GIA-{data['certificate_no']}" if data.get("certificate_no") else None

    length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
    dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
    if depth not in (None, ""):
        dims = f"{dims}x{depth}" if dims else str(depth)
    meas_line = f"{dims}mm" if dims else None

    # GIA + measurements sit under the QR, in its own column -- not beside
    # the field rows, and clear of them since qr_x already keeps clear of
    # the field list's widest row.
    y = height_mm - QR_SIZE_MM - MARGIN_MM - 1.4
    c.setFont(FONT, 3.6)
    if gia_line:
        c.drawString(qr_x * mm, y * mm, gia_line)
        y -= 2.0
    if meas_line:
        c.drawString(qr_x * mm, y * mm, meas_line)


def render_jewellery(c, data, width_mm, height_mm):
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, HEADER_BOLD_SIZE, sku), (FONT, HEADER_SIZE, growth_type)],
    )
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, HEADER_BOLD_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 2.3) * mm, sku)
    c.setFont(FONT, HEADER_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 4.3) * mm, growth_type)

    stone_line = None
    if data.get("stone"):
        stone_line = data["stone"]
        if data.get("stone_weight_ct"):
            stone_line += f" - {data['stone_weight_ct']} ct"

    gross_ring_line = None
    if data.get("gross_weight_g"):
        gross_ring_line = f"{data['gross_weight_g']} gms"
        if data.get("ring_size"):
            gross_ring_line += f" | Ring Size: {data['ring_size']}"
    elif data.get("ring_size"):
        gross_ring_line = f"Ring Size: {data['ring_size']}"

    c.setFont(FONT, BODY_SIZE)
    y = height_mm - QR_SIZE_MM - MARGIN_MM - 0.8
    for line in (stone_line, data.get("description"), data.get("metal"), gross_ring_line):
        if line:
            c.drawString(MARGIN_MM * mm, y * mm, line)
            y -= ROW_GAP


def render_matching_pairs(c, data, width_mm, height_mm):
    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, HEADER_BOLD_SIZE, data.get("sku")), (FONT, HEADER_SIZE, "Matching Pair")],
        band_rows=[("Shp", data.get("shape"))],
    )
    _draw_qr(c, data.get("sku"), qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, HEADER_BOLD_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 2.3) * mm, data.get("sku") or "")
    c.setFont(FONT, HEADER_SIZE)
    c.drawString(MARGIN_MM * mm, (height_mm - 4.3) * mm, "Matching Pair")

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Col", data.get("colour")),
            ("Cla", data.get("clarity")),
            ("Pr Wt", f"{data['pair_weight_ct']} ct" if data.get("pair_weight_ct") else None),
            ("Qty", data.get("qty")),
        ],
        MARGIN_MM,
        height_mm - 6.5,
    )


_RENDERERS = {
    "parcel": render_parcel,
    "certified": render_certified_simple,
    "jewellery": render_jewellery,
    "matching_pairs": render_matching_pairs,
}


def render_label_pdf(data, output_path, width_mm=None, height_mm=None):
    width_mm = width_mm or config.LABEL_WIDTH_MM
    height_mm = height_mm or config.LABEL_HEIGHT_MM

    renderer = _RENDERERS.get(data["label_type"])
    if renderer is None:
        raise ValueError(f"No renderer for label type {data['label_type']!r}")

    c = canvas.Canvas(output_path, pagesize=(width_mm * mm, height_mm * mm))
    _draw_border(c, width_mm, height_mm)
    renderer(c, data, width_mm, height_mm)
    c.showPage()
    c.save()
    return output_path
