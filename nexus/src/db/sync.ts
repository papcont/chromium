/**
 * PLM Sync — flushes the offline write queue to Fusion Manage.
 * Runs as a background task in the Nexus extension service worker.
 * Triggered by: network-online events, periodic alarm, manual flush.
 */

import { NexusDB } from './nexus-db';

const SYNC_ALARM = 'nexus-plm-sync';

export async function startSyncScheduler(): Promise<void> {
  // Run sync every 5 minutes when online
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) flushSyncQueue();
  });
  // Also flush when coming back online
  self.addEventListener('online', () => flushSyncQueue());
}

export async function flushSyncQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const db = await NexusDB.open();
  const pending = db.getPendingSyncs(10);
  if (pending.length === 0) return;

  const { plmClientId, plmTenant } = await chrome.storage.local.get(['plmClientId', 'plmTenant']);
  if (!plmTenant) return;

  const token = await getAccessToken();
  if (!token) return;

  for (const entry of pending) {
    try {
      const data = JSON.parse(entry.data);
      await applyPLMWrite(entry.operation, entry.item_id, data, plmTenant, token);
      db.markSyncComplete(entry.id, entry.item_id);
    } catch (err) {
      db.markSyncFailed(entry.id, String(err));
    }
  }
}

async function applyPLMWrite(
  operation: string,
  itemId: string,
  data: unknown,
  tenant: string,
  token: string
): Promise<void> {
  const baseUrl = `https://${tenant}.autodeskplm360.net/api/v3`;
  if (operation === 'update') {
    await fetch(`${baseUrl}/workspaces/items/${itemId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  // extend for 'create', 'workflow' as needed
}

async function getAccessToken(): Promise<string | null> {
  const { apsToken, apsTokenExpiry } = await chrome.storage.session.get(
    ['apsToken', 'apsTokenExpiry']
  );
  if (apsToken && apsTokenExpiry > Date.now()) return apsToken;
  return null; // Caller should trigger re-auth flow
}
