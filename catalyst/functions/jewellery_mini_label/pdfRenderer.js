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
// face each other/back each other around a string or loop. Same format
// as jewellery_label, with additions: Style ID and a price line
// (Main_Total) below the ProductType (e.g. "Lab Grown") in the left
// panel -- left panel is now 4 lines (SKU, ProductType, Style ID,
// Price) instead of 2. Row y-positions reuse the same evenly-spaced
// anchors as the right panel's DETAIL_ROW_Y so both columns line up.
const HALF_WIDTH_MM = 25;
const HEIGHT_MM = 11;
const TOTAL_WIDTH_MM = HALF_WIDTH_MM * 2;

const QR = { x: 2.6, y: 1.6, size: 7.4 };
const LEFT_FONT_SIZE = 6.0;
const LEFT_TEXT_X = 12.6;
const LEFT_ROW_Y = [2.4, 4.9, 7.4, 9.9];
const [SKU_Y, GROWTH_Y, STYLE_ID_Y, PRICE_Y] = LEFT_ROW_Y;

const DETAIL_FONT_SIZE = 4.5;
const LAST_ROW_FONT_SIZE = 4.0; // last right-panel line is a bit smaller than the rest
const RIGHT_TEXT_X = HALF_WIDTH_MM + 1.5;
const DETAIL_ROW_Y = [2.4, 4.9, 7.4, 9.9];
const DETAIL_MAX_WIDTH_MM = TOTAL_WIDTH_MM - RIGHT_TEXT_X - 1.0;

async function renderJewelleryLabelPdf(data) {
  const doc = new PDFDocument({ size: [mm(TOTAL_WIDTH_MM), mm(HEIGHT_MM)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Dashed fold line at the midpoint -- where the strip folds in half.
  doc
    .moveTo(mm(HALF_WIDTH_MM), mm(0))
    .lineTo(mm(HALF_WIDTH_MM), mm(HEIGHT_MM))
    .dash(1, { space: 0.8 })
    .lineWidth(0.3)
    .stroke("black")
    .undash();

  function drawAt(x, yTop, text, { fontSize = DETAIL_FONT_SIZE, bold = true, maxWidthMm = null } = {}) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
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

  if (!isEmpty(data.sku)) drawAt(LEFT_TEXT_X, SKU_Y, data.sku, { fontSize: LEFT_FONT_SIZE });
  if (!isEmpty(data.growth_type)) drawAt(LEFT_TEXT_X, GROWTH_Y, data.growth_type, { fontSize: LEFT_FONT_SIZE });
  if (!isEmpty(data.style_id)) drawAt(LEFT_TEXT_X, STYLE_ID_Y, data.style_id, { fontSize: LEFT_FONT_SIZE });
  if (!isEmpty(data.price)) drawAt(LEFT_TEXT_X, PRICE_Y, `9${data.price}9`, { fontSize: LEFT_FONT_SIZE });

  const line1 = [data.parent_category, data.sub_category].filter((v) => !isEmpty(v)).join(" - ") || null;
  const line2 = [data.diamond_shape, data.metal_type, data.metal_purity].filter((v) => !isEmpty(v)).join(" ") || null;
  const line3 =
    [
      !isEmpty(data.total_diamond_weight) ? `TDW: ${data.total_diamond_weight}ct` : null,
      !isEmpty(data.center_diamond_weight) ? `CDW: ${data.center_diamond_weight}ct` : null,
    ]
      .filter(Boolean)
      .join("  ") || null;
  const line4 =
    [
      !isEmpty(data.metal_weight) ? `${data.metal_weight} gms` : null,
      !isEmpty(data.ring_size) ? `Size: ${data.ring_size}` : null,
    ]
      .filter(Boolean)
      .join("  ") || null;

  [line1, line2, line3, line4].forEach((line, i) => {
    const isLastRow = i === 3;
    if (line) {
      drawAt(RIGHT_TEXT_X, DETAIL_ROW_Y[i], line, {
        maxWidthMm: DETAIL_MAX_WIDTH_MM,
        fontSize: isLastRow ? LAST_ROW_FONT_SIZE : DETAIL_FONT_SIZE,
      });
    }
  });

  doc.end();
  return done;
}

module.exports = { renderJewelleryLabelPdf };
