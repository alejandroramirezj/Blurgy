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

// Añadir al inicio del archivo, después de las variables globales
let retryCount = 0;
const MAX_RETRIES = 3;
let lastModificationTime = 0;
const RETRY_DELAY = 1000; // 1 segundo entre reintentos

// Añadir nueva variable global al inicio del archivo
let activeDomains = new Set();

// Variables globales al inicio del archivo
let lastToggleTime = 0;
const TOGGLE_DELAY = 300; // Aumentar para evitar activaciones accidentales
let pendingToggle = false;
let toggleLocked = false;

/**
 * Inyecta estilos (.blur-extension, .delete-extension y .hover-highlight)
 * si aún no han sido inyectados.
 */
function injectGlobalStyles() {
  const existing = document.getElementById("blur-style-extension");
  if (!existing) {
    // Obtener URLs seguras para las imágenes
    const blurImageUrl = getSafeImageUrl('blur.png');
    const borrarImageUrl = getSafeImageUrl('borrar.png');
    const editarImageUrl = getSafeImageUrl('editar.png');
    const desactivadoImageUrl = getSafeImageUrl('desactivado.png');
    
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
        background-image: url(${blurImageUrl});
        background-size: contain;
        background-repeat: no-repeat;
      }
      .hover-highlight.delete-mode::before {
        background-image: url(${borrarImageUrl}) !important;
      }
      .hover-highlight.edit-text-mode::before {
        background-image: url(${editarImageUrl}) !important;
      }
      /* Iconos de desactivado específicos para cada modo */
      .blur-extension.hover-highlight::before {
        background-image: url(${desactivadoImageUrl}) !important;
      }
      .delete-extension.hover-highlight::before {
        background-image: url(${desactivadoImageUrl}) !important;
      }
      .text-edit-extension.hover-highlight::before {
        background-image: url(${desactivadoImageUrl}) !important;
      }
      /* Fallback si no existen las imágenes específicas */
      .blur-extension.hover-highlight::before,
      .delete-extension.hover-highlight::before,
      .text-edit-extension.hover-highlight::before {
        background-image: url(${desactivadoImageUrl}) !important;
      }
      .blur-extension.hover-highlight:hover {
        filter: none !important; /* Evita el blur en el hover */
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Aplica las modificaciones con sistema de reintentos
 */
async function applyStoredModificationsWithRetry() {
  if (Date.now() - lastModificationTime < RETRY_DELAY) {
    return; // Evitar llamadas demasiado frecuentes
  }
  
  try {
    // Obtener el dominio actual
    const currentDomain = window.location.hostname;
    
    // Si no hay dominio o no está en la lista de dominios activos, salir
    if (!currentDomain || !activeDomains.has(currentDomain)) {
      console.log('Dominio no activado:', currentDomain);
      return;
    }

    // Verificar si estamos en chatgpt.com o similar
    if (currentDomain.includes('chatgpt.com') || 
        currentDomain.includes('chat.openai.com')) {
      console.log('Extensión en modo manual para ChatGPT');
      return;
    }

    // Inyectar estilos
    injectGlobalStyles();

    return new Promise((resolve, reject) => {
      const tryApply = () => {
        chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
          if (chrome.runtime.lastError) {
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              setTimeout(tryApply, RETRY_DELAY);
              return;
            }
            reject(chrome.runtime.lastError);
            return;
          }

          try {
            const isActive = data.extensionActive ?? false;
            if (!isActive) {
              removeAllModifications();
              resolve();
              return;
            }

            // Limpiar modificaciones existentes
            removeAllModifications();

            // Obtener los selectores solo para el dominio actual
            const blurSelectors = (data.blurSelectors?.[currentDomain] || [])
              .map(item => typeof item === "string" ? item : item.selector);
            
            const deleteSelectors = (data.deleteSelectors?.[currentDomain] || [])
              .map(item => typeof item === "string" ? item : item.selector);
            
            const editTextSelectors = (data.editTextSelectors?.[currentDomain] || [])
              .filter(item => typeof item === "object" && item.customText)
              .map(item => ({
                selector: item.selector,
                customText: item.customText
              }));

            // Aplicar las modificaciones de forma segura
            safeApplyModifications(blurSelectors, deleteSelectors, editTextSelectors);
            
            lastModificationTime = Date.now();
            retryCount = 0;
            resolve();
          } catch (error) {
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              setTimeout(tryApply, RETRY_DELAY);
            } else {
              reject(error);
            }
          }
        });
      };

      tryApply();
    });
  } catch (error) {
    console.warn('Error al aplicar modificaciones:', error);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => applyStoredModificationsWithRetry(), RETRY_DELAY);
    }
  }
}

