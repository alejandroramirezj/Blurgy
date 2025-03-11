// content.js

// Observador para re-aplicar blur en cambios dinámicos (AJAX, etc.)
let blurObserver = null;

// Indica si el modo edición (selección) está activo
let selectionMode = false;

// Indica si estamos en modo borrar
let deleteMode = false;

// Indica si estamos en modo editar texto
let editTextMode = false;

// Almacena temporalmente el elemento que se está editando actualmente
let currentlyEditingElement = null;

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
        visibility: hidden !important;
      }
      .text-edit-extension {
        position: relative !important;
        color: transparent !important;
      }
      .text-edit-extension > * {
        color: transparent !important;
      }
      .text-edit-extension::after {
        content: attr(data-custom-text) !important;
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        color: initial !important;
        background: inherit !important;
        font: inherit !important;
        font-size: inherit !important;
        line-height: inherit !important;
        text-align: inherit !important;
        padding: inherit !important;
        margin: inherit !important;
        z-index: 1 !important;
      }
      .hover-highlight {
        outline: 3px dashed #007aff !important;
        background: rgba(0,122,255,0.1) !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 2 !important;
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
      }
      .hover-highlight.delete-mode::before {
        background-image: url(${chrome.runtime.getURL('borrar.png')}) !important;
      }
      .hover-highlight.edit-text-mode::before {
        background-image: url(${chrome.runtime.getURL('editar.png')}) !important;
      }
      /* Iconos de desactivado específicos para cada modo */
      .blur-extension.hover-highlight::before {
        background-image: url(${chrome.runtime.getURL('desactivado.png')}) !important;
      }
      .delete-extension.hover-highlight::before {
        background-image: url(${chrome.runtime.getURL('desactivado.png')}) !important;
      }
      .text-edit-extension.hover-highlight::before {
        background-image: url(${chrome.runtime.getURL('desactivado.png')}) !important;
      }
      /* Fallback si no existen las imágenes específicas */
      .blur-extension.hover-highlight::before,
      .delete-extension.hover-highlight::before,
      .text-edit-extension.hover-highlight::before {
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
  try {
    // Verificar que el runtime de Chrome está disponible
    if (!chrome || !chrome.runtime) {
      console.warn('Runtime de Chrome no disponible');
      return;
    }

    // Obtener el dominio actual de forma segura
    const currentDomain = window.location.hostname;
    if (!currentDomain) {
      console.warn('No se pudo obtener el dominio actual');
      return;
    }

    // Verificar primero si estamos en chatgpt.com o similar
    if (currentDomain.includes('chatgpt.com') || 
        currentDomain.includes('chat.openai.com')) {
      console.log('Extensión en modo manual para ChatGPT');
      return;
    }

    injectGlobalStyles();

    // Verificamos si la extensión está activa
    chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
      if (chrome.runtime.lastError) {
        console.error("Error al obtener datos:", chrome.runtime.lastError);
        return;
      }
      
      const isActive = data.extensionActive ?? false;
      
      // Si la extensión está desactivada, eliminar todos los efectos y salir
      if (!isActive) {
        removeAllModifications();
        return;
      }
      
      // Solo aplicar modificaciones si la extensión está activa
      if (isActive) {
        // Limpiar modificaciones existentes
        removeAllModifications();
        
        // Aplicar modificaciones para el dominio actual
        const blurStore = data.blurSelectors?.[currentDomain] || [];
        const deleteStore = data.deleteSelectors?.[currentDomain] || [];
        const editTextStore = data.editTextSelectors?.[currentDomain] || [];

        // Aplicar blur
        blurStore.forEach(item => {
          const selector = (typeof item === "string") ? item : item.selector;
          applyModification(selector, "blur-extension");
        });

        // Aplicar delete
        deleteStore.forEach(item => {
          const selector = (typeof item === "string") ? item : item.selector;
          applyModification(selector, "delete-extension");
        });

        // Aplicar edit text
        editTextStore.forEach(item => {
          if (typeof item !== "object") return;
          const selector = item.selector;
          const customText = item.customText || "";
          if (!customText.trim()) return;
          
          applyModification(selector, "text-edit-extension", customText);
        });
      }
    });
  } catch (error) {
    console.error("Error al aplicar modificaciones:", error);
  }
}

// Función auxiliar para remover todas las modificaciones
function removeAllModifications() {
  document.querySelectorAll(".blur-extension, .delete-extension, .text-edit-extension").forEach(el => {
    el.classList.remove("blur-extension", "delete-extension", "text-edit-extension");
    el.removeAttribute("data-custom-text");
  });
}

