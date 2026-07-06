import argparse
import subprocess
import sys
import tempfile

from . import config, ezpl_renderer, label_mapper, renderer, zoho_client


def print_pdf(pdf_path):
    subprocess.run(
        ["lp", "-d", config.PRINTER_NAME, pdf_path],
        check=True,
    )


def print_ezpl(ezpl_text):
    subprocess.run(
        ["lp", "-d", config.PRINTER_NAME, "-o", "raw"],
        input=ezpl_text.encode(),
        check=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Print a jewellery label for a Zoho Inventory item.")
    parser.add_argument("item_id", help="Zoho Inventory item_id to fetch and print")
    parser.add_argument("--label-type", choices=["parcel", "certified", "jewellery", "matching_pairs"],
                         help="Override auto-detected label type")
    parser.add_argument("--ezpl", action="store_true",
                         help="Use the real EZPL template (templates/) instead of the PDF renderer -- certified and jewellery only, for now")
    parser.add_argument("--out", help="Write the rendered PDF/EZPL here instead of a temp file")
    parser.add_argument("--no-print", action="store_true", help="Render only, don't send to the printer")
    args = parser.parse_args()

    item, custom_fields = zoho_client.get_item_with_fields(args.item_id)
    data = label_mapper.build_label_data(item, custom_fields, label_type=args.label_type)

    EZPL_RENDERERS = {
        "certified": ezpl_renderer.render_certified_ezpl,
        "jewellery": ezpl_renderer.render_jewellery_ezpl,
    }

    if args.ezpl:
        if data["label_type"] not in EZPL_RENDERERS:
            sys.exit(f"--ezpl only has templates for {list(EZPL_RENDERERS)}, got {data['label_type']!r}")
        ezpl_text = EZPL_RENDERERS[data["label_type"]](data)
        out_path = args.out or tempfile.mktemp(suffix=".ezpl")
        with open(out_path, "w") as f:
            f.write(ezpl_text)
        print(f"Rendered {data['label_type']} label for {data.get('sku') or args.item_id} -> {out_path}")
        if not args.no_print:
            print_ezpl(ezpl_text)
            print(f"Sent to printer '{config.PRINTER_NAME}' (raw EZPL)")
        return

    out_path = args.out or tempfile.mktemp(suffix=".pdf")
    renderer.render_label_pdf(data, out_path)
    print(f"Rendered {data['label_type']} label for {data.get('sku') or args.item_id} -> {out_path}")

    if not args.no_print:
        print_pdf(out_path)
        print(f"Sent to printer '{config.PRINTER_NAME}'")


if __name__ == "__main__":
    sys.exit(main())
