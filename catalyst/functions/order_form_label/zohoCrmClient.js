const { getAccessToken, httpsRequestJson } = require("./zohoAuth");

// Zoho CRM's standard Quotes module -- used here as "Order Forms".
// Confirmed live against a real record (888045000012213015, subject
// "Laura Dumont - Order Form - 19/08/2026"): Quote_Number is a long
// internal ID, not the short "Order:" number shown on the printed
// label -- see labelData.js for what's actually confirmed vs pending.
async function getQuote(quoteId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/crm/v2/Quotes/${quoteId}`, apiDomain);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!json.data || !json.data[0]) {
    throw new Error(`Zoho CRM error for quote ${quoteId}: ${JSON.stringify(json)}`);
  }
  return json.data[0];
}

// "Appros" in the CRM sidebar is the standard Sales_Orders module,
// relabeled -- confirmed live (record 888045000012702001, Subject
// "Kendra - Order Form - 28/08/2026"). Each Appro links back to its
// originating Quote (Order Form) via the Quote_Name lookup field, and
// carries an Inventory_id field (e.g. "826963000084646439", the same
// ID format/series as other Zoho Inventory record IDs used elsewhere
// in this project) -- that's the real link to the Zoho Inventory Sales
// Order, per instruction. The Appro's own "SO_Number" field
// (888045000012702002) is NOT the human-readable sales order number --
// it's some other internal reference; the real number has to come from
// Zoho Inventory via Inventory_id (see zohoInventoryClient.js).
async function findApproByQuoteId(quoteId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL("/crm/v2/Sales_Orders/search", apiDomain);
  url.searchParams.set("criteria", `(Quote_Name:equals:${quoteId})`);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!json.data || !json.data[0]) return null;
  return json.data[0];
}

module.exports = { getQuote, findApproByQuoteId };
