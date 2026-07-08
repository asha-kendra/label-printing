# Catalyst Advanced I/O function: fetches a Zoho Inventory item, builds the
# label data, and returns something printable in response to a plain GET --
# this is the "click a URL, get a label" endpoint.
#
# NOTE ON THE HANDLER SIGNATURE: Zoho's Catalyst docs block automated
# fetches (same issue this project's zoho_client.py already flags for the
# Inventory custom-modules API), so this is written against the
# Flask-`Request`-based Advanced I/O pattern Catalyst's own tutorials use,
# but it was not possible to verify the exact current signature/response
# helpers against a live doc page. Before deploying: run `catalyst init`
# yourself, diff this file's handler signature and response construction
# against whatever main.py it scaffolds, and adjust if the SDK has since
# changed how requests/responses are read and sent.
#
# URL shape once deployed (see catalyst/README.md for the full path):
#   GET /server/print_label/label?item_id=<id>              -> PDF, inline
#   GET /server/print_label/label?item_id=<id>&format=ezpl   -> raw EZPL text
#
# IMPORTANT: this function can fetch + render but cannot print. The GE330
# is a local USB/network printer -- nothing running in Catalyst's cloud can
# reach it. format=pdf gets you something a browser can print via its own
# dialog if the GE330's driver is installed on that machine; format=ezpl
# gets you the exact bytes the real printer needs, but something with LAN
# access to the printer still has to `lp -o raw` them -- that's the piece
# that has to stay local. See catalyst/README.md.

import tempfile

from flask import Request, Response

import ezpl_renderer
import label_mapper
import renderer
import zoho_client

EZPL_RENDERERS = {
    "certified": ezpl_renderer.render_certified_ezpl,
    "jewellery": ezpl_renderer.render_jewellery_ezpl,
}


def handler(request: Request):
    item_id = request.args.get("item_id")
    if not item_id:
        resp = Response("Missing required query param: item_id", status=400)
        resp.headers["Content-Type"] = "text/plain"
        return resp

    label_type = request.args.get("label_type") or None
    fmt = (request.args.get("format") or "pdf").lower()

    try:
        item, custom_fields = zoho_client.get_item_with_fields(item_id)
        data = label_mapper.build_label_data(item, custom_fields, label_type=label_type)
    except Exception as exc:  # noqa: BLE001 -- surface any fetch/mapping failure as a plain 502
        resp = Response(f"Could not fetch/build label for item_id={item_id}: {exc}", status=502)
        resp.headers["Content-Type"] = "text/plain"
        return resp

    if fmt == "ezpl":
        renderer_fn = EZPL_RENDERERS.get(data["label_type"])
        if renderer_fn is None:
            resp = Response(
                f"No EZPL template for label_type={data['label_type']!r} yet "
                f"(have: {list(EZPL_RENDERERS)}) -- try format=pdf instead.",
                status=501,
            )
            resp.headers["Content-Type"] = "text/plain"
            return resp
        ezpl_text = renderer_fn(data)
        resp = Response(ezpl_text, status=200)
        resp.headers["Content-Type"] = "text/plain; charset=utf-8"
        resp.headers["Content-Disposition"] = f'inline; filename="{data.get("sku") or item_id}.ezpl"'
        return resp

    # format=pdf (default): the same visual-approximation renderer used
    # throughout this project for previews -- good for a quick browser
    # print, but not guaranteed pixel-identical to the real EZPL output.
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        renderer.render_label_pdf(data, tmp.name)
        pdf_bytes = open(tmp.name, "rb").read()

    resp = Response(pdf_bytes, status=200)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f'inline; filename="{data.get("sku") or item_id}.pdf"'
    return resp
