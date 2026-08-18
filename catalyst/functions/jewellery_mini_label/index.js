// Catalyst Advanced I/O function (Node.js): jewellery mini label.
// Same 50x11mm foldable flag-tag format as jewellery_label, with one
// addition: a price line (Main_Total) below the SKU -- see
// pdfRenderer.js for the shape/field-position rationale.
//
// URL shape once deployed:
//   GET /server/jewellery_mini_label?product_id=<id>   -> PDF, inline (Zoho CRM Products)

const { buildLabelDataFromCrmProduct } = require("./labelData");
const { getProduct } = require("./zohoCrmClient");
const { renderJewelleryLabelPdf } = require("./pdfRenderer");

function send(res, status, headers, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(body);
}

function getQuery(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    const parsed = new URL(req.url, "http://placeholder");
    return Object.fromEntries(parsed.searchParams.entries());
  } catch (err) {
    return {};
  }
}

module.exports = async (req, res) => {
  const query = getQuery(req);
  const productId = query.product_id;
  if (!productId) {
    send(res, 400, { "Content-Type": "text/plain" }, "Missing required query param: product_id");
    return;
  }

  let data;
  try {
    const product = await getProduct(productId);
    data = buildLabelDataFromCrmProduct(product);
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch/build label for product_id=${productId}: ${err.message}`);
    return;
  }

  const pdfBuffer = await renderJewelleryLabelPdf(data);
  send(
    res,
    200,
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.sku || productId}.pdf"`,
    },
    pdfBuffer
  );
};
