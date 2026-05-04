# Nexus — Implementation Roadmap

## Phase 1: Foundation (Weeks 1–4)
*Goal: All apps running inside the browser, PLM extension baked in.*

### Milestones

- [ ] **Submodule setup** — Link cadam, editor, plm-extensions, asset-guardian-1, sceneform-android as git submodules under `nexus/apps/` and `nexus/mobile/`
- [ ] **Nexus app launcher** — Custom New Tab page listing all engineering apps with icons and PLM status indicator
- [ ] **PLM Extension → built-in** — Embed `plm-extensions/chrome/` as a pre-installed, non-removable browser extension (Manifest V3, pinned to toolbar)
- [ ] **CADAM as PWA** — Add `manifest.json` and service worker to CADAM; register as installable app in Nexus
- [ ] **Pascal Editor as PWA** — Same treatment for the Pascal Editor Next.js app
- [ ] **Shared Chromium build flag** — `nexus_engineering_browser=true` GN arg that gates all Nexus customizations

### Deliverable
A locally buildable Chromium variant where opening `nexus://apps` shows all tools, and the PLM extension is always active.

---

## Phase 2: Native Integration (Weeks 5–10)
*Goal: Native side panel, plm:// protocol, shared AI service.*

### Milestones

- [ ] **`plm://` protocol handler** — C++ implementation in `chrome/browser/custom_handlers/`; maps plm:// URLs to PLM workspaces and items
- [ ] **Native PLM Side Panel** — Replace Chrome extension content scripts with a native side panel (`chrome/browser/ui/side_panel/plm/`); auto-activates on autodeskplm360.net tabs
- [ ] **Nexus AI Service** — `window.nexus.ai` API exposed via Blink extension; routes to Gemini or Claude based on context; API keys in browser credential store
- [ ] **Asset Guardian background service** — Port from AI Studio app to browser service worker; Notifications API integration for PLM alerts
- [ ] **CADAM → nexus.ai migration** — Remove Anthropic API key from CADAM `.env`; use `window.nexus.ai` instead
- [ ] **Raised WASM memory limit** — GN flag to increase WASM memory cap for OpenSCAD compilation

### Deliverable
Engineers can click a `plm://` link from CADAM to jump to a PLM item. Asset Guardian runs in the background without a separate terminal process.

---

## Phase 3: Unified Data Layer (Weeks 11–16)
*Goal: Shared offline-capable database; interop between CAD and building editor.*

### Milestones

- [ ] **Nexus local DB** — SQLite WASM instance shared across CADAM and Pascal Editor; Supabase-compatible API surface
- [ ] **CADAM → Pascal Editor import** — Export CADAM OpenSCAD model as `.glb`; import as a node in Pascal Editor scene
- [ ] **PLM ↔ CAD item linking** — Associate a Pascal Editor building node or CADAM model with a PLM workspace item; tracked in local DB
- [ ] **Offline mode** — All apps functional without network; sync queue for PLM writes
- [ ] **Shared design tokens** — Single Tailwind config and shadcn/ui theme across CADAM, Editor, and PLM Extensions web apps

### Deliverable
A building designed in Pascal Editor can have its components linked to PLM items, with CADAM-generated parametric parts embedded directly in the scene.

---

## Phase 4: Mobile & OS Shell (Weeks 17–24)
*Goal: Sceneform AR companion; kiosk/OS deployment mode.*

### Milestones

- [ ] **WebXR bridge** — CADAM and Pascal Editor export to `.glb`; Web Share Target opens model in Sceneform Android AR viewer
- [ ] **Android PLM deep links** — `plm://` URL scheme registered on Android; opens mobile PLM view
- [ ] **Nexus OS mode** — Chromium kiosk build (`--kiosk --nexus-os`) that boots directly to app launcher, manages app windows like a WM
- [ ] **Multi-window support** — CADAM and Pascal Editor open in separate browser windows with shared state via BroadcastChannel
- [ ] **Auto-update infrastructure** — Chromium component updater extended for Nexus app updates (CADAM, Editor, PLM) independent of full browser release
- [ ] **First-run setup wizard** — Tenant configuration, API key entry, PLM connection test — all in-browser

### Deliverable
Nexus can be deployed as a managed engineering workstation OS image. Mobile engineers use Sceneform to view AR overlays of designs created on the desktop.

---

## Dependency Graph

```
Phase 1: Submodules → App Launcher → PWAs → Build Flag
    ↓
Phase 2: Protocol Handler → Side Panel → AI Service → Asset Guardian
    ↓
Phase 3: Local DB → CAD Interop → PLM Linking → Offline Mode
    ↓
Phase 4: Mobile Bridge → OS Shell → Multi-window → Auto-update
```

---

## Out of Scope (for now)

- Replacing Blink/V8 with alternative engines
- Custom GPU drivers (we tune existing WebGPU, not replace it)
- iOS companion app (Sceneform is Android-only; WebXR on Safari is incomplete)
- Self-hosted AI model inference (cloud AI APIs via nexus.ai service)
