/**
 * Nexus Content Script
 *
 * Injected into every page by the Nexus browser extension.
 * Exposes window.nexus.ai, window.nexus.plm, and window.nexus.fs
 * as a bridge to the background service worker.
 */

(function injectNexusAPI() {
  // Prevent double-injection
  if (window.nexus) return;

  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.ok === false) {
          reject(new Error(response.error ?? 'Nexus background error'));
        } else {
          resolve(response);
        }
      });
    });
  }

  function streamFromBackground(message) {
    return new ReadableStream({
      start(controller) {
        const port = chrome.runtime.connect({ name: 'nexus-stream' });
        port.postMessage(message);
        port.onMessage.addListener((msg) => {
          if (msg.type === 'chunk') controller.enqueue(msg.text);
          if (msg.type === 'done') { port.disconnect(); controller.close(); }
          if (msg.type === 'error') { port.disconnect(); controller.error(new Error(msg.error)); }
        });
      },
    });
  }

  window.nexus = Object.freeze({
    version: chrome.runtime.getManifest().version,

    ai: {
      /** Generate text using the best available local/cloud AI */
      generate: (req) =>
        sendToBackground({ type: 'NEXUS_AI_GENERATE', ...req }),

      /** Stream tokens — returns ReadableStream<string> */
      stream: (req) =>
        streamFromBackground({ type: 'NEXUS_AI_STREAM', ...req }),

      /** Get embeddings for semantic search */
      embed: (text) =>
        sendToBackground({ type: 'NEXUS_AI_EMBED', prompt: text, context: 'embed' }),

      /** Download engineering model to OPFS (shows progress) */
      downloadModel: (onProgress) => {
        const port = chrome.runtime.connect({ name: 'nexus-model-download' });
        port.postMessage({ type: 'NEXUS_AI_DOWNLOAD_MODEL' });
        port.onMessage.addListener((msg) => {
          if (msg.type === 'progress') onProgress?.(msg.progress);
          if (msg.type === 'done') port.disconnect();
        });
      },
    },

    plm: {
      openPanel: (workspaceId) =>
        sendToBackground({ type: 'PLM_OPEN_PANEL', workspaceId }),
      getItem: (itemId) =>
        sendToBackground({ type: 'PLM_GET_ITEM', itemId }),
      updateItem: (itemId, data) =>
        sendToBackground({ type: 'PLM_UPDATE_ITEM', itemId, data }),
      linkNode: (nodeId, plmItemId) =>
        sendToBackground({ type: 'PLM_LINK_NODE', nodeId, plmItemId }),
    },

    fs: {
      save: (data, suggestedName) =>
        sendToBackground({ type: 'FS_SAVE', suggestedName,
          data: data instanceof Blob ? data : new Blob([data]) }),
    },
  });

  // Notify apps that Nexus is available
  window.dispatchEvent(new CustomEvent('nexus:ready', {
    detail: { version: window.nexus.version }
  }));
})();
