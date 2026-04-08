# Editorial Wall Calendar

A production-grade React wall calendar that translates the feel of a modern printed calendar into an interactive, stateful interface. The build now runs as a plain React + Vite application, with a centered hanging-sheet layout inspired by the physical reference design.

## Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand with localStorage persistence

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173`.

Production checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Feature Overview

- Infinite month navigation with animated month transitions
- Keyboard navigation with arrow keys and `Escape`
- Click, hover, and drag range selection
- Jump-to-today and month/year jump controls
- Global monthly notes, per-day notes, and range notes
- Add, edit, delete, import, and export notes
- Visual note indicators directly on calendar cells
- Mock holiday and event markers with flat category colors
- Light/dark theme and accent color persistence
- Swipe navigation on touch devices
- Context menu shortcuts on dates
- Undo/redo history for note, range, and image changes

## Architecture

### App shell

- [`src/main.tsx`](/c:/Disk%20E/Projects/tufintern/src/main.tsx)
- [`src/App.tsx`](/c:/Disk%20E/Projects/tufintern/src/App.tsx)
- [`src/index.css`](/c:/Disk%20E/Projects/tufintern/src/index.css)

The Vite entrypoint mounts the React app directly. Global tokens, the paper-stage styling, and the wall-calendar presentation all live in the shared stylesheet and the calendar root component.

### State and logic

- [`src/store/use-calendar-store.ts`](/c:/Disk%20E/Projects/tufintern/src/store/use-calendar-store.ts)
- [`src/hooks/use-calendar.ts`](/c:/Disk%20E/Projects/tufintern/src/hooks/use-calendar.ts)
- [`src/hooks/use-date-range.ts`](/c:/Disk%20E/Projects/tufintern/src/hooks/use-date-range.ts)
- [`src/hooks/use-notes.ts`](/c:/Disk%20E/Projects/tufintern/src/hooks/use-notes.ts)
- [`src/hooks/use-theme.ts`](/c:/Disk%20E/Projects/tufintern/src/hooks/use-theme.ts)
- [`src/lib/date.ts`](/c:/Disk%20E/Projects/tufintern/src/lib/date.ts)

Zustand owns the persistent product state and interaction actions. The hooks layer exposes focused read models for the UI so components do not carry business rules inline. Date math, range normalization, hover preview logic, and event mapping all live outside the presentation layer.

### UI composition

- [`src/components/calendar/wall-calendar-app.tsx`](/c:/Disk%20E/Projects/tufintern/src/components/calendar/wall-calendar-app.tsx)
- [`src/components/calendar/calendar-grid.tsx`](/c:/Disk%20E/Projects/tufintern/src/components/calendar/calendar-grid.tsx)
- [`src/components/calendar/notes-panel.tsx`](/c:/Disk%20E/Projects/tufintern/src/components/calendar/notes-panel.tsx)
- [`src/components/calendar/context-menu.tsx`](/c:/Disk%20E/Projects/tufintern/src/components/calendar/context-menu.tsx)

The UI is split by responsibility: the hanging calendar surface, the interactive date grid, the notes system, and the command affordances. The main surface is intentionally art-directed to resemble a printed hanging calendar page rather than a dashboard.

## Interaction Notes

- Click a date to focus it or open its day notes.
- Ctrl/Cmd-click a date to start a range, then click another date to confirm the end.
- Drag upward from the lower half of the sheet to flip to the next month.
- Right-click a date to open quick actions.
- Use the notes panel to create month, range, or day notes.
- Swipe left or right on touch devices to change months.
- Import expects a JSON file shaped like the exported backup.

## Persistence Model

The following are persisted in localStorage:

- theme
- accent color
- selected view mode
- visible month / focused date
- saved ranges
- notes
- uploaded month image overrides

Undo/redo history is session-based and intentionally capped to keep storage predictable.
