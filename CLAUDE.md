# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mapdex is a full-stack spatial data platform for building, managing, and exploring custom map-based projects such as places, infrastructure, services, routes, environmental features, community assets, events, neighbourhoods, presence data, and motion data.

Mapdex is not hardcoded around one dataset type. Projects define their own schemas, and the application renders forms, filters, displays, map behavior, and related functionality from those schemas and the active engine.

Stack:

* React 19 + Vite — client
* Express 5 — server
* MongoDB Node.js driver — database access, no ORM
* Leaflet and Mapbox GL — maps
* Vercel — frontend deployment
* Render — backend deployment
* MongoDB — persistent application data
* Azure Speech and Translator — supporting voice/translation services
* AWS S3 — file/media storage
* Resend — email

## Commands

```bash
npm run dev          # runs client (Vite) + server (nodemon) concurrently
npm run start-server # server only (nodemon server/server.js)
npm run start-client # client only (Vite)
npm run build        # Vite production build
npm run lint         # ESLint
npm run preview      # Vite preview
```

There is currently no test suite or test runner configured in this repository. There is no `test` script and no Jest/Vitest dependency. Do not assume a test framework exists.

The client development server proxies `/api` to `http://localhost:3000` through `vite.config.js`.

The server listens on `PORT`, defaulting to port 3000.

Both client and server use environment configuration. Server environment variable names include:

* `MONGO_URI`
* `DB_NAME`
* `JWT_SECRET`
* `JWT_EXPIRES_IN`
* `FRONTEND_URL`
* Azure Speech/Translator configuration
* `RESEND_API_KEY`

Client-exposed environment variables use the `VITE_` prefix, for example `VITE_MAPBOX_ACCESS_TOKEN`.

Never inspect, print, copy, or expose secret environment variable values unless explicitly required for a task. Environment variable names may be inspected when necessary.

## Architecture

### `shared/` is isomorphic

`shared/` contains code imported by both `src/` and `server/`.

In particular:

* `shared/validation/*`
* `shared/auth/auth.js`

contain shared validation logic, schema constants, authentication-related constants, geometry validation, data validation, and extension content validation.

When changing shared validation, inspect both client and server consumers.

The client may use shared validation for feedback and form behavior, but the server must independently validate incoming data and must never trust client-side validation alone.

### Engine registry: one system with pluggable data types

The core abstraction is an **engine**: a module describing the behavior and capabilities of a particular kind of spatial data.

Current engines include:

* places
* events
* neighbourhoods
* presence
* motion

Engines are registered in:

`src/engines/index.js`

Each engine lives under:

`src/engines/<engine>/`

An existing engine such as `src/engines/places/` can be used as a structural reference.

Engine definitions may include:

* `defaultSchema` — default fields and sections for the engine
* `AppAdapter` — integration with the application shell
* `PagesAdapter` — engine-specific page behavior
* `MapAdapter` — engine-specific map behavior
* `extensionModals` — supported optional extensions and their modal components
* `schemaRules` — restrictions and capabilities used by the Schema Builder
* `geometry` — supported spatial geometry behavior
* `time` — engine-specific time semantics

Server-side engine behavior is implemented through corresponding routes such as:

`server/routes/<engine>.js`

and engine-aware utilities under:

`server/utils/`

When adding or substantially extending an engine, inspect all potentially relevant layers before deciding what needs modification. These may include:

* engine definition
* default schema
* runtime
* forms
* filters
* display rendering
* validation
* server routes
* MongoDB operations
* map adapters
* extensions

Use an existing engine as a structural reference, but do not assume every engine change requires modifying every one of these layers.

### Runtime hooks compose shared and engine-specific state

`src/runtime/index.js` contains `useAllRuntime`, which composes shared application runtime state with engine-specific runtime hooks.

`GlobalRuntime` contains shared state and behavior such as:

* schema
* data
* active layer
* filters
* user location
* location tracking

Engine-specific runtime hooks include:

* `PlacesRuntime`
* `EventRuntime`
* `NeighbourhoodsRuntime`
* `PresenceRuntime`
* `MotionRuntime`

Each engine runtime receives the portions of shared state it needs.

This runtime composition is an important boundary between the generic Mapdex application shell and engine-specific behavior.

