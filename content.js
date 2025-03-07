// content.js

// Observador para re-aplicar blur en cambios dinámicos (AJAX, etc.)
let blurObserver = null;

// Indica si el modo edición (selección) está activo
let selectionMode = false;

// Indica si estamos en modo borrar
let deleteMode = false;

// Dominio actual de la página
const currentDomain = window.location.hostname;

/**
 * Inyecta estilos (.blur-extension, .delete-extension y .hover-highlight)
 * si aún no han sido inyectados.
 */
function injectGlobalStyles() {
  const existing = document.getElementById("blur-style-extension");
  if (!existing) {
    const styleEl = document.createElement("style");
    styleEl.id = "blur-style-extension";
    styleEl.textContent = `
      .blur-extension {
        filter: blur(5px) !important;
      }
      .delete-extension {
        display: none !important;
      }
      .blur-extension.hover-highlight {
        outline: 3px dashed #dc3545 !important;
        background: rgba(220,53,69,0.1) !important;
        cursor: pointer !important;
        position: relative;
        z-index: 998 !important;
      }
      .hover-highlight {
        outline: 3px dashed #007aff !important;
        background: rgba(0,122,255,0.1) !important;
        cursor: pointer !important;
        position: relative;
        z-index: 998 !important;
      }
      .hover-highlight::before {
        content: '';
        position: absolute !important;
        top: -30px !important;
        left: 0 !important;
        width: 32px;
        height: 32px;
        background-image: url(${chrome.runtime.getURL('blur.png')});
        background-size: contain;
        background-repeat: no-repeat;
        z-index: 999999;
      }
      .hover-highlight.delete-mode::before {
        background-image: url(${chrome.runtime.getURL('borrar.png')}) !important;
      }
      .blur-extension.hover-highlight::before {
        background-image: url(${chrome.runtime.getURL('desactivado.png')}) !important;
      }
      .delete-extension.hover-highlight::before {
        background-image: url(${chrome.runtime.getURL('desactivado.png')}) !important;
      }
      .blur-extension.hover-highlight:hover {
        filter: none !important; /* Evita el blur en el hover */
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Aplica las clases .blur-extension y .delete-extension a los selectores guardados
 * SOLO si la extensión está activa y solo al dominio actual.
 */
function applyStoredModifications() {
  injectGlobalStyles();

  try {
    // Primero verificamos si la extensión está activa
    chrome.storage.local.get("extensionActive", extensionData => {
      if (chrome.runtime.lastError) {
        console.error("Error al verificar extensionActive:", chrome.runtime.lastError);
        return;
      }
      
      const isActive = extensionData.extensionActive ?? false;
      
      // Si la extensión está desactivada, eliminar todos los efectos y salir
      if (!isActive) {
        document.querySelectorAll(".blur-extension").forEach(el => {
          el.classList.remove("blur-extension");
        });
        
        document.querySelectorAll(".delete-extension").forEach(el => {
          el.classList.remove("delete-extension");
        });
        return;
      }
      
      // Luego quitamos todas las clases de blur y delete para empezar desde cero
      document.querySelectorAll(".blur-extension").forEach(el => {
        el.classList.remove("blur-extension");
      });
      
      document.querySelectorAll(".delete-extension").forEach(el => {
        el.classList.remove("delete-extension");
      });
      
      // Y solo si la extensión está activa, aplicamos las modificaciones SÓLO para el dominio actual
      chrome.storage.local.get(["blurSelectors", "deleteSelectors"], data => {
        if (chrome.runtime.lastError) {
          console.error("Error al obtener selectores:", chrome.runtime.lastError);
          return;
        }
        
        // Aplicar blur SOLO para el dominio actual
        const blurStore = data.blurSelectors || {};
        if (blurStore[currentDomain] && Array.isArray(blurStore[currentDomain])) {
          blurStore[currentDomain].forEach(item => {
            const selector = (typeof item === "string") ? item : item.selector;
            try {
              document.querySelectorAll(selector).forEach(el => {
                if (
                  !el.classList.contains("ratitas-rojas") &&
                  !el.classList.contains("icono-visible")
                ) {
                  el.classList.add("blur-extension");
                }
              });
            } catch (err) {
              console.warn("No se pudo aplicar blur al selector:", selector, err);
            }
          });
        }
        
        // Aplicar delete SOLO para el dominio actual
        const deleteStore = data.deleteSelectors || {};
        if (deleteStore[currentDomain] && Array.isArray(deleteStore[currentDomain])) {
          deleteStore[currentDomain].forEach(item => {
            const selector = (typeof item === "string") ? item : item.selector;
            try {
              document.querySelectorAll(selector).forEach(el => {
                if (
                  !el.classList.contains("ratitas-rojas") &&
                  !el.classList.contains("icono-visible")
                ) {
                  el.classList.add("delete-extension");
                }
              });
            } catch (err) {
              console.warn("No se pudo aplicar borrado al selector:", selector, err);
            }
          });
        }
      });
    });
  } catch (error) {
    console.error("Error al aplicar modificaciones:", error);
  }
}

/**
 * Inicia un MutationObserver que vuelve a llamar a applyStoredModifications()
 * tras cada cambio importante en el DOM, para reflejar elementos nuevos
 * que requieran difuminado o borrado.
 */
function startObserver() {
  if (blurObserver) blurObserver.disconnect();

  blurObserver = new MutationObserver(() => {
    applyStoredModifications();
  });
  blurObserver.observe(document.body, { childList: true, subtree: true });
}

/** Activa el modo edición (resaltar y clic para (des)aplicar modificaciones). */
function enableSelectionMode() {
  selectionMode = true;
  
  // Asegurar que los estilos estén inyectados antes de activar el modo de selección
  injectGlobalStyles();
  
  // Eliminar primero para evitar duplicados en caso de múltiples activaciones
  document.removeEventListener("mouseover", highlightElement);
  document.removeEventListener("mouseout", unhighlightElement);
  document.removeEventListener("click", handleElementClick, true);
  
  // Añadir los listeners de eventos
  document.addEventListener("mouseover", highlightElement);
  document.addEventListener("mouseout", unhighlightElement);
  document.addEventListener("click", handleElementClick, true);
  
  // Aplica elementos guardados para asegurar que todo esté actualizado
  applyStoredModifications();
  
  console.log("Modo selección activado correctamente");
}

/** Desactiva el modo edición. */
function disableSelectionMode() {
  selectionMode = false;
  document.removeEventListener("mouseover", highlightElement);
  document.removeEventListener("mouseout", unhighlightElement);
  document.removeEventListener("click", handleElementClick, true);
}

/**
 * Al pasar el ratón por un elemento en modo edición,
 * le añadimos la clase .hover-highlight con la variante según el modo.
 */
function highlightElement(evt) {
  if (!selectionMode) return;
  
  // Ignorar elementos de la extensión y elementos del sistema (html, body, etc.)
  const ignoredTags = ['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'META', 'LINK'];
  if (ignoredTags.includes(evt.target.tagName)) return;
  
  // Si el elemento ya tiene la clase hover-highlight, no hacer nada (evita flickering)
  if (evt.target.classList.contains("hover-highlight")) return;
  
  // Limpiar cualquier highlight previo para evitar múltiples elementos resaltados
  document.querySelectorAll(".hover-highlight").forEach(el => {
    if (el !== evt.target) {
      el.classList.remove("hover-highlight");
      el.classList.remove("delete-mode");
    }
  });
  
  // Forzar visibilidad del elemento y asegurar la posición relativa para el posicionamiento
  evt.target.style.position = "relative";
  evt.target.style.zIndex = "1000";
  
  // Aplicar las clases correspondientes
  evt.target.classList.add("hover-highlight");
  
  // Si estamos en modo borrar, añadir la clase indicativa
  if (deleteMode) {
    evt.target.classList.add("delete-mode");
  } else {
    evt.target.classList.remove("delete-mode");
  }
  
  // Asegurar que el elemento es visible en modo hover
  if (evt.target.classList.contains("blur-extension")) {
    evt.target.style.filter = "none";
  }
}

/**
 * Quitamos las clases de hover al salir del elemento.
 */
function unhighlightElement(evt) {
  if (!selectionMode) return;
  
  evt.target.classList.remove("hover-highlight");
  evt.target.classList.remove("delete-mode");
  
  // Restaurar el blur si estaba aplicado
  if (evt.target.classList.contains("blur-extension")) {
    evt.target.style.filter = "";
  }
}

/**
 * Maneja el clic en un elemento durante el modo edición:
 *  - Si ya está modificado => quitamos la clase correspondiente y lo eliminamos del storage
 *  - Si no => lo modificamos y lo añadimos al storage
 */
function handleElementClick(evt) {
  if (!selectionMode) return;

  evt.preventDefault();
  evt.stopPropagation();

  const el = evt.target;
  const selector = getCssPath(el);

  if (deleteMode) {
    // Modo borrar
    if (el.classList.contains("delete-extension")) {
      // Si ya está borrado, lo restauramos
      el.classList.remove("delete-extension");
      removeSelectorFromStorage(selector, "delete");
    } else {
      // Si no, lo borramos
      el.classList.add("delete-extension");
      // Si estaba con blur, quitamos el blur
      if (el.classList.contains("blur-extension")) {
        el.classList.remove("blur-extension");
        removeSelectorFromStorage(selector, "blur");
      }
      addSelectorToStorage(selector, "delete");
    }
  } else {
    // Modo blur
    if (el.classList.contains("blur-extension")) {
      // Si ya está difuminado, lo restauramos
      el.classList.remove("blur-extension");
      removeSelectorFromStorage(selector, "blur");
    } else {
      // Si no, lo difuminamos
      el.classList.add("blur-extension");
      // Si estaba borrado, quitamos el borrado
      if (el.classList.contains("delete-extension")) {
        el.classList.remove("delete-extension");
        removeSelectorFromStorage(selector, "delete");
      }
      addSelectorToStorage(selector, "blur");
    }
  }
  
  // Quitamos siempre las clases de hover al hacer clic
  el.classList.remove("hover-highlight");
  el.classList.remove("delete-mode");
  return false;
}

/**
 * Genera un selector CSS que ignora la clase .hover-highlight y
 * prioriza ID o clases únicas. Si no encuentra nada, recurre
 * al método original con :nth-of-type.
 */
function getCssPath(el) {
  if (!(el instanceof Element)) return "";

  // 1) Si tiene ID, úsalo
  if (el.id) {
    return `#${el.id}`;
  }

  // 2) Filtramos las clases efímeras
  const stableClasses = Array.from(el.classList).filter(cls => 
    cls !== "hover-highlight" && 
    cls !== "blur-extension" && 
    cls !== "delete-extension" &&
    cls !== "delete-mode");
  
  if (stableClasses.length > 0) {
    // Buscamos si alguna es única en el documento
    const uniqueClass = stableClasses.find(
      cls => document.querySelectorAll(`.${cls}`).length === 1
    );
    if (uniqueClass) {
      return `.${uniqueClass}`;
    }
  }

  // 3) Fallback: recorrer padres, construyendo :nth-of-type
  const path = [];
  let current = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let nodeName = current.nodeName.toLowerCase();
    if (current.id) {
      nodeName += "#" + current.id;
      path.unshift(nodeName);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      // Corregido: comparamos con el nodeName en lugar de sel
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.nodeName.toLowerCase() === nodeName) nth++;
      }
      nodeName += `:nth-of-type(${nth})`;
    }
    path.unshift(nodeName);
    current = current.parentNode;
  }

  return path.join(" > ");
}

