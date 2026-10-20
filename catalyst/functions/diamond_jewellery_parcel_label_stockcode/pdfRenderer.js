const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

function drawAtFactory(doc) {
  return function drawAt(x, yTop, text, fontSize, { bold = true, maxWidthMm = null } = {}) {
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
  };
}

// ---------------------------------------------------------------------
// Certified diamonds / parcels -- 65x31mm single panel, ported from
// large_diamond_parcel_label. Same layout language as the smaller
// 30x19mm labels, coordinates scaled up by width (65/30) and height
// (31/19) respectively.
// ---------------------------------------------------------------------
const LARGE_LEFT_X = 4.3;
const LARGE_VALUE_X = 19.5;
const LARGE_RIGHT_X = 36.8;
const LARGE_FONT_SIZE = 6.5;

const LARGE_SKU_Y = 5.7;
const LARGE_GROWTH_Y = 9.3;
const LARGE_GIA_Y = 22.0;
const LARGE_MEAS_Y = 26.3;
const LARGE_QR = { x: LARGE_RIGHT_X, top: 3.6, size: 14.4 };

const LARGE_FIELD_ROW_Y = {
  4: [14.7, 18.9, 22.7, 26.3],
  5: [14.7, 17.6, 20.5, 23.4, 26.3],
};

const CERTIFIED_FIELD_ROWS = [
  ["shp", "Shp.", (d) => d.shape],
  ["wt", "Wt", (d) => (!isEmpty(d.weight_ct) ? `${d.weight_ct} ct` : null)],
  ["col", "Col", (d) => d.colour],
  ["cla", "Cla", (d) => d.clarity],
];

