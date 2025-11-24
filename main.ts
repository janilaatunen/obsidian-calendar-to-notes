import { App, Plugin, PluginSettingTab, Setting, Notice, ItemView, WorkspaceLeaf, Modal, requestUrl } from 'obsidian';
import ICAL from 'ical.js';

const VIEW_TYPE_CALENDAR = 'calendar-view';

interface MeetingNotesSettings {
	icsUrl: string;
	templatePath: string;
	notesFolder: string;
	trimTeamsLinks: boolean;
}

const DEFAULT_SETTINGS: MeetingNotesSettings = {
	icsUrl: '',
	templatePath: 'Templates/Meeting',
	notesFolder: 'Notes',
	trimTeamsLinks: true
}

interface CalendarEvent {
	uid: string;
	summary: string;
	description: string;
	location: string;
	start: Date;
	end: Date;
	attendees: string[];
}

export default class MeetingNotesPlugin extends Plugin {
	settings: MeetingNotesSettings;
	events: CalendarEvent[] = [];
	refreshInterval: number;

	async onload() {
		await this.loadSettings();
		await this.loadCachedEvents();

		console.log('Meeting Notes plugin loaded');

		// Fetch fresh events on startup
		if (this.settings.icsUrl) {
			this.fetchCalendarEvents();
		}

		// Auto-refresh every 12 hours
		this.refreshInterval = window.setInterval(() => {
			if (this.settings.icsUrl) {
				this.fetchCalendarEvents();
			}
		}, 12 * 60 * 60 * 1000); // 12 hours in milliseconds
		this.registerInterval(this.refreshInterval);

		// Register the calendar view
		this.registerView(
			VIEW_TYPE_CALENDAR,
			(leaf) => new CalendarView(leaf, this)
		);

		// Add settings tab
		this.addSettingTab(new MeetingNotesSettingTab(this.app, this));

		// Add command to open view
		this.addCommand({
			id: 'open-calendar-view',
			name: 'Open calendar view',
			callback: () => {
				this.activateView();
			}
		});

		// Add command to refresh events
		this.addCommand({
			id: 'refresh-calendar-events',
			name: 'Refresh calendar events',
			callback: () => {
				this.fetchCalendarEvents();
			}
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
		console.log('Meeting Notes plugin unloaded');
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Create a new leaf in the right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
			}
		}

		// Reveal the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadCachedEvents() {
		try {
			const data = await this.loadData();
			if (data && data.cachedEvents) {
				// Convert date strings back to Date objects
				this.events = data.cachedEvents.map((event: any) => ({
					...event,
					start: new Date(event.start),
					end: new Date(event.end)
				}));
				console.log(`Loaded ${this.events.length} cached events`);

				// Update the calendar view if it's open
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
				leaves.forEach(leaf => {
					if (leaf.view instanceof CalendarView) {
						leaf.view.refresh();
					}
				});
			}
		} catch (error) {
			console.error('Error loading cached events:', error);
		}
	}

	async saveEvents() {
		try {
			const data = await this.loadData() || {};
			// Convert Date objects to ISO strings for storage
			data.cachedEvents = this.events.map(event => ({
				...event,
				start: event.start.toISOString(),
				end: event.end.toISOString()
			}));
			await this.saveData(data);
			console.log(`Cached ${this.events.length} events`);
		} catch (error) {
			console.error('Error saving events:', error);
		}
	}

	async fetchCalendarEvents() {
		if (!this.settings.icsUrl) {
			new Notice('Please configure ICS URL in settings');
			return;
		}

		try {
			new Notice('Fetching calendar events...');
			const response = await requestUrl({
				url: this.settings.icsUrl,
				method: 'GET'
			});

			if (response.status !== 200) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const icsData = response.text;
			await this.parseICSData(icsData);

			new Notice(`Loaded ${this.events.length} calendar events`);
			console.log('Calendar events loaded:');
			this.events.forEach(event => {
				console.log(`- ${event.summary}: ${event.start.toLocaleString()} to ${event.end.toLocaleString()}`);
			});
		} catch (error) {
			console.error('Error fetching calendar:', error);
			new Notice('Error fetching calendar events. Check console for details.');
		}
	}