/** Añade un selector al almacenamiento (dominio actual). */
function addSelectorToStorage(selector, type = "blur") {
  const storageKey = type === "delete" ? "deleteSelectors" : "blurSelectors";
  
  chrome.storage.local.get(storageKey, data => {
    const store = data[storageKey] || {};
    const domain = window.location.hostname;
    if (!store[domain]) {
      store[domain] = [];
    }
    
    // Verificar si el selector ya existe para evitar duplicados
    const exists = store[domain].some(item => {
      if (typeof item === "string") {
        return item === selector;
      } else {
        return item.selector === selector;
      }
    });
    
    if (!exists) {
      store[domain].push({ selector, name: `Nuevo ${type === "delete" ? "borrado" : "blur"}` });
      
      chrome.storage.local.set({ [storageKey]: store }, () => {
        // Notificar al popup para actualizar la UI
        chrome.runtime.sendMessage({
          action: "selectorAdded",
          domain: domain,
          selector: selector,
          type: type
        });
      });
    }
  });
}

/**
 * Quita un selector del almacenamiento (dominio actual).
 */
function removeSelectorFromStorage(selector, type = "blur") {
  const storageKey = type === "delete" ? "deleteSelectors" : "blurSelectors";
  
  chrome.storage.local.get(storageKey, data => {
    const store = data[storageKey] || {};
    const domain = window.location.hostname;
    if (!store[domain] || !Array.isArray(store[domain])) return;

    const initialLength = store[domain].length;
    
    store[domain] = store[domain].filter(item => {
      if (typeof item === "string") {
        return item !== selector;
      } else {
        return item.selector !== selector;
      }
    });

    // Solo actualizar si realmente se eliminó algo
    if (initialLength !== store[domain].length) {
      chrome.storage.local.set({ [storageKey]: store }, () => {
        // Notificar al popup para actualizar la UI
        chrome.runtime.sendMessage({
          action: "selectorRemoved",
          domain: domain,
          selector: selector,
          type: type
        });
      });
    }
  });
}

