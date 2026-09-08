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

// Zoho CRM's Quotes module ("Order Forms" in the UI). Confirmed live
// against a real record (888045000012213015): Quoted_Items is the
// line-items array, each entry's Product_Name is a lookup object
// carrying that line item's real Products-module record id -- that id
// is what gets passed to getProduct() to build each line item's label.
async function getQuote(quoteId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/crm/v2/Quotes/${quoteId}`, apiDomain);
  // No `fields` param here on purpose: passing fields=Quoted_Items was
  // tried and confirmed (live) to break the response down to just `id`
  // -- subform fields aren't selectable via `fields`. The full,
  // unrestricted record fetch is what actually includes Quoted_Items.

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

module.exports = { getProduct, getQuote };
