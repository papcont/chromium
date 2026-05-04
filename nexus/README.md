# Nexus — Engineering Browser OS

> A Chromium-based platform that unifies 3D CAD, PLM, AI tooling, and AR into a single engineering operating system.

[![Built on Chromium](https://img.shields.io/badge/Built%20on-Chromium-4285F4?logo=googlechrome&logoColor=white)](https://chromium.googlesource.com/chromium/src)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](../LICENSE)

---

## What is Nexus?

Nexus is a custom Chromium-based browser built as an **engineering operating system** for industrial product development. Instead of installing multiple desktop tools, engineering teams get a single browser-native environment where every tool — CAD, PLM, 3D editing, AI assistance — runs as a first-class web application with native browser integration.

Think ChromeOS, but purpose-built for mechanical engineers, architects, and PLM administrators.

---

## Constituent Repositories

| Repository | Role in Nexus | Integration Level |
|---|---|---|
| **chromium** *(this repo)* | Browser engine & OS foundation | Native C++ |
| **cadam** | Text-to-CAD web app (OpenSCAD + AI) | PWA / Built-in App |
| **editor** (Pascal) | 3D building editor (WebGPU) | PWA / Built-in App |
| **plm-extensions** | Fusion Manage UX server + Chrome Extension | Native Browser Panel |
| **asset-guardian-1** | AI-powered PLM asset monitoring (Gemini) | Built-in AI Service |
| **sceneform-android** | Android AR companion for 3D model viewing | Mobile Client |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    NEXUS BROWSER / OS                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  APP LAUNCHER (New Tab)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │    CADAM     │  │Pascal Editor │  │    PLM Extensions     │  │
│  │ Text-to-CAD  │  │ 3D Building  │  │  Fusion Manage UX     │  │
│  │   (PWA)      │  │  Editor(PWA) │  │  (Native Side Panel)  │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              NATIVE BROWSER SERVICES LAYER               │   │
│  │  AI Assistant (Asset Guardian) · PLM Protocol Handler    │   │
│  │  plm:// URL Scheme · Local Supabase · File System API    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  CHROMIUM ENGINE (C++)                    │   │
│  │  WebGPU (CAD-optimized) · WASM Runtime (OpenSCAD)        │   │
│  │  AI Agents API · Blink · V8 · Net Stack                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                           ↕  WebXR / APS API
┌──────────────────────────────────────────────────────────────────┐
│               SCENEFORM ANDROID (Mobile Companion)               │
│              AR Viewer · Mobile PLM Access · 3D Preview          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

**1. Browser as the OS**  
No separate Electron wrapper. No web server required for tool access. The browser is the runtime, window manager, and security boundary.

**2. Native over Extension**  
The PLM integration is a native browser side-panel, not a content-script extension. This eliminates permission prompts, host-permission restrictions, and update friction.

**3. AI as Infrastructure**  
Asset Guardian's AI capabilities (Gemini) and CADAM's Claude integration are browser-level services — available to all apps via a shared internal API, not siloed per-app.

**4. Offline-First Engineering**  
Local Supabase instance + IndexedDB persistence. Teams work without cloud dependency; sync is additive.

**5. WebGPU Native**  
Pascal Editor's WebGPU renderer and CADAM's Three.js engine benefit from a browser tuned for engineering 3D workloads — no generic consumer graphics trade-offs.

---

## Quick Links

- [Architecture Deep-Dive](./ARCHITECTURE.md)
- [Implementation Roadmap](./ROADMAP.md)
- [Repository Integration Guide](./docs/integration.md)
- [Contributing](../CONTRIBUTING.md)
