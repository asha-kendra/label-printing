const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

// Large-format diamond/parcel label: same layout language as the
// 30x19mm certified/uncertified/parcel labels (print_label_node,
// certified_diamond_label), just scaled up to a 65x31mm label stock.
// Coordinates below are the original 30x19mm hand-tuned values scaled
// by width (65/30) and height (31/19) respectively -- not re-derived
// from scratch -- so the layout reads as the same design, just bigger.
const LEFT_X = 4.3;
const VALUE_X = 19.5;
const RIGHT_X = 36.8;
const FONT_SIZE = 6.5; // pt, uniform across every line on purpose

const SKU_Y = 5.7;
const GROWTH_Y = 9.3;
const GIA_Y = 22.0;
const MEAS_Y = 26.3;
const QR = { x: RIGHT_X, top: 3.6, size: 14.4 };

// Field-list row y-positions -- same top/bottom-anchored spacing scheme
// as the small label: fixed top/bottom anchors, evenly spaced rows
// in between, regardless of row count.
const FIELD_ROW_Y = {
  4: [14.7, 18.9, 22.7, 26.3],
  5: [14.7, 17.6, 20.5, 23.4, 26.3],
};

const CERTIFIED_FIELD_ROWS = [
  ["shp", "Shp.", (d) => d.shape],
  ["wt", "Wt", (d) => (!isEmpty(d.weight_ct) ? `${d.weight_ct} ct` : null)],
  ["col", "Col", (d) => d.colour],
  ["cla", "Cla", (d) => d.clarity],
];

const FIELD_ROWS_BY_TYPE = {
  certified: CERTIFIED_FIELD_ROWS,
  uncertified: CERTIFIED_FIELD_ROWS,
  parcel: [
    ...CERTIFIED_FIELD_ROWS,
    ["size", "Size", (d) => (!isEmpty(d.mm_size) ? `${d.mm_size}mm` : null)],
  ],
};

// Certified diamonds get a distinct color scheme (navy labels/SKU,
// orange values/cert line, red measurements), matching a reference
// sample the user provided. Other label types stay plain black.
const COLOR_NAVY = "#16305C";
const COLOR_ORANGE = "#C1751D";
const COLOR_RED = "#B02B24";
const COLOR_BLACK = "#000000";

function measurementsLine(data) {
  if (!isEmpty(data.measurements_mm)) {
    return `${String(data.measurements_mm).replace(/x/g, "×")}mm`;
  }
  const dims = [data.length_mm, data.width_mm].filter((v) => !isEmpty(v)).join("-");
  let combined = dims;
  if (!isEmpty(data.depth_mm)) combined = dims ? `${dims}×${data.depth_mm}` : String(data.depth_mm);
  return combined ? `${combined}mm` : null;
}

async function renderLargeLabelPdf(data) {
  const widthMm = Number(process.env.LABEL_WIDTH_MM || 65);
  const heightMm = Number(process.env.LABEL_HEIGHT_MM || 31);

  const doc = new PDFDocument({ size: [mm(widthMm), mm(heightMm)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Border: rounded rect inset 0.5mm, radius 1.2mm -- same treatment as
  // the small labels (border weight doesn't scale with label size).
  doc
    .roundedRect(mm(0.5), mm(0.5), mm(widthMm - 1), mm(heightMm - 1), mm(1.2))
    .lineWidth(0.5)
    .stroke("black");

  function drawAt(x, yTop, text, { bold = true, maxWidthMm = null, color = COLOR_BLACK } = {}) {
    const baselinePt = mm(yTop);
    const topPt = baselinePt - FONT_SIZE * HELVETICA_ASCENT;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(FONT_SIZE).fillColor(color);
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

  const isCertified = data.label_type === "certified";
  const skuColor = isCertified ? COLOR_NAVY : COLOR_BLACK;
  const valueColor = isCertified ? COLOR_ORANGE : COLOR_BLACK;
  const measColor = isCertified ? COLOR_RED : COLOR_BLACK;

  const sku = data.sku || "";
  const growthType = data.growth_type || "Natural";

  const qrPng = await QRCode.toBuffer(sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.top), { width: mm(QR.size), height: mm(QR.size) });

  drawAt(LEFT_X, SKU_Y, sku, { color: skuColor });
  drawAt(LEFT_X, GROWTH_Y, growthType, { color: skuColor });

  const fieldRows = FIELD_ROWS_BY_TYPE[data.label_type] || FIELD_ROWS_BY_TYPE.certified;
  const rowYs = FIELD_ROW_Y[fieldRows.length];
  fieldRows.forEach(([, label, getValue], i) => {
    const y = rowYs[i];
    drawAt(LEFT_X, y, label, { color: skuColor });
    const value = getValue(data);
    if (!isEmpty(value)) drawAt(VALUE_X, y, String(value), { color: valueColor });
  });

  // Certified diamonds always show the lab + certificate number here.
  // Uncertified diamonds and parcels never show cert info -- they show
  // mm_size instead, even if the record happens to carry cert data
  // (matches certified_diamond_label / print_label_node respectively).
  const lab = data.certificate_lab || "GIA";
  const giaLine =
    data.label_type === "certified"
      ? !isEmpty(data.certificate_no)
        ? `${lab}-${data.certificate_no}`
        : null
      : !isEmpty(data.mm_size)
        ? `Size ${data.mm_size}mm`
        : null;
  const measLine = measurementsLine(data);
  const rightColumnMaxWidthMm = widthMm - RIGHT_X - 1.5;

  if (giaLine) drawAt(RIGHT_X, GIA_Y, giaLine, { maxWidthMm: rightColumnMaxWidthMm, color: valueColor });
  if (measLine) drawAt(RIGHT_X, MEAS_Y, measLine, { maxWidthMm: rightColumnMaxWidthMm, color: measColor });

  doc.end();
  return done;
}

module.exports = { renderLargeLabelPdf };
