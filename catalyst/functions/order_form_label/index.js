// Catalyst Advanced I/O function (Node.js): Order Form / Quote label,
// 50x11mm, single panel (not the foldable jewellery format). Fetches
// either a Zoho CRM Quotes record or a Zoho Inventory Sales Order and
// renders the same printed-sample layout. For the Quotes path, also
// chases the real Appro number through two hops, per instruction:
//   Quote (CRM Quotes) --Quote_Name lookup--> Appro (CRM Sales_Orders,
//   labelled "Appros" in the UI) --Inventory_id--> Zoho Inventory Sales
//   Order --salesorder_number--> the number shown on the label.
// See labelData.js for which fields are confirmed vs unverified.
//
// URL shape once deployed:
//   GET /server/order_form_label?quote_id=<id>         -> PDF, inline (Zoho CRM Quotes)
//   GET /server/order_form_label?sales_order_id=<id>   -> PDF, inline (Zoho Inventory Sales Orders)

const { buildLabelDataFromQuote, buildLabelDataFromSalesOrder } = require("./labelData");
const { getQuote, findApproByQuoteId } = require("./zohoCrmClient");
const { getSalesOrder } = require("./zohoInventoryClient");
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
      // Chase the real Appro number: find this Quote's Appro record in
      // the CRM (Sales_Orders module), then use ITS Inventory_id to
      // fetch the actual Zoho Inventory Sales Order and take its
      // salesorder_number. Best-effort at every step -- a missing Appro,
      // missing Inventory_id, or failed Inventory lookup just leaves
      // appro_no blank rather than failing the whole label.
      try {
        const appro = await findApproByQuoteId(quoteId);
        if (appro && appro.Inventory_id) {
          const inventorySalesOrder = await getSalesOrder(appro.Inventory_id);
          data.appro_no = inventorySalesOrder.salesorder_number || null;
        }
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
