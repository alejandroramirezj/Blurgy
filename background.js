// background.js

// Para compatibilidad con Manifest V3 y evitar errores de "You do not have a background page"
// Manejador de mensajes que responde inmediatamente a cualquier consulta
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Responder inmediatamente para evitar errores de comunicación
  if (message && message.action === "ping") {
    console.log("Ping recibido, respondiendo inmediatamente");
    sendResponse({ success: true, source: "background", alive: true });
    return false; // No mantener canal abierto
  }
  
  // Para mensajes de actualización de estado del popup
  if (message && message.action === "updatePopupState") {
    // Actualizamos el estado en storage para mantener sincronización
    if (message.state) {
      console.log("Actualizando estado del popup:", message.state);
      chrome.storage.local.set(message.state)
        .then(() => {
          // Sincronizar el icono si cambió el estado de la extensión
          if (message.state.hasOwnProperty('extensionActive')) {
            syncIconWithState(message.state.extensionActive);
          }
          sendResponse({ success: true, source: "background", state: message.state });
        })
        .catch(error => {
          console.error("Error actualizando estado:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Mantener canal abierto para la respuesta asíncrona
    }
    
    // Simplemente confirmamos que recibimos el mensaje
    sendResponse({ success: true, source: "background" });
    return false;
  }
  
  // Para otros mensajes
  sendResponse({ success: true, source: "background" });
  return false; // No mantener canal abierto
});

// Al instalar/iniciar, sincronizamos el icono con el estado en storage y configuramos los blurs por defecto.
chrome.runtime.onInstalled.addListener(() => {
  try {
    console.log("Extensión instalada/actualizada");
    syncIconWithState();
    setDefaultBlurSelectors();
  } catch (error) {
    console.error("Error durante la instalación:", error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  try {
    console.log("Extensión iniciada");
    syncIconWithState();
  } catch (error) {
    console.error("Error durante el inicio:", error);
  }
});

// Si cambia extensionActive, refrescamos el icono
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.extensionActive) {
    try {
      console.log("Cambio detectado en extensionActive:", changes.extensionActive.newValue);
      syncIconWithState(changes.extensionActive.newValue);
    } catch (error) {
      console.error("Error al sincronizar icono:", error);
    }
  }
});

// Service Worker para la extensión Blurgy
let activeTabId = null;
let tabsCache = new Map();

// Función para verificar si una pestaña existe y es válida para mensajes
async function isTabValidForMessaging(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab && tab.url && !tab.url.startsWith('chrome:') && !tab.url.startsWith('chrome-extension:');
  } catch (error) {
    return false;
  }
}

// Función para enviar mensaje a una pestaña de forma segura
async function sendMessageToTabSafely(tabId, message) {
  try {
    if (!await isTabValidForMessaging(tabId)) {
      throw new Error(`Pestaña ${tabId} no válida para mensajes`);
    }
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error(`Error al enviar mensaje a pestaña ${tabId}:`, error);
    throw error;
  }
}

// Función para obtener la pestaña activa de forma segura
async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No se encontró pestaña activa');
    }
    return tab;
  } catch (error) {
    console.error('Error al obtener pestaña activa:', error);
    throw error;
  }
}

// Manejar la instalación del service worker
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Service Worker instalado correctamente');
  try {
    await chrome.storage.local.set({
      extensionActive: false,
      editMode: false,
      deleteMode: false,
      blurSelectors: {},
      deleteSelectors: {},
      autoActivate: false
    });
    await syncIconWithState(false);
    console.log('Configuración inicial establecida correctamente - Extensión desactivada por defecto');
  } catch (error) {
    console.error('Error durante la instalación:', error);
  }
});

// Mantener registro de la pestaña activa
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (await isTabValidForMessaging(activeInfo.tabId)) {
      activeTabId = activeInfo.tabId;
      tabsCache.set(activeTabId, tab);
      console.log('Nueva pestaña activa:', tab.url);
    }
  } catch (error) {
    console.error('Error al actualizar pestaña activa:', error);
    activeTabId = null;
  }
});

// Limpiar caché cuando se cierra una pestaña
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsCache.delete(tabId);
  if (activeTabId === tabId) {
    activeTabId = null;
  }
});