/**
 * Recibe mensajes desde popup.js para:
 *  - toggleExtension: activar/desactivar modificaciones
 *  - toggleEditMode: activar/desactivar modo edición
 *  - changeMode: cambiar entre modo blur y borrar
 *  - reApply: volver a aplicar las modificaciones sin refrescar
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Verificar que tenemos un mensaje válido
  if (!msg || typeof msg !== 'object') {
    sendResponse({ success: false, error: "Mensaje inválido" });
    return true;
  }

  try {
    if (msg.action === "toggleExtension") {
      if (msg.enable) {
        // Solo aplicar modificaciones si la extensión está activa
        applyStoredModifications();
        startObserver();
      } else {
        turnOffExtension();
        // Desactivar también el modo edición cuando se desactiva la extensión
        disableSelectionMode();
      }
      sendResponse({ success: true });
    }
    else if (msg.action === "toggleEditMode") {
      // Solo activar modo edición si la extensión está activa
      chrome.storage.local.get("extensionActive", data => {
        if (chrome.runtime.lastError) {
          console.error("Error al verificar extensionActive:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        const isActive = data.extensionActive ?? false;
        
        if (isActive && msg.enable) {
          // Actualizar modo borrado si es necesario
          if (msg.deleteMode !== undefined) {
            deleteMode = msg.deleteMode;
          }
          enableSelectionMode();
        } else {
          disableSelectionMode();
        }
        sendResponse({ success: true });
      });
      return true; // Importante para respuestas asíncronas
    }
    else if (msg.action === "changeMode" || msg.action === "changeDeleteMode") {
      deleteMode = msg.deleteMode;
      
      // Actualizar cualquier elemento que pueda estar resaltado
      document.querySelectorAll(".hover-highlight").forEach(el => {
        if (deleteMode) {
          el.classList.add("delete-mode");
        } else {
          el.classList.remove("delete-mode");
        }
      });
      
      sendResponse({ success: true });
    }
    else if (msg.action === "reApply") {
      // Solo re-aplicar si la extensión está activa
      chrome.storage.local.get("extensionActive", data => {
        if (chrome.runtime.lastError) {
          console.error("Error al verificar extensionActive:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        const isActive = data.extensionActive ?? false;
        if (isActive) {
          reApplyModifications();
        }
        sendResponse({ success: true });
      });
      return true; // Importante para respuestas asíncronas
    }
    else {
      // Acción desconocida, responder para evitar errores
      sendResponse({ success: false, error: "Acción desconocida: " + msg.action });
    }
  } catch (error) {
    console.error("Error procesando mensaje:", error, msg);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Mantener el canal de mensajes abierto para todas las acciones
});

/**
 * Desactiva totalmente la extensión:
 *  - Quita .blur-extension y .delete-extension de todos los elementos
 *  - Remueve estilos
 *  - Desactiva modo edición
 *  - Desconecta el observer
 */
