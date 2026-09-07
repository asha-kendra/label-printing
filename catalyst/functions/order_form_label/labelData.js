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
// The number shown next to the order type (e.g. "APPRO | SO-00234") is
// NOT a field on the Quote at all -- confirmed live, it takes two more
// hops: the Quote's matching Appro record (CRM Sales_Orders module,
// labelled "Appros" in the UI, linked via its Quote_Name lookup field)
// carries an Inventory_id field, and THAT id is what fetches the real
// Zoho Inventory Sales Order whose salesorder_number belongs here (the
// Appro's own SO_Number field is a different, non-human-readable
// internal reference -- not what gets displayed). Since this needs two
// live lookups, appro_no is left null in this function -- index.js
// fills it in (see zohoCrmClient.js's findApproByQuoteId and
// zohoInventoryClient.js's getSalesOrder). "Label Printed" is not a
// CRM field at all -- it's stamped with the current time at render
// time, in pdfRenderer.js.
function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function buildLabelDataFromQuote(quote) {
  const clientName = (quote.Account_Name && quote.Account_Name.name) || (quote.Contact_Name && quote.Contact_Name.name) || null;
  const salesRep = (quote.Owner && quote.Owner.name) || null;
  const itemCount = Array.isArray(quote.Quoted_Items) ? quote.Quoted_Items.length : null;

  return {
    order_no: quote.Quote_Number || null,
    appro_no: null, // filled in by index.js from the linked Zoho Inventory Sales Order
    client_id: quote.Dispatch_Queue || null,
    client_name: clientName,
    sales_rep: salesRep,
    order_type: quote.Order_Type || null,
    submitted_at: quote.Created_Time || null,
    item_count: isEmpty(itemCount) ? null : itemCount,
  };
}

// Confirmed live against Zoho Inventory's Sales Order custom-field
// metadata (bulk_fetch_fields, entity=salesorder, org 20108921672):
// cf_sales_type is real, with values including "APPRO" -- this is the
// Inventory-side equivalent of the CRM Quote's Order_Type. No custom
// field matching "Client ID" / "Dispatch Queue" (as a number) was found
// among Sales Order custom fields -- the closest is cf_dispatch_status,
// which is a status dropdown (Draft/Submitted/Shipped/...), not the
// same thing, so client_id stays unconfirmed (null) for this path.
// salesorder_number itself is the real, standard field for "Appro
// number" -- when fetching a Sales Order directly (not via a linked
// CRM Quote), its own number goes in the Appro slot, and
// reference_number (falling back to salesorder_number) is used for
// "Order:" since that's expected to hold the originating Quote number.
function buildLabelDataFromSalesOrder(salesOrder) {
  const itemCount = Array.isArray(salesOrder.line_items) ? salesOrder.line_items.length : null;

  return {
    order_no: salesOrder.reference_number || salesOrder.salesorder_number || null,
    appro_no: salesOrder.salesorder_number || null,
    client_id: null, // unconfirmed -- no matching Sales Order field found yet
    client_name: salesOrder.customer_name || null,
    sales_rep: salesOrder.salesperson_name || null,
    order_type: salesOrder.cf_sales_type || null,
    submitted_at: salesOrder.date || salesOrder.created_time || null,
    item_count: isEmpty(itemCount) ? null : itemCount,
  };
}

module.exports = { isEmpty, buildLabelDataFromQuote, buildLabelDataFromSalesOrder };