// Manejar mensajes desde el popup o content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Para mensajes de ping, responder inmediatamente
    if (message.action === "ping") {
      sendResponse({ 
        success: true, 
        source: "background", 
        alive: true,
        serviceWorkerActive: true 
      });
      return false;
    }

    // Para mensajes que requieren procesamiento inmediato
    switch (message.action) {
      case 'getActiveTab':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0) {
            sendResponse({ success: true, tabId: tabs[0].id, url: tabs[0].url });
          } else {
            sendResponse({ success: false, error: 'No se encontró pestaña activa' });
          }
        });
        return false; // No mantener canal abierto

      case 'selectorAdded':
        // Validar que tenemos toda la información necesaria
        if (!message.domain || !message.selector || !message.type) {
          sendResponse({ success: false, error: 'Faltan datos requeridos para selectorAdded' });
        } else {
          console.log('Selector añadido:', {
            domain: message.domain,
            selector: message.selector,
            type: message.type
          });
          sendResponse({ success: true });
        }
        return false;

      case 'updateExtensionState':
        if (!message.state) {
          sendResponse({ success: false, error: 'Estado no proporcionado' });
          return false;
        }
        
        chrome.storage.local.set({
          extensionActive: message.state.extensionActive,
          editMode: message.state.editMode,
          deleteMode: message.state.deleteMode
        }).then(() => {
          syncIconWithState(message.state.extensionActive);
          sendResponse({ success: true, state: message.state });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return false;

      case 'sendMessageToTab':
        if (!message.tabId || !message.data) {
          sendResponse({ success: false, error: 'ID de pestaña o datos no proporcionados' });
        } else {
          // Enviamos el mensaje sin esperar respuesta
          chrome.tabs.sendMessage(message.tabId, message.data).catch(() => {
            console.log('Error enviando mensaje a la pestaña, posiblemente no disponible');
          });
          sendResponse({ success: true });
        }
        return false;

      case 'updatePopupState':
        // Solo confirmamos recepción
        sendResponse({ success: true });
        return false;

      default:
        if (message.target === 'background') {
          sendResponse({ success: true, source: "background" });
        } else {
          sendResponse({ success: false, error: 'Acción no reconocida: ' + message.action });
        }
        return false;
    }
  } catch (error) {
    console.error('Error en el service worker:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// Manejar la actualización del service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clients.claim();
      console.log('Service Worker activado y reclamado');
      
      try {
        const tab = await getActiveTab();
        if (tab && await isTabValidForMessaging(tab.id)) {
          activeTabId = tab.id;
          tabsCache.set(activeTabId, tab);
        }
      } catch (error) {
        console.warn('No se pudo obtener la pestaña activa durante la activación:', error);
      }
    })()
  );
});

// Función para establecer los blurs por defecto
async function setDefaultBlurSelectors() {
  try {
    const defaultBlurSelectors = {};
    await chrome.storage.local.set({ 
      blurSelectors: defaultBlurSelectors, 
      editMode: false,
      extensionActive: false,
      deleteMode: false
    });
    console.log("Configuración inicial establecida.");
  } catch (error) {
    console.error("Error al establecer la configuración inicial:", error);
  }
}

/** 
 * Llama a setIcon(isActive) con el valor actual de extensionActive,
 * a menos que se provea 'forceValue' (true|false).
 */
async function syncIconWithState(forceValue) {
  try {
    if (typeof forceValue === "boolean") {
      console.log("Sincronizando icono con valor forzado:", forceValue);
      await setIcon(forceValue);
    } else {
      const data = await chrome.storage.local.get("extensionActive");
      console.log("Sincronizando icono con valor de storage:", data.extensionActive);
      await setIcon(data.extensionActive ?? false);
    }
  } catch (error) {
    console.error('Error al sincronizar el icono:', error);
    throw error;
  }
}

/** 
 * Pone el ícono de la barra según el estado (activado o desactivado).
 */
async function setIcon(isActive) {
  try {
    await chrome.action.setIcon({
      path: {
        "16": isActive ? "blur16.png" : "borrar16.png",
        "48": isActive ? "blur48.png" : "borrar48.png",
        "128": isActive ? "blur128.png" : "borrar128.png"
      }
    });
    console.log('Icono actualizado:', isActive ? 'activo' : 'inactivo');
  } catch (error) {
    console.error('Error al establecer el icono:', error);
    throw error;
  }
}
