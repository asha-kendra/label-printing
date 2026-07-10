// Catalyst Advanced I/O function (Node.js): fetches a Zoho Inventory item,
// builds the label data, and returns something printable in response to a
// plain GET -- this is the "click a URL, get a label" endpoint.
//
// HANDLER SIGNATURE: confirmed live against a real deploy -- Catalyst calls
// this with (req, res) where `res` is native-Node-http-shaped
// (res.statusCode / res.setHeader / res.end), NOT Express's chainable
// res.status().set().send(). That mismatch was the actual bug behind an
// earlier "res.status is not a function" crash.
//
// URL shape once deployed:
//   GET /server/print_label_node?item_id=<id>                 -> PDF, inline (Zoho Inventory)
//   GET /server/print_label_node?product_id=<id>               -> PDF, inline (Zoho CRM Products)
//   GET /server/print_label_node?item_id=<id>&format=ezpl       -> raw EZPL text
//
// item_id and product_id are mutually exclusive -- pick whichever system
// you're fetching from. The CRM path needs the refresh token to carry a
// CRM scope (e.g. ZohoCRM.modules.products.READ) in addition to whatever
// Inventory scopes it already has -- same token, both scopes.
//
// IMPORTANT: this function can fetch + render but cannot print. The GE330
// is a local USB/network printer -- nothing running in Catalyst's cloud can
// reach it. See catalyst/README.md for what's needed to close that gap.

const { buildLabelData, buildLabelDataFromCrmProduct } = require("./labelData");
const { getItemWithFields } = require("./zohoClient");
const { getProduct } = require("./zohoCrmClient");
const { EZPL_RENDERERS } = require("./ezplRenderer");
const { renderCertifiedPdf } = require("./pdfRenderer");

function send(res, status, headers, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(body);
}

// req.query doesn't exist on this native-Node-http-shaped request either
// (same story as res not being Express-shaped) -- parse it from req.url
// directly. Fall back to req.query in case some wrapping does provide it.
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
  const format = (query.format || "pdf").toLowerCase();
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

  if (format === "ezpl") {
    const renderFn = EZPL_RENDERERS[data.label_type];
    if (!renderFn) {
      send(
        res,
        501,
        { "Content-Type": "text/plain" },
        `No EZPL template for label_type=${data.label_type} yet ` +
          `(have: ${Object.keys(EZPL_RENDERERS).join(", ")}) -- try format=pdf instead.`
      );
      return;
    }
    const ezplText = renderFn(data);
    send(
      res,
      200,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${data.sku || sourceLabel}.ezpl"`,
      },
      ezplText
    );
    return;
  }

  if (data.label_type !== "certified") {
    send(
      res,
      501,
      { "Content-Type": "text/plain" },
      `PDF rendering is only wired up for label_type=certified so far, got ${data.label_type}.`
    );
    return;
  }

  const pdfBuffer = await renderCertifiedPdf(data);
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
