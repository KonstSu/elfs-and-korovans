# Repository Guidelines

## Project Structure & Module Organization

Browser 3D game «Эльфы и корованы». `index.html` loads classic scripts from `src/` in order (util → injuries → world → trees → fx → entities → combat → ai → director → player → ui → save → game); modules share the global `window.G`. `src/injuries.js` is pure logic usable from Node. `vendor/three.min.js` is Three.js r128 (MIT), vendored so the game runs offline from `file://`. Tests live in `tests/`.

## Build, Test, and Development Commands

No build step. Run by opening `index.html`, or `npm run serve` (http://localhost:8000). `npm test` runs `node --test tests/*.test.js`; `npm run check` syntax-checks every file in `src/`.

## Coding Style & Naming Conventions

No language or formatter is established. Follow the conventions of the chosen language and its standard formatter or linter, and check in that tool’s configuration so contributors get consistent results. Use descriptive names, keep modules focused, and match existing naming patterns once they are established.

## Testing Guidelines

Tests use the built-in `node:test` runner. Keep game rules that can be pure (like injuries) free of Three.js so they stay testable. Run relevant tests and format or lint checks before submitting changes.

## Commit & Pull Request Guidelines

Git history is not available in this workspace, so no commit-message convention can be inferred. Use short, imperative commit subjects (for example, `Add initial project structure`). Pull requests should explain the change and its motivation, list validation performed, and include screenshots for user-visible changes. Link related issues when applicable.

## Configuration & Generated Files

Keep credentials and machine-specific settings out of the repository. Provide safe example configuration when needed, and identify required environment variables in the project documentation. Do not commit build output, caches, or local secrets.
