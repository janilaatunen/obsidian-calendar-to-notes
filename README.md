# Calendar to Notes

> **⚠️ Disclaimer:** This plugin was vibe coded. Use at your own risk and back up your vault.

Sync ICS calendar events to Obsidian, view them in a sidebar calendar, and create meeting notes from templates.

## Features

- **ICS Calendar Sync** - Connect to any ICS URL (Outlook, Google Calendar, etc.)
- **Auto-refresh** - Loads on startup, refreshes every 12 hours, 4 weeks past + 6 weeks future
- **Calendar Sidebar** - Browse events by day with navigation controls (desktop only on startup)
- **One-click Notes** - Create meeting notes from events using your template
- **Teams Link Trimming** - Removes Microsoft Teams boilerplate from descriptions
- **Recurring Events** - Properly handles recurring calendar events
- **All-day Events** - Shows all-day events on correct day only
- **Silent Auto-sync** - Background refreshes don't show notifications

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from releases
2. Create folder: `.obsidian/plugins/calendar-to-notes/`
3. Copy files into folder
4. Restart Obsidian
5. Enable in Settings → Community Plugins

## Setup

Go to Settings → Calendar to Notes:

- **ICS Calendar URL**: Your calendar's ICS feed URL
- **Template Path**: Path to meeting template (default: `Templates/Meeting`)
- **Notes Folder**: Where notes are created (default: `Notes`)
- **Trim Teams Links**: Remove Teams footer from descriptions (default: enabled)

## Usage

### Calendar View

- **Command Palette** (Ctrl/Cmd + P) → "Open calendar view"
- Opens in right sidebar (desktop only on startup)
- **Today**: Jump to current date
- **← →**: Navigate days
- **🔄**: Manual refresh (shows notifications)

### Create Meeting Notes

1. Click **"Create Note"** on any event
2. Note created with:
   - Sanitized event title in filename
   - Date and time in frontmatter
   - Attendees as links
   - Description in quote block

## Template Example

Create `Templates/Meeting.md`:

```markdown
---
tags:
  - Meeting
date:
time:
attendees:
---

## Agenda

## Notes

## Action Items
- [ ]

## Decisions Made

## Follow-up
```

Fields `date`, `time`, and `attendees` auto-populate.

## Settings

| Setting | Default |
|---------|---------|
| ICS Calendar URL | (empty) |
| Template Path | `Templates/Meeting` |
| Notes Folder | `Notes` |
| Trim Teams Links | Enabled |

## Development

```bash
npm install
npm run build
```

## License

MIT © 2026 Jani Laatunen