Before moving state or introducing new global state, inspect whether the behavior belongs in `GlobalRuntime`, an engine runtime, or a lower-level component/helper.

### Schema-driven forms, filters, and display

Project fields are primarily schema-driven rather than hardcoded into individual project types.

Schemas are built and edited through the workspace schema system under:

`src/workspace/schema/`

including the Schema Builder and its field, section, and extension configurators.

The same schema is consumed through several parallel rendering pipelines.

#### Forms

`src/forms/renderAddEditFormPage.jsx`

and:

`src/forms/inputs/`

build add/edit interfaces from the schema.

#### Filters

`src/filters/renderFiltersBySchema.jsx`

and:

`src/filters/inputs/`

build filter controls from the schema.

#### Display

`src/display/renderInfoPanelBySchema.jsx`

and:

`src/display/inputs/`

build read-only information displays from the schema.

These systems have parallel concerns such as:

* geometry
* time
* user data
* conditional sections
* extensions

When introducing or changing a schema field, input type, or schema-driven behavior, inspect all relevant pipelines rather than changing only the first renderer encountered.

Depending on the feature, a change may require corresponding work in:

* form rendering
* form value conversion
* filters
* display rendering
* Schema Builder
* shared validation
* engine rules
* server validation
* MongoDB data handling

Only modify the layers actually required by the feature.

### Map layer: Leaflet and Mapbox, each behind a persistent shell

