# CLAUDE.md — obsidian-calendar-to-notes

Obsidian plugin that syncs calendar events to notes via ICS feeds.

## Tech Stack

- TypeScript, esbuild
- Obsidian API
- ical.js for ICS calendar parsing

## Architecture

- Main class extends `Plugin`
- Custom calendar view component
- Auto-refresh every 12 hours
- Template-based note creation
- Settings interface + settings tab

## Commands

```bash
npm install
npm run build   # Production build → main.js + styles.css
npm run dev     # Watch mode
```

## Build Output

- `main.js` — plugin code (gitignored)
- `manifest.json` — plugin metadata
- `styles.css` — styling

## Deployment

After committing, copy built files to vault:

```bash
cp main.js styles.css manifest.json \
  ~/Obsidian/Codex/.obsidian/plugins/obsidian-calendar-to-notes/
```

Then reload Obsidian (Cmd+Option+I to open console and check for errors).

## Git

Identity: personal (`jani@laatunen.fi` / janilaatunen)

## Rules

- Never increment version numbers without explicit confirmation
- "Vibe coded" — focus on functionality over perfect code quality
- Always recommend users backup their vault before using
