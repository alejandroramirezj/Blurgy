// background.js

// Para compatibilidad con Manifest V3 y evitar errores de "You do not have a background page"
// Manejador de mensajes que responde inmediatamente a cualquier consulta
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Responder inmediatamente para evitar errores de comunicación
  if (message && message.action === "ping") {
    sendResponse({ success: true, source: "background", alive: true });
  } else {
    sendResponse({ success: true, source: "background" });
  }
  return true; // Mantener el canal abierto
});

// Al instalar/iniciar, sincronizamos el icono con el estado en storage y configuramos los blurs por defecto.
chrome.runtime.onInstalled.addListener(() => {
  try {
    syncIconWithState();
    setDefaultBlurSelectors();
  } catch (error) {
    console.error("Error durante la instalación:", error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  try {
    syncIconWithState();
  } catch (error) {
    console.error("Error durante el inicio:", error);
  }
});

// Si cambia extensionActive, refrescamos el icono
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.extensionActive) {
    try {
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

  // Para mensajes que requieren procesamiento asíncrono
  const handleAsyncMessage = async () => {
    try {
      switch (message.action) {
        case 'getActiveTab':
          const tab = await getActiveTab();
          return { success: true, tabId: tab.id, url: tab.url };

        case 'selectorAdded':
          // Validar que tenemos toda la información necesaria
          if (!message.domain || !message.selector || !message.type) {
            throw new Error('Faltan datos requeridos para selectorAdded');
          }
          console.log('Selector añadido:', {
            domain: message.domain,
            selector: message.selector,
            type: message.type
          });
          return { success: true };

        case 'updateExtensionState':
          if (!message.state) {
            throw new Error('Estado no proporcionado');
          }
          
          if (message.state.extensionActive) {
            const tab = await getActiveTab();
            if (tab && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com'))) {
              console.log('Activación manual requerida para ChatGPT');
            }
          }
          
          await chrome.storage.local.set({
            extensionActive: message.state.extensionActive,
            editMode: message.state.editMode,
            deleteMode: message.state.deleteMode
          });
          await syncIconWithState(message.state.extensionActive);
          return { success: true, state: message.state };

        case 'sendMessageToTab':
          if (!message.tabId || !message.data) {
            throw new Error('ID de pestaña o datos no proporcionados');
          }
          await sendMessageToTabSafely(message.tabId, message.data);
          return { success: true };

        default:
          if (message.target === 'background') {
            return { success: true, source: "background" };
          }
          throw new Error('Acción no reconocida: ' + message.action);
      }
    } catch (error) {
      console.error('Error en el service worker:', error);
      return { success: false, error: error.message };
    }
  };

  // Manejar la respuesta asíncrona
  handleAsyncMessage()
    .then(response => {
      try {
        sendResponse(response);
      } catch (error) {
        console.warn('Canal de mensajes cerrado:', error);
      }
    })
    .catch(error => {
      console.error('Error al manejar el mensaje asíncrono:', error);
      try {
        sendResponse({ success: false, error: error.message });
      } catch (sendError) {
        console.warn('Error al enviar respuesta de error:', sendError);
      }
    });

  return true; // Indicamos que la respuesta será asíncrona
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
      await setIcon(forceValue);
    } else {
      const data = await chrome.storage.local.get("extensionActive");
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