/**
 * Aplica las modificaciones de forma segura
 */
function safeApplyModifications(blurSelectors, deleteSelectors, editTextSelectors) {
  const applyWithRetry = (selector, className, customText = "") => {
    try {
      applyModification(selector, className, customText);
    } catch (error) {
      console.warn(`Error al aplicar ${className} a ${selector}:`, error);
    }
  };

  // Aplicar cada tipo de modificación
  blurSelectors.forEach(selector => applyWithRetry(selector, "blur-extension"));
  deleteSelectors.forEach(selector => applyWithRetry(selector, "delete-extension"));
  editTextSelectors.forEach(({selector, customText}) => 
    applyWithRetry(selector, "text-edit-extension", customText)
  );
}

// Reemplazar la función original applyStoredModifications
function applyStoredModifications() {
  applyStoredModificationsWithRetry().catch(error => {
    console.warn('Error final al aplicar modificaciones:', error);
  });
}

// Función auxiliar para aplicar una modificación específica de forma segura
function applyModification(selector, className, customText = "") {
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!el || !el.classList) return;
      
      if (!el.classList.contains("ratitas-rojas") && !el.classList.contains("icono-visible")) {
        if (className === "text-edit-extension" && customText) {
          if (!el.hasAttribute("data-original-text")) {
            el.setAttribute("data-original-text", el.textContent.trim());
          }
          el.setAttribute("data-custom-text", customText);
        }
        el.classList.add(className);
      }
    });
  } catch (err) {
    // Ignorar errores silenciosamente para no interrumpir la ejecución
  }
}

// Función auxiliar para remover modificaciones de forma segura
function removeAllModifications() {
  try {
    document.querySelectorAll(".blur-extension, .delete-extension, .text-edit-extension").forEach(el => {
      if (el && el.classList) {
        el.classList.remove("blur-extension", "delete-extension", "text-edit-extension");
        el.removeAttribute("data-custom-text");
      }
    });
  } catch (err) {
    // Ignorar errores silenciosamente
  }
}

/**
 * Inicia un MutationObserver que vuelve a llamar a applyStoredModifications()
 * tras cada cambio importante en el DOM, para reflejar elementos nuevos
 * que requieran difuminado o borrado.
 */
function startObserver() {
  if (blurObserver) blurObserver.disconnect();

  let timeoutId = null;
  blurObserver = new MutationObserver(() => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      applyStoredModifications();
    }, 500); // Esperar 500ms entre llamadas
  });

  blurObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
}

/** Activa el modo edición */
function enableSelectionMode() {
  // Prevenir activaciones rápidas múltiples
  const now = Date.now();
  if (now - lastToggleTime < TOGGLE_DELAY) {
    console.log("Ignorando activación rápida", now - lastToggleTime);
    return;
  }
  
  // Actualizar timestamp para evitar activaciones múltiples
  lastToggleTime = now;
  console.log("Activando modo selección");
  
  // Verificar si la extensión está activa
  chrome.storage.local.get("extensionActive", (data) => {
    const extensionActive = data.extensionActive === true;
    
    if (!extensionActive) {
      console.log("La extensión no está activa, no se puede activar el modo selección");
      return;
    }
    
    // Activar modo selección y asegurar que el dominio está activo
    selectionMode = true;
    const currentDomain = window.location.hostname;
    activeDomains.add(currentDomain);
    
    // Guardar estado
    chrome.storage.local.set({ 
      editMode: true,
      activeDomains: Array.from(activeDomains)
    });
    
    // Notificar al popup sobre el cambio de estado
    chrome.runtime.sendMessage({
      action: "updatePopupState",
      state: {
        editMode: true,
        extensionActive: extensionActive,
        deleteMode: deleteMode,
        editTextMode: editTextMode,
        domainActive: true
      }
    });
    
    // Inyectar estilos y añadir event listeners
    injectGlobalStyles();
    removeEventListeners(); // Primero remover para evitar duplicados
    addEventListeners();
    
    console.log("Modo selección activado correctamente");
  });
}

