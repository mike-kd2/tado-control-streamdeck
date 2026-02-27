# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tado Control — an Elgato Stream Deck plugin for controlling Tado V2/V3 smart heating systems. Rewrite of [aperezm85/streamdeck-tado-v2-plugin](https://github.com/aperezm85/streamdeck-tado-v2-plugin) using Stream Deck SDK v2, TypeScript strict mode, and a centralized polling architecture.

**Plugin UUID:** `dev.klauserdesignscoaching.tado-control`

## Commands

```bash
npm run build          # Rollup: src/plugin.ts → sdPlugin/bin/plugin.js
npm run watch          # Build + auto-restart plugin on Stream Deck
npm run lint:check     # Prettier check
npm run lint:fix       # Prettier auto-fix
npm test               # vitest run
npm run test:watch     # vitest watch mode
npm run test:coverage  # vitest with v8 coverage
```

## Architecture

### Core Singletons

- **TadoManager** (`src/tado-manager.ts`) — Auth singleton wrapping `node-tado-client`. Idempotent `ensureAuthenticated()` prevents duplicate browser auth popups. Stores refresh token in Stream Deck global settings.
- **PollingService** (`src/polling-service.ts`) — Visibility-aware centralized polling. Actions register/unregister zones in `onWillAppear`/`onWillDisappear`. Uses `getZoneStates(homeId)` (1 API call per home, not per zone). Doubles poll interval when rate limit < 100 remaining.

### Entry Point

`src/plugin.ts` registers all 9 actions once at module load, calls `tadoManager.ensureAuthenticated()`, then `streamDeck.connect()`. Actions are registered once globally, never per-appearance.

### Actions (`src/actions/`)

9 actions total — 4 refactored originals (current-temperature, power, boost, off) + 5 new (zone-control, quick-preset, presence-status, humidity-display, schedule-status). Each uses `@action({ UUID })` decorator.

### Property Inspector UI (`sdPlugin/ui/`)

HTML-based settings panels using a Home → Zone dropdown cascade. `shared.js` provides EN/DE localization. PI ↔ Plugin communication via `sendToPropertyInspector`/`onSendToPlugin` events.

### Key Patterns

- Actions subscribe to PollingService via `onUpdate()`, keep unsubscribe ref, call it in `onWillDisappear` to prevent leaks
- Settings use string IDs — always `parseInt(homeId, 10)` before API calls
- Zone Control encoder: dial rotation debounced 300ms, immediate UI feedback
- Temperature range: 5–25°C / 41–77°F, utilities in `src/utils/temperature.ts`

## Build System

Rollup bundles to `dev.klauserdesignscoaching.tado-control.sdPlugin/bin/plugin.js`. Terser minification only in production (not watch). A custom plugin emits `bin/package.json` with `"type": "module"`.

## TypeScript Config

Extends `@tsconfig/node20`. Strict mode, ES2022 modules, bundler resolution, `experimentalDecorators` + `emitDecoratorMetadata` enabled.

## Formatting

Prettier: 120 char width, 2-space indent, double quotes, trailing commas. Config in `package.json`.

## Development Plan

See `PLAN.md` for the 9-phase plan (German). Track progress with checkboxes. Commit format: `phase X.Y: short description`. Run `/code-simplifier` before commits.

## SDK v2 Notes

- JSON types from `@elgato/utils`, not `@elgato/streamdeck`
- Logging uses string literals (`"DEBUG"`, `"INFO"`)
- `action.isDial()` / `action.isKey()` for controller type checks
- PI settings via `.action.getSettings()`
