// Nexus PLM Extension — Background Service Worker
// Manages PLM connection state, token refresh, and exposes
// the window.nexus.plm API to web app contexts.

import { PLMClient } from './plm-client.js';

let plmClient = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['plm_tenant', 'plm_client_id'], (config) => {
    if (config.plm_tenant && config.plm_client_id) {
      plmClient = new PLMClient(config.plm_tenant, config.plm_client_id);
    }
  });
});

// Handle messages from content scripts and web apps
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PLM_GET_ITEM':
      plmClient
        ?.getItem(message.itemId)
        .then((item) => sendResponse({ ok: true, item }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async response

    case 'PLM_UPDATE_ITEM':
      plmClient
        ?.updateItem(message.itemId, message.data)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'PLM_OPEN_PANEL':
      chrome.sidePanel.open({ windowId: sender.tab?.windowId });
      sendResponse({ ok: true });
      break;

    case 'PLM_PING':
      sendResponse({ ok: true, connected: !!plmClient });
      break;
  }
});

// Protocol handler: plm://workspace/123/item/456
chrome.webNavigation?.onBeforeNavigate?.addListener((details) => {
  if (details.url.startsWith('plm://')) {
    const url = new URL(details.url);
    const appUrl = `https://nexus-plm.local/${url.pathname}${url.search}`;
    chrome.tabs.update(details.tabId, { url: appUrl });
  }
});
