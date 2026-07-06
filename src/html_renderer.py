import base64
from io import BytesIO

import qrcode

from . import config

LABEL_CSS = """
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
.label {{
    position: relative;
    width: {width_mm}mm;
    height: {height_mm}mm;
    border: 0.5pt solid #000;
    font-family: Helvetica, Arial, sans-serif;
    background: #fff;
}}
.label span {{
    position: absolute;
    left: {side_margin}mm;
    white-space: nowrap;
    font-size: {font_size}pt;
    line-height: 1;
}}
.label span.bold {{ font-weight: bold; }}
.label img.qr {{
    position: absolute;
    left: {qr_x}mm;
    width: {qr_size}mm;
    height: {qr_size}mm;
}}
"""


def _qr_data_uri(data):
    img = qrcode.make(data or "", border=0)
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def render_certified_html(data, output_path, width_mm=None, height_mm=None):
    """Standalone HTML/CSS reproduction of render_certified_simple (renderer.py),
    using the same mm/pt positions so it matches the PDF exactly. CSS supports
    mm and pt as absolute units, so no unit conversion is needed."""
    width_mm = width_mm or config.LABEL_WIDTH_MM
    height_mm = height_mm or config.LABEL_HEIGHT_MM

    font_size = 2.6
    label_w = 2.6
    top_margin, bottom_margin, side_margin = 1.6, 1.6, 0.8
    row_gap = (height_mm - top_margin - bottom_margin) / 5
    qr_size = 8
    margin_mm = 0.8
    qr_x = width_mm - qr_size - margin_mm

    sku = data.get("sku") or ""
    growth_type = data.get("growth_type") or "Natural"

    y0 = height_mm - top_margin
    rows_y = [y0 - row_gap * i for i in range(6)]

    gia_line = f"GIA-{data['certificate_no']}" if data.get("certificate_no") else None
    length, width, depth = data.get("length_mm"), data.get("width_mm"), data.get("depth_mm")
    dims = "-".join(str(v) for v in (length, width) if v not in (None, ""))
    if depth not in (None, ""):
        dims = f"{dims}x{depth}" if dims else str(depth)
    meas_line = f"{dims}mm" if dims else None

    qr_bottom = height_mm - qr_size - margin_mm
    gia_y = qr_bottom - 1.2
    meas_y = gia_y - row_gap

    css = LABEL_CSS.format(
        width_mm=width_mm, height_mm=height_mm, side_margin=side_margin,
        font_size=font_size, qr_x=qr_x, qr_size=qr_size,
    )

    wt_value = f"{data['weight_ct']} ct" if data.get("weight_ct") else ""
    spans = [
        f'<span class="bold" style="bottom:{rows_y[0]}mm">{sku}</span>',
        f'<span style="bottom:{rows_y[1]}mm">{growth_type}</span>',
        f'<span style="bottom:{rows_y[2]}mm"><b>Shp:</b> {data.get("shape") or ""}</span>',
        f'<span style="bottom:{rows_y[3]}mm"><b>Wt:</b> {wt_value}</span>',
        f'<span style="bottom:{rows_y[4]}mm"><b>Col:</b> {data.get("colour") or ""}</span>',
        f'<span style="bottom:{rows_y[5]}mm"><b>Cla:</b> {data.get("clarity") or ""}</span>',
    ]
    if gia_line:
        spans.append(f'<span style="bottom:{gia_y}mm; left:{qr_x}mm">{gia_line}</span>')
    if meas_line:
        spans.append(f'<span style="bottom:{meas_y}mm; left:{qr_x}mm">{meas_line}</span>')

    qr_uri = _qr_data_uri(sku)
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Certified Label</title>
<style>{css}</style></head>
<body>
<div class="label">
{chr(10).join(spans)}
<img class="qr" style="bottom:{qr_bottom}mm" src="{qr_uri}">
</div>
</body></html>
"""
    with open(output_path, "w") as f:
        f.write(html)
    return output_path
