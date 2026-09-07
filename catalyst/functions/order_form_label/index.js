// Catalyst Advanced I/O function (Node.js): Order Form / Quote label,
// 50x11mm, single panel (not the foldable jewellery format). Fetches
// either a Zoho CRM Quotes record or a Zoho Inventory Sales Order and
// renders the same printed-sample layout. For the Quotes path, also
// looks up the matching Zoho Inventory Sales Order (every "Appro"
// order form gets one, per instruction) to pull its real
// salesorder_number as the Appro number -- see labelData.js for which
// fields are confirmed vs unverified.
//
// URL shape once deployed:
//   GET /server/order_form_label?quote_id=<id>         -> PDF, inline (Zoho CRM Quotes)
//   GET /server/order_form_label?sales_order_id=<id>   -> PDF, inline (Zoho Inventory Sales Orders)

const { buildLabelDataFromQuote, buildLabelDataFromSalesOrder } = require("./labelData");
const { getQuote } = require("./zohoCrmClient");
const { getSalesOrder, findSalesOrderByReferenceNumber } = require("./zohoInventoryClient");
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
  const salesOrderId = query.sales_order_id;
  if (!quoteId && !salesOrderId) {
    send(res, 400, { "Content-Type": "text/plain" }, "Missing required query param: quote_id or sales_order_id");
    return;
  }

  const sourceLabel = salesOrderId ? `sales_order_id=${salesOrderId}` : `quote_id=${quoteId}`;

  let data;
  try {
    if (salesOrderId) {
      const salesOrder = await getSalesOrder(salesOrderId);
      data = buildLabelDataFromSalesOrder(salesOrder);
    } else {
      const quote = await getQuote(quoteId);
      data = buildLabelDataFromQuote(quote);
      // Every "Appro" order form gets a matching Sales Order in Zoho
      // Inventory -- look it up by reference_number (the Quote's own
      // number) and use its salesorder_number as the Appro number.
      // Best-effort: if the lookup fails or finds nothing, the label
      // still renders, just without that number.
      try {
        const linkedSalesOrder = await findSalesOrderByReferenceNumber(data.order_no);
        if (linkedSalesOrder) data.appro_no = linkedSalesOrder.salesorder_number || null;
      } catch (lookupErr) {
        // swallow -- Appro number is a nice-to-have, not worth failing the whole label for
      }
    }
  } catch (err) {
    send(res, 502, { "Content-Type": "text/plain" }, `Could not fetch/build label for ${sourceLabel}: ${err.message}`);
    return;
  }

  const pdfBuffer = await renderOrderFormLabelPdf(data, new Date());
  send(
    res,
    200,
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.order_no || sourceLabel}.pdf"`,
    },
    pdfBuffer
  );
};
