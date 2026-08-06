// Catalyst Advanced I/O function (Node.js): large-format (65x31mm)
// parcel-only label. Forked from large_diamond_parcel_label but split
// into its own dedicated script -- mirrors how certified_diamond_label
// is separate from print_label_node.
//
// URL shape once deployed:
//   GET /server/parcel_label?item_id=<id>       -> PDF, inline (Zoho Inventory)
//   GET /server/parcel_label?product_id=<id>    -> PDF, inline (Zoho CRM Products)

const { buildLabelData, buildLabelDataFromCrmProduct } = require("./labelData");
const { getItemWithFields } = require("./zohoClient");
const { getProduct } = require("./zohoCrmClient");
const { renderParcelLabelPdf } = require("./pdfRenderer");

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
  const itemId = query.item_id;
  const productId = query.product_id;
  if (!itemId && !productId) {
    send(res, 400, { "Content-Type": "text/plain" }, "Missing required query param: item_id or product_id");
    return;
  }

  const labelType = query.label_type || null;
  const sourceLabel = productId ? `product_id=${productId}` : `item_id=${itemId}`;

  let data;
  try {
    if (productId) {
      const product = await getProduct(productId);
      data = buildLabelDataFromCrmProduct(product, labelType);
    } else {
      const { item, fields } = await getItemWithFields(itemId);
      data = buildLabelData(item, fields, labelType);
    }
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch/build label for ${sourceLabel}: ${err.message}`);
    return;
  }

  if (data.label_type !== "parcel") {
    send(
      res,
      501,
      { "Content-Type": "text/plain" },
      `This function only handles label_type=parcel, got ${data.label_type}. Use large_diamond_parcel_label or certified_diamond_label instead.`
    );
    return;
  }

  const pdfBuffer = await renderParcelLabelPdf(data);
  send(
    res,
    200,
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.sku || sourceLabel}.pdf"`,
    },
    pdfBuffer
  );
};
