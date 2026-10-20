const https = require("https");

function httpsRequestJson({ hostname, path, method, headers }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`Non-JSON response (${res.statusCode}) from ${hostname}${path}: ${body.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// Shared across zohoClient.js (Inventory) and zohoCrmClient.js (CRM) -- one
// token, one cache. The refresh token needs BOTH products' scopes granted
// together (e.g. ZohoInventory.items.READ,...,ZohoCRM.modules.products.READ)
// since it's the same token used for either API.
let tokenCache = { accessToken: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
  const url = new URL("/oauth/v2/token", accountsDomain);
  url.searchParams.set("refresh_token", process.env.ZOHO_REFRESH_TOKEN);
  url.searchParams.set("client_id", process.env.ZOHO_CLIENT_ID);
  url.searchParams.set("client_secret", process.env.ZOHO_CLIENT_SECRET);
  url.searchParams.set("grant_type", "refresh_token");

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
  });
  if (!json.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(json)}`);
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + ((json.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.accessToken;
}

module.exports = { getAccessToken, httpsRequestJson };
