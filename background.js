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
    // Comenzar con un objeto vacío
    const defaultBlurSelectors = {};
    
    // Configuración inicial para que la extensión esté activa por defecto
    chrome.storage.local.set({ 
        blurSelectors: defaultBlurSelectors, 
        editMode: false,
        extensionActive: true
    }, () => {
        console.log("Configuración inicial establecida.");
    });
    
    // Asegurarnos que predefined_blurs.js está cargado correctamente
    // Nota: esto se gestionará principalmente desde el popup
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
 * Pone el ícono de la barra según el estado (activado o desactivado),
 * usando archivos distintos para cada tamaño (16, 48, 128).
 */
function setIcon(isActive) {
    const path16 = isActive ? "activado16.png" : "desactivado16.png";
    const path48 = isActive ? "activado48.png" : "desactivado48.png";
    const path128 = isActive ? "activado128.png" : "desactivado128.png";

    chrome.action.setIcon({
        path: {
            "16": path16,
            "48": path48,
            "128": path128
        }
    });
}
