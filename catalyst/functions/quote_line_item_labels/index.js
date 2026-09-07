// Catalyst Advanced I/O function (Node.js): all labels for a Quote
// (Order Form) in one go. Fetches the Quote's line items
// (Quoted_Items), fetches each line item's own Products-module record
// (via Product_Name.id -- confirmed live, see zohoCrmClient.js), builds
// a label for each one (certified/parcel/jewellery, same detection as
// diamond_jewellery_parcel_label), and returns them all as a single
// multi-page PDF -- one page per line item, each page sized for that
// item's own label format (65x31mm certified/parcel vs 50x11mm
// jewellery), ready to print in one batch.
//
// Line items whose product can't be fetched, or whose category doesn't
// match certified/parcel/jewellery, are skipped rather than failing
// the whole batch -- see the "skipped" list in the response headers.
//
// URL shape once deployed:
//   GET /server/quote_line_item_labels?quote_id=<id>   -> PDF, inline (Zoho CRM Quotes)

const { buildLabelDataFromCrmProduct, isEmpty } = require("./labelData");
const { getQuote, getProduct } = require("./zohoCrmClient");
const { renderMultiLabelPdf } = require("./pdfRenderer");

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
  if (!quoteId) {
    send(res, 400, { "Content-Type": "text/plain" }, "Missing required query param: quote_id");
    return;
  }

  let quote;
  try {
    quote = await getQuote(quoteId);
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch quote_id=${quoteId}: ${err.message}`);
    return;
  }

  const lineItems = Array.isArray(quote.Quoted_Items) ? quote.Quoted_Items : [];
  if (!lineItems.length) {
    send(res, 502, { "Content-Type": "text/plain" }, `Quote ${quoteId} has no line items (Quoted_Items).`);
    return;
  }

  const dataList = [];
  const skipped = [];

  for (const item of lineItems) {
    const productId = item.Product_Name && item.Product_Name.id;
    if (!productId) {
      skipped.push(`line_item=${item.id || "unknown"}: no linked product (Product_Name.id missing)`);
      continue;
    }
    try {
      const product = await getProduct(productId);
      const data = buildLabelDataFromCrmProduct(product);
      // Show this line item's own Quantity instead of the product's
      // catalog weight -- the quantity actually being ordered on THIS
      // quote can differ from the product record's own weight_ct
      // (e.g. a partial quantity out of a parcel), per instruction.
      if (!isEmpty(item.Quantity)) data.weight_ct = item.Quantity;
      // Parcel's extra "No.of Stones Ordered" row -- also a line item
      // field (No_Of_Stones_Ordered), not on the product record.
      if (!isEmpty(item.No_Of_Stones_Ordered)) data.stones_ordered = item.No_Of_Stones_Ordered;
      if (!PDF_LABEL_TYPES.includes(data.label_type)) {
        skipped.push(`product_id=${productId}: unsupported label_type ${data.label_type}`);
        continue;
      }
      dataList.push(data);
    } catch (err) {
      skipped.push(`product_id=${productId}: ${err.message}`);
    }
  }

  if (!dataList.length) {
    send(
      res,
      502,
      { "Content-Type": "text/plain" },
      `Could not build any labels for quote_id=${quoteId}. Skipped:\n${skipped.join("\n")}`
    );
    return;
  }

  const pdfBuffer = await renderMultiLabelPdf(dataList);
  send(
    res,
    200,
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.Quote_Number || quoteId}.pdf"`,
      "X-Labels-Rendered": String(dataList.length),
      "X-Labels-Skipped": String(skipped.length),
    },
    pdfBuffer
  );
};
