/**
 * Nexus Extension — Background Service Worker
 *
 * Handles all messages from content scripts (window.nexus.*).
 * Routes AI requests through the local provider chain.
 */

import { nexusGenerate, warmProviders, downloadEngineeringModel } from '../../ai/nexus-ai-service.js';
import { PLMClient } from './plm-client.js';

let plmClient = null;

// Pre-warm providers when the service worker starts
warmProviders().catch(console.warn);

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['plm_tenant', 'plm_client_id'], (config) => {
    if (config.plm_tenant) {
      plmClient = new PLMClient(config.plm_tenant, config.plm_client_id);
    }
  });
});

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    // AI: generate (non-streaming)
    case 'NEXUS_AI_GENERATE':
      nexusGenerate({
        prompt: message.prompt,
        context: message.context ?? 'general',
        systemPrompt: message.systemPrompt,
        image: message.image,
      })
        .then((res) => sendResponse({ ok: true, ...res }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    // AI: embeddings
    case 'NEXUS_AI_EMBED':
      nexusGenerate({ prompt: message.prompt, context: 'embed' })
        .then((res) => sendResponse({ ok: true, ...res }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    // PLM operations
    case 'PLM_GET_ITEM':
      plmClient?.getItem(message.itemId)
        .then((item) => sendResponse({ ok: true, item }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'PLM_UPDATE_ITEM':
      plmClient?.updateItem(message.itemId, message.data)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'PLM_OPEN_PANEL':
      chrome.sidePanel.open({}).catch(console.warn);
      sendResponse({ ok: true });
      break;

    case 'PLM_PING':
      sendResponse({ ok: true, connected: !!plmClient });
      break;
  }
});

// ─── Streaming via long-lived port ───────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'nexus-stream') {
    port.onMessage.addListener(async (message) => {
      try {
        // Streaming: send chunks as they arrive
        // Built-in AI and WebLLM both support streaming
        const { nexusStream } = await import('../../ai/nexus-ai-service.js');
        const stream = nexusStream(message);
        for await (const chunk of stream) {
          port.postMessage({ type: 'chunk', text: chunk });
        }
        port.postMessage({ type: 'done' });
      } catch (err) {
        port.postMessage({ type: 'error', error: err.message });
      }
    });
  }

  if (port.name === 'nexus-model-download') {
    port.onMessage.addListener(async (message) => {
      if (message.type === 'NEXUS_AI_DOWNLOAD_MODEL') {
        await downloadEngineeringModel((progress) => {
          port.postMessage({ type: 'progress', progress });
        });
        port.postMessage({ type: 'done' });
      }
    });
  }
});

// ─── plm:// protocol handler ──────────────────────────────────────────────────

chrome.webNavigation?.onBeforeNavigate?.addListener((details) => {
  if (details.url.startsWith('plm://')) {
    const url = new URL(details.url);
    // Redirect to the PLM Extensions web app running in the embedded service
    const appUrl = `nexus://app/plm-portal${url.pathname}${url.search}`;
    chrome.tabs.update(details.tabId, { url: appUrl });
  }
});
