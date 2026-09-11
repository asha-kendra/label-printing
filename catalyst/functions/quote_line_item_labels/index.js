// Catalyst Advanced I/O function (Node.js): one label for one specific
// line item on a Quote (Order Form). Fetches the Quote, finds the
// named line item within whichever line-items field is actually
// present (the real "Quoted Items" custom subform if the API exposes
// it, else falls back to Product_Details, Zoho's standard built-in
// line-items subform -- see zohoCrmClient.js for why both exist),
// fetches that line item's linked Products-module record, and
// builds/renders a single label (certified/parcel/jewellery, same
// detection as diamond_jewellery_parcel_label) sized for that item's
// own label format (65x31mm certified/parcel vs 50x11mm jewellery).
//
// URL shape once deployed:
//   GET /server/quote_line_item_labels?quote_id=<id>&line_item_id=<id>   -> PDF, inline

const { buildLabelDataFromCrmProduct, isEmpty } = require("./labelData");
const { getQuote, getProduct } = require("./zohoCrmClient");
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
  const quoteId = query.quote_id;
  const lineItemId = query.line_item_id;
  if (!quoteId || !lineItemId) {
    send(res, 400, { "Content-Type": "text/plain" }, "Missing required query param(s): quote_id and line_item_id");
    return;
  }

  let quote;
  try {
    quote = await getQuote(quoteId);
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch quote_id=${quoteId}: ${err.message}`);
    return;
  }

  // Prefer the real "Quoted Items" custom subform when the API exposes
  // it; otherwise fall back to Zoho's standard Product_Details field
  // (see zohoCrmClient.js).
  const usingCustomSubform = Array.isArray(quote.Quoted_Items);
  const lineItems = usingCustomSubform ? quote.Quoted_Items : Array.isArray(quote.Product_Details) ? quote.Product_Details : [];
  // line_item_id is normally the subform row's own record id, but the
  // CRM Client Script that builds this URL from the Quotes page can
  // only see Sequence_Number (a per-row counter, e.g. "1", "2") -- the
  // row's real id isn't exposed by that SDK at all. Accept either.
  const item = lineItems.find((li) => String(li.id) === String(lineItemId) || String(li.Sequence_Number) === String(lineItemId));
  if (!item) {
    send(
      res,
      404,
      { "Content-Type": "text/plain" },
      `line_item_id=${lineItemId} not found on quote_id=${quoteId} (has ${lineItems.length} line item(s)).\n\nDEBUG quote_keys:\n${JSON.stringify(Object.keys(quote))}`
    );
    return;
  }

  // The custom subform's product lookup is Product_Name; the standard
  // Product_Details field's is just "product".
  const productId = usingCustomSubform ? item.Product_Name && item.Product_Name.id : item.product && item.product.id;
  if (!productId) {
    send(
      res,
      502,
      { "Content-Type": "text/plain" },
      `Line item ${lineItemId} has no linked product.\n\nDEBUG item:\n${JSON.stringify(item, null, 2)}`
    );
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

  // Show this line item's own Quantity instead of the product's
  // catalog weight -- the quantity actually being ordered on THIS
  // quote can differ from the product record's own weight_ct (e.g. a
  // partial quantity out of a parcel), per instruction.
  if (!isEmpty(item.Quantity)) data.weight_ct = item.Quantity;
  // Parcel's extra "No.of Stones Ordered" field -- also a line item
  // field (No_Of_Stones_Ordered), not on the product record.
  if (!isEmpty(item.No_Of_Stones_Ordered)) data.stones_ordered = item.No_Of_Stones_Ordered;

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
      "Content-Disposition": `inline; filename="${data.sku || lineItemId}.pdf"`,
    },
    pdfBuffer
  );
};
