# Animated Wall Calendar

An interactive editorial-style wall calendar built with React, Vite, TypeScript, and Three.js. The project recreates the feel of a physical hanging calendar with a flip-based month transition, persistent notes, range selection, theme controls, and a responsive layout for desktop and mobile.

## Links

- Live Application: https://animcalendar.vercel.app/
- Source Code: https://github.com/hardikguptaofficialgit/animatedcalendar

## Why This Approach

- I chose `React + Vite + TypeScript` for a fast development loop, strong typing, and straightforward deployment.
- I used `Zustand` to keep calendar state, notes, ranges, theme preferences, and undo/redo logic centralized without adding heavy boilerplate.
- I used `Framer Motion` for UI transitions and overlays, while the actual page-flip feel is driven by `@react-three/fiber`, `three`, and a custom page mesh for a more tactile effect.
- I kept the UI intentionally art-directed instead of dashboard-like so the app feels closer to a real wall calendar product.

## Core Features

- Month navigation with animated flip interaction
- Mobile-friendly layout with bottom-docked month controls in button mode
- Day, month, and range-based notes
- Range selection with live preview
- Undo and redo support
- Keyboard shortcuts for fast navigation
- Swipe navigation on touch devices
- Light and dark mode with accent color customization
- Persistent state with local storage

## Project Structure

```text
src/
  components/calendar/
    wall-calendar-app.tsx
    RealisticPageMesh.tsx
    calendar-grid.tsx
    notes-panel.tsx
    context-menu.tsx
  hooks/
    use-calendar.ts
    use-theme.ts
    use-notes.ts
    use-date-range.ts
  store/
    use-calendar-store.ts
  lib/
    date.ts
  data/
    month-images.ts
```

## How To Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/hardikguptaofficialgit/animatedcalendar.git
cd animatedcalendar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open the local URL shown by Vite, typically:

```text
http://localhost:5173
```

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
```

## Build Notes

- `npm run build` creates the production build in `dist/`
- The project currently builds successfully
- Vite may still warn about a large bundle chunk because the app includes animation and 3D rendering dependencies

## Implementation Notes

- The hanging calendar surface and most visual composition live in `src/components/calendar/wall-calendar-app.tsx`
- The flip deformation is handled in `src/components/calendar/RealisticPageMesh.tsx`
- State persistence and calendar actions are managed through the Zustand store
- Date math and month-grid generation are isolated in utility functions to keep UI code simpler

## Submission Summary

This repository contains both:

- the public source code
- a brief explanation of implementation choices
- clear local setup instructions
- the live deployed application link