	async parseICSData(icsData: string) {
		try {
			const jcalData = ICAL.parse(icsData);
			const comp = new ICAL.Component(jcalData);
			const vevents = comp.getAllSubcomponents('vevent');

			// Define date range: 1 week before and 2 weeks after today
			const today = new Date();
			const oneWeekAgo = new Date(today);
			oneWeekAgo.setDate(today.getDate() - 7);
			const twoWeeksLater = new Date(today);
			twoWeeksLater.setDate(today.getDate() + 14);

			console.log(`Filtering events between ${oneWeekAgo.toLocaleDateString()} and ${twoWeeksLater.toLocaleDateString()}`);

			const allEvents: CalendarEvent[] = [];

			vevents.forEach(vevent => {
				const event = new ICAL.Event(vevent);

				// Extract attendees
				const attendees: string[] = [];
				const attendeeProps = vevent.getAllProperties('attendee');
				attendeeProps.forEach(prop => {
					const cn = prop.getParameter('cn');
					if (cn) {
						if (Array.isArray(cn)) {
							attendees.push(...cn);
						} else {
							attendees.push(cn);
						}
					}
				});

				// Check if this is a recurring event
				if (event.isRecurring()) {
					// Expand recurring events within the date range
					const expand = new ICAL.RecurExpansion({
						component: vevent,
						dtstart: event.startDate
					});

					let next;
					while ((next = expand.next())) {
						const occurrence = next.toJSDate();

						// Stop if we're past our date range
						if (occurrence > twoWeeksLater) break;

						// Only include if within our date range
						if (occurrence >= oneWeekAgo && occurrence <= twoWeeksLater) {
							const duration = event.duration.toSeconds() * 1000; // Convert to milliseconds
							const endDate = new Date(occurrence.getTime() + duration);

							allEvents.push({
								uid: event.uid + '-' + occurrence.getTime(),
								summary: event.summary || 'Untitled Event',
								description: event.description || '',
								location: event.location || '',
								start: occurrence,
								end: endDate,
								attendees: attendees
							});
						}
					}
				} else {
					// Single event
					const startDate = event.startDate.toJSDate();

					if (startDate >= oneWeekAgo && startDate <= twoWeeksLater) {
						allEvents.push({
							uid: event.uid,
							summary: event.summary || 'Untitled Event',
							description: event.description || '',
							location: event.location || '',
							start: startDate,
							end: event.endDate.toJSDate(),
							attendees: attendees
						});
					}
				}
			});

			// Deduplicate events based on summary and start time
			const uniqueEvents = new Map<string, CalendarEvent>();
			allEvents.forEach(event => {
				const key = `${event.summary}-${event.start.getTime()}`;
				if (!uniqueEvents.has(key)) {
					uniqueEvents.set(key, event);
				}
			});

			this.events = Array.from(uniqueEvents.values());

			// Sort events by start date
			this.events.sort((a, b) => a.start.getTime() - b.start.getTime());

			// Save events to cache
			await this.saveEvents();

			// Update the calendar view if it's open
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
			leaves.forEach(leaf => {
				if (leaf.view instanceof CalendarView) {
					leaf.view.refresh();
				}
			});
		} catch (error) {
			console.error('Error parsing ICS data:', error);
			new Notice('Error parsing calendar data');
		}
	}
}

class CalendarView extends ItemView {
	plugin: MeetingNotesPlugin;
	currentDate: Date;

	constructor(leaf: WorkspaceLeaf, plugin: MeetingNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.currentDate = new Date();
		// Reset to start of day
		this.currentDate.setHours(0, 0, 0, 0);
	}

	getViewType() {
		return VIEW_TYPE_CALENDAR;
	}

	getDisplayText() {
		return 'Meeting Notes';
	}

	getIcon() {
		return 'calendar-days';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('meeting-notes-view');

		this.refresh();
	}

