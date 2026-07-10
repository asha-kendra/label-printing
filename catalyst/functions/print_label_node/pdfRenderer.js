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

const POSITIONS = {
  sku: [LEFT_X, 3.5],
  growth: [LEFT_X, 5.7],
  shp_label: [LEFT_X, 9.0], shp_value: [VALUE_X, 9.0],
  wt_label: [LEFT_X, 11.6], wt_value: [VALUE_X, 11.6],
  col_label: [LEFT_X, 13.9], col_value: [VALUE_X, 13.9],
  cla_label: [LEFT_X, 16.1], cla_value: [VALUE_X, 16.1],
  gia: [RIGHT_X, 13.5],
  meas: [RIGHT_X, 16.1],
};
const QR = { x: RIGHT_X, top: 2.2, size: 8.8 };

async function renderCertifiedPdf(data) {
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

  function draw(key, text, bold = true) {
    const [x, yTop] = POSITIONS[key];
    const baselinePt = mm(yTop);
    const topPt = baselinePt - FONT_SIZE * HELVETICA_ASCENT;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(FONT_SIZE)
      .text(text, mm(x), topPt, { lineBreak: false });
  }

  const sku = data.sku || "";
  const growthType = data.growth_type || "Natural";

  // QR
  const qrPng = await QRCode.toBuffer(sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.top), { width: mm(QR.size), height: mm(QR.size) });

  draw("sku", sku);
  draw("growth", growthType);

  const fieldRows = [
    ["shp", "Shp.", data.shape],
    ["wt", "Wt", !isEmpty(data.weight_ct) ? `${data.weight_ct} ct` : null],
    ["col", "Col", data.colour],
    ["cla", "Cla", data.clarity],
  ];
  for (const [key, label, value] of fieldRows) {
    draw(`${key}_label`, label);
    if (!isEmpty(value)) draw(`${key}_value`, String(value));
  }

  const lab = data.certificate_lab || "GIA";
  const giaLine = !isEmpty(data.certificate_no) ? `${lab}-${data.certificate_no}` : null;

  let measLine;
  if (!isEmpty(data.measurements_mm)) {
    measLine = `${String(data.measurements_mm).replace(/x/g, "×")}mm`;
  } else {
    const dims = [data.length_mm, data.width_mm].filter((v) => !isEmpty(v)).join("-");
    let combined = dims;
    if (!isEmpty(data.depth_mm)) combined = dims ? `${dims}×${data.depth_mm}` : String(data.depth_mm);
    measLine = combined ? `${combined}mm` : null;
  }

  if (giaLine) draw("gia", giaLine);
  if (measLine) draw("meas", measLine);

  doc.end();
  return done;
}

module.exports = { renderCertifiedPdf };
