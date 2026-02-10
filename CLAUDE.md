# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IMPA Attendance is a desktop kiosk application for employee check-in/check-out tracking. Built with **Tauri 2** (Rust backend + React/TypeScript frontend) and **SQLite** for local data storage. The UI is in Spanish.

## Commands

```bash
# Development (frontend only, no Tauri shell)
npm run dev

# Development (full desktop app with hot reload)
npm run tauri dev

# Production build
npm run build              # TypeScript check + Vite bundle
npm run tauri build        # Native desktop binary

# Preview production frontend
npm run preview
```

No test runner or linter is currently configured. TypeScript strict mode (`tsconfig.json`) provides type checking via `tsc`.

## Architecture

**Frontend** (`src/`): React 19 + TypeScript, bundled with Vite (port 1420).
- `App.tsx` — Root component. Switches between kiosk and admin modes. F12 opens admin (password-protected), ESC returns to kiosk.
- `components/KioskView.tsx` — Main kiosk UI. Employee ID input with check-in (ENTRADA) / check-out (SALIDA) buttons. Calls Rust backend via `invoke()`.
- `components/AdminPanel.tsx` — Admin panel (referenced in App.tsx but may not exist yet).

**Backend** (`src-tauri/`): Rust with Tauri 2.
- `src/main.rs` — Application entry point. Sets up SQLite connection (`attendance.db`), creates the `attendance` table, and exposes three Tauri commands:
  - `check_in(employee_id, employee_name)` — Inserts an `entry` record
  - `check_out(employee_id)` — Inserts an `exit` record
  - `get_records()` — Placeholder, returns empty vec
- Database state is shared via `Mutex<Connection>` in `AppState`, managed by Tauri.
- `src/lib.rs` — Library crate (template stub).

**IPC**: Frontend calls Rust functions through Tauri's `invoke()` bridge. Commands are registered in `main.rs` via `tauri::generate_handler!`.

**Database schema** (`attendance` table):
- `id` INTEGER PRIMARY KEY
- `employee_id` TEXT NOT NULL
- `employee_name` TEXT
- `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
- `type` TEXT CHECK('entry' | 'exit')

## Known Issues

- `rusqlite` is used in `main.rs` but missing from `Cargo.toml` dependencies
- `AdminPanel` component is imported in `App.tsx` but may not exist yet
- `get_records()` is a stub returning an empty vector
- Admin password is `'0824'` (stored in database `config` table)
