const { getAccessToken, httpsRequestJson } = require("./zohoAuth");

// The Quote's own Inventory_Appro_ID field is a reference number (e.g.
// "00169"), not a Zoho Inventory record id, per instruction -- so the
// matching Sales Order has to be found by searching Inventory's
// reference_number rather than fetched directly by id.
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

module.exports = { findSalesOrderByReferenceNumber };
