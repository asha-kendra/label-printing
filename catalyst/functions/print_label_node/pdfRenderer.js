const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718; // ascender / 1000 em, matches pdfmetrics.getAscent('Helvetica') used in the Python renderer

function mm(v) {
  return v * MM;
}

// Mirrors src/renderer.py's render_certified_simple: same fixed
// coordinates (mm from the label's top-left edge to each line's baseline),
// hand-tuned via the layout-bench editor and confirmed by the user. Keep
// both in sync if the layout changes.
const LEFT_X = 2.0;
const VALUE_X = 9.0;
const RIGHT_X = 17.0;
const FONT_SIZE = 4.0; // pt, uniform across every line on purpose

const SKU_Y = 3.5;
const GROWTH_Y = 5.7;
const GIA_Y = 13.5;
const MEAS_Y = 16.1;
const QR = { x: RIGHT_X, top: 2.2, size: 8.8 };

// Field-list row y-positions -- top and bottom anchors (9.0, 16.1) stay
// fixed regardless of row count so the field list always starts level
// with the header gap and ends level with the GIA/measurements column;
// rows in between are spaced evenly. Certified's 4-row spacing here
// (9.0/11.6/13.9/16.1) is the exact hand-tuned values confirmed earlier --
// not a re-derived formula -- so certified's positions never shift.
const FIELD_ROW_Y = {
  4: [9.0, 11.6, 13.9, 16.1],
  5: [9.0, 10.775, 12.55, 14.325, 16.1],
};

// label_type -> which field rows it shows, in order. "size" pulls from
// data.mm_size -- a real Zoho CRM Products field, confirmed live.
const FIELD_ROWS_BY_TYPE = {
  certified: [
    ["shp", "Shp.", (d) => d.shape],
    ["wt", "Wt", (d) => (!isEmpty(d.weight_ct) ? `${d.weight_ct} ct` : null)],
    ["col", "Col", (d) => d.colour],
    ["cla", "Cla", (d) => d.clarity],
  ],
  parcel: [
    ["shp", "Shp.", (d) => d.shape],
    ["wt", "Wt", (d) => (!isEmpty(d.weight_ct) ? `${d.weight_ct} ct` : null)],
    ["col", "Col", (d) => d.colour],
    ["cla", "Cla", (d) => d.clarity],
    ["size", "Size", (d) => (!isEmpty(d.mm_size) ? `${d.mm_size}mm` : null)],
  ],
};

function measurementsLine(data) {
  if (!isEmpty(data.measurements_mm)) {
    return `${String(data.measurements_mm).replace(/x/g, "×")}mm`;
  }
  const dims = [data.length_mm, data.width_mm].filter((v) => !isEmpty(v)).join("-");
  let combined = dims;
  if (!isEmpty(data.depth_mm)) combined = dims ? `${dims}×${data.depth_mm}` : String(data.depth_mm);
  return combined ? `${combined}mm` : null;
}

async function renderLabelPdf(data) {
  const widthMm = Number(process.env.LABEL_WIDTH_MM || 30);
  const heightMm = Number(process.env.LABEL_HEIGHT_MM || 19);

  const doc = new PDFDocument({ size: [mm(widthMm), mm(heightMm)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Border: rounded rect inset 0.5mm, radius 1.2mm -- matches _draw_border
  // in the Python renderer.
  doc
    .roundedRect(mm(0.5), mm(0.5), mm(widthMm - 1), mm(heightMm - 1), mm(1.2))
    .lineWidth(0.5) // points, matches reportlab's setLineWidth(0.5) in the Python renderer
    .stroke("black");

  function drawAt(x, yTop, text, bold = true) {
    const baselinePt = mm(yTop);
    const topPt = baselinePt - FONT_SIZE * HELVETICA_ASCENT;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(FONT_SIZE)
      .text(text, mm(x), topPt, { lineBreak: false });
  }

  const sku = data.sku || "";
  const growthType = data.growth_type || "Natural";

  const qrPng = await QRCode.toBuffer(sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.top), { width: mm(QR.size), height: mm(QR.size) });

  drawAt(LEFT_X, SKU_Y, sku);
  drawAt(LEFT_X, GROWTH_Y, growthType);

  const fieldRows = FIELD_ROWS_BY_TYPE[data.label_type] || FIELD_ROWS_BY_TYPE.certified;
  const rowYs = FIELD_ROW_Y[fieldRows.length];
  fieldRows.forEach(([, label, getValue], i) => {
    const y = rowYs[i];
    drawAt(LEFT_X, y, label);
    const value = getValue(data);
    if (!isEmpty(value)) drawAt(VALUE_X, y, String(value));
  });

  const lab = data.certificate_lab || "GIA";
  const giaLine = !isEmpty(data.certificate_no) ? `${lab}-${data.certificate_no}` : null;
  const measLine = measurementsLine(data);

  if (giaLine) drawAt(RIGHT_X, GIA_Y, giaLine);
  if (measLine) drawAt(RIGHT_X, MEAS_Y, measLine);

  doc.end();
  return done;
}

module.exports = { renderLabelPdf, renderCertifiedPdf: renderLabelPdf };
