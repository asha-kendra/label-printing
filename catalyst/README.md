# Zoho Catalyst deployment: click-a-URL label generation

Two implementations of the same function, pick one:

- **`functions/print_label/`** (Python) -- reproduces this project's own
  fetch → map → render pipeline (`zoho_client` → `label_mapper` →
  `ezpl_renderer`/`renderer`) as closely as possible.
- **`functions/print_label_node/`** (Node.js) -- a from-scratch port of the
  same logic. Built after the Python function's runtime (`python_3_13`)
  turned out to have **no in-console code editor at all** ("Please use
  CLI"), which made it hard to tell whether upload problems were code bugs
  or deployment-path issues. Node.js Advanced I/O functions are more
  commonly editable directly in the Catalyst console, which may sidestep
  that entirely -- worth trying first if you hit the same wall.

Both are copies, not a shared package with `../src/` -- if you change the
fetch/mapping/render logic later, copy the change into all three places
(`src/`, here, and there), or they'll drift apart.

Both are also flat on purpose: the field-mapping rules and EZPL templates
are inlined as code (Python dict / JS object and template-literal strings)
rather than read from `config/label_fields.json` / `templates/*.ezpl` at
runtime. The first Python deploy attempt crashed with `FileNotFoundError`
because those subdirectories didn't survive the upload -- so neither
function has any file it depends on besides its own source files.

The Node version was verified locally end-to-end (mocked Zoho fetch,
matched the Python EZPL output byte-for-byte, PDF opens and renders
correctly) before being written up here -- see
`functions/print_label_node/` for the source.

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

I could not verify either function's exact handler signature against
Zoho's current docs -- `docs.catalyst.zoho.com` blocks automated fetches
(the same issue `zoho_client.py` already flags for the Inventory
custom-modules API). The Python version is written against the
Flask-`Request`-based Advanced I/O pattern Catalyst's own tutorials use;
the Node version against the commonly-documented Express-style `(req, res)`
pattern. **Compare whichever one you use against what `catalyst init`
actually scaffolds for that runtime, and adjust the request/response
handling if the SDK has since changed.**

## Setup: Node.js (`print_label_node`)

```bash
npm install -g zcatalyst-cli
catalyst login
cd catalyst
catalyst init      # choose: Functions -> Advanced I/O -> Node.js
                    # name it print_label (or print_label_node)
```

Replace the scaffolded function's files with everything in
`functions/print_label_node/` (`main.js`, `labelData.js`, `zohoClient.js`,
`ezplRenderer.js`, `pdfRenderer.js`, `package.json`, `package-lock.json`).
Run `npm install` inside that folder if the console/CLI doesn't do it for
you automatically on deploy.

Same environment variables as below, same `catalyst deploy`, same URL
shape (`?item_id=<id>&format=ezpl|pdf`).

## Setup: Python (`print_label`)

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