	refresh() {
		const container = this.containerEl.children[1];
		container.empty();

		// Header with navigation
		const header = container.createEl('div', { cls: 'meeting-notes-header' });

		// Date navigation section
		const dateNav = header.createEl('div', { cls: 'meeting-notes-date-nav' });

		// Today button (leftmost)
		const todayBtn = dateNav.createEl('button', {
			text: 'Today',
			cls: 'meeting-notes-today-btn'
		});
		todayBtn.addEventListener('click', () => {
			this.currentDate = new Date();
			this.currentDate.setHours(0, 0, 0, 0);
			this.refresh();
		});

		// Previous day button
		const prevBtn = dateNav.createEl('button', {
			cls: 'meeting-notes-nav-btn',
			attr: { 'aria-label': 'Previous day' }
		});
		prevBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
		prevBtn.addEventListener('click', () => {
			this.currentDate.setDate(this.currentDate.getDate() - 1);
			this.refresh();
		});

		// Current date display
		const dateDisplay = dateNav.createEl('div', {
			cls: 'meeting-notes-date-display',
			text: this.formatDateHeader(this.currentDate)
		});

		// Next day button
		const nextBtn = dateNav.createEl('button', {
			cls: 'meeting-notes-nav-btn',
			attr: { 'aria-label': 'Next day' }
		});
		nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
		nextBtn.addEventListener('click', () => {
			this.currentDate.setDate(this.currentDate.getDate() + 1);
			this.refresh();
		});

		// Refresh button with icon (rightmost)
		const refreshBtn = dateNav.createEl('button', {
			cls: 'meeting-notes-refresh-btn',
			attr: { 'aria-label': 'Refresh events' }
		});
		refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
		refreshBtn.addEventListener('click', () => {
			this.plugin.fetchCalendarEvents();
		});

		// Events list
		const eventsList = container.createEl('div', { cls: 'meeting-notes-list' });

		// Filter events for current date
		const dayEvents = this.getEventsForDate(this.currentDate);

		if (this.plugin.events.length === 0) {
			eventsList.createEl('p', {
				text: 'No events loaded. Configure your ICS URL in settings and click Refresh.',
				cls: 'meeting-notes-empty'
			});
		} else if (dayEvents.length === 0) {
			eventsList.createEl('p', {
				text: 'No events on this day.',
				cls: 'meeting-notes-empty'
			});
		} else {
			dayEvents.forEach(event => {
				const eventEl = eventsList.createEl('div', { cls: 'meeting-notes-event' });

				// Event summary
				eventEl.createEl('div', {
					text: event.summary,
					cls: 'meeting-notes-event-title'
				});

				// Event time
				const isAllDay = this.isAllDayEvent(event);
				const timeStr = isAllDay ? 'All Day' : `${this.formatTime(event.start)} - ${this.formatTime(event.end)}`;
				eventEl.createEl('div', {
					text: timeStr,
					cls: 'meeting-notes-event-time'
				});


				// Create note button
				const btnContainer = eventEl.createEl('div', { cls: 'meeting-notes-event-actions' });
				const createBtn = btnContainer.createEl('button', {
					text: 'Create Note',
					cls: 'meeting-notes-create-btn'
				});
				createBtn.addEventListener('click', () => {
					this.createNoteFromEvent(event);
				});
			});
		}
	}

	getEventsForDate(date: Date): CalendarEvent[] {
		// Create start and end of target day in local time
		const dayStart = new Date(date);
		dayStart.setHours(0, 0, 0, 0);

		const dayEnd = new Date(date);
		dayEnd.setHours(23, 59, 59, 999);

		console.log(`Filtering events for: ${dayStart.toLocaleDateString()} (${dayStart.toISOString()} to ${dayEnd.toISOString()})`);

		const filtered = this.plugin.events.filter(event => {
			const eventStart = new Date(event.start);
			const eventEnd = new Date(event.end);

			// Check if event overlaps with the target day
			const matches = (eventStart >= dayStart && eventStart <= dayEnd) ||
				   (eventEnd >= dayStart && eventEnd <= dayEnd) ||
				   (eventStart < dayStart && eventEnd > dayEnd);

			if (matches) {
				console.log(`  ✓ ${event.summary}: ${eventStart.toLocaleString()}`);
			}

			return matches;
		});

		console.log(`Found ${filtered.length} events for this day`);

		// Sort events: all-day events first, then by start time
		filtered.sort((a, b) => {
			const aIsAllDay = this.isAllDayEvent(a);
			const bIsAllDay = this.isAllDayEvent(b);

			// All-day events come first
			if (aIsAllDay && !bIsAllDay) return -1;
			if (!aIsAllDay && bIsAllDay) return 1;

			// Otherwise sort by start time
			return a.start.getTime() - b.start.getTime();
		});

		return filtered;
	}

	isAllDayEvent(event: CalendarEvent): boolean {
		const startHours = event.start.getHours();
		const startMinutes = event.start.getMinutes();
		const endHours = event.end.getHours();
		const endMinutes = event.end.getMinutes();

		return startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0;
	}

