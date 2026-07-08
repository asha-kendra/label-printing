// Catalyst Advanced I/O function (Node.js): fetches a Zoho Inventory item,
// builds the label data, and returns something printable in response to a
// plain GET -- this is the "click a URL, get a label" endpoint.
//
// NOTE ON THE HANDLER SIGNATURE: Zoho's Catalyst docs block automated
// fetches, so this is written against the commonly-documented Express-style
// (req, res) convention Catalyst's Node.js Advanced I/O functions use, but
// it wasn't possible to verify against a live current doc page. Check this
// against whatever `catalyst init` scaffolds for a Node Advanced I/O
// function before relying on it.
//
// URL shape once deployed:
//   GET /server/print_label?item_id=<id>              -> PDF, inline
//   GET /server/print_label?item_id=<id>&format=ezpl   -> raw EZPL text
//
// IMPORTANT: this function can fetch + render but cannot print. The GE330
// is a local USB/network printer -- nothing running in Catalyst's cloud can
// reach it. See catalyst/README.md for what's needed to close that gap.

const { buildLabelData } = require("./labelData");
const { getItemWithFields } = require("./zohoClient");
const { EZPL_RENDERERS } = require("./ezplRenderer");
const { renderCertifiedPdf } = require("./pdfRenderer");

module.exports = async (req, res) => {
  const itemId = req.query && req.query.item_id;
  if (!itemId) {
    res.status(400).set("Content-Type", "text/plain").send("Missing required query param: item_id");
    return;
  }

  const labelType = (req.query && req.query.label_type) || null;
  const format = ((req.query && req.query.format) || "pdf").toLowerCase();

  let data;
  try {
    const { item, fields } = await getItemWithFields(itemId);
    data = buildLabelData(item, fields, labelType);
  } catch (err) {
    res
      .status(502)
      .set("Content-Type", "text/plain")
      .send(`Could not fetch/build label for item_id=${itemId}: ${err.message}`);
    return;
  }

  if (format === "ezpl") {
    const renderFn = EZPL_RENDERERS[data.label_type];
    if (!renderFn) {
      res
        .status(501)
        .set("Content-Type", "text/plain")
        .send(
          `No EZPL template for label_type=${data.label_type} yet ` +
            `(have: ${Object.keys(EZPL_RENDERERS).join(", ")}) -- try format=pdf instead.`
        );
      return;
    }
    const ezplText = renderFn(data);
    res
      .status(200)
      .set("Content-Type", "text/plain; charset=utf-8")
      .set("Content-Disposition", `inline; filename="${data.sku || itemId}.ezpl"`)
      .send(ezplText);
    return;
  }

  if (data.label_type !== "certified") {
    res
      .status(501)
      .set("Content-Type", "text/plain")
      .send(`PDF rendering is only wired up for label_type=certified so far, got ${data.label_type}.`);
    return;
  }

  const pdfBuffer = await renderCertifiedPdf(data);
  res
    .status(200)
    .set("Content-Type", "application/pdf")
    .set("Content-Disposition", `inline; filename="${data.sku || itemId}.pdf"`)
    .send(pdfBuffer);
};
