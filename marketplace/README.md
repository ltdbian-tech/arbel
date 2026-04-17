# Arbel Marketplace

Curated, reviewed templates, scenes, brand kits, and components for the Arbel Cinematic editor.

## Security model

Marketplace items live in this repo and go through pull-request review before merge. On install, the Arbel editor runs every item through a sanitizer that:

- Strips any `customHead`, `customBodyEnd`, or inline `<script>` content
- Validates every `href` / `src` against the editor's URL allow-list (HTTPS only, no `javascript:`, no `vbscript:`, no `data:` except images/videos)
- Whitelists only known schema fields — unknown keys are discarded
- Rejects items whose registry URL does not match `raw.githubusercontent.com/<Arbel org>/…`

## Registry

`registry.json` at the root lists all available items. Each item has a `url` pointing to a JSON payload in this folder. The editor fetches the registry from a **hardcoded URL** — it never fetches arbitrary user-supplied URLs.

## Contributing

1. Add your item JSON under `scenes/`, `kits/`, or `components/`.
2. Add a registry entry in `registry.json` with a clear `name`, `author`, and `description`.
3. Open a PR. A maintainer reviews for safety and quality before merge.

## Item kinds

- `scene` — a single cinematic scene with elements and scroll animations
- `brandKit` — design-token bundle (colors + fonts + scale)
- `component` — a reusable element group (coming soon)
- `effect` — a background preset (coming soon)
