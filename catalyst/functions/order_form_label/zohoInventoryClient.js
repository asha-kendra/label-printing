const { getAccessToken, httpsRequestJson } = require("./zohoAuth");

// Zoho Inventory's Sales Orders endpoint -- NOT verified live yet (the
// Inventory connector was unavailable when this was written). Field
// names below follow Zoho's public, documented Sales Order schema
// (salesorder_number, customer_name, salesperson_name, date,
// line_items, custom_fields). Confirm against a real record and adjust
// labelData.js's buildLabelDataFromSalesOrder if anything is off.
async function getSalesOrder(salesOrderId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/inventory/v1/salesorders/${salesOrderId}`, apiDomain);
  url.searchParams.set("organization_id", process.env.ZOHO_ORGANIZATION_ID);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (json.code !== 0) {
    throw new Error(`Zoho Inventory error for sales order ${salesOrderId}: ${json.message}`);
  }
  return json.salesorder;
}

// For every "Appro" order form in CRM Quotes, a matching Sales Order is
// created in Inventory (per instruction) -- this looks that Sales Order
// up by reference_number, using the CRM Quote's own number as the
// search key, and returns its (confirmed real, standard) salesorder_number
// for display. UNVERIFIED: whether reference_number is actually where
// the Quote number gets stored on the Sales Order side hasn't been
// confirmed against a real linked pair -- test with a real quote_id and
// adjust the search key here if it comes back empty.
async function findSalesOrderByReferenceNumber(referenceNumber) {
  if (!referenceNumber) return null;
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL("/inventory/v1/salesorders", apiDomain);
  url.searchParams.set("organization_id", process.env.ZOHO_ORGANIZATION_ID);
  url.searchParams.set("reference_number", referenceNumber);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (json.code !== 0) {
    throw new Error(`Zoho Inventory search error for reference_number=${referenceNumber}: ${json.message}`);
  }
  const orders = json.salesorders || [];
  return orders[0] || null;
}

module.exports = { getSalesOrder, findSalesOrderByReferenceNumber };