// Función auxiliar para aplicar una modificación específica
function applyModification(selector, className, customText = "") {
  try {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.classList.contains("ratitas-rojas") && !el.classList.contains("icono-visible")) {
        if (className === "text-edit-extension") {
          if (!el.hasAttribute("data-original-text")) {
            el.setAttribute("data-original-text", el.textContent.trim());
          }
          el.setAttribute("data-custom-text", customText);
        }
        el.classList.add(className);
      }
    });
  } catch (err) {
    console.warn(`No se pudo aplicar ${className} al selector:`, selector, err);
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
  chrome.storage.local.get(["extensionActive", "editMode"], data => {
    const isActive = data.extensionActive ?? false;
    const editModeEnabled = data.editMode ?? false;
    
    // Si la extensión no está activa o el modo edición está desactivado, no hacemos nada
    if (!isActive) {
      disableSelectionMode();
      return;
    }

    // Si el modo edición está activado, activamos la selección
    if (editModeEnabled) {
      selectionMode = true;
      injectGlobalStyles();
      
      // Eliminar primero para evitar duplicados
      document.removeEventListener("mouseover", highlightElement);
      document.removeEventListener("mouseout", unhighlightElement);
      document.removeEventListener("click", handleElementClick, true);
      
      // Añadir los listeners de eventos
      document.addEventListener("mouseover", highlightElement);
      document.addEventListener("mouseout", unhighlightElement);
      document.addEventListener("click", handleElementClick, true);
    } else {
      disableSelectionMode();
    }
    
    applyStoredModifications();
  });
}

