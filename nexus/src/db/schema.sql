-- Nexus Local Database Schema
-- SQLite WASM with OPFS persistence
-- Shared across CADAM, Pascal Editor, PLM Extensions

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── PLM item cache ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plm_items (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT,
  attributes  TEXT, -- JSON
  embedding   BLOB, -- Float32Array (384 dims, all-MiniLM-L6-v2)
  synced_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  dirty       INTEGER NOT NULL DEFAULT 0 -- 1 = has local unsync'd changes
);

CREATE INDEX IF NOT EXISTS idx_plm_items_workspace ON plm_items(workspace);
CREATE INDEX IF NOT EXISTS idx_plm_items_dirty     ON plm_items(dirty) WHERE dirty = 1;

-- ── Node ↔ PLM item links ────────────────────────────────────────────────────
-- Links Pascal Editor nodes or CADAM models to PLM workspace items
CREATE TABLE IF NOT EXISTS node_plm_links (
  id          TEXT PRIMARY KEY,
  node_id     TEXT NOT NULL,
  node_type   TEXT NOT NULL, -- 'pascal:wall', 'pascal:slab', 'cadam:model', etc.
  app         TEXT NOT NULL, -- 'pascal-editor' | 'cadam'
  plm_item_id TEXT NOT NULL REFERENCES plm_items(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_links_node     ON node_plm_links(node_id);
CREATE INDEX IF NOT EXISTS idx_links_plm_item ON node_plm_links(plm_item_id);

-- ── CADAM models ─────────────────────────────────────────────────────────────
-- Stores generated CAD models locally for import into Pascal Editor
CREATE TABLE IF NOT EXISTS cadam_models (
  id           TEXT PRIMARY KEY,
  prompt       TEXT NOT NULL,
  openscad     TEXT NOT NULL, -- OpenSCAD source code
  glb_data     BLOB,          -- Compiled GLB (populated after export)
  stl_data     BLOB,          -- Intermediate STL (can be discarded after GLB)
  params       TEXT,          -- JSON: extracted parametric variables
  plm_item_id  TEXT REFERENCES plm_items(id),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  exported_at  INTEGER         -- Set when GLB is ready
);

CREATE INDEX IF NOT EXISTS idx_cadam_models_created ON cadam_models(created_at DESC);

-- ── PLM offline write queue ──────────────────────────────────────────────────
-- Writes buffered while offline; flushed when PLM API is reachable
CREATE TABLE IF NOT EXISTS plm_sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  operation   TEXT    NOT NULL, -- 'update' | 'create' | 'workflow'
  item_id     TEXT    NOT NULL,
  data        TEXT    NOT NULL, -- JSON payload
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT
);

-- ── App preferences ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Schema version ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO schema_version(version) VALUES (1);
