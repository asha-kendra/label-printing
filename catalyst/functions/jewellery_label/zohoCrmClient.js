const { getAccessToken, httpsRequestJson } = require("./zohoAuth");

// Zoho CRM's Products module -- confirmed live against a real record
// (888045000009457101, a Diamonds-category product). Needs the refresh
// token to also carry a CRM scope (e.g. ZohoCRM.modules.products.READ) --
// the Inventory-only scope this project started with won't authorize
// these calls.
async function getProduct(productId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/crm/v2/Products/${productId}`, apiDomain);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!json.data || !json.data[0]) {
    throw new Error(`Zoho CRM error for product ${productId}: ${JSON.stringify(json)}`);
  }
  return json.data[0];
}

module.exports = { getProduct };
