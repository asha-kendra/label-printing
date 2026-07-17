// Catalyst Advanced I/O function (Node.js): jewellery flag-tag label.
// New physical shape (long, thin, pointed tail for a string/loop) and new
// layout compared to print_label_node's 30x19mm diamond labels -- see
// pdfRenderer.js for the shape/field-position rationale.
//
// URL shape once deployed:
//   GET /server/jewellery_label?product_id=<id>   -> PDF, inline (Zoho CRM Products)

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
