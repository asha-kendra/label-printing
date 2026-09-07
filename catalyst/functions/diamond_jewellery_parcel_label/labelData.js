// Field mapping for the combined diamonds/jewellery/parcel label.
// Detection rules confirmed live during this project (see
// large_diamond_parcel_label and jewellery_mini_label, which this
// function's logic is ported from):
//   certified: Category=Certified,   Stock_Caregory=Diamonds, Stock_Sub_Category=single stone/item
//   parcel:    Category=Uncertified, Stock_Caregory=Diamonds, Stock_Sub_Category=Parcel
//   jewellery: Stock_Caregory=Jewellery
// Anything else is out of scope and throws, same as the source functions.
function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function detectLabelTypeFromCrmProduct(product) {
  const category = (product.Category || "").toLowerCase();
  const stockCategory = (product.Stock_Caregory || "").toLowerCase();
  const subCategory = (product.Stock_Sub_Category || "").toLowerCase();
  if (stockCategory.includes("jewellery") || stockCategory.includes("jewelry")) return "jewellery";
  const isDiamond = stockCategory.includes("diamond");
  if (isDiamond && category.includes("certified") && !category.includes("uncertified") && subCategory.includes("single")) {
    return "certified";
  }
  if (isDiamond && category.includes("uncertified") && subCategory.includes("parcel")) {
    return "parcel";
  }
  return null;
}

// Combined field set: certified/parcel fields (shape, weight_ct, colour,
// clarity, measurements, cert info, mm_size) plus jewellery fields
// (parent_category, sub_category, diamond weights, metal, ring size,
// Style ID, price) all populated together -- each renderer only reads
// the fields relevant to its own label_type, the rest sit unused.
function buildLabelDataFromCrmProduct(product, labelTypeOverride) {
  const labelType = labelTypeOverride || detectLabelTypeFromCrmProduct(product);
  if (!labelType) {
    throw new Error(
      `Could not determine label type for CRM product ${product.id} ` +
        `(Category=${product.Category}, Stock_Caregory=${product.Stock_Caregory}, ` +
        `Stock_Sub_Category=${product.Stock_Sub_Category}). ` +
        `Pass label_type explicitly.`
    );
  }

  return {
    label_type: labelType,
    sku: product.Product_Code || null,
    growth_type: product.ProductType || null,

    // certified / parcel (large_diamond_parcel_label)
    shape: product.Shape || null,
    weight_ct: isEmpty(product.Carat_Units_IN) ? null : product.Carat_Units_IN,
    colour: product.Colour || null,
    clarity: product.Clarity || null,
    measurements_mm: product.Measurement_mm ? String(product.Measurement_mm).replace(/\//g, "x") : null,
    length_mm: isEmpty(product.Length_mm) ? null : product.Length_mm,
    width_mm: isEmpty(product.Width_mm) ? null : product.Width_mm,
    depth_mm: isEmpty(product.Depth_mm) ? null : product.Depth_mm,
    certificate_no: product.Cert_No || null,
    certificate_lab: product.LAB || null,
    mm_size: product.mm_size || null,

    // jewellery (jewellery_mini_label)
    parent_category: product.Parent_Category || null,
    diamond_shape: product.Shape || null,
    sub_category: product.Sub_Category || null,
    total_diamond_weight: isEmpty(product.Total_Diamond_Weight) ? null : product.Total_Diamond_Weight,
    center_diamond_weight: isEmpty(product.Centre_Diamond_Weight) ? null : product.Centre_Diamond_Weight,
    metal_type: product.Metal_Colour || null,
    metal_purity: product.Metal_Purity || null,
    metal_weight: isEmpty(product.Metal_Weight) ? null : product.Metal_Weight,
    ring_size: product.Size || null,
    style_id: product.Style_ID || null,
    price: isEmpty(product.Main_Total) ? null : product.Main_Total,
  };
}

module.exports = { isEmpty, detectLabelTypeFromCrmProduct, buildLabelDataFromCrmProduct };
