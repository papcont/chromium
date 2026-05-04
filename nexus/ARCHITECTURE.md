# Nexus — Technical Architecture

## Layer Model

```
Layer 4  │  Mobile Companion (Sceneform Android)
Layer 3  │  Web Applications (CADAM · Pascal Editor · PLM Extensions · Asset Guardian)
Layer 2  │  Native Browser Services (AI · PLM Protocol · File System · Local DB)
Layer 1  │  Chromium Engine (C++ · WebGPU · WASM · Blink · V8)
```

---

## Layer 1: Chromium Engine Customizations

### WebGPU Engineering Profile

Chromium's WebGPU implementation will be tuned for engineering 3D workloads:

- Increased default buffer sizes for large mesh geometry (Pascal Editor scenes)
- WASM memory limit raised for OpenSCAD compilation (CADAM needs ~512MB for complex models)
- Hardware-accelerated CSG operations where GPU supports compute shaders

**Affected Chromium directories:**
- `gpu/config/` — GPU feature list overrides
- `content/browser/gpu/` — GPU process configuration
- `third_party/dawn/` — WebGPU implementation (Dawn)

### Custom URL Scheme: `plm://`

A native protocol handler maps `plm://` URLs to PLM workspace items:

```
plm://workspace/{workspaceId}/item/{itemId}        → Opens item detail
plm://bom/{itemId}                                 → Opens BOM editor
plm://change/{changeOrderId}                       → Opens change management
plm://dashboard                                   → PLM dashboard
```

**Implementation:** `//chrome/browser/custom_handlers/plm_protocol_handler.cc`

### Embedded PLM Service Worker

The `plm-extensions` Node.js server is embedded as a browser-managed background service — no separate `npm start` required:

- Browser spawns the service on first PLM interaction
- Service lifecycle managed by browser (start/stop/restart)
- Communicates via `chrome.runtime` IPC (no TCP port exposure)

**Replaces:** `plm-extensions/app.js` external server

---

## Layer 2: Native Browser Services

### AI Service (Asset Guardian + CADAM)

Unified AI service broker exposed to all web apps via a controlled internal API:

```
window.nexus.ai.generate({
  provider: 'gemini' | 'claude',
  model: 'gemini-2.0-flash' | 'claude-opus-4-7',
  prompt: string,
  context?: 'plm' | 'cad' | 'general'
}): Promise<AIResponse>
```

- API keys stored in browser credential store (not `.env` files)
- Provider routing based on task context
- Shared across CADAM, Asset Guardian, and any future apps

### PLM Native Side Panel

Replaces the `plm-extensions` Chrome extension content scripts with a native browser side panel:

```
window.nexus.plm.openPanel(workspaceId?: string): void
window.nexus.plm.getItem(itemId: string): Promise<PLMItem>
window.nexus.plm.updateItem(itemId: string, data: Partial<PLMItem>): Promise<void>
```

- No `host_permissions` required — native browser has full access
- Injected into any `*.autodeskplm360.net` tab automatically
- Also available as standalone side panel in Nexus shell

### Local Database (Supabase Embedded)

A lightweight local Supabase-compatible layer for offline operation:

- SQLite backend via WASM for browser-local storage
- Supabase Realtime sync when online
- Both CADAM and Pascal Editor share the same local DB instance
- Schema managed via unified migration runner

---

## Layer 3: Web Applications

### CADAM — Text-to-CAD

**Current:** Standalone Vite + React app, own Supabase backend, Anthropic API key in env

**In Nexus:**
- Packaged as PWA, installed on first launch
- Uses `window.nexus.ai` for Claude API (no `.env` needed)
- OpenSCAD WASM benefits from raised Chromium memory limits
- 3D preview uses shared Three.js / WebGPU context with Pascal Editor

**Source:** `../cadam` (separate repo, referenced as git submodule)

### Pascal Editor — 3D Building Editor

**Current:** Next.js Turborepo monorepo, WebGPU renderer, Zustand scene state

**In Nexus:**
- `@pascal-app/viewer` package registered as browser-native 3D viewer
- Scene data persisted to Nexus local DB (not just IndexedDB per-tab)
- Tools can interop: CADAM-generated OpenSCAD models importable as Pascal nodes
- WebGPU renderer given priority GPU access via Nexus GPU profile

**Source:** `../editor` (separate repo, referenced as git submodule)

### PLM Extensions — Fusion Manage UX

**Current:** Node.js Express server + Chrome extension content scripts

**In Nexus:**
- Express server replaced by embedded browser service (Layer 2)
- Chrome extension replaced by native side panel
- All 15+ applications (BOM Editor, Portal, Variants Manager, etc.) served from embedded service
- `plm://` deep-links open the correct application directly

**Source:** `../plm-extensions` (separate repo, referenced as git submodule)

### Asset Guardian — AI PLM Monitor

**Current:** AI Studio app (Gemini API), Fusion Manage mapping file

**In Nexus:**
- Runs as a browser background service (persistent across tabs)
- Uses `window.nexus.ai` with Gemini provider
- Monitors PLM items, triggers alerts via browser Notifications API
- Deep-links into PLM Extensions panel on alert click

**Source:** `../asset-guardian-1` (separate repo, referenced as git submodule)

---

## Layer 4: Mobile Companion (Sceneform Android)

### WebXR Bridge

Sceneform Android exposes 3D models from CADAM and Pascal Editor via:

1. **Web Share Target** — CADAM exports `.glb` directly to Sceneform AR viewer
2. **PLM Deep Link** — `plm://` scheme handled on Android opens model in Sceneform AR
3. **Local Sync** — Nexus local DB syncs with Android SQLite via APS APIs

---

## Shared Infrastructure

### AI Agent Development Framework

The existing `agents/` directory in Chromium already provides:
- Shared prompts (`agents/prompts/`)
- MCP server configurations (`agents/extensions/`)
- Skills for Claude Code and Gemini CLI (`agents/skills/`, `.claude/skills/`)

Nexus extends this for engineering-domain AI tasks:
- `agents/prompts/plm/` — PLM workflow prompts
- `agents/prompts/cad/` — CAD generation prompts
- `agents/skills/cadam/` — CADAM-specific Claude Code skills

### Git Submodules

```
nexus/
├── apps/
│   ├── cadam          → git submodule: papcont/cadam
│   ├── editor         → git submodule: papcont/editor
│   ├── plm-extensions → git submodule: papcont/plm-extensions
│   └── asset-guardian → git submodule: papcont/asset-guardian-1
├── mobile/
│   └── sceneform      → git submodule: papcont/sceneform-android
├── src/               → Chromium C++ modifications
├── ARCHITECTURE.md    ← this file
├── ROADMAP.md
└── README.md
```

---

## Security Model

| Concern | Solution |
|---|---|
| API keys exposure | Browser credential store, never in `.env` files |
| PLM data in browser | Same-origin policy + native service isolation |
| Extension attack surface | No external extensions — native panels only |
| WASM sandboxing | Chromium WASM sandbox unchanged; OpenSCAD confined |
| Mobile sync | APS OAuth2 with browser-managed token refresh |