/** Desactiva el modo edición. */
function disableSelectionMode() {
  selectionMode = false;
  
  // Remover todos los listeners
  document.removeEventListener("mouseover", highlightElement);
  document.removeEventListener("mouseout", unhighlightElement);
  document.removeEventListener("click", handleElementClick, true);
  
  // Limpiar cualquier highlight que pudiera quedar
  document.querySelectorAll(".hover-highlight").forEach(el => {
    el.classList.remove("hover-highlight");
    el.classList.remove("delete-mode");
    el.classList.remove("edit-text-mode");
    el.style.filter = "";
    el.style.position = "";
    el.style.zIndex = "";
  });
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
      el.classList.remove("edit-text-mode");
    }
  });
  
  // Forzar visibilidad del elemento y asegurar la posición relativa para el posicionamiento
  evt.target.style.position = "relative";
  evt.target.style.zIndex = "1000";
  
  // Aplicar las clases correspondientes
  evt.target.classList.add("hover-highlight");
  
  // Aplicar clase según el modo actual
  if (deleteMode) {
    evt.target.classList.add("delete-mode");
    evt.target.classList.remove("edit-text-mode");
  } else if (editTextMode) {
    evt.target.classList.add("edit-text-mode");
    evt.target.classList.remove("delete-mode");
  } else {
    evt.target.classList.remove("delete-mode");
    evt.target.classList.remove("edit-text-mode");
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
  evt.target.classList.remove("edit-text-mode");
  
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

  if (editTextMode) {
    // Modo editar texto
    showTextEditPrompt(el, selector);
  } else if (deleteMode) {
    // Modo borrar
    if (el.classList.contains("delete-extension")) {
      // Si ya está borrado, lo restauramos
      el.classList.remove("delete-extension");
      removeSelectorFromStorage(selector, "delete");
    } else {
      // Si no, lo borramos
      el.classList.add("delete-extension");
      // Si estaba con blur o text-edit, quitamos esas clases
      if (el.classList.contains("blur-extension")) {
        el.classList.remove("blur-extension");
        removeSelectorFromStorage(selector, "blur");
      }
      if (el.classList.contains("text-edit-extension")) {
        el.classList.remove("text-edit-extension");
        el.removeAttribute("data-custom-text");
        removeSelectorFromStorage(selector, "editText");
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
      // Si estaba borrado o text-edit, quitamos esas clases
      if (el.classList.contains("delete-extension")) {
        el.classList.remove("delete-extension");
        removeSelectorFromStorage(selector, "delete");
      }
      if (el.classList.contains("text-edit-extension")) {
        el.classList.remove("text-edit-extension");
        el.removeAttribute("data-custom-text");
        removeSelectorFromStorage(selector, "editText");
      }
      addSelectorToStorage(selector, "blur");
    }
  }
  
  // Quitamos siempre las clases de hover al hacer clic
  el.classList.remove("hover-highlight");
  el.classList.remove("delete-mode");
  el.classList.remove("edit-text-mode");
  return false;
}

/**
 * Muestra un prompt para editar el texto de un elemento
 */
function showTextEditPrompt(el, selector) {
  // Guardamos el elemento actual para referencia
  currentlyEditingElement = el;
  
  // Obtenemos el texto original
  let originalText = el.getAttribute("data-original-text");
  if (!originalText) {
    originalText = el.textContent.trim();
    el.setAttribute("data-original-text", originalText);
  }
  
  // Obtenemos el texto personalizado actual si existe
  const currentCustomText = el.getAttribute("data-custom-text") || "";
  const textToEdit = currentCustomText || originalText;
  
  // Mostramos el prompt para editar
  const newText = prompt("Editar texto:", textToEdit);
  
  // Si el usuario cancela, no hacemos nada
  if (newText === null) {
    currentlyEditingElement = null;
    return;
  }
  
  // Si el texto está vacío o es igual al original, restauramos el elemento
  if (!newText.trim() || newText === originalText) {
    el.classList.remove("text-edit-extension");
    el.removeAttribute("data-custom-text");
    removeSelectorFromStorage(selector, "editText");
  } else {
    // Limpiar clases previas que puedan interferir
    if (el.classList.contains("blur-extension")) {
      el.classList.remove("blur-extension");
      removeSelectorFromStorage(selector, "blur");
    }
    if (el.classList.contains("delete-extension")) {
      el.classList.remove("delete-extension");
      removeSelectorFromStorage(selector, "delete");
    }
    
    // Aplicar el nuevo texto
    el.classList.add("text-edit-extension");
    el.setAttribute("data-custom-text", newText);
    
    // Guardar en storage
    addSelectorToStorage(selector, "editText", newText);
  }
  
  currentlyEditingElement = null;
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
    cls !== "delete-mode" &&
    cls !== "edit-text-mode");
  
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
function addSelectorToStorage(selector, type = "blur", customText = "") {
  const storageKey = type === "delete" ? "deleteSelectors" : 
                    (type === "editText" ? "editTextSelectors" : "blurSelectors");
  
  chrome.storage.local.get(storageKey, data => {
    const store = data[storageKey] || {};
    const domain = window.location.hostname;
    if (!store[domain]) {
      store[domain] = [];
    }
    
    // Obtener el elemento y su texto original
    const element = document.querySelector(selector);
    const originalText = element ? element.getAttribute("data-original-text") || element.textContent.trim() : "";
    
    // Verificar si el selector ya existe para evitar duplicados
    const existsIndex = store[domain].findIndex(item => {
      if (typeof item === "string") {
        return item === selector;
      } else {
        return item.selector === selector;
      }
    });
    
    if (existsIndex === -1) {
      // No existe, lo añadimos
      if (type === "editText") {
        store[domain].push({ 
          selector, 
          name: `Nuevo texto editado`, 
          customText: customText,
          originalText: originalText
        });
      } else {
        store[domain].push({ 
          selector, 
          name: `Nuevo ${type === "delete" ? "borrado" : "blur"}` 
        });
      }
    } else {
      // Existe, actualizamos el customText si es modo edición
      if (type === "editText") {
        store[domain][existsIndex].customText = customText;
        store[domain][existsIndex].originalText = originalText;
      }
    }
    
    chrome.storage.local.set({ [storageKey]: store }, () => {
      // Notificar al popup para actualizar la UI
      chrome.runtime.sendMessage({
        action: "selectorAdded",
        domain: domain,
        selector: selector,
        type: type,
        customText: customText,
        originalText: originalText
      });
    });
  });
}

/**
 * Quita un selector del almacenamiento (dominio actual).
 */
function removeSelectorFromStorage(selector, type = "blur") {
  const storageKey = type === "delete" ? "deleteSelectors" : 
                    (type === "editText" ? "editTextSelectors" : "blurSelectors");
  
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
 *  - ping: verificar si el content script está cargado
 *  - toggleExtension: activar/desactivar modificaciones
 *  - toggleEditMode: activar/desactivar modo edición
 *  - changeMode: cambiar entre modo blur y borrar
 *  - reApply: volver a aplicar las modificaciones sin refrescar
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Verificar que tenemos un mensaje válido y que chrome.runtime está disponible
  if (!msg || typeof msg !== 'object' || !chrome.runtime) {
    console.warn('Mensaje inválido o runtime no disponible');
    sendResponse({ success: false, error: "Mensaje inválido o runtime no disponible" });
    return false; // No esperamos respuesta asíncrona
  }

  try {
    // Mensaje de ping para verificar que el content script está cargado
    if (msg.action === "ping") {
      sendResponse({ success: true, pong: true });
      return false; // No esperamos respuesta asíncrona
    }
    
    // Para mensajes que requieren respuesta asíncrona
    const handleAsyncMessage = async () => {
      try {
        const data = await new Promise((resolve) => {
          chrome.storage.local.get("extensionActive", resolve);
        });
        
        const isActive = data.extensionActive ?? false;
        
        switch(msg.action) {
          case "toggleExtension":
            // Permitir la activación explícita incluso en ChatGPT
            if (msg.enable) {
              await applyStoredModifications();
              startObserver();
            } else {
              turnOffExtension();
              disableSelectionMode();
            }
            return { success: true };
            
          case "toggleEditMode":
            if (isActive) {
              if (msg.deleteMode !== undefined) {
                deleteMode = msg.deleteMode;
              }
              if (msg.editTextMode !== undefined) {
                editTextMode = msg.editTextMode;
              }
              // Si enable es true, activamos el modo edición
              if (msg.enable) {
                enableSelectionMode();
              } else {
                disableSelectionMode();
              }
            }
            return { success: true };
            
          case "changeMode":
          case "changeDeleteMode":
            deleteMode = msg.deleteMode ?? false;
            editTextMode = msg.editTextMode ?? false;
            document.querySelectorAll(".hover-highlight").forEach(el => {
              if (deleteMode) {
                el.classList.add("delete-mode");
                el.classList.remove("edit-text-mode");
              } else if (editTextMode) {
                el.classList.add("edit-text-mode");
                el.classList.remove("delete-mode");
              } else {
                el.classList.remove("delete-mode");
                el.classList.remove("edit-text-mode");
              }
            });
            return { success: true };
            
          case "reApply":
            if (isActive) {
              await reApplyModifications();
            }
            return { success: true };
            
          default:
            return { success: false, error: "Acción desconocida: " + msg.action };
        }
      } catch (error) {
        console.error("Error procesando mensaje:", error);
        return { success: false, error: error.message };
      }
    };

    // Manejar la respuesta asíncrona
    handleAsyncMessage().then(response => {
      try {
        sendResponse(response);
      } catch (error) {
        console.warn('Canal de mensajes cerrado:', error);
      }
    });
    
    return true; // Indicamos que la respuesta será asíncrona
  } catch (error) {
    console.error("Error procesando mensaje:", error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
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
  
  document.querySelectorAll(".text-edit-extension").forEach(el => {
    el.classList.remove("text-edit-extension");
    // Eliminar los overlays
    const overlay = el.querySelector('.text-edit-overlay');
    if (overlay) {
      overlay.remove();
    }
  });
  
  // Eliminar todos los overlays restantes por si acaso
  document.querySelectorAll(".text-edit-overlay").forEach(el => {
    el.remove();
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
  // Verificar si estamos en chatgpt.com o similar
  if (window.location.hostname.includes('chatgpt.com') || 
      window.location.hostname.includes('chat.openai.com')) {
    console.log('Extensión en modo manual para ChatGPT');
    return;
  }

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
      
      // Verificamos los modos actuales
      chrome.storage.local.get(["deleteMode", "editTextMode"], modeData => {
        deleteMode = modeData.deleteMode ?? false;
        editTextMode = modeData.editTextMode ?? false;
        console.log("Modo edición reactivado: deleteMode =", deleteMode, ", editTextMode =", editTextMode);
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
 * También reaccionamos a cambios en el almacenamiento (extensionActive, editMode, deleteMode, editTextMode):
 *  - Si se activa la extensión => aplicar modificaciones y observer
 *  - Si se desactiva => turnOffExtension()
 *  - Si se activa editMode => enableSelectionMode()
 *  - Si se desactiva => disableSelectionMode()
 *  - Si cambia deleteMode => actualizar deleteMode
 *  - Si cambia editTextMode => actualizar editTextMode
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

  if (changes.editTextMode) {
    editTextMode = changes.editTextMode.newValue;
  }
});

/**
 * Al cargar, leemos extensionActive, editMode, deleteMode y editTextMode para aplicarlos
 * sin necesidad de refrescar la página.
 * También verificamos si hay sugerencias predefinidas para este dominio.
 */
chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "editTextMode", "blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
  const isActive = data.extensionActive ?? false;
  const isEditing = data.editMode ?? false;
  deleteMode = data.deleteMode ?? false;
  editTextMode = data.editTextMode ?? false;
  const domain = window.location.hostname;
  
  console.log("Estado inicial:", {
    isActive,
    isEditing,
    deleteMode,
    editTextMode,
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
