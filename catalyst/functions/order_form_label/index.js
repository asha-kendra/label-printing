// Catalyst Advanced I/O function (Node.js): Order Form / Quote label,
// 50x11mm, single panel (not the foldable jewellery format). Fetches a
// Zoho CRM Quotes record and renders the printed-sample layout -- see
// labelData.js for which fields are confirmed vs still pending (Appro
// number in particular has no confirmed field yet).
//
// URL shape once deployed:
//   GET /server/order_form_label?quote_id=<id>   -> PDF, inline (Zoho CRM Quotes)

const { buildLabelDataFromQuote } = require("./labelData");
const { getQuote } = require("./zohoCrmClient");
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
