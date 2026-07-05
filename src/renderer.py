from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from . import config

QR_SIZE_MM = 13
MARGIN_MM = 1.5
FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _draw_border(c, width_mm, height_mm, inset_mm=0.8):
    c.setLineWidth(0.75)
    c.rect(inset_mm * mm, inset_mm * mm, (width_mm - 2 * inset_mm) * mm, (height_mm - 2 * inset_mm) * mm, stroke=1, fill=0)


def _draw_qr(c, data, x_mm, y_mm, size_mm=QR_SIZE_MM):
    widget = QrCodeWidget(data or "")
    bounds = widget.getBounds()
    box_size = bounds[2] - bounds[0]
    scale = (size_mm * mm) / box_size
    drawing = Drawing(size_mm * mm, size_mm * mm, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x_mm * mm, y_mm * mm)


def _text_col(c, lines, x_mm, top_y_mm, line_gap_mm=3.4, font_size=6.5, label_width_mm=13):
    y = top_y_mm
    for label, value in lines:
        if value in (None, ""):
            continue
        c.setFont(FONT_BOLD, font_size)
        c.drawString(x_mm * mm, y * mm, f"{label}:")
        c.setFont(FONT, font_size)
        c.drawString((x_mm + label_width_mm) * mm, y * mm, str(value))
        y -= line_gap_mm


def _text_two_col(c, left_lines, right_lines, left_x_mm, right_x_mm, top_y_mm, line_gap_mm=3.4, font_size=6.5, label_width_mm=8):
    _text_col(c, left_lines, left_x_mm, top_y_mm, line_gap_mm, font_size, label_width_mm)
    _text_col(c, right_lines, right_x_mm, top_y_mm, line_gap_mm, font_size, label_width_mm)


def _text_width_mm(c, text, font, size):
    return c.stringWidth(text, font, size) / mm


def _draw_double_arrow(c, x_mm, y_bottom_mm, h_mm=3.2, w_mm=1.3):
    """One vertical range arrow: a line with a triangle at each end."""
    x = x_mm * mm
    y0 = y_bottom_mm * mm
    y1 = y0 + h_mm * mm
    half_w = (w_mm / 2) * mm
    tri_h = 0.9 * mm
    c.setLineWidth(0.4)
    c.line(x, y0, x, y1)
    for y_tip, y_base, going_up in ((y1, y1 - tri_h, True), (y0, y0 + tri_h, False)):
        p = c.beginPath()
        p.moveTo(x - half_w, y_base)
        p.lineTo(x + half_w, y_base)
        p.lineTo(x, y_tip)
        p.close()
        c.drawPath(p, fill=1, stroke=0)


def _draw_range_icon(c, x_mm, y_bottom_mm, spacing_mm=2.2):
    """The '↕↕' range-indicator icon from the real label samples,
    drawn as vector shapes since standard PDF fonts lack the glyph. Returns
    the x (mm) just past the icon's right edge."""
    _draw_double_arrow(c, x_mm, y_bottom_mm)
    _draw_double_arrow(c, x_mm + spacing_mm, y_bottom_mm)
    return x_mm + spacing_mm + 1.5


def _qr_x(c, width_mm, height_mm, header_specs, band_row=None, label_width_mm=13, font_size=6.5, gap_mm=3):
    """Pull the QR left toward the header text instead of pinning it to the
    right edge, without letting it overlap whatever else shares its row band
    (the header lines, and -- on templates where the first field row sits
    high enough to be beside the QR rather than below it -- that row too).
    """
    widths = [_text_width_mm(c, text, font, size) for font, size, text in header_specs if text]
    if band_row:
        label, value = band_row
        if value not in (None, ""):
            widths.append(label_width_mm + _text_width_mm(c, str(value), FONT, font_size))
    max_w = max(widths) if widths else 0
    default_x = width_mm - QR_SIZE_MM - MARGIN_MM
    return min(default_x, MARGIN_MM + max_w + gap_mm)


def render_parcel(c, data, width_mm, height_mm):
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, growth_type)

    # Meas (mm range) + Total Weight mini block, between the header and the QR
    header_w = max(_text_width_mm(c, sku, FONT_BOLD, 8), _text_width_mm(c, growth_type, FONT, 6.5))

    misc_lines = []
    if data.get("meas_mm_range"):
        misc_lines.append(f"Meas: {data['meas_mm_range']}")
    if data.get("total_weight") not in (None, ""):
        misc_lines.append(f"Total Wt: {data['total_weight']}")

    misc_x = MARGIN_MM + header_w + 4
    if misc_lines:
        misc_x = _draw_range_icon(c, misc_x, height_mm - 8) + 1

    c.setFont(FONT_BOLD, 6)
    y = height_mm - 4
    misc_w = 0
    for line in misc_lines:
        c.drawString(misc_x * mm, y * mm, line)
        misc_w = max(misc_w, _text_width_mm(c, line, FONT_BOLD, 6))
        y -= 4

    content_w = (misc_x + misc_w - MARGIN_MM) if misc_lines else header_w
    default_qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
    qr_x = min(default_qr_x, MARGIN_MM + content_w + 3)
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Size", data.get("size_ct_range")),
            ("Col", data.get("colour")),
            ("Cla", data.get("clarity")),
        ],
        MARGIN_MM,
        height_mm - 16,
    )


