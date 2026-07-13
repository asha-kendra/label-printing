const { isEmpty } = require("./labelData");

// Templates inlined as strings rather than read from files -- same reason
// as labelData.js. Keep in sync with ../../../templates/*.ezpl.
const CERTIFIED_TEMPLATE = `^Q152,24
^W240
^H10
^P1
^S2
^AT
^AD
^C1
^R0
~Q+0
^O0
^D0
^E12

AA,16,28,1,1,0,0E,<ITEM_NO>
AA,16,46,1,1,0,0E,<COLOR>

AA,16,72,1,1,0,0E,Shp.
AA,72,72,1,1,0,0E,<SHAPE>

AA,16,93,1,1,0,0E,Wt
AA,72,93,1,1,0,0E,<WEIGHT>

AA,16,111,1,1,0,0E,Col
AA,72,111,1,1,0,0E,<COLOR_GRADE>

AA,16,129,1,1,0,0E,Cla
AA,72,129,1,1,0,0E,<CLARITY>

AA,136,108,1,1,0,0E,<CERT_NO>
AA,136,129,1,1,0,0E,<MEASUREMENTS>

BQ,136,18,2,5,M,0
MA,<QR_DATA>

E
`;

const JEWELLERY_TEMPLATE = `^Q152,24
^W240
^H10
^P1
^S2
^AT
^AD
^C1
^R0
~Q+0
^O0
^D0
^E12

AA,12,24,1,1,0,0E,<SKU>
AA,12,45,1,1,0,0E,<GROWTH_TYPE>

AA,12,78,1,1,0,0E,Stone
AA,68,78,1,1,0,0E,<STONE>

AA,12,98,1,1,0,0E,Wt
AA,68,98,1,1,0,0E,<STONE_WEIGHT>

AA,12,119,1,1,0,0E,Mtl
AA,68,119,1,1,0,0E,<METAL>

AA,12,140,1,1,0,0E,Ring
AA,68,140,1,1,0,0E,<RING_SIZE>

AA,164,87,1,1,0,0E,<DESCRIPTION>
AA,164,108,1,1,0,0E,<GROSS_WEIGHT>

BQ,164,12,2,5,M,0
MA,<QR_DATA>

E
`;

function applySubstitutions(template, subs) {
  let out = template;
  for (const [key, value] of Object.entries(subs)) {
    out = out.split(key).join(String(value));
  }
  return out;
}

function renderCertifiedEzpl(data) {
  let measurements;
  if (!isEmpty(data.measurements_mm)) {
    // Zoho's own combined field (e.g. "7.13x6.76x4.39") -- swap the ASCII
    // "x" for U+00D7 (×, matches the reference mockup, in Latin-1 which the
    // PPD declares -- confirm on a real print) and append the unit.
    measurements = `${String(data.measurements_mm).replace(/x/g, "×")}mm`;
  } else {
    const dims = [data.length_mm, data.width_mm].filter((v) => !isEmpty(v)).join("-");
    let combined = dims;
    if (!isEmpty(data.depth_mm)) {
      combined = dims ? `${dims}×${data.depth_mm}` : String(data.depth_mm);
    }
    measurements = combined ? `${combined}mm` : "";
  }

  const lab = data.certificate_lab || "GIA";
  const certField = !isEmpty(data.certificate_no) ? `${lab}-${data.certificate_no}` : "";
  const weightField = !isEmpty(data.weight_ct) ? `${data.weight_ct} ct` : "";

  return applySubstitutions(CERTIFIED_TEMPLATE, {
    "<ITEM_NO>": data.sku || "",
    "<COLOR>": data.growth_type || "Natural",
    "<SHAPE>": data.shape || "",
    "<WEIGHT>": weightField,
    "<COLOR_GRADE>": data.colour || "",
    "<CLARITY>": data.clarity || "",
    "<CERT_NO>": certField,
    "<MEASUREMENTS>": measurements,
    "<QR_DATA>": data.sku || "",
  });
}

function renderJewelleryEzpl(data) {
  const stoneWeight = !isEmpty(data.stone_weight_ct) ? `${data.stone_weight_ct} ct` : "";
  const grossWeight = !isEmpty(data.gross_weight_g) ? `${data.gross_weight_g} gms` : "";

  return applySubstitutions(JEWELLERY_TEMPLATE, {
    "<SKU>": data.sku || "",
    "<GROWTH_TYPE>": data.growth_type || "Natural",
    "<STONE>": data.stone || "",
    "<STONE_WEIGHT>": stoneWeight,
    "<METAL>": data.metal || "",
    "<RING_SIZE>": data.ring_size || "",
    "<DESCRIPTION>": data.description || "",
    "<GROSS_WEIGHT>": grossWeight,
    "<QR_DATA>": data.sku || "",
  });
}

const EZPL_RENDERERS = { certified: renderCertifiedEzpl, jewellery: renderJewelleryEzpl };

module.exports = { renderCertifiedEzpl, renderJewelleryEzpl, EZPL_RENDERERS };
