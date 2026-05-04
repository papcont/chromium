/**
 * NexusDB — SQLite WASM with OPFS persistence
 *
 * Provides a simple async/await interface over @sqlite.org/sqlite-wasm.
 * Shared by CADAM, Pascal Editor, and PLM Extensions running inside Nexus.
 *
 * Outside Nexus (dev/standalone), falls back to an in-memory SQLite
 * instance so apps remain functional without OPFS.
 */

const DB_FILENAME = '/nexus/nexus.sqlite';

type Row = Record<string, unknown>;
type BindParams = (string | number | null | Uint8Array)[];

export class NexusDB {
  private static instance: NexusDB | null = null;
  private db: unknown = null;
  private sqlite3: unknown = null;

  private constructor() {}

  static async open(): Promise<NexusDB> {
    if (NexusDB.instance) return NexusDB.instance;
    const inst = new NexusDB();
    await inst.init();
    NexusDB.instance = inst;
    return inst;
  }

  private async init(): Promise<void> {
    // Dynamic import — only included in Nexus builds
    const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
    this.sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: console.warn });
    const sqlite3 = this.sqlite3 as any;

    // Use OPFS if available (Nexus browser), otherwise in-memory
    const hasOPFS = typeof StorageManager !== 'undefined' &&
      !!(await navigator.storage?.getDirectory?.().catch(() => null));

    if (hasOPFS && sqlite3.oo1?.OpfsDb) {
      this.db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
    } else {
      this.db = new sqlite3.oo1.DB(':memory:');
      console.warn('[NexusDB] OPFS not available — using in-memory DB (data will not persist)');
    }

    await this.applySchema();
  }

  private async applySchema(): Promise<void> {
    const schemaRes = await fetch('/nexus/db/schema.sql');
    const schema = await schemaRes.text();
    (this.db as any).exec(schema);
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  run(sql: string, params: BindParams = []): void {
    (this.db as any).exec({ sql, bind: params });
  }

  all<T extends Row = Row>(sql: string, params: BindParams = []): T[] {
    const rows: T[] = [];
    (this.db as any).exec({
      sql,
      bind: params,
      rowMode: 'object',
      callback: (row: T) => rows.push(row),
    });
    return rows;
  }

  get<T extends Row = Row>(sql: string, params: BindParams = []): T | null {
    return this.all<T>(sql, params)[0] ?? null;
  }

  // ── CADAM models ───────────────────────────────────────────────────────────

  saveCADAMModel(id: string, prompt: string, openscad: string, params?: Record<string, number>): void {
    this.run(
      `INSERT OR REPLACE INTO cadam_models (id, prompt, openscad, params)
       VALUES (?, ?, ?, ?)`,
      [id, prompt, openscad, params ? JSON.stringify(params) : null]
    );
  }

  saveCADAMModelGLB(id: string, glb: Uint8Array): void {
    this.run(
      `UPDATE cadam_models SET glb_data = ?, exported_at = unixepoch() WHERE id = ?`,
      [glb, id]
    );
  }

  getCADAMModel(id: string) {
    return this.get<{
      id: string; prompt: string; openscad: string;
      glb_data: Uint8Array | null; params: string | null;
    }>('SELECT * FROM cadam_models WHERE id = ?', [id]);
  }

  listCADAMModels(limit = 50) {
    return this.all<{ id: string; prompt: string; created_at: number; exported_at: number | null }>(
      'SELECT id, prompt, created_at, exported_at FROM cadam_models ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  // ── PLM items ──────────────────────────────────────────────────────────────

  upsertPLMItem(item: {
    id: string; workspace: string; title: string;
    description?: string; status?: string; attributes?: Record<string, string>;
  }): void {
    this.run(
      `INSERT OR REPLACE INTO plm_items (id, workspace, title, description, status, attributes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.workspace, item.title,
       item.description ?? null, item.status ?? null,
       item.attributes ? JSON.stringify(item.attributes) : null]
    );
  }

  linkNodeToPLM(nodeId: string, nodeType: string, app: string, plmItemId: string): void {
    const id = `${app}:${nodeId}:${plmItemId}`;
    this.run(
      `INSERT OR REPLACE INTO node_plm_links (id, node_id, node_type, app, plm_item_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, nodeId, nodeType, app, plmItemId]
    );
  }

  getLinksForNode(nodeId: string) {
    return this.all<{ plm_item_id: string; node_type: string }>(
      `SELECT npl.plm_item_id, npl.node_type, pi.title, pi.status
       FROM node_plm_links npl
       JOIN plm_items pi ON pi.id = npl.plm_item_id
       WHERE npl.node_id = ?`,
      [nodeId]
    );
  }

  // ── Sync queue ─────────────────────────────────────────────────────────────

  queuePLMWrite(operation: 'update' | 'create' | 'workflow', itemId: string, data: unknown): void {
    this.run(
      `INSERT INTO plm_sync_queue (operation, item_id, data) VALUES (?, ?, ?)`,
      [operation, itemId, JSON.stringify(data)]
    );
    // Mark item as dirty
    this.run(`UPDATE plm_items SET dirty = 1 WHERE id = ?`, [itemId]);
  }

  getPendingSyncs(limit = 10) {
    return this.all<{ id: number; operation: string; item_id: string; data: string }>(
      `SELECT * FROM plm_sync_queue WHERE attempts < 3 ORDER BY created_at LIMIT ?`,
      [limit]
    );
  }

  markSyncComplete(queueId: number, itemId: string): void {
    this.run(`DELETE FROM plm_sync_queue WHERE id = ?`, [queueId]);
    this.run(`UPDATE plm_items SET dirty = 0 WHERE id = ?`, [itemId]);
  }

  markSyncFailed(queueId: number, error: string): void {
    this.run(
      `UPDATE plm_sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
      [error, queueId]
    );
  }
}
