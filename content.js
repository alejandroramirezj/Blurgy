// content.js

// Observador para re-aplicar blur en cambios dinámicos (AJAX, etc.)
let blurObserver = null;

// Indica si el modo edición (selección) está activo
let selectionMode = false;

/**
 * Inyecta estilos (.blur-extension y .hover-highlight)
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
      .blur-extension.hover-highlight {
        outline: 2px dashed #dc3545 !important;
        background: rgba(220,53,69,0.1) !important;
        cursor: pointer !important;
      }
      .hover-highlight {
        outline: 2px dashed #007aff !important;
        background: rgba(0,122,255,0.1) !important;
        cursor: pointer !important;
      }
      .hover-highlight::before {
        content: '';
        position: fixed !important;
        transform: translateY(-100%) !important;
        width: 24px;
        height: 24px;
        background-image: url(${chrome.runtime.getURL('activado.png')});
        background-size: contain;
        background-repeat: no-repeat;
        z-index: 999999;
      }
      .blur-extension.hover-highlight::before {
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
 * Aplica la clase .blur-extension a todos los selectores guardados
 * para el dominio actual, según 'blurSelectors' en chrome.storage.
 */
function applyStoredBlur() {
  injectGlobalStyles();

  chrome.storage.local.get("blurSelectors", data => {
    const store = data.blurSelectors || {};
    const domain = window.location.hostname;
    // Verificamos que exista y sea un array
    if (!store[domain] || !Array.isArray(store[domain])) return;

    store[domain].forEach(item => {
      const selector = (typeof item === "string") ? item : item.selector;
      try {
        // Intentamos aplicar la clase a cada elemento que coincida con el selector
        document.querySelectorAll(selector).forEach(el => {
          if (
            // Excluir elementos específicos de ser difuminados:
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
  });
}

/**
 * Inicia un MutationObserver que vuelve a llamar a applyStoredBlur()
 * tras cada cambio importante en el DOM, para reflejar elementos nuevos
 * que requieran difuminado.
 */
function startBlurObserver() {
  if (blurObserver) blurObserver.disconnect();

  blurObserver = new MutationObserver(() => {
    applyStoredBlur();
  });
  blurObserver.observe(document.body, { childList: true, subtree: true });
}

/** Activa el modo edición (resaltar y clic para (des)aplicar blur). */
function enableSelectionMode() {
  selectionMode = true;
  document.addEventListener("mouseover", highlightElement);
  document.addEventListener("mouseout", unhighlightElement);
  document.addEventListener("click", handleElementClick, true);
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
 * le añadimos la clase .hover-highlight.
 */
function highlightElement(evt) {
  if (selectionMode) {
    evt.target.classList.add("hover-highlight");
  }
}

/**
 * Quitamos la clase .hover-highlight al salir del elemento.
 */
function unhighlightElement(evt) {
  evt.target.classList.remove("hover-highlight");
}

/**
 * Maneja el clic en un elemento durante el modo edición:
 *  - Si ya está difuminado => quitamos la clase .blur-extension y lo eliminamos del storage
 *  - Si no => lo difuminamos y lo añadimos al storage
 */
function handleElementClick(evt) {
  if (!selectionMode) return;

  evt.preventDefault();
  evt.stopPropagation();

  const el = evt.target;
  const selector = getCssPath(el);

  // Si ya está difuminado, lo quitamos
  if (el.classList.contains("blur-extension")) {
    el.classList.remove("blur-extension");
    removeSelectorFromStorage(selector);
  } else {
    // Si no, lo difuminamos
    el.classList.add("blur-extension");
    addSelectorToStorage(selector);
  }
  // Quitamos siempre la clase de hover al hacer clic
  el.classList.remove("hover-highlight");
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

  // 2) Filtramos la clase efímera 'hover-highlight'
  const stableClasses = Array.from(el.classList).filter(cls => cls !== "hover-highlight");
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
    let sel = current.nodeName.toLowerCase();
    if (current.id) {
      sel += "#" + current.id;
      path.unshift(sel);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.nodeName.toLowerCase() === sel) nth++;
      }
      sel += `:nth-of-type(${nth})`;
    }
    path.unshift(sel);
    current = current.parentNode;
  }

  return path.join(" > ");
}

/** Añade un selector al almacenamiento (dominio actual). */
function addSelectorToStorage(selector) {
  chrome.storage.local.get("blurSelectors", data => {
    const store = data.blurSelectors || {};
    const domain = window.location.hostname;
    if (!store[domain]) {
      store[domain] = [];
    }
    store[domain].push({ selector, name: "Nuevo blur" });

    chrome.storage.local.set({ blurSelectors: store });
  });
}

/**
 * Quita un selector del almacenamiento (dominio actual).
 */
function removeSelectorFromStorage(selector) {
  chrome.storage.local.get("blurSelectors", data => {
    const store = data.blurSelectors || {};
    const domain = window.location.hostname;
    if (!store[domain] || !Array.isArray(store[domain])) return;

    store[domain] = store[domain].filter(item => {
      if (typeof item === "string") {
        return item !== selector;
      } else {
        return item.selector !== selector;
      }
    });

    chrome.storage.local.set({ blurSelectors: store });
  });
}

/**
 * Recibe mensajes desde popup.js para:
 *  - toggleExtension: activar/desactivar difuminado
 *  - toggleEditMode: activar/desactivar modo edición
 *  - reApplyBlur: volver a aplicar el difuminado sin refrescar
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "toggleExtension") {
    if (msg.enable) {
      applyStoredBlur();
      startBlurObserver();
    } else {
      turnOffExtension();
    }
  }
  else if (msg.action === "toggleEditMode") {
    if (msg.enable) {
      enableSelectionMode();
    } else {
      disableSelectionMode();
    }
  }
  else if (msg.action === "reApplyBlur") {
    reApplyBlur();
  }
});

/**
 * Desactiva totalmente la extensión:
 *  - Quita .blur-extension de todos los elementos
 *  - Remueve estilos
 *  - Desactiva modo edición
 *  - Desconecta el observer
 */
function turnOffExtension() {
  document.querySelectorAll(".blur-extension").forEach(el => {
    el.classList.remove("blur-extension");
  });
  const styleEl = document.getElementById("blur-style-extension");
  if (styleEl) styleEl.remove();

  disableSelectionMode();
  if (blurObserver) blurObserver.disconnect();
}

/**
 * Re-aplica el difuminado sin refrescar la página:
 *  - Quita todos los .blur-extension
 *  - Asegura estilos inyectados
 *  - Llama a applyStoredBlur() de nuevo
 */
function reApplyBlur() {
  document.querySelectorAll(".blur-extension").forEach(el => {
    el.classList.remove("blur-extension");
  });
  injectGlobalStyles();
  applyStoredBlur();
}

/**
 * También reaccionamos a cambios en el almacenamiento (extensionActive, editMode):
 *  - Si se activa la extensión => aplicar blur y observer
 *  - Si se desactiva => turnOffExtension()
 *  - Si se activa editMode => enableSelectionMode()
 *  - Si se desactiva => disableSelectionMode()
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.extensionActive) {
    const newVal = changes.extensionActive.newValue;
    if (newVal) {
      applyStoredBlur();
      startBlurObserver();
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
});

/**
 * Al cargar, leemos extensionActive y editMode para aplicarlos
 * sin necesidad de refrescar la página.
 */
chrome.storage.local.get(["extensionActive", "editMode"], data => {
  const isActive = data.extensionActive ?? true;
  const isEditing = data.editMode ?? false;

  if (isActive) {
    applyStoredBlur();
    startBlurObserver();
  }
  if (isEditing) {
    enableSelectionMode();
  }
});
