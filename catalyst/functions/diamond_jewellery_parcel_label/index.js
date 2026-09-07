// Catalyst Advanced I/O function (Node.js): combined label for
// certified diamonds, parcels, and jewellery -- one script, one CRM
// Products fetch, dispatching to two entirely different physical label
// formats depending on detected category (see labelData.js for the
// detection rules and pdfRenderer.js for the two renderers):
//   certified / parcel -> 65x31mm single-panel label (ported from
//     large_diamond_parcel_label)
//   jewellery           -> 50x11mm foldable two-panel tag (ported from
//     jewellery_mini_label, including Style ID and price)
//
// CRM Products only (no Zoho Inventory item_id path) -- jewellery
// detection/fields were only ever confirmed against CRM Products
// records in this project.
//
// URL shape once deployed:
//   GET /server/diamond_jewellery_parcel_label?product_id=<id>   -> PDF, inline (Zoho CRM Products)

const { buildLabelDataFromCrmProduct } = require("./labelData");
const { getProduct } = require("./zohoCrmClient");
const { renderLabelPdf } = require("./pdfRenderer");

const PDF_LABEL_TYPES = ["certified", "parcel", "jewellery"];

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

  const labelType = query.label_type || null;

  let data;
  try {
    const product = await getProduct(productId);
    data = buildLabelDataFromCrmProduct(product, labelType);
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch/build label for product_id=${productId}: ${err.message}`);
    return;
  }

  if (!PDF_LABEL_TYPES.includes(data.label_type)) {
    send(
      res,
      501,
      { "Content-Type": "text/plain" },
      `This function only handles label_type in [${PDF_LABEL_TYPES.join(", ")}], got ${data.label_type}.`
    );
    return;
  }

  const pdfBuffer = await renderLabelPdf(data);
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
