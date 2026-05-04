# Repository Integration Guide

This document describes how each constituent repository is integrated into Nexus.

## Setup: Adding Submodules

```bash
# From the repository root
git submodule add https://github.com/papcont/cadam nexus/apps/cadam
git submodule add https://github.com/papcont/editor nexus/apps/editor
git submodule add https://github.com/papcont/plm-extensions nexus/apps/plm-extensions
git submodule add https://github.com/papcont/asset-guardian-1 nexus/apps/asset-guardian
git submodule add https://github.com/papcont/sceneform-android nexus/mobile/sceneform

git submodule update --init --recursive
```

## CADAM Integration

**Status:** Phase 1 (PWA packaging)

1. Add `nexus/apps/cadam/public/manifest.json` (PWA manifest)
2. Add `nexus/apps/cadam/public/sw.js` (service worker for offline support)
3. Register app in Nexus launcher: `nexus/src/launcher/apps.ts`
4. Phase 2: Replace `ANTHROPIC_API_KEY` usage with `window.nexus.ai`

**Build:**
```bash
cd nexus/apps/cadam && npm run build
# Output goes to nexus/out/apps/cadam/
```

## Pascal Editor Integration

**Status:** Phase 1 (PWA packaging)

1. Add PWA manifest to `nexus/apps/editor/apps/editor/public/`
2. Register `@pascal-app/viewer` as a shared Nexus 3D viewer package
3. Phase 3: Connect `useScene` store to Nexus local DB

**Build:**
```bash
cd nexus/apps/editor && bun run build
# Turborepo builds all packages
```

## PLM Extensions Integration

**Status:** Phase 1 (pre-installed extension) → Phase 2 (native side panel)

### Phase 1 — Pre-installed Extension

Copy `nexus/apps/plm-extensions/chrome/` to:
`chrome/browser/resources/nexus/plm_extension/`

Register in `chrome/browser/extensions/component_extensions_resource_manager.cc`

### Phase 2 — Native Side Panel

New C++ files:
```
chrome/browser/ui/side_panel/plm/
├── plm_side_panel_coordinator.h
├── plm_side_panel_coordinator.cc
└── plm_side_panel_ui.cc
```

## Asset Guardian Integration

**Status:** Phase 2 (background service)

1. Port `asset-guardian-1/server.ts` endpoints to a browser service worker
2. Use `window.nexus.ai` (Gemini provider) instead of direct API calls
3. Register persistent service worker in Nexus browser profile

## Sceneform Android Integration

**Status:** Phase 4 (WebXR bridge)

1. Add Web Share Target handler to Sceneform Android `AndroidManifest.xml`
2. Register `plm://` intent filter for Android deep links
3. CADAM adds "View in AR" export button (`.glb` → share sheet)

## Build System

Nexus customizations use a GN build argument:

```python
# nexus/BUILD.gn
declare_args() {
  nexus_engineering_browser = false
}

if (nexus_engineering_browser) {
  # Include all Nexus-specific targets
}
```

Build Nexus:
```bash
gn gen out/Nexus --args='nexus_engineering_browser=true is_debug=false'
autoninja -C out/Nexus chrome
```
