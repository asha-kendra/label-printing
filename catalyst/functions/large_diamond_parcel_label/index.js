// Catalyst Advanced I/O function (Node.js): large-format (65x31mm) label
// for certified diamonds and parcels. One script -- certified diamonds
// show LAB-CertNo, parcels show mm_size instead. There is no separate
// "uncertified" individual-stone label here: an Uncertified-category
// record only renders if its Stock_Sub_Category is Parcel (see
// detectLabelTypeFromCrmProduct in labelData.js) -- anything else
// Uncertified is out of scope for this script.
//
// URL shape once deployed:
//   GET /server/large_diamond_parcel_label?item_id=<id>       -> PDF, inline (Zoho Inventory)
//   GET /server/large_diamond_parcel_label?product_id=<id>    -> PDF, inline (Zoho CRM Products)

const { buildLabelData, buildLabelDataFromCrmProduct } = require("./labelData");
const { getItemWithFields } = require("./zohoClient");
const { getProduct } = require("./zohoCrmClient");
const { renderLargeLabelPdf } = require("./pdfRenderer");

const PDF_LABEL_TYPES = ["certified", "parcel"];

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

  if (!PDF_LABEL_TYPES.includes(data.label_type)) {
    send(
      res,
      501,
      { "Content-Type": "text/plain" },
      `This large-label function only handles label_type in [${PDF_LABEL_TYPES.join(", ")}], got ${data.label_type}.`
    );
    return;
  }

  const pdfBuffer = await renderLargeLabelPdf(data);
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