/** Desactiva el modo edición */
function disableSelectionMode() {
  // Prevenir desactivaciones rápidas múltiples
  const now = Date.now();
  if (now - lastToggleTime < TOGGLE_DELAY) {
    console.log("Ignorando desactivación rápida", now - lastToggleTime);
    return;
  }
  
  // Actualizar timestamp para evitar desactivaciones múltiples
  lastToggleTime = now;
  console.log("Desactivando modo selección");

  // Desactivar modo selección
  selectionMode = false;
  deleteMode = false;
  editTextMode = false;
  
  // Limpiar
  removeEventListeners();
  cleanupHighlights();
  
  // Guardar estado
  chrome.storage.local.set({ 
    editMode: false,
    deleteMode: false,
    editTextMode: false
  });
  
  // Notificar al popup sobre el cambio de estado
  chrome.runtime.sendMessage({
    action: "updatePopupState",
    state: {
      editMode: false,
      deleteMode: false,
      editTextMode: false
    }
  });
  
  console.log("Modo selección desactivado correctamente");
}

/** Limpia los event listeners */
function removeEventListeners() {
  document.removeEventListener("mouseover", highlightElement);
  document.removeEventListener("mouseout", unhighlightElement);
  document.removeEventListener("click", handleElementClick, true);
}

/** Añade los event listeners */
function addEventListeners() {
  document.addEventListener("mouseover", highlightElement);
  document.addEventListener("mouseout", unhighlightElement);
  document.addEventListener("click", handleElementClick, true);
}

