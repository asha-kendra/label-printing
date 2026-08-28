// Field mapping for the Order Form / Quote label. Confirmed live against
// a real Zoho CRM Quotes record (888045000012213015):
//   Quote_Number: "888045000012213018" (long internal number -- used as
//     the "Order:" number FOR NOW, per instruction, until the real short
//     order-number field is identified).
//   Dispatch_Queue: "103" -- confirmed as the "Client ID:" field.
//   Account_Name.name / Contact_Name.name: "Laura Dumont" -- client name.
//   Owner.name: "Laura Dumont" -- sales rep (record owner).
//   Order_Type: "APPRO" -- confirmed real field; the "APPRO" text next
//     to the header IS this field's value, not a separate label.
//   Created_Time: "2026-08-19T14:19:28+01:00" -- submitted date/time.
//   Quoted_Items (array): used to count "No of items" -- no dedicated
//     count field was found on the record, so this is a best-effort
//     stand-in, not a confirmed field.
// The number shown next to the order type (e.g. "APPRO | 5678989") is
// also Dispatch_Queue -- same field as Client ID, per instruction, even
// though it duplicates that line. "Label Printed" is not a CRM field
// at all -- it's stamped with the current time at render time, in
// pdfRenderer.js.
function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function buildLabelDataFromQuote(quote) {
  const clientName = (quote.Account_Name && quote.Account_Name.name) || (quote.Contact_Name && quote.Contact_Name.name) || null;
  const salesRep = (quote.Owner && quote.Owner.name) || null;
  const itemCount = Array.isArray(quote.Quoted_Items) ? quote.Quoted_Items.length : null;

  return {
    order_no: quote.Quote_Number || null,
    appro_no: quote.Dispatch_Queue || null,
    client_id: quote.Dispatch_Queue || null,
    client_name: clientName,
    sales_rep: salesRep,
    order_type: quote.Order_Type || null,
    submitted_at: quote.Created_Time || null,
    item_count: isEmpty(itemCount) ? null : itemCount,
  };
}

module.exports = { isEmpty, buildLabelDataFromQuote };
