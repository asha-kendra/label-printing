const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { isEmpty } = require("./labelData");

const MM = 2.83465; // points per mm
const HELVETICA_ASCENT = 0.718;

function mm(v) {
  return v * MM;
}

// Single-panel order-form/quote label, 50x11mm -- not the two-panel
// foldable jewellery format. Layout: a bold "Order Type | Appro number"
// header line, 6 regular-weight detail lines below, a small logo mark
// and a QR code in a narrower right-hand column. Positions hand-tuned
// via the layout-bench editor and confirmed by the user. The original
// "Order: <quote number>" line was dropped per instruction -- the
// Appro number line now stands alone as the header.
const WIDTH_MM = 50;
const HEIGHT_MM = 11;

const TEXT_X = 1.5;
const TEXT_MAX_WIDTH_MM = 35.5; // leaves room for the logo/QR column on the right

const HEADER_FONT_SIZE = 3.6;
const BODY_FONT_SIZE = 3.0;
const HEADER_Y = 1.4;
const ROW_Y = [2.8, 4.2, 5.6, 7.1, 8.6, 10.1];

const LOGO = { x: 37.9, y: 0.5, width: 5.1, height: 3.0 };
const QR = { x: 37.4, y: 4.4, size: 6.4 };

function pad2(n) {
  return String(n).padStart(2, "0");
}

// "14/08/2026 - 12:38 PM" -- matches the printed sample's format.
function formatDateTime(date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
}

// Simple stylized double-diamond mark approximating the logo on the
// printed sample -- not an exact reproduction, just a placeholder
// silhouette in the same spot. Swap this out if a real logo asset
// becomes available.
function drawLogo(doc) {
  const { x, y, width, height } = LOGO;
  const diamondW = width * 0.42;
  const gap = width * 0.16;
  [0, 1].forEach((i) => {
    const cx = mm(x + i * (diamondW + gap) + diamondW / 2);
    const top = mm(y);
    const mid = mm(y + height * 0.5);
    const bottom = mm(y + height);
    const halfW = mm(diamondW / 2);
    doc
      .moveTo(cx, top)
      .lineTo(cx + halfW, mid)
      .lineTo(cx, bottom)
      .lineTo(cx - halfW, mid)
      .closePath()
      .fill("black");
  });
}

async function renderOrderFormLabelPdf(data, printedAt) {
  const doc = new PDFDocument({ size: [mm(WIDTH_MM), mm(HEIGHT_MM)], margin: 0 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  function drawAt(x, yTop, text, { fontSize, bold = false, maxWidthMm = null } = {}) {
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

  const orderTypeLine = [data.order_type, data.appro_no].filter((v) => !isEmpty(v)).join(" | ") || null;

  const submittedLine = data.submitted_at ? `Submitted: ${formatDateTime(new Date(data.submitted_at))}` : null;
  const printedLine = `Label Printed: ${formatDateTime(printedAt)}`;

  const bodyLines = [
    !isEmpty(data.client_id) ? `Client ID: ${data.client_id}` : null,
    !isEmpty(data.client_name) ? `Client: ${data.client_name}` : null,
    !isEmpty(data.sales_rep) ? `Sales: ${data.sales_rep}` : null,
    submittedLine,
    printedLine,
    !isEmpty(data.item_count) ? `No of items: ${data.item_count}` : null,
  ];

  if (orderTypeLine) drawAt(TEXT_X, HEADER_Y, orderTypeLine, { fontSize: HEADER_FONT_SIZE, bold: true, maxWidthMm: TEXT_MAX_WIDTH_MM });
  bodyLines.forEach((line, i) => {
    if (line) drawAt(TEXT_X, ROW_Y[i], line, { fontSize: BODY_FONT_SIZE, maxWidthMm: TEXT_MAX_WIDTH_MM });
  });

  drawLogo(doc);
  const qrPng = await QRCode.toBuffer(data.order_no || " ", { margin: 0, errorCorrectionLevel: "M" });
  doc.image(qrPng, mm(QR.x), mm(QR.y), { width: mm(QR.size), height: mm(QR.size) });

  doc.end();
  return done;
}

module.exports = { renderOrderFormLabelPdf };
