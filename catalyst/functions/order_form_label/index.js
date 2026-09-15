// Catalyst Advanced I/O function (Node.js): Order Form / Quote label,
// 50x11mm, single panel (not the foldable jewellery format). Fetches a
// Zoho CRM Quotes record and renders the printed-sample layout. Also
// fetches the real Appro number by searching Zoho Inventory for the
// Sales Order whose reference_number matches the Quote's own
// Inventory_Appro_ID field. See labelData.js for which fields are
// confirmed vs unverified.
//
// URL shape once deployed:
//   GET /server/order_form_label?quote_id=<id>   -> PDF, inline (Zoho CRM Quotes)

const { buildLabelDataFromQuote } = require("./labelData");
const { getQuote } = require("./zohoCrmClient");
const { findSalesOrderByReferenceNumber } = require("./zohoInventoryClient");
const { renderOrderFormLabelPdf } = require("./pdfRenderer");

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

  let data;
  try {
    const quote = await getQuote(quoteId);
    data = buildLabelDataFromQuote(quote);
    // Fetch the real Appro number by searching Zoho Inventory for the
    // Sales Order whose reference_number matches the Quote's own
    // Inventory_Appro_ID (a reference number, not a record id, per
    // instruction). Best effort: a missing field or failed lookup just
    // leaves appro_no blank rather than failing the whole label.
    try {
      if (quote.Inventory_Appro_ID) {
        const inventorySalesOrder = await findSalesOrderByReferenceNumber(quote.Inventory_Appro_ID);
        if (inventorySalesOrder) data.appro_no = inventorySalesOrder.salesorder_number || null;
      }
    } catch (lookupErr) {
      // swallow -- Appro number is a nice-to-have, not worth failing the whole label for
    }
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch/build label for quote_id=${quoteId}: ${err.message}`);
    return;
  }

  const pdfBuffer = await renderOrderFormLabelPdf(data, new Date());
  send(
    res,
    200,
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.order_no || quoteId}.pdf"`,
    },
    pdfBuffer
  );
};