	formatDateHeader(date: Date): string {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const targetDate = new Date(date);
		targetDate.setHours(0, 0, 0, 0);

		if (targetDate.getTime() === today.getTime()) {
			return 'Today';
		}

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (targetDate.getTime() === tomorrow.getTime()) {
			return 'Tomorrow';
		}

		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		if (targetDate.getTime() === yesterday.getTime()) {
			return 'Yesterday';
		}

		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	formatTime(date: Date): string {
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	async createNoteFromEvent(event: CalendarEvent) {
		try {
			// Read the template
			const templatePath = this.plugin.settings.templatePath + '.md';
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

			if (!templateFile) {
				new Notice(`Template not found: ${templatePath}`);
				return;
			}

			const templateContent = await this.app.vault.read(templateFile as any);

			// Format the date for the filename and frontmatter
			const year = event.start.getFullYear();
			const month = String(event.start.getMonth() + 1).padStart(2, '0');
			const day = String(event.start.getDate()).padStart(2, '0');
			const hours = String(event.start.getHours()).padStart(2, '0');
			const minutes = String(event.start.getMinutes()).padStart(2, '0');

			const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
			const timeStr = `${hours}:${minutes}`; // 24-hour format

			// Replace placeholders in template (preserve line breaks)
			let noteContent = templateContent;
			noteContent = noteContent.replace(/^date:.*$/gm, `date: ${dateStr}`);
			noteContent = noteContent.replace(/^time:.*$/gm, `time: ${timeStr}`);

			// Format attendees as YAML list
			console.log('Attendees found:', event.attendees);
			if (event.attendees && event.attendees.length > 0) {
				const attendeesList = event.attendees.map(a => `  - "[[${a}]]"`).join('\n');
				noteContent = noteContent.replace(/^attendees:.*$/gm, `attendees:\n${attendeesList}`);
			} else {
				noteContent = noteContent.replace(/^attendees:.*$/gm, `attendees:`);
			}

			// Remove description from frontmatter if it exists
			noteContent = noteContent.replace(/^description:.*$/gm, '');

			// Add meeting invite description at the bottom
			if (event.description && event.description.trim()) {
				let description = event.description;

				// Trim Teams links if enabled
				if (this.plugin.settings.trimTeamsLinks) {
					const teamsMarker = '________________________________________________________________________________';
					const teamsIndex = description.indexOf(teamsMarker);
					if (teamsIndex !== -1) {
						description = description.substring(0, teamsIndex).trim();
					}
				}

				if (description) {
					// Format description as a quote block
					const quotedDescription = description.split('\n').map(line => `> ${line}`).join('\n');
					noteContent += `\n\n## Meeting invite\n\n${quotedDescription}`;
				}
			}

			console.log('Event details:', {
				summary: event.summary,
				attendees: event.attendees,
				hasDescription: !!event.description
			});

			// Create filename: "YYYY-MM-DD Event Title"
			const fileName = `${dateStr} ${event.summary}.md`;
			const folderPath = this.plugin.settings.notesFolder;

			// Ensure folder exists
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}

			// Create the note
			const filePath = `${folderPath}/${fileName}`;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);

			if (existingFile) {
				new Notice(`Note already exists: ${fileName}`);
				// Open the existing note
				await this.app.workspace.openLinkText(filePath, '', false);
			} else {
				const newFile = await this.app.vault.create(filePath, noteContent);
				new Notice(`Created note: ${fileName}`);
				// Open the new note
				await this.app.workspace.openLinkText(filePath, '', false);
			}
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice('Error creating note. Check console for details.');
		}
	}

	async onClose() {
		// Nothing to clean up
	}
}

class SettingsModal extends Modal {
	plugin: MeetingNotesPlugin;

	constructor(app: App, plugin: MeetingNotesPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Calendar Settings' });

		new Setting(contentEl)
			.setName('ICS Calendar URL')
			.setDesc('Enter the URL to your ICS calendar file')
			.addText(text => text
				.setPlaceholder('https://example.com/calendar.ics')
				.setValue(this.plugin.settings.icsUrl)
				.onChange(async (value) => {
					this.plugin.settings.icsUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Template Path')
			.setDesc('Path to meeting note template (without .md extension)')
			.addText(text => text
				.setPlaceholder('Templates/Meeting')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Notes Folder')
			.setDesc('Folder where meeting notes will be created')
			.addText(text => text
				.setPlaceholder('Notes')
				.setValue(this.plugin.settings.notesFolder)
				.onChange(async (value) => {
					this.plugin.settings.notesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(contentEl)
			.setName('Trim Teams Links')
			.setDesc('Remove Microsoft Teams footer from meeting descriptions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trimTeamsLinks)
				.onChange(async (value) => {
					this.plugin.settings.trimTeamsLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Close')
				.setCta()
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class MeetingNotesSettingTab extends PluginSettingTab {
	plugin: MeetingNotesPlugin;

	constructor(app: App, plugin: MeetingNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Calendar Settings' });

		new Setting(containerEl)
			.setName('ICS Calendar URL')
			.setDesc('Enter the URL to your ICS calendar file')
			.addText(text => text
				.setPlaceholder('https://example.com/calendar.ics')
				.setValue(this.plugin.settings.icsUrl)
				.onChange(async (value) => {
					this.plugin.settings.icsUrl = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', { text: 'Note Creation Settings' });

		new Setting(containerEl)
			.setName('Template Path')
			.setDesc('Path to meeting note template (without .md extension)')
			.addText(text => text
				.setPlaceholder('Templates/Meeting')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Notes Folder')
			.setDesc('Folder where meeting notes will be created')
			.addText(text => text
				.setPlaceholder('Notes')
				.setValue(this.plugin.settings.notesFolder)
				.onChange(async (value) => {
					this.plugin.settings.notesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Trim Teams Links')
			.setDesc('Remove Microsoft Teams footer from meeting descriptions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trimTeamsLinks)
				.onChange(async (value) => {
					this.plugin.settings.trimTeamsLinks = value;
					await this.plugin.saveSettings();
				}));
	}
}