/** Limpia los highlights */
function cleanupHighlights() {
  document.querySelectorAll(".hover-highlight").forEach(el => {
    el.classList.remove("hover-highlight", "delete-mode", "edit-text-mode");
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

  // Usar requestAnimationFrame para mejorar el rendimiento
  requestAnimationFrame(() => {
    const el = evt.target;
    const selector = getCssPath(el);

    if (editTextMode) {
      showTextEditPrompt(el, selector);
    } else if (deleteMode) {
      toggleDeleteMode(el, selector);
    } else {
      toggleBlurMode(el, selector);
    }
    
    el.classList.remove("hover-highlight", "delete-mode", "edit-text-mode");
  });

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

// Separar la lógica del modo borrar para mejor rendimiento
function toggleDeleteMode(el, selector) {
  if (el.classList.contains("delete-extension")) {
    el.classList.remove("delete-extension");
    removeSelectorFromStorage(selector, "delete");
  } else {
    el.classList.add("delete-extension");
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
}

// Separar la lógica del modo blur para mejor rendimiento
function toggleBlurMode(el, selector) {
  if (el.classList.contains("blur-extension")) {
    el.classList.remove("blur-extension");
    removeSelectorFromStorage(selector, "blur");
  } else {
    el.classList.add("blur-extension");
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

// Al inicio del archivo, después de las variables globales
document.addEventListener('DOMContentLoaded', () => {
  // Notificar que el content script está listo
  try {
    chrome.runtime.sendMessage({
      action: "contentScriptReady",
      domain: window.location.hostname
    });
  } catch (error) {
    console.warn('No se pudo notificar que el content script está listo:', error);
  }
});

// Modificar el listener de mensajes para mejorar la robustez
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') {
    sendResponse({ success: false, error: "Mensaje inválido" });
    return false;
  }

  try {
    switch(msg.action) {
      case "toggleEditMode":
        console.log("toggleEditMode recibido:", msg.enable);
        
        // Si el toggle está bloqueado, ignorar la solicitud
        if (toggleLocked) {
          console.log("Toggle bloqueado, ignorando solicitud");
          sendResponse({ 
            success: false, 
            error: "Toggle bloqueado temporalmente",
            editMode: selectionMode
          });
          return false;
        }
        
        // Bloquear el toggle brevemente para evitar múltiples activaciones
        toggleLocked = true;
        setTimeout(() => {
          toggleLocked = false;
        }, TOGGLE_DELAY);
        
        if (msg.enable) {
          // Verificar si la extensión está activa antes de activar el modo edición
          chrome.storage.local.get("extensionActive", (data) => {
            const extensionActive = data.extensionActive === true;
            
            if (extensionActive) {
              enableSelectionMode();
            } else {
              console.log("No se puede activar el modo selección porque la extensión está desactivada");
            }
            
            sendResponse({ 
              success: true, 
              domain: window.location.hostname, 
              editMode: selectionMode,
              extensionActive: extensionActive
            });
          });
          return true; // Mantener canal abierto para la respuesta asíncrona
        } else {
          disableSelectionMode();
          sendResponse({ 
            success: true, 
            domain: window.location.hostname, 
            editMode: false
          });
        }
        break;

      case "setMode":
        if (msg.mode === "delete") {
          deleteMode = true;
          editTextMode = false;
        } else if (msg.mode === "editText") {
          deleteMode = false;
          editTextMode = true;
        } else {
          deleteMode = false;
          editTextMode = false;
        }
        chrome.storage.local.set({ 
          deleteMode: deleteMode,
          editTextMode: editTextMode
        });
        sendResponse({ success: true, mode: msg.mode });
        break;

      case "toggleExtension":
        const currentDomain = window.location.hostname;
        if (msg.enable) {
          activeDomains.add(currentDomain);
          // Guardar dominios activos inmediatamente
          chrome.storage.local.set({ 
            activeDomains: Array.from(activeDomains)
          });
          applyStoredModifications();
          startObserver();
        } else {
          activeDomains.delete(currentDomain);
          turnOffExtension();
          disableSelectionMode();
        }
        sendResponse({ success: true, domain: currentDomain });
        break;

      case "reApply":
        applyStoredModifications();
        sendResponse({ success: true, domain: window.location.hostname });
        break;

      case "ping":
        sendResponse({ 
          success: true, 
          domain: window.location.hostname,
          selectionMode: selectionMode,
          deleteMode: deleteMode,
          editTextMode: editTextMode,
          extensionActive: true
        });
        break;

      default:
        sendResponse({ 
          success: false, 
          error: "Acción desconocida", 
          domain: window.location.hostname 
        });
    }
  } catch (error) {
    console.error("Error en procesamiento de mensaje:", error);
    sendResponse({ 
      success: false, 
      error: error.message,
      domain: window.location.hostname 
    });
  }
  
  return false; // No mantener el canal abierto por defecto
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

  console.log("Cambios en storage detectados:", Object.keys(changes));

  if (changes.extensionActive) {
    const newVal = changes.extensionActive.newValue;
    console.log("Cambio en extensionActive:", newVal);
    
    if (newVal) {
      applyStoredModifications();
      startObserver();
    } else {
      turnOffExtension();
      // Si la extensión se desactiva, también desactivamos el modo edición
      disableSelectionMode();
    }
  }
  
  if (changes.editMode) {
    const isEditing = changes.editMode.newValue;
    console.log("Cambio en editMode:", isEditing);
    
    if (isEditing) {
      // Solo activamos si la extensión está activa
      chrome.storage.local.get("extensionActive", data => {
        if (data.extensionActive) {
          // Evitar bucles infinitos comprobando el estado actual
          if (!selectionMode) {
            enableSelectionMode();
          }
        } else {
          console.log("No se puede activar el modo edición porque la extensión está desactivada");
          // Si la extensión no está activa, desactivar el modo edición en storage
          chrome.storage.local.set({ editMode: false });
        }
      });
    } else {
      // Evitar bucles infinitos comprobando el estado actual
      if (selectionMode) {
        disableSelectionMode();
      }
    }
  }
  
  if (changes.deleteMode) {
    deleteMode = changes.deleteMode.newValue;
    console.log("Cambio en deleteMode:", deleteMode);
  }

  if (changes.editTextMode) {
    editTextMode = changes.editTextMode.newValue;
    console.log("Cambio en editTextMode:", editTextMode);
  }
});

/**
 * Al cargar, leemos extensionActive, editMode, deleteMode y editTextMode para aplicarlos
 * sin necesidad de refrescar la página.
 * También verificamos si hay sugerencias predefinidas para este dominio.
 */
chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "editTextMode", "activeDomains"], data => {
  const isActive = data.extensionActive ?? false;
  const isEditing = data.editMode ?? false;
  deleteMode = data.deleteMode ?? false;
  editTextMode = data.editTextMode ?? false;
  const domain = window.location.hostname;
  
  // Restaurar dominios activos del storage
  if (data.activeDomains) {
    activeDomains = new Set(data.activeDomains);
  }
  
  console.log("Estado inicial:", {
    isActive,
    isEditing,
    deleteMode,
    editTextMode,
    domain: domain,
    isDomainActive: activeDomains.has(domain)
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

  if (isActive && activeDomains.has(domain)) {
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

// Función para manejar URLs de imágenes de forma segura
function getSafeImageUrl(imageName) {
  try {
    return chrome.runtime.getURL(imageName);
  } catch (error) {
    console.warn(`No se pudo obtener URL para ${imageName}:`, error);
    // Devolver una imagen transparente como fallback
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}
