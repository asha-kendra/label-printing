import argparse
import subprocess
import sys
import tempfile

from . import config, label_mapper, renderer, zoho_client


def print_pdf(pdf_path):
    subprocess.run(
        ["lp", "-d", config.PRINTER_NAME, pdf_path],
        check=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Print a jewellery label for a Zoho Inventory item.")
    parser.add_argument("item_id", help="Zoho Inventory item_id to fetch and print")
    parser.add_argument("--label-type", choices=["parcel", "certified", "jewellery", "matching_pairs"],
                         help="Override auto-detected label type")
    parser.add_argument("--out", help="Write the rendered PDF here instead of a temp file")
    parser.add_argument("--no-print", action="store_true", help="Render only, don't send to the printer")
    args = parser.parse_args()

    item, custom_fields = zoho_client.get_item_with_fields(args.item_id)
    data = label_mapper.build_label_data(item, custom_fields, label_type=args.label_type)

    out_path = args.out or tempfile.mktemp(suffix=".pdf")
    renderer.render_label_pdf(data, out_path)
    print(f"Rendered {data['label_type']} label for {data.get('sku') or args.item_id} -> {out_path}")

    if not args.no_print:
        print_pdf(out_path)
        print(f"Sent to printer '{config.PRINTER_NAME}'")


if __name__ == "__main__":
    sys.exit(main())
