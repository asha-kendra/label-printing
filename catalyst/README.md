# Zoho Catalyst deployment: click-a-URL label generation

`functions/print_label/` is a self-contained Catalyst Advanced I/O function
(Python) that reproduces this project's fetch → map → render pipeline
(`zoho_client` → `label_mapper` → `ezpl_renderer`/`renderer`) so it can run
as a URL instead of a local CLI command. It's a copy, not a shared package
with `../src/` -- if you change the fetch/mapping/render logic later, copy
the change into both places, or these will drift apart.

It's also flat on purpose: `label_mapper.py`'s field-mapping rules and
`ezpl_renderer.py`'s EZPL templates are inlined as Python literals rather
than read from `config/label_fields.json` / `templates/*.ezpl` at runtime.
The first deploy attempt crashed with `FileNotFoundError` because those
subdirectories didn't survive the upload -- so this folder now has zero
files besides the six `.py` files + `requirements.txt`, and nothing it
does at runtime depends on anything but those.

## What this does and doesn't do

- **Does:** given `?item_id=<id>`, fetch the item + custom fields from your
  Zoho Inventory org, map them to label data, and return either a PDF or
  the raw EZPL text.
- **Doesn't print.** The GE330 is a local USB/network printer -- nothing
  running in Catalyst's cloud can reach it. Clicking the URL gets you a
  printable *artifact*, not a completed print job:
  - `format=pdf` (default) returns a PDF inline. If the GE330's driver is
    installed on whatever machine opens the link, its browser print dialog
    can send that PDF to it directly -- genuinely "click and print" from
    the user's side, but it's the same visual-approximation renderer used
    for previews throughout this project, not guaranteed pixel-identical
    to the real EZPL output.
  - `format=ezpl` returns the exact bytes the real printer needs, but
    something with LAN access to the printer still has to pipe them to
    `lp -o raw` -- a browser can't do that on its own. If you want true
    one-click-from-anywhere printing, the missing piece is a small local
    script/agent on the print machine that polls or receives a push from
    this endpoint and runs `lp -d $PRINTER_NAME -o raw`. Ask and I'll build
    that next -- it wasn't clear yet whether you wanted it.

## Before you deploy

I could not verify `main.py`'s exact handler signature against Zoho's
current docs -- `docs.catalyst.zoho.com` blocks automated fetches (the
same issue `zoho_client.py` already flags for the Inventory custom-modules
API). It's written against the Flask-`Request`-based Advanced I/O pattern
Catalyst's own tutorials use, but **run `catalyst init` yourself first,
compare its scaffolded `main.py` to this one, and adjust the request/response
handling if the SDK has since changed.**

## Setup

```bash
npm install -g zcatalyst-cli   # if not already installed
catalyst login
```

From this `catalyst/` directory (or wherever you want the Catalyst project
root):

```bash
catalyst init      # choose: Functions -> Advanced I/O -> Python
                    # name it print_label, then replace the scaffolded
                    # functions/print_label/ contents with this folder's
                    # 6 files: main.py, requirements.txt, config.py,
                    # zoho_client.py, label_mapper.py, ezpl_renderer.py,
                    # renderer.py -- no subfolders needed
```

If you already have a Catalyst project, use `catalyst function:create`
(or the console) to add `print_label` as a new Advanced I/O function
instead of running `init` again.

### Environment variables

Set these in the Catalyst console (Functions → print_label → Environment
Variables) or via `catalyst deploy --env` -- **not** in a checked-in
`.env` file:

| Variable | Value |
|---|---|
| `ZOHO_CLIENT_ID` | from your `.env` |
| `ZOHO_CLIENT_SECRET` | from your `.env` |
| `ZOHO_REFRESH_TOKEN` | from your `.env` |
| `ZOHO_ORGANIZATION_ID` | `20108921672` |
| `ZOHO_ACCOUNTS_DOMAIN` | `https://accounts.zoho.eu` |
| `ZOHO_API_DOMAIN` | `https://www.zohoapis.eu` |
| `LABEL_WIDTH_MM` | `30` |
| `LABEL_HEIGHT_MM` | `19` |

### Deploy

```bash
catalyst deploy
```

Catalyst prints the project's serverless domain on deploy --
the function is reachable at:

```
https://<your-project-domain>.catalystserverless.eu/server/print_label/label?item_id=<id>
```

Add `&format=ezpl` for raw EZPL, `&label_type=jewellery` (etc.) to
override auto-detection the same way `--label-type` does on the CLI.