def render_certified(c, data, width_mm, height_mm):
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"
    gia_line = f"GIA - {data['certificate_no']}" if data.get("certificate_no") else None

    header_w = max(
        _text_width_mm(c, sku, FONT_BOLD, 8),
        _text_width_mm(c, growth_type, FONT, 6.5),
        _text_width_mm(c, gia_line, FONT, 6.5) if gia_line else 0,
    )
    has_meas = any(data.get(k) not in (None, "") for k in ("length_mm", "width_mm", "depth_mm"))
    icon_right = MARGIN_MM + header_w + 3
    if has_meas:
        icon_right = _draw_range_icon(c, icon_right, height_mm - 9)

    default_qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
    qr_x = min(default_qr_x, icon_right + 3)
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, growth_type)
    if gia_line:
        c.drawString(MARGIN_MM * mm, (height_mm - 11.5) * mm, gia_line)

    grid_top_y = height_mm - 16
    row_gap = 3.3
    font_size = 6.2
    label_w = 7

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Wt", f"{data['weight_ct']} ct" if data.get("weight_ct") else None),
            ("Col", data.get("colour")),
            ("Cla", data.get("clarity")),
        ],
        MARGIN_MM, grid_top_y, row_gap, font_size, label_w,
    )
    _text_col(
        c,
        [
            ("Cut", data.get("cut")),
            ("Pol", data.get("polish")),
            ("Sym", data.get("symmetry")),
            ("Flo", data.get("fluorescence")),
        ],
        MARGIN_MM + 19, grid_top_y, row_gap, font_size, label_w,
    )

    meas_x = MARGIN_MM + 35
    c.setFont(FONT_BOLD, font_size)
    c.drawString(meas_x * mm, grid_top_y * mm, "Meas:")
    c.setFont(FONT, font_size)
    y = grid_top_y - row_gap
    meas_values = [data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")]
    for i, v in enumerate(meas_values):
        if v not in (None, ""):
            c.drawString(meas_x * mm, y * mm, f"x {v} mm" if i == 2 else f"{v} mm")
        y -= row_gap

    tdr_x = MARGIN_MM + 51
    y = grid_top_y
    for label, value in [("T", data.get("table_pct")), ("D", data.get("depth_pct")), ("R", data.get("ratio_pct"))]:
        if value not in (None, ""):
            c.setFont(FONT_BOLD, font_size)
            c.drawString(tdr_x * mm, y * mm, f"{label}:")
            c.setFont(FONT, font_size)
            c.drawString((tdr_x + 3.5) * mm, y * mm, str(value))
        y -= row_gap


def render_certified_simple(c, data, width_mm, height_mm):
    """The plainer certified layout: single Shp/Wt/Col/Cla column, with the
    GIA cert # and combined measurements as two side lines instead of a
    4-column grid. Matches the simpler real label sample exactly."""
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, 8, sku), (FONT, 6.5, growth_type)],
    )
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, growth_type)

    top_y = height_mm - 16
    row_gap = 3.4
    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Wt", f"{data['weight_ct']} ct" if data.get("weight_ct") else None),
            ("Col", data.get("colour")),
            ("Cla", data.get("clarity")),
        ],
        MARGIN_MM, top_y, row_gap,
    )

    gia_line = f"GIA-{data['certificate_no']}" if data.get("certificate_no") else None

    length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
    dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
    if depth not in (None, ""):
        dims = f"{dims}x{depth}" if dims else str(depth)
    meas_line = f"{dims}mm" if dims else None

    side_x = width_mm / 2 + 3
    c.setFont(FONT, 6.5)
    if gia_line:
        c.drawString(side_x * mm, (top_y - row_gap * 2) * mm, gia_line)
    if meas_line:
        c.drawString(side_x * mm, (top_y - row_gap * 3) * mm, meas_line)


def render_jewellery(c, data, width_mm, height_mm):
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, 8, sku), (FONT, 6.5, growth_type)],
    )
    _draw_qr(c, sku, qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, growth_type)

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

    c.setFont(FONT, 6.5)
    y = height_mm - 15
    for line in (stone_line, data.get("description"), data.get("metal"), gross_ring_line):
        if line:
            c.drawString(MARGIN_MM * mm, y * mm, line)
            y -= 3.6


def render_matching_pairs(c, data, width_mm, height_mm):
    qr_x = _qr_x(
        c, width_mm, height_mm,
        header_specs=[(FONT_BOLD, 8, data.get("sku")), (FONT, 6.5, "Matching Pair")],
        band_row=("Shp", data.get("shape")),
    )
    _draw_qr(c, data.get("sku"), qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, data.get("sku") or "")
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, "Matching Pair")

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Col", data.get("colour")),
            ("Clty", data.get("clarity")),
            ("Pr Wt", f"{data['pair_weight_ct']} ct" if data.get("pair_weight_ct") else None),
            ("Qty", data.get("qty")),
        ],
        MARGIN_MM,
        height_mm - 12,
    )


_RENDERERS = {
    "parcel": render_parcel,
    "certified": render_certified,
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