Mapdex has two map implementations - `src/map/leaflet/` (the original, more mature implementation) and `src/map/mapbox/` (a newer parallel implementation, gated behind `user.mapPlan === "Mapbox"`). Do not assume feature parity between them; inspect the **current implementation** of both where relevant, since the current repository state is the primary source of truth (git history is useful for intent, but old commits aren't more authoritative than current code).

Ownership is inverted from a typical "component creates its own map instance" pattern. Each engine's `src/engines/<engine>/MapAdapter.jsx` does **not** create a map - it computes that engine's map data (filtering, editor-role restrictions, etc.) and exports `{ LeafletMapContent, MapboxMapContent }` (plain components, not JSX), each rendering a shared content component from `src/map/leaflet/content/` or `src/map/mapbox/content/` with that data. Places and events share one `GeometryMapContent` pair per renderer.

Two shells, rendered once by `src/map/MapShellHost.jsx` (itself rendered once by `MainApp.jsx`), each own a single map instance for the life of the session:

* `src/map/leaflet/LeafletMapShell.jsx` owns the persistent `<MapContainer>` (no `key` prop forcing a remount on style change - `<TileLayer>` just updates its `url` in place) plus the shared controllers (`MapActionController`, a view tracker - `MapViewTracker` by default, overridable per engine via `ViewTrackerComponent` on that engine's `MapAdapter.jsx`, since Presence's doesn't pause syncing during `trackLocation` the way the others do - and `ZoomController`).
* `src/map/mapbox/MapboxMapShell.jsx` owns the persistent `mapboxgl.Map` via `useMapboxMap.js`, plus its own `MapViewTracker`/`MapActionController`/`VisibilityController` - real components, mirroring Leaflet's own, not hooks. Tile style changes call `setStyle()` on the existing instance rather than recreating it (a `new mapboxgl.Map()` construction is a billable "map load"). Every Mapbox layer file only calls `addSource`/`addLayer`, relying on the map's own `"style.load"` event (not React state) to know when to re-add sources/layers after a style change, and a matching `removeXLayers` function (called on unmount) to avoid leaking a previous engine's sources/layers into the persistent instance.

`MapShellHost` renders both shells always (Mapbox's shell only exists at all if `mapPlan === "Mapbox"`, so a non-Mapbox-plan user never pays its setup cost); the inactive one is hidden via the `hidden` attribute (not unmounted), which also removes it from the accessibility tree for free. Switching engines, projects, or the Leaflet/Mapbox toggle never recreates either map instance - only the active engine's content mounts and unmounts on top of whichever shell is current. The shell-level controllers (`VisibilityController`/`MapActionController`/the view tracker/`ZoomController`, in both `LeafletMapShell.jsx` and `MapboxMapShell.jsx`) are the one exception to "always mounted": each shell only renders its own copy while it's actually the visible one, so a `mapAction` (`fitToData`, pan, etc.) is only ever processed - and `mapCenter`/`mapZoom` only ever written - by whichever shell the user can currently see, never computed against the other, hidden shell's own stale or zero-sized container. `VisibilityController`'s own mount (not a `hidden`-transition comparison) is what signals "just became visible," and it resyncs the now-current shell to whatever `mapCenter`/`mapZoom` the other one left behind.

Two small React contexts avoid prop-drilling the instance through the host: `src/map/mapbox/context/MapboxMapContext.jsx` exposes the shared `mapboxgl.Map`, and `src/map/leaflet/context/LeafletDataRefsContext.jsx` exposes the shared "item id -> leaflet layer" ref map read by `MapActionController`. Leaflet's own layers don't need an instance context - they're react-leaflet's declarative `<Marker>`/`<Polygon>`/`<Polyline>` components, which get the map via react-leaflet's own internal context (`useMap()`).

Shared map tooling also exists outside the Leaflet/Mapbox-specific folders, including:

* `src/map/tools/`
* `src/map/utils/draftGeometry.js`
* `src/map/popup/` (shared popup positioning, used by both engines' own popup components)

Inspect shared map utilities before implementing duplicate behavior separately in Leaflet or Mapbox. See project memory (`persistent-map-shell-architecture.md`, `per-engine-tile-style-catalogs.md`) for the detailed history and reasoning behind this shape, including a since-reverted attempt to remove Leaflet entirely.

### Authentication

Authentication uses a JWT stored in an HTTP-only cookie.

`server/middleware/requireAuth.js`

verifies the token and sets values such as:

* `req.userId`
* `req.userName`

Do not assume the username stored in an existing JWT is always the current authoritative username.

Where authorization, ownership, permissions, or current display identity depends on the user's present username, retrieve the current user record from the database when appropriate.

Username comparisons should generally be case-insensitive while preserving original casing for display.

Relevant authentication code includes:

* `server/routes/auth.js`
* `server/routes/accounts.js`
* `src/auth/`
* `ProtectedRoute`
* `PublicOnlyRoute`

For authorization decisions, prefer stable identifiers such as user IDs where the existing architecture supports them.

Never weaken server-side authorization because equivalent restrictions exist in the client.

### Extensions

Optional project/engine extensions live under:

`src/extensions/`

Current extensions include:

* Gallery
* Guestbook
* Bulletin
* Chat

Extensions are configured through the schema system and Schema Builder extension configurators.

Extension content is validated server-side using shared validation such as:

`shared/validation/*ContentValidation.js`

Not every engine supports every extension.

Before adding extension behavior to an engine, inspect that engine's `extensionModals`, extension configuration, schema rules, validation, and relevant server support.

## Working rules

### Understand before changing

Mapdex is an existing application with established architecture.

Before modifying an unfamiliar system:

1. Inspect the relevant implementation.
2. Search for existing related components, hooks, helpers, validators, API functions, routes, and utilities.
3. Trace the relevant data flow.
4. Determine the smallest coherent change that accomplishes the task.
5. Preserve existing behavior outside the requested change.

Do not assume a system does not exist merely because it has not yet been encountered.

### Prefer targeted changes

Prefer focused changes over broad rewrites.

Do not perform unrelated:

* cleanup
* renaming
* folder restructuring
* dependency replacement
* architectural rewrites
* formatting sweeps
* abstraction changes

unless explicitly requested or genuinely required to complete the task.

If a larger architectural change appears necessary, explain why before making it.

### Reuse existing architecture

Reuse and extend existing Mapdex patterns where appropriate rather than creating parallel implementations.

Before creating a new:

* component
* hook
* API helper
* validation helper
* schema abstraction
* map utility
* runtime system
* data structure

search for an existing implementation that can reasonably be extended.

Do not force reuse when the existing abstraction is genuinely inappropriate, but explain the reason before introducing a parallel system.

### Fix causes, not symptoms

For bugs, identify the underlying cause whenever practical.

Do not hide a state, validation, rendering, or data-flow problem with superficial guards if the actual issue can be fixed safely.

When behavior involves several transformations, trace the values through those transformations before changing them.

### Trace cross-layer changes

For changes that cross application layers, trace the complete flow where relevant:

React state/components
→ forms/input conversion
→ API helpers
→ Express routes
→ shared validation
→ MongoDB operations
→ returned data
→ display/rendering

Do not assume a requested feature is frontend-only or backend-only without checking.

Schema-driven behavior may additionally involve:

* Schema Builder configuration
* engine definitions
* engine runtimes
* form renderers
* filter renderers
* display renderers
* validation
* map adapters
* server routes
* database migration or compatibility concerns

Modify only the layers actually required.

### MongoDB MCP

A project-specific MongoDB MCP server is available and may be used to inspect the real Mapdex database rather than guessing collection structure or data shape.

Normal database reads are allowed when useful for development and investigation.

Task-specific development writes are allowed when they are clearly necessary to perform the requested task.

Before modifying unfamiliar database structures, inspect the relevant collections and corresponding server code.

Do not perform broad or destructive database operations unless explicitly instructed.

Without explicit instruction, never:

* drop a database
* drop a collection
* mass-delete documents
* broadly overwrite collections
* rename collections
* modify database users
* modify database permissions
* alter Atlas infrastructure
* change indexes with significant production impact
* perform destructive migrations

Prefer narrow, reversible changes.

### Secrets

Never place secrets in:

* source files
* `CLAUDE.md`
* documentation
* Git commits
* generated examples
* responses

Secrets include:

* passwords
* MongoDB connection strings
* API keys
* access tokens
* JWT secrets
* service credentials

Do not print secret environment variable values merely for debugging.

Use configured environment variables and private tool configuration instead.

### Git

This repository intentionally works directly on the `main` branch.

Do not create Git branches unless explicitly requested.

Editing, creating, and deleting project files as part of an explicitly requested coding task is allowed.

Do not perform Git history or publishing actions unless explicitly instructed.

This includes:

* `git commit`
* `git push`
* `git pull`
* merges
* rebases
* resets
* force pushes
* branch creation/deletion
* history rewriting
* tag creation

Git commands that only inspect state or history, such as `git status`, `git diff`, `git log`, and `git show`, may be used when useful.

### Deployment and infrastructure

Do not automatically deploy changes.

Do not modify:

* Vercel configuration
* Render configuration
* MongoDB Atlas infrastructure
* DNS
* production environment variables
* external service credentials
* production infrastructure

unless explicitly requested.

Repository deployment-related files may be inspected when necessary to understand the application.

### Communication for substantial tasks

For substantial or architectural tasks:

1. Inspect the relevant implementation first.
2. Briefly explain what was found.
3. Identify the important files or systems involved.
4. State the intended approach.
5. Then make the requested changes.

For small, obvious edits, unnecessary planning is not required.

If the requested design conflicts with the existing architecture, explain the conflict and its consequences rather than silently replacing the existing design.

### Project memory

Use Claude Code auto memory to preserve durable Mapdex knowledge across sessions.

Record information that will materially help future development sessions, including:

* architectural decisions and the reasons behind them
* important implementation discoveries that are not obvious from the code
* underlying causes of significant bugs and how they were resolved
* incomplete migrations or systems currently under development
* conventions or constraints established during development
* relationships between subsystems that took meaningful investigation to understand
* decisions explicitly made by the user about how Mapdex should behave
* important rejected approaches when knowing why they were rejected will prevent repeating work

Do not fill memory with routine edits, temporary debugging output, transient task status, or information that can be trivially rediscovered from the current code.

Never store secrets, passwords, API keys, tokens, connection strings, or other credentials in project memory.

When beginning work on an area of Mapdex, consult relevant existing project memory when it may contain prior decisions or discoveries about that system.

### Verification

After making code changes, perform appropriate available verification when practical.

Depending on the change, this may include:

* `npm run lint`
* `npm run build`
* inspecting relevant diffs
* targeted manual reasoning through affected code paths

There is currently no automated test framework, so do not invent or claim automated test coverage that does not exist.

Do not modify unrelated code solely to make existing unrelated lint or build errors disappear.

## Priority

Preserve working Mapdex functionality while evolving the application incrementally.

Understand the current architecture first, make the smallest coherent change that satisfies the task, and avoid unnecessary disruption to existing systems.
