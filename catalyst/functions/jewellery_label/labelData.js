// Field mapping for the jewellery flag-tag label. Confirmed live against
// real Zoho CRM Products records (Stock_Caregory=Jewellery), e.g.
// Product_Code 132295 (Parent_Category=Rings, Sub_Category="Three Stone
// Ring", Total_Diamond_Weight=4, Size="M") and 148980 (Metal_Colour=
// "Platinum", Metal_Purity="950" -- together read as "Platinum 950").
// "Metal_Colour" is the real API name for what's shown as metal type
// despite the field name -- confirmed by its actual values ("Platinum",
// etc.), not colours in the gemstone sense.
function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function buildLabelDataFromCrmProduct(product) {
  return {
    label_type: "jewellery",
    sku: product.Product_Code || null,
    growth_type: product.ProductType || null,
    parent_category: product.Parent_Category || null,
    carat_in: isEmpty(product.Carat_Units_IN) ? null : product.Carat_Units_IN,
    sub_category: product.Sub_Category || null,
    metal_type: product.Metal_Colour || null,
    metal_purity: product.Metal_Purity || null,
    total_diamond_weight: isEmpty(product.Total_Diamond_Weight) ? null : product.Total_Diamond_Weight,
    ring_size: product.Size || null,
  };
}

module.exports = { isEmpty, buildLabelDataFromCrmProduct };