function turnOffExtension() {
  document.querySelectorAll(".blur-extension").forEach(el => {
    el.classList.remove("blur-extension");
  });
  
  document.querySelectorAll(".delete-extension").forEach(el => {
    el.classList.remove("delete-extension");
  });
  
  const styleEl = document.getElementById("blur-style-extension");
  if (styleEl) styleEl.remove();

  disableSelectionMode();
  if (blurObserver) blurObserver.disconnect();
}

/**
 * Re-aplica las modificaciones (blur y delete) sin tener que refrescar la página.
 * Útil cuando se activa/desactiva la extensión o se cambian ajustes.
 */
function reApplyModifications() {
  // Primero aplicamos las clases y estilos
  applyStoredModifications();
  
  // Si estamos en modo selección, aseguramos que se vean los estilos de hover
  chrome.storage.local.get("editMode", data => {
    const editModeActive = data.editMode ?? false;
    
    if (editModeActive) {
      // Reforzamos el modo de selección
      if (!selectionMode) {
        enableSelectionMode();
      }
      
      // Verificamos el modo actual (blur o delete)
      chrome.storage.local.get("deleteMode", deleteData => {
        deleteMode = deleteData.deleteMode ?? false;
        console.log("Modo edición reactivado: deleteMode =", deleteMode);
      });
    } else {
      // Desactivamos el modo si está activo
      if (selectionMode) {
        disableSelectionMode();
      }
    }
  });
  
  // Reiniciar el observador
  startObserver();
}

