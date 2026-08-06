const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

// Large-format (65x31mm) parcel-only label. Same layout language and
// scaled coordinates as large_diamond_parcel_label, but split into its
// own dedicated function/script -- mirroring how certified_diamond_label
// is separate from print_label_node. Parcels never show cert info; the
// right column always shows mm_size instead.
const LEFT_X = 4.3;
const VALUE_X = 19.5;
const RIGHT_X = 36.8;
const FONT_SIZE = 6.5; // pt, uniform across every line on purpose

const SKU_Y = 5.7;
const GROWTH_Y = 9.3;
const GIA_Y = 22.0;
const MEAS_Y = 26.3;
const QR = { x: RIGHT_X, top: 3.6, size: 14.4 };

// Parcel always has 5 field rows (adds Size); top/bottom anchors stay
// fixed, rows in between spaced evenly.
const FIELD_ROW_Y = [14.7, 17.6, 20.5, 23.4, 26.3];

const PARCEL_FIELD_ROWS = [
  ["shp", "Shp.", (d) => d.shape],
  ["wt", "Wt", (d) => (!isEmpty(d.weight_ct) ? `${d.weight_ct} ct` : null)],
  ["col", "Col", (d) => d.colour],
  ["cla", "Cla", (d) => d.clarity],
  ["size", "Size", (d) => (!isEmpty(d.mm_size) ? `${d.mm_size}mm` : null)],
];

function measurementsLine(data) {
  if (!isEmpty(data.measurements_mm)) {
    return `${String(data.measurements_mm).replace(/x/g, "×")}mm`;
  }
  const dims = [data.length_mm, data.width_mm].filter((v) => !isEmpty(v)).join("-");
  let combined = dims;
  if (!isEmpty(data.depth_mm)) combined = dims ? `${dims}×${data.depth_mm}` : String(data.depth_mm);
  return combined ? `${combined}mm` : null;
}

async function renderParcelLabelPdf(data) {
  const widthMm = Number(process.env.LABEL_WIDTH_MM || 65);
  const heightMm = Number(process.env.LABEL_HEIGHT_MM || 31);

  const doc = new PDFDocument({ size: [mm(widthMm), mm(heightMm)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Border: rounded rect inset 0.5mm, radius 1.2mm -- same treatment as
  // the other labels.
  doc
    .roundedRect(mm(0.5), mm(0.5), mm(widthMm - 1), mm(heightMm - 1), mm(1.2))
    .lineWidth(0.5)
    .stroke("black");

  function drawAt(x, yTop, text, { bold = true, maxWidthMm = null } = {}) {
    const baselinePt = mm(yTop);
    const topPt = baselinePt - FONT_SIZE * HELVETICA_ASCENT;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(FONT_SIZE);
    const xPt = mm(x);
    if (maxWidthMm != null) {
      const textWidthPt = doc.widthOfString(text);
      const maxWidthPt = mm(maxWidthMm);
      if (textWidthPt > maxWidthPt) {
        const scaleX = maxWidthPt / textWidthPt;
        doc.save();
        doc.translate(xPt, topPt);
        doc.scale(scaleX, 1);
        doc.text(text, 0, 0, { lineBreak: false });
        doc.restore();
        return;
      }
    }
    doc.text(text, xPt, topPt, { lineBreak: false });
  }

  const sku = data.sku || "";
  const growthType = data.growth_type || "Natural";

  const qrPng = await QRCode.toBuffer(sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.top), { width: mm(QR.size), height: mm(QR.size) });

  drawAt(LEFT_X, SKU_Y, sku);
  drawAt(LEFT_X, GROWTH_Y, growthType);

  PARCEL_FIELD_ROWS.forEach(([, label, getValue], i) => {
    const y = FIELD_ROW_Y[i];
    drawAt(LEFT_X, y, label);
    const value = getValue(data);
    if (!isEmpty(value)) drawAt(VALUE_X, y, String(value));
  });

  // Parcels never show cert info -- mm_size instead, unconditionally.
  const giaLine = !isEmpty(data.mm_size) ? `Size ${data.mm_size}mm` : null;
  const measLine = measurementsLine(data);
  const rightColumnMaxWidthMm = widthMm - RIGHT_X - 1.5;

  if (giaLine) drawAt(RIGHT_X, GIA_Y, giaLine, { maxWidthMm: rightColumnMaxWidthMm });
  if (measLine) drawAt(RIGHT_X, MEAS_Y, measLine, { maxWidthMm: rightColumnMaxWidthMm });

  doc.end();
  return done;
}

module.exports = { renderParcelLabelPdf };
