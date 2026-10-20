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

// Zoho CRM's Quotes module ("Order Forms" in the UI). This module
// actually carries TWO line-item-shaped fields on this record:
//   - Product_Details: Zoho's standard built-in line-items subform
//     (generic keys: product, quantity, Discount, net_total, ...) --
//     always present, but missing the org's custom columns
//     (Stock_Category, No_Of_Stones_Ordered, etc).
//   - the actual "Quoted Items" custom subform the business uses --
//     confirmed live to exist (via a different tool's fetch) but its
//     real api_name is still unconfirmed: a plain v2 GET on this record
//     doesn't return it at all (not even the key is present), and
//     requesting fields=Quoted_Items explicitly got rejected (response
//     collapsed to just `id`). Bumping to API v6 here as a live test --
//     if the custom subform is still missing after this, the field is
//     most likely hidden from this API user via Field-Level Security
//     in CRM Setup, not a naming/version issue.
async function getQuote(quoteId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/crm/v6/Quotes/${quoteId}`, apiDomain);

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