/**
 * También reaccionamos a cambios en el almacenamiento (extensionActive, editMode, deleteMode):
 *  - Si se activa la extensión => aplicar modificaciones y observer
 *  - Si se desactiva => turnOffExtension()
 *  - Si se activa editMode => enableSelectionMode()
 *  - Si se desactiva => disableSelectionMode()
 *  - Si cambia deleteMode => actualizar deleteMode
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.extensionActive) {
    const newVal = changes.extensionActive.newValue;
    if (newVal) {
      applyStoredModifications();
      startObserver();
    } else {
      turnOffExtension();
    }
  }
  
  if (changes.editMode) {
    const isEditing = changes.editMode.newValue;
    if (isEditing) {
      enableSelectionMode();
    } else {
      disableSelectionMode();
    }
  }
  
  if (changes.deleteMode) {
    deleteMode = changes.deleteMode.newValue;
  }
});

/**
 * Al cargar, leemos extensionActive, editMode y deleteMode para aplicarlos
 * sin necesidad de refrescar la página.
 * También verificamos si hay sugerencias predefinidas para este dominio.
 */
chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "blurSelectors", "deleteSelectors"], data => {
  const isActive = data.extensionActive ?? false;
  const isEditing = data.editMode ?? false;
  deleteMode = data.deleteMode ?? false;
  const domain = window.location.hostname;
  
  console.log("Estado inicial:", {
    isActive,
    isEditing,
    deleteMode,
    domain: window.location.hostname
  });
  
  // Comprobar si ya tenemos configuraciones predefinidas cargadas
  let hasPresets = false;
  if (data.blurSelectors && data.blurSelectors[domain]) {
    hasPresets = data.blurSelectors[domain].some(item => 
      typeof item === "object" && item.isPreset === true
    );
  }
  
  // Si este dominio tiene configuraciones predefinidas en el archivo predefined_blurs.js
  // pero no están en storage, las cargaremos como sugerencias
  if (window.PREDEFINED_BLURS && window.PREDEFINED_BLURS[domain] && !hasPresets) {
    // Esto es para cuando el content script tenga acceso a las configuraciones predefinidas
    // (normalmente esto se manejaría desde el popup, pero dejamos esta lógica por si acaso)
    console.log("Dominio con configuraciones predefinidas disponibles:", domain);
  }

  if (isActive) {
    applyStoredModifications();
    startObserver();
    
    // Si también está en modo edición, activarlo
    if (isEditing) {
      setTimeout(() => { // Pequeño retraso para asegurar que todo esté listo
        enableSelectionMode();
      }, 100);
    }
  }
});
