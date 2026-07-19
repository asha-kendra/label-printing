const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

// Foldable two-panel tag: two equal 25x11mm panels side by side (50x11mm
// total), meant to be folded in half at the midpoint so the two panels
// face each other/back each other around a string or loop. Left panel:
// QR + SKU + ProductType. Right panel: the remaining details (4 lines).
const HALF_WIDTH_MM = 25;
const HEIGHT_MM = 11;
const TOTAL_WIDTH_MM = HALF_WIDTH_MM * 2;

const QR = { x: 1.5, y: 1.5, size: 6.5 };
const SKU_FONT_SIZE = 4.0;
const GROWTH_FONT_SIZE = 3.2;
const LEFT_TEXT_X = QR.x + QR.size + 1.0;
const SKU_Y = 4.2;
const GROWTH_Y = 8.6;

const DETAIL_FONT_SIZE = 3.0;
const RIGHT_TEXT_X = HALF_WIDTH_MM + 1.5;
const DETAIL_ROW_Y = [2.4, 4.9, 7.4, 9.9];
const DETAIL_MAX_WIDTH_MM = TOTAL_WIDTH_MM - RIGHT_TEXT_X - 1.0;

async function renderJewelleryLabelPdf(data) {
  const doc = new PDFDocument({ size: [mm(TOTAL_WIDTH_MM), mm(HEIGHT_MM)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Outline around the full 50x11mm strip.
  doc.rect(mm(0), mm(0), mm(TOTAL_WIDTH_MM), mm(HEIGHT_MM)).lineWidth(0.5).stroke("black");

  // Dashed fold line at the midpoint -- where the strip folds in half.
  doc
    .moveTo(mm(HALF_WIDTH_MM), mm(0))
    .lineTo(mm(HALF_WIDTH_MM), mm(HEIGHT_MM))
    .dash(1, { space: 0.8 })
    .lineWidth(0.3)
    .stroke("black")
    .undash();

  function drawAt(x, yTop, text, { fontSize = DETAIL_FONT_SIZE, maxWidthMm = null } = {}) {
    doc.font("Helvetica-Bold").fontSize(fontSize);
    const baselinePt = mm(yTop);
    const topPt = baselinePt - fontSize * HELVETICA_ASCENT;
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

  const qrPng = await QRCode.toBuffer(data.sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.y), { width: mm(QR.size), height: mm(QR.size) });

  if (!isEmpty(data.sku)) drawAt(LEFT_TEXT_X, SKU_Y, data.sku, { fontSize: SKU_FONT_SIZE });
  if (!isEmpty(data.growth_type)) drawAt(LEFT_TEXT_X, GROWTH_Y, data.growth_type, { fontSize: GROWTH_FONT_SIZE });

  const line1 =
    !isEmpty(data.parent_category) || !isEmpty(data.carat_in)
      ? [data.parent_category, !isEmpty(data.carat_in) ? `${data.carat_in} ct` : null].filter(Boolean).join(" - ")
      : null;
  const line2 = !isEmpty(data.sub_category) ? data.sub_category : null;
  const line3 = [data.metal_type, data.metal_purity].filter((v) => !isEmpty(v)).join(" ") || null;
  const line4 =
    !isEmpty(data.total_diamond_weight) || !isEmpty(data.ring_size)
      ? [
          !isEmpty(data.total_diamond_weight) ? `${data.total_diamond_weight} gms` : null,
          !isEmpty(data.ring_size) ? `Ring Size: ${data.ring_size}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : null;

  [line1, line2, line3, line4].forEach((line, i) => {
    if (line) drawAt(RIGHT_TEXT_X, DETAIL_ROW_Y[i], line, { maxWidthMm: DETAIL_MAX_WIDTH_MM });
  });

  doc.end();
  return done;
}

module.exports = { renderJewelleryLabelPdf };
