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

function flattenCustomFields(item) {
  const fields = {};
  for (const cf of item.custom_fields || []) {
    const label = (cf.label || cf.customfield_name || "").trim().toLowerCase();
    if (label) fields[label] = cf.value;
  }
  return fields;
}

async function getItem(itemId) {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = new URL(`/inventory/v1/items/${itemId}`, apiDomain);
  url.searchParams.set("organization_id", process.env.ZOHO_ORGANIZATION_ID);

  const { json } = await httpsRequestJson({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (json.code !== 0) {
    throw new Error(`Zoho API error for item ${itemId}: ${json.message}`);
  }
  return json.item;
}

async function getItemWithFields(itemId) {
  const item = await getItem(itemId);
  const fields = flattenCustomFields(item);
  // NOTE: custom-module lookup (the GIA-cert-style linked module) isn't
  // ported here yet -- src/zoho_client.py's get_custom_module_record is
  // still unverified against a real endpoint (see that file's docstring),
  // so it wasn't worth porting an unconfirmed API call. Add it here the
  // same way if/when it's confirmed.
  return { item, fields };
}

module.exports = { getAccessToken, getItem, getItemWithFields, flattenCustomFields };