const LARGE_FIELD_ROWS_BY_TYPE = {
  certified: CERTIFIED_FIELD_ROWS,
  parcel: [...CERTIFIED_FIELD_ROWS, ["size", "Size", (d) => (!isEmpty(d.mm_size) ? `${d.mm_size}mm` : null)]],
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

async function renderLargeLabelPdf(data) {
  const widthMm = Number(process.env.LABEL_WIDTH_MM || 65);
  const heightMm = Number(process.env.LABEL_HEIGHT_MM || 31);

  const doc = new PDFDocument({ size: [mm(widthMm), mm(heightMm)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const drawAt = drawAtFactory(doc);

  doc
    .roundedRect(mm(0.5), mm(0.5), mm(widthMm - 1), mm(heightMm - 1), mm(1.2))
    .lineWidth(0.5)
    .stroke("black");

  const sku = data.sku || "";
  const growthType = data.growth_type || "Natural";

  const qrPng = await QRCode.toBuffer(sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(LARGE_QR.x), mm(LARGE_QR.top), { width: mm(LARGE_QR.size), height: mm(LARGE_QR.size) });

  drawAt(LARGE_LEFT_X, LARGE_SKU_Y, sku, LARGE_FONT_SIZE);
  drawAt(LARGE_LEFT_X, LARGE_GROWTH_Y, growthType, LARGE_FONT_SIZE);

  const fieldRows = LARGE_FIELD_ROWS_BY_TYPE[data.label_type] || LARGE_FIELD_ROWS_BY_TYPE.certified;
  const rowYs = LARGE_FIELD_ROW_Y[fieldRows.length];
  fieldRows.forEach(([, label, getValue], i) => {
    const y = rowYs[i];
    drawAt(LARGE_LEFT_X, y, label, LARGE_FONT_SIZE);
    const value = getValue(data);
    if (!isEmpty(value)) drawAt(LARGE_VALUE_X, y, String(value), LARGE_FONT_SIZE);
  });

  // Certified diamonds always show the lab + certificate number here.
  // Parcels never show cert info -- mm_size instead, unconditionally.
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
  const rightColumnMaxWidthMm = widthMm - LARGE_RIGHT_X - 1.5;

  if (giaLine) drawAt(LARGE_RIGHT_X, LARGE_GIA_Y, giaLine, LARGE_FONT_SIZE, { maxWidthMm: rightColumnMaxWidthMm });
  if (measLine) drawAt(LARGE_RIGHT_X, LARGE_MEAS_Y, measLine, LARGE_FONT_SIZE, { maxWidthMm: rightColumnMaxWidthMm });

  doc.end();
  return done;
}

// ---------------------------------------------------------------------
// Jewellery -- foldable 50x11mm two-panel tag, ported from
// jewellery_mini_label (SKU/ProductType/Style ID/Price on the left,
// category/shape/metal/weight details on the right).
// ---------------------------------------------------------------------
const JEWELLERY_HALF_WIDTH_MM = 25;
const JEWELLERY_HEIGHT_MM = 11;
const JEWELLERY_TOTAL_WIDTH_MM = JEWELLERY_HALF_WIDTH_MM * 2;

const JEWELLERY_QR = { x: 2.6, y: 1.6, size: 7.4 };
const JEWELLERY_LEFT_FONT_SIZE = 6.0;
const JEWELLERY_LEFT_TEXT_X = 12.6;
const JEWELLERY_LEFT_ROW_Y = [2.4, 4.9, 7.4, 9.9];
const [JEWELLERY_SKU_Y, JEWELLERY_GROWTH_Y, JEWELLERY_STYLE_ID_Y, JEWELLERY_PRICE_Y] = JEWELLERY_LEFT_ROW_Y;

const JEWELLERY_DETAIL_FONT_SIZE = 4.5;
const JEWELLERY_LAST_ROW_FONT_SIZE = 4.0;
const JEWELLERY_RIGHT_TEXT_X = JEWELLERY_HALF_WIDTH_MM + 1.5;
const JEWELLERY_DETAIL_ROW_Y = [2.4, 4.9, 7.4, 9.9];
const JEWELLERY_DETAIL_MAX_WIDTH_MM = JEWELLERY_TOTAL_WIDTH_MM - JEWELLERY_RIGHT_TEXT_X - 1.0;

async function renderJewelleryLabelPdf(data) {
  const doc = new PDFDocument({ size: [mm(JEWELLERY_TOTAL_WIDTH_MM), mm(JEWELLERY_HEIGHT_MM)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const drawAt = drawAtFactory(doc);

  doc
    .moveTo(mm(JEWELLERY_HALF_WIDTH_MM), mm(0))
    .lineTo(mm(JEWELLERY_HALF_WIDTH_MM), mm(JEWELLERY_HEIGHT_MM))
    .dash(1, { space: 0.8 })
    .lineWidth(0.3)
    .stroke("black")
    .undash();

  const qrPng = await QRCode.toBuffer(data.sku || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(JEWELLERY_QR.x), mm(JEWELLERY_QR.y), { width: mm(JEWELLERY_QR.size), height: mm(JEWELLERY_QR.size) });

  if (!isEmpty(data.sku)) drawAt(JEWELLERY_LEFT_TEXT_X, JEWELLERY_SKU_Y, data.sku, JEWELLERY_LEFT_FONT_SIZE);
  if (!isEmpty(data.growth_type)) drawAt(JEWELLERY_LEFT_TEXT_X, JEWELLERY_GROWTH_Y, data.growth_type, JEWELLERY_LEFT_FONT_SIZE);
  if (!isEmpty(data.style_id)) drawAt(JEWELLERY_LEFT_TEXT_X, JEWELLERY_STYLE_ID_Y, data.style_id, JEWELLERY_LEFT_FONT_SIZE);
  if (!isEmpty(data.price)) drawAt(JEWELLERY_LEFT_TEXT_X, JEWELLERY_PRICE_Y, `9${data.price}9`, JEWELLERY_LEFT_FONT_SIZE);

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
      drawAt(JEWELLERY_RIGHT_TEXT_X, JEWELLERY_DETAIL_ROW_Y[i], line, isLastRow ? JEWELLERY_LAST_ROW_FONT_SIZE : JEWELLERY_DETAIL_FONT_SIZE, {
        maxWidthMm: JEWELLERY_DETAIL_MAX_WIDTH_MM,
      });
    }
  });

  doc.end();
  return done;
}

// ---------------------------------------------------------------------
// Dispatch: certified/parcel get the large 65x31mm single-panel label,
// jewellery gets the foldable 50x11mm two-panel tag -- these are
// genuinely different physical label stock, not just a field
// difference, so the PDF page size itself differs by label_type.
// ---------------------------------------------------------------------
async function renderLabelPdf(data) {
  if (data.label_type === "jewellery") return renderJewelleryLabelPdf(data);
  return renderLargeLabelPdf(data);
}

module.exports = { renderLabelPdf, renderLargeLabelPdf, renderJewelleryLabelPdf };
