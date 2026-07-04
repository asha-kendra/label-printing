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


def _draw_qr(c, data, x_mm, y_mm, size_mm=QR_SIZE_MM):
    widget = QrCodeWidget(data or "")
    bounds = widget.getBounds()
    box_size = bounds[2] - bounds[0]
    scale = (size_mm * mm) / box_size
    drawing = Drawing(size_mm * mm, size_mm * mm, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x_mm * mm, y_mm * mm)


def _text_col(c, lines, x_mm, top_y_mm, line_gap_mm=3.4, font_size=6.5):
    y = top_y_mm
    for label, value in lines:
        if value in (None, ""):
            continue
        c.setFont(FONT_BOLD, font_size)
        c.drawString(x_mm * mm, y * mm, f"{label}:")
        c.setFont(FONT, font_size)
        c.drawString((x_mm + 13) * mm, y * mm, str(value))
        y -= line_gap_mm


def render_parcel(c, data, width_mm, height_mm):
    qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
    _draw_qr(c, data.get("sku"), qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, data.get("sku") or "")
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, "Natural")

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Size", data.get("size_mm")),
            ("Clr", data.get("colour")),
            ("Clty", data.get("clarity")),
            ("Wt", data.get("total_weight")),
        ],
        MARGIN_MM,
        height_mm - 12,
    )


def render_certified(c, data, width_mm, height_mm):
    qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
    _draw_qr(c, data.get("sku"), qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, data.get("sku") or "")
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, data.get("growth_type") or "Natural")
    if data.get("certificate_no"):
        c.drawString(MARGIN_MM * mm, (height_mm - 11.5) * mm, f"GIA - {data['certificate_no']}")

    _text_col(
        c,
        [
            ("Shp", data.get("shape")),
            ("Cut", data.get("cut")),
            ("Meas", data.get("measurements")),
            ("Wt", f"{data['weight_ct']} ct" if data.get("weight_ct") else None),
            ("Sym", data.get("symmetry")),
            ("Tbl", data.get("table_pct")),
            ("Col", data.get("colour")),
            ("Clty", data.get("clarity")),
            ("Flu", data.get("fluorescence")),
        ],
        MARGIN_MM,
        height_mm - 15.5,
    )


def render_jewellery(c, data, width_mm, height_mm):
    qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
    _draw_qr(c, data.get("sku"), qr_x, height_mm - QR_SIZE_MM - MARGIN_MM)

    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_MM * mm, (height_mm - 4) * mm, data.get("sku") or "")
    c.setFont(FONT, 6.5)
    c.drawString(MARGIN_MM * mm, (height_mm - 8) * mm, data.get("metal") or "")

    stone_line = None
    if data.get("stone"):
        stone_line = data["stone"]
        if data.get("stone_weight_ct"):
            stone_line += f" - {data['stone_weight_ct']} ct"
    if stone_line:
        c.drawString(MARGIN_MM * mm, (height_mm - 11.5) * mm, stone_line)

    _text_col(
        c,
        [
            ("Desc", data.get("description")),
            ("Clty", data.get("clarity")),
            ("Gr Wt", f"{data['gross_weight_g']} g" if data.get("gross_weight_g") else None),
            ("Ring", data.get("ring_size")),
        ],
        MARGIN_MM,
        height_mm - 15,
    )


def render_matching_pairs(c, data, width_mm, height_mm):
    qr_x = width_mm - QR_SIZE_MM - MARGIN_MM
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
    renderer(c, data, width_mm, height_mm)
    c.showPage()
    c.save()
    return output_path
