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

module.exports = { getQuote };
