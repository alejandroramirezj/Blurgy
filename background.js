// background.js

// Al instalar/iniciar, sincronizamos el icono con el estado en storage y configuramos los blurs por defecto.
chrome.runtime.onInstalled.addListener(() => {
    syncIconWithState();
    setDefaultBlurSelectors();
});

chrome.runtime.onStartup.addListener(() => {
    syncIconWithState();
});

// Si cambia extensionActive, refrescamos el icono
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.extensionActive) {
        syncIconWithState(changes.extensionActive.newValue);
    }
});

// Función para establecer los blurs por defecto
function setDefaultBlurSelectors() {
    const defaultBlurSelectors = {};

    chrome.storage.local.set({ blurSelectors_Global: defaultBlurSelectors, editMode: false }, () => {
        console.log("Blurs por defecto establecidos.");
    });
}

/** 
 * Llama a setIcon(isActive) con el valor actual de extensionActive,
 * a menos que se provea 'forceValue' (true|false).
 */
function syncIconWithState(forceValue) {
    if (typeof forceValue === "boolean") {
        setIcon(forceValue);
    } else {
        chrome.storage.local.get("extensionActive", data => {
            const isActive = data.extensionActive ?? true; // Por defecto, digamos que arranque activo.
            setIcon(isActive);
        });
    }
}

/** 
 * Pone el ícono de la barra en 'activado.png' o 'desactivado.png'.
 */
function setIcon(isActive) {
    const path = isActive ? "activado.png" : "desactivado.png";
    chrome.action.setIcon({
        path: {
            "16": path,
            "48": path,
            "128": path
        }
    });
}
  