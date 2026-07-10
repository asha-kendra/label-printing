const { getAccessToken, httpsRequestJson } = require("./zohoAuth");

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

module.exports = { getItem, getItemWithFields, flattenCustomFields };
