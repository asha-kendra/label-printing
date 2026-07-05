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


def _draw_qr_left(c, sku, height_mm, gap_mm=2):
    """QR pinned top-left, as in the real label samples -- returns the x
    (mm) where header/body text should start, just to its right."""
    y = height_mm - QR_SIZE_MM - MARGIN_MM
    _draw_qr(c, sku, MARGIN_MM, y)
    return MARGIN_MM + QR_SIZE_MM + gap_mm


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

    text_x = _draw_qr_left(c, sku, height_mm)

    c.setFont(FONT_BOLD, 8)
    c.drawString(text_x * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(text_x * mm, (height_mm - 8) * mm, growth_type)

    # Meas (mm range) + Total Weight mini block, top-right, beside the header
    misc_x = width_mm - 23
    c.setFont(FONT_BOLD, 6)
    y = height_mm - 4
    if data.get("meas_mm_range"):
        c.drawString(misc_x * mm, y * mm, f"Meas: {data['meas_mm_range']}")
        y -= 4
    if data.get("total_weight") not in (None, ""):
        c.drawString(misc_x * mm, y * mm, f"Total Wt: {data['total_weight']}")

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

    text_x = _draw_qr_left(c, sku, height_mm)

    c.setFont(FONT_BOLD, 8)
    c.drawString(text_x * mm, (height_mm - 4) * mm, sku)
    c.setFont(FONT, 6.5)
    c.drawString(text_x * mm, (height_mm - 8) * mm, growth_type)
    if gia_line:
        c.drawString(text_x * mm, (height_mm - 11.5) * mm, gia_line)

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


def render_jewellery(c, data, width_mm, height_mm):
    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    text_x = _draw_qr_left(c, sku, height_mm)

    c.setFont(FONT_BOLD, 8)
    c.drawString(text_x * mm, (height_mm - 4) * mm, sku)

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
    y = height_mm - 8
    for line in (growth_type, stone_line, data.get("description"), data.get("metal"), gross_ring_line):
        if line:
            c.drawString(text_x * mm, y * mm, line)
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
