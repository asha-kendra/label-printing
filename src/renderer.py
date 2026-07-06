from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from . import config


def _ascent_mm(font, size):
    return pdfmetrics.getAscent(font) * size / 1000 / mm

QR_SIZE_MM = 8
MARGIN_MM = 0.8
FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

HEADER_BOLD_SIZE = 5.5
HEADER_SIZE = 4.3
BODY_SIZE = 4.2
ROW_GAP = 2.0
LABEL_W = 5.5


def _draw_border(c, width_mm, height_mm, inset_mm=0.5, radius_mm=0):
    c.setLineWidth(0.5)
    if radius_mm:
        c.roundRect(inset_mm * mm, inset_mm * mm, (width_mm - 2 * inset_mm) * mm,
                    (height_mm - 2 * inset_mm) * mm, radius_mm * mm, stroke=1, fill=0)
    else:
        c.rect(inset_mm * mm, inset_mm * mm, (width_mm - 2 * inset_mm) * mm, (height_mm - 2 * inset_mm) * mm, stroke=1, fill=0)


def _draw_qr(c, data, x_mm, y_mm, size_mm=QR_SIZE_MM):
    widget = QrCodeWidget(data or "")
    # Default barBorder=4 bakes a quiet-zone margin into the widget's own
    # bounding box, so the *visible* QR pattern sits inset within size_mm
    # rather than filling it -- making it look misaligned against text
    # whose glyphs start right at their nominal position. Zero it out so
    # the bounding box we scale to size_mm matches what's actually drawn.
    widget.barBorder = 0
    bounds = widget.getBounds()
    box_size = bounds[2] - bounds[0]
    scale = (size_mm * mm) / box_size
    drawing = Drawing(size_mm * mm, size_mm * mm, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x_mm * mm, y_mm * mm)


def _text_col(c, lines, x_mm, top_y_mm, line_gap_mm=ROW_GAP, font_size=BODY_SIZE, label_width_mm=LABEL_W,
              bold_label=True, label_suffix=":"):
    y = top_y_mm
    label_font = FONT_BOLD if bold_label else FONT
    for label, value in lines:
        if value in (None, ""):
            continue
        c.setFont(label_font, font_size)
        c.drawString(x_mm * mm, y * mm, f"{label}{label_suffix}")
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
    """The plainer certified layout: rounded corners, a bold SKU header
    (same point size as everything else -- bold is the only distinction)
    over a plain growth-type line, a bigger gap, then Shp/Wt/Col/Cla as a
    label/value column, with GIA cert # + combined measurements under the
    QR -- all at one uniform font size.

    The GIA/measurements column width is pinned to `text_col_w` (12mm),
    *not* derived from the QR's own size: that's how wide the widest
    realistic measurement string ("10.03-9.32x6.30mm") needs at this
    uniform font size, checked numerically (~1mm slack). The QR itself is
    drawn smaller and stays right-anchored, so shrinking it just opens up
    blank margin above-left of the QR -- it doesn't take width away from
    the text column below, which would otherwise overflow the label edge.
    """
    font_size = 4.0
    label_w = 7
    tight_gap = 2.6
    padding = 1.5  # left, right, bottom
    top_padding = 2.5  # extra breathing room above the header/QR specifically
    qr_size = 9  # visual QR box size, right-anchored
    text_col_w = 12  # GIA/measurements column width -- independent of qr_size, see docstring

    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    # QR's top and the item name's top sit on the same line: both start at
    # `top_padding` from the top edge. Text is positioned by baseline, so
    # back out the baseline from the font's real ascent instead of guessing.
    top_line_y = height_mm - top_padding
    y0 = top_line_y - _ascent_mm(FONT, font_size)
    qr_x = width_mm - padding - qr_size
    qr_y = top_line_y - qr_size
    text_x = width_mm - padding - text_col_w
    _draw_qr(c, sku, qr_x, qr_y, size_mm=qr_size)

    field_rows = [
        ("Shp.", data.get("shape")),
        ("Wt", f"{data['weight_ct']} ct" if data.get("weight_ct") else None),
        ("Col", data.get("colour")),
        ("Cla", data.get("clarity")),
    ]
    field_values = [v for _, v in field_rows if v]
    left_col_w = padding + label_w + max(
        (_text_width_mm(c, str(v), FONT, font_size) for v in field_values), default=0)
    header_w = padding + max(_text_width_mm(c, sku, FONT_BOLD, font_size),
                              _text_width_mm(c, growth_type, FONT, font_size))
    assert max(left_col_w, header_w) < text_x, (
        f"left content ({max(left_col_w, header_w):.1f}mm) collides with the "
        f"GIA/measurements column ({text_x:.1f}mm) -- shrink font_size/label_w or widen the label"
    )

    # Header (SKU, growth) and fields (Shp/Wt/Col/Cla) each read as a tight
    # group; the gap *between* the groups is enlarged instead, soaking up
    # the rest of the available height so Cla still lands near the bottom
    # padding line.
    between_gap = height_mm - top_padding - padding - _ascent_mm(FONT, font_size) - tight_gap * 4
    y_growth = y0 - tight_gap
    y_fields_top = y_growth - between_gap

    c.setFont(FONT_BOLD, font_size)
    c.drawString(padding * mm, y0 * mm, sku)
    c.setFont(FONT, font_size)
    c.drawString(padding * mm, y_growth * mm, growth_type)

    _text_col(c, field_rows, padding, y_fields_top, tight_gap, font_size, label_w,
              bold_label=False, label_suffix="")

    gia_line = f"GIA-{data['certificate_no']}" if data.get("certificate_no") else None

    length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
    dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
    if depth not in (None, ""):
        dims = f"{dims}×{depth}" if dims else str(depth)
    meas_line = f"{dims}mm" if dims else None

    # Position by real clearance from the QR's bottom edge to the text's
    # cap-height top (not baseline -- baseline-only offsets undercount by
    # a whole ascent and can let the glyph overlap the QR), then size the
    # GIA-to-meas gap so meas_line's baseline lands exactly on the bottom
    # padding line regardless of how tall the QR ends up being.
    gia_top_clearance = 0.39
    gia_y = qr_y - gia_top_clearance - _ascent_mm(FONT, font_size)
    meas_y = padding
    if gia_line:
        c.drawString(text_x * mm, gia_y * mm, gia_line)
    if meas_line:
        c.drawString(text_x * mm, meas_y * mm, meas_line)


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
    _draw_border(c, width_mm, height_mm, radius_mm=1.2)
    renderer(c, data, width_mm, height_mm)
    c.showPage()
    c.save()
    return output_path
