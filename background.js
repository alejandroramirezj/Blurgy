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

// Función para establecer los blurs por defecto
function setDefaultBlurSelectors() {
  // Comenzar con un objeto vacío
  const defaultBlurSelectors = {};
  
  // Configuración inicial para que la extensión esté DESACTIVADA por defecto
  try {
    chrome.storage.local.set({ 
      blurSelectors: defaultBlurSelectors, 
      editMode: false,
      extensionActive: false, // Cambiado a false para que arranque desactivada
      deleteMode: false // Añadimos el modo de borrado, por defecto desactivado
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error al establecer configuración inicial:", chrome.runtime.lastError);
        return;
      }
      console.log("Configuración inicial establecida.");
    });
  } catch (error) {
    console.error("Error al establecer la configuración inicial:", error);
  }
  
  // Asegurarnos que predefined_blurs.js está cargado correctamente
  // Nota: esto se gestionará principalmente desde el popup
}

/** 
 * Llama a setIcon(isActive) con el valor actual de extensionActive,
 * a menos que se provea 'forceValue' (true|false).
 */
function syncIconWithState(forceValue) {
  try {
    if (typeof forceValue === "boolean") {
      setIcon(forceValue);
    } else {
      chrome.storage.local.get("extensionActive", data => {
        if (chrome.runtime.lastError) {
          console.error("Error al obtener extensionActive:", chrome.runtime.lastError);
          return;
        }
        const isActive = data.extensionActive ?? false; // Por defecto, desactivada
        setIcon(isActive);
      });
    }
  } catch (error) {
    console.error("Error en syncIconWithState:", error);
  }
}

/** 
 * Pone el ícono de la barra según el estado (activado o desactivado),
 * usando archivos distintos para cada tamaño (16, 48, 128).
 */
function setIcon(isActive) {
  try {
    const path16 = isActive ? "blur16.png" : "borrar16.png";
    const path48 = isActive ? "blur48.png" : "borrar48.png";
    const path128 = isActive ? "blur128.png" : "borrar128.png";

    chrome.action.setIcon({
      path: {
        "16": path16,
        "48": path48,
        "128": path128
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error al establecer icono:", chrome.runtime.lastError);
      }
    });
  } catch (error) {
    console.error("Error en setIcon:", error);
  }
}
