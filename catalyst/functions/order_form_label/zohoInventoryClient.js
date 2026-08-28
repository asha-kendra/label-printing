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

module.exports = { getSalesOrder };
