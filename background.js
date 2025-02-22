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
    const defaultBlurSelectors = {
        "portal.clever.gy": [
            {
                "name": "Logo cliente actual",
                "selector": "span[data-slot='value']"
            },
            {
                "name": "Logos clientes",
                "selector": "div[data-slot='content'][data-open='true']"
            },
            {
                "name": "Datos tabla instalaciones",
                "selector": "table[aria-label='Instalaciones'] > tbody td:nth-child(2), table[aria-label='Instalaciones'] > tbody td:nth-child(3)"
            },
            {
                "name": "Tabla de usuarios",
                "selector": "table[aria-label='Usuarios'] > tbody td:nth-child(2), table[aria-label='Usuarios'] > tbody td:nth-child(3), table[aria-label='Usuarios'] > tbody td:nth-child(4), table[aria-label='Usuarios'] > tbody td:nth-child(5)"
            },
            {
                "name": "Tabla Comunidades Energéticas",
                "selector": "table[aria-label='Comunidades energéticas'] > tbody td:nth-child(1), table[aria-label='Comunidades energéticas'] > tbody td:nth-child(2)"
            },
            {
                "name": "Listado de tickets",
                "selector": "table[aria-label='Listado de tickets'] > tbody td:nth-child(2), table[aria-label='Listado de tickets'] > tbody td:nth-child(3)"
            },
            {
                "name": "Listado de inversores",
                "selector": "table[aria-label='Listado de inversores'] > tbody td:nth-child(1)"
            },
            {
                "name": "Listado de oportunidades de venta",
                "selector": "table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(3), table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(4), table[aria-label='Listado de oportunidades de venta'] > tbody td:nth-child(5)"
            }
        ]
    };

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
  