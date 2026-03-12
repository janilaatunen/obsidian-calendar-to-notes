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
npm run build   # Production build → main.js + styles.css, auto-deploys to vault
npm run dev     # Watch mode, auto-deploys to vault on every save
```

## Build Output

- `main.js` — plugin code (gitignored)
- `manifest.json` — plugin metadata
- `styles.css` — styling

## Deployment

Build and deploy are automatic — esbuild copies files to the vault after every build.

**After any code change, run `npm run build` to build and deploy to vault.**

Then reload Obsidian (Cmd+Option+I to open console and check for errors).

> **Claude Code:** Always run `npm run build` after making any code changes to this plugin.

## Git

Identity: personal (`jani@laatunen.fi` / janilaatunen)

## Rules

- Never increment version numbers without explicit confirmation
- "Vibe coded" — focus on functionality over perfect code quality
- Always recommend users backup their vault before using
