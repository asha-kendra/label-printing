const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

// Flag-tag shape: a rectangular body with a triangular point on the right
// edge (for threading onto a string/loop) -- reference photo showed a
// long, thin tag divided by a vertical line into a QR/SKU box on the left
// and a 4-line details box on the right. No confirmed physical size yet
// (standard flag-tag size chosen as a first draft; adjust after preview).
const BODY_WIDTH_MM = 42;
const TAIL_LENGTH_MM = 10;
const HEIGHT_MM = 10;
const TOTAL_WIDTH_MM = BODY_WIDTH_MM + TAIL_LENGTH_MM;

const DIVIDER_X_MM = 17;
const QR = { x: 1.0, y: 1.0, size: 5.0 };

const SKU_FONT_SIZE = 3.4;
const GROWTH_FONT_SIZE = 2.6;
const DETAIL_FONT_SIZE = 2.5;

const LEFT_TEXT_X = QR.x + QR.size + 0.8;
const SKU_Y = 3.0;
const GROWTH_Y = 7.3;

const RIGHT_TEXT_X = DIVIDER_X_MM + 1.2;
const DETAIL_ROW_Y = [2.3, 4.6, 6.9, 9.2];
const DETAIL_MAX_WIDTH_MM = BODY_WIDTH_MM - RIGHT_TEXT_X - 1.0;

async function renderJewelleryLabelPdf(data) {
  const doc = new PDFDocument({ size: [mm(TOTAL_WIDTH_MM), mm(HEIGHT_MM)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Tag outline: rectangular body + a triangular point tapering to the tip.
  doc
    .moveTo(mm(0), mm(0))
    .lineTo(mm(BODY_WIDTH_MM), mm(0))
    .lineTo(mm(TOTAL_WIDTH_MM), mm(HEIGHT_MM / 2))
    .lineTo(mm(BODY_WIDTH_MM), mm(HEIGHT_MM))
    .lineTo(mm(0), mm(HEIGHT_MM))
    .closePath()
    .lineWidth(0.5)
    .stroke("black");

  // Divider between the QR/SKU box and the details box.
  doc
    .moveTo(mm(DIVIDER_X_MM), mm(0.8))
    .lineTo(mm(DIVIDER_X_MM), mm(HEIGHT_MM - 0.8))
    .lineWidth(0.3)
    .stroke("black");

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
