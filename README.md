# Calendar to Notes

An Obsidian plugin that syncs ICS calendar events and creates meeting notes automatically.

## Features

- 📅 **ICS Calendar Sync** - Connect to any ICS calendar URL (Outlook, Google Calendar, etc.)
- 🔄 **Auto-refresh** - Events load on startup and refresh every 12 hours
- 📝 **One-click Note Creation** - Generate meeting notes from calendar events using templates
- 🗓️ **Day Navigation** - Browse events by day with intuitive navigation
- 🧹 **Teams Link Trimming** - Automatically removes Microsoft Teams boilerplate from meeting descriptions
- ⚡ **Recurring Events Support** - Properly handles recurring calendar events

## Installation

### From GitHub

1. Download the latest release from the [Releases](https://github.com/jlaatu/obsidian-calendar-to-notes/releases) page
2. Extract the files to your vault's `.obsidian/plugins/calendar-to-notes/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

### Manual Installation

1. Clone this repository or download the source code
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-meeting-notes-from-calendar/` folder
5. Reload Obsidian
6. Enable the plugin in Settings → Community plugins

## Setup

1. Go to **Settings → Calendar to Notes**
2. Configure your settings:
   - **ICS Calendar URL**: Your calendar's ICS feed URL
   - **Template Path**: Path to your meeting note template (default: `Templates/Meeting`)
   - **Notes Folder**: Where meeting notes will be created (default: `Notes`)
   - **Trim Teams Links**: Toggle to remove Microsoft Teams footer from descriptions

## Usage

### Opening the Calendar View

- Use **Command Palette** (Ctrl/Cmd + P) → "Open calendar view"
- The view will open in the right sidebar

### Navigating Events

- **Today**: Jump to today's date
- **← →**: Navigate previous/next day
- **🔄**: Refresh calendar events

### Creating Meeting Notes

1. Click the **"Create Note"** button on any event
2. A new note will be created using your template with:
   - Event title in the filename
   - Date and time in frontmatter
   - Attendees as links (if available)
   - Meeting description in a quote block

## Template Setup

Create a meeting template (e.g., `Templates/Meeting.md`):

\`\`\`markdown
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
\`\`\`

The plugin will automatically populate `date:`, `time:`, and `attendees:` fields.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| ICS Calendar URL | URL to your ICS calendar feed | (empty) |
| Template Path | Path to meeting note template | `Templates/Meeting` |
| Notes Folder | Folder where notes will be created | `Notes` |
| Trim Teams Links | Remove Microsoft Teams footer | Enabled |

## Development

### Building the Plugin

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Build and watch for changes
npm run dev
```

### Project Structure

```
obsidian-calendar-to-notes/
├── main.ts              # Main plugin code
├── styles.css           # Plugin styles
├── manifest.json        # Plugin manifest
├── package.json         # NPM dependencies
├── tsconfig.json        # TypeScript config
└── esbuild.config.mjs   # Build configuration
```

## License

MIT

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/jlaatu/obsidian-calendar-to-notes/issues) on GitHub.

## Credits

Developed by Jani Laatunen with assistance from Claude (Anthropic).
