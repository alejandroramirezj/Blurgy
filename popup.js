// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const toggleEdit = document.getElementById("toggleEdit");
  const toggleExtensionBtn = document.getElementById("toggleExtension");
  const extensionStateImage = document.getElementById("extensionStateImage");
  const domainWrapper = document.getElementById("domainWrapper");
  const suggestedWrapper = document.getElementById("suggestedWrapper");
  const importBtn = document.getElementById("importBlur");
  const importBlurButton = document.getElementById("importBlurButton");
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Gestión de pestañas
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Quitar la clase activa de todas las pestañas
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Añadir la clase activa a la pestaña clickeada
      tab.classList.add('active');
      
      // Mostrar el contenido correspondiente
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Notificación flotante básica
  function showNotification(message, duration = 2000) {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.bottom = "16px";
    div.style.left = "50%";
    div.style.transform = "translateX(-50%)";
    div.style.background = "#48bb78";
    div.style.color = "#fff";
    div.style.padding = "8px 16px";
    div.style.borderRadius = "8px";
    div.style.fontSize = "14px";
    div.style.zIndex = "9999";
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), duration);
  }

  // Refresca el botón e imagen superior (activado.png / desactivado.png)
  function refreshExtensionToggleUI() {
    chrome.storage.local.get("extensionActive", data => {
      const active = data.extensionActive ?? true;
      toggleExtensionBtn.innerHTML = `
        <span class="toggle-icon">${active ? "🚫" : "🎯"}</span>
        <span class="toggle-text">${active ? "Desactivar" : "Activar"} Extensión</span>
      `;
      toggleExtensionBtn.className = `btn ${active ? "btn-secondary" : "btn-primary"}`;
      if (extensionStateImage) {
        extensionStateImage.src = active ? "activado.png" : "desactivado.png";
      }
    });
  }

  // Pulsar botón => invertimos extensionActive
  toggleExtensionBtn.addEventListener("click", () => {
    chrome.storage.local.get("extensionActive", data => {
      const wasActive = data.extensionActive ?? true;
      const newState = !wasActive;

      chrome.storage.local.set({ extensionActive: newState }, () => {
        refreshExtensionToggleUI();
        // Avisar al content script
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleExtension",
              enable: newState
            });
          }
        });
        showNotification(newState ? "🎉 Extensión activada" : "👋 Extensión desactivada");
      });
    });
  });

  // Modo selección
  function refreshEditCheckbox() {
    chrome.storage.local.get("editMode", data => {
      const isEditing = data.editMode ?? false;
      toggleEdit.checked = isEditing;
      
      // Actualizar imagen del selector
      const selectorImg = document.getElementById("selectorStateImage");
      if (selectorImg) {
        selectorImg.src = "activado.png";
        selectorImg.style.display = isEditing ? "block" : "none";
      }
    });
  }

  function toggleEditMode() {
    const isOn = toggleEdit.checked;
    chrome.storage.local.get("extensionActive", data => {
      const isActive = data.extensionActive ?? true;

      // Si la extensión no está activa, activarla
      if (!isActive) {
        chrome.storage.local.set({ extensionActive: true }, () => {
          refreshExtensionToggleUI(); // Actualiza la UI del toggle de extensión
          // Avisar al content script
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "toggleExtension",
                enable: true
              });
            }
          });
        });
      }

      // Actualizar el modo de edición
      chrome.storage.local.set({ editMode: isOn }, () => {
        const selectorImg = document.getElementById("selectorStateImage");
        if (selectorImg) {
          selectorImg.src = "activado.png";
          selectorImg.style.display = isOn ? "block" : "none";
        }

        // Avisar content script
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleEditMode",
              enable: isOn
            });
          }
        });
        showNotification(isOn ? "🎯 Modo selección activado" : "🚫 Modo selección desactivado");
      });
    });
  }
  toggleEdit.addEventListener("change", toggleEditMode);

  // Construir UI del dominio actual
  function buildDomainUI(domain) {
    chrome.storage.local.get("blurSelectors", data => {
      const store = data.blurSelectors || {};
      const items = store[domain] || [];

      if (items.length === 0) {
        domainWrapper.innerHTML = `
          <div class="empty-state">
            No hay elementos blureados para <strong>${domain}</strong>
          </div>
        `;
        return;
      }

      let html = `
        <details open>
          <summary>${domain} (${items.length} blur${items.length !== 1 ? "s" : ""})</summary>
          <div class="blur-items">
      `;
      items.forEach((item, i) => {
        const sel = typeof item === "string" ? item : item.selector;
        const nm = (typeof item === "object" && item.name) ? item.name : getDefaultNameForSelector(sel);
        const isPreset = typeof item === "object" && item.isPreset === true;
        
        html += `
          <div class="blur-item ${isPreset ? 'preset-item' : ''}">
            <span class="blur-name">${i + 1}. ${nm}</span>
            <div class="buttons-blur">
              <button class="rename-blur" data-domain="${domain}" data-selector="${sel}">✏️</button>
              <button class="remove-blur" data-domain="${domain}" data-selector="${sel}">❌</button>
            </div>
          </div>
        `;
      });
      html += `</div></details>`;
      domainWrapper.innerHTML = html;

      // Listeners para renombrar/eliminar
      domainWrapper.querySelectorAll(".rename-blur").forEach(btn => {
        btn.addEventListener("click", () => {
          inlineRenameBlur(btn.dataset.domain, btn.dataset.selector, btn.closest(".blur-item"));
        });
      });
      domainWrapper.querySelectorAll(".remove-blur").forEach(btn => {
        btn.addEventListener("click", () => {
          removeBlur(btn.dataset.domain, btn.dataset.selector);
        });
      });
    });
    
    // Ahora también construimos las sugerencias
    buildSuggestionsUI(domain);
  }
  
  // Construir UI para sugerencias con animaciones
  function buildSuggestionsUI(domain) {
    // Si no tenemos sugerencias para este dominio, mostramos un mensaje
    if (!PREDEFINED_BLURS[domain] || PREDEFINED_BLURS[domain].length === 0) {
      suggestedWrapper.innerHTML = `
        <div class="empty-state">
          No hay sugerencias disponibles para <strong>${domain}</strong>
        </div>
      `;
      return;
    }
    
    // Obtenemos los selectores ya activos para no mostrarlos en las sugerencias
    chrome.storage.local.get("blurSelectors", data => {
      const store = data.blurSelectors || {};
      const activeSelectors = (store[domain] || []).map(item => 
        typeof item === "string" ? item : item.selector
      );
      
      // Filtramos las sugerencias que no estén ya activas
      const suggestions = PREDEFINED_BLURS[domain].filter(item => 
        !activeSelectors.includes(item.selector)
      );
      
      if (suggestions.length === 0) {
        suggestedWrapper.innerHTML = `
          <div class="empty-state">
            Todas las sugerencias ya están activas en <strong>${domain}</strong>
          </div>
        `;
        return;
      }
      
      let html = `
        <details open>
          <summary>Sugerencias para ${domain} (${suggestions.length})</summary>
          <div class="blur-items">
      `;
      
      suggestions.forEach((item, i) => {
        html += `
          <div class="blur-item preset-item">
            <span class="blur-name">${i + 1}. ${item.name}</span>
            <div class="buttons-blur">
              <button class="add-blur" data-domain="${domain}" data-selector="${item.selector}" data-name="${item.name}">➕</button>
            </div>
          </div>
        `;
      });
      
      html += `</div></details>`;
      suggestedWrapper.innerHTML = html;
      
      // Listeners para agregar sugerencias
      suggestedWrapper.querySelectorAll(".add-blur").forEach(btn => {
        btn.addEventListener("click", () => {
          addSuggestion(btn.dataset.domain, btn.dataset.selector, btn.dataset.name);
        });
      });
    });
  }
  
  // Agregar una sugerencia a los blurs activos
  function addSuggestion(domain, selector, name) {
    chrome.storage.local.get("blurSelectors", data => {
      const store = data.blurSelectors || {};
      if (!store[domain]) {
        store[domain] = [];
      }
      
      // Verificamos que no esté ya para evitar duplicados
      const exists = store[domain].some(item => {
        if (typeof item === "string") {
          return item === selector;
        } else {
          return item.selector === selector;
        }
      });
      
      if (exists) {
        showNotification("⚠️ Este elemento ya está activo");
        return;
      }
      
      // Agregamos la sugerencia marcada como preset
      store[domain].push({ 
        selector, 
        name, 
        isPreset: true 
      });
      
      chrome.storage.local.set({ blurSelectors: store }, () => {
        showNotification("✅ Sugerencia activada");
        
        // Actualizamos las interfaces
        buildDomainUI(domain);
        buildSuggestionsUI(domain);
        
        // Re-aplicar blur sin refrescar
        reApplyBlurInTab();
      });
    });
  }

  // Renombrado inline
  function inlineRenameBlur(domain, selector, blurItemEl) {
    const nameSpan = blurItemEl.querySelector(".blur-name");
    const originalText = nameSpan.textContent || "";
    // Quitar "1. " del comienzo si existe
    const splitted = originalText.split(". ");
    splitted.shift();
    const existingName = splitted.join(". ").trim();

    nameSpan.contentEditable = "true";
    nameSpan.focus();
    nameSpan.textContent = existingName;

    const onKeyDown = e => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameSpan.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Restaurar el texto original
        nameSpan.textContent = originalText;
        // Quitar listeners
        nameSpan.removeEventListener("keydown", onKeyDown);
        nameSpan.removeEventListener("blur", onBlur);
        nameSpan.contentEditable = "false";
      }
    };
    const onBlur = () => {
      const newName = nameSpan.textContent.trim() || existingName;
      nameSpan.removeEventListener("keydown", onKeyDown);
      nameSpan.removeEventListener("blur", onBlur);
      nameSpan.contentEditable = "false";

      renameBlurInStorage(domain, selector, newName);
    };
    nameSpan.addEventListener("keydown", onKeyDown);
    nameSpan.addEventListener("blur", onBlur);
  }

  function renameBlurInStorage(domain, selector, newName) {
    chrome.storage.local.get("blurSelectors", data => {
      const store = data.blurSelectors || {};
      if (!store[domain]) return;

      store[domain] = store[domain].map(it => {
        if (typeof it === "string") {
          if (it === selector) return { selector, name: newName };
          return it;
        } else {
          if (it.selector === selector) {
            // Preservamos isPreset si existe
            const isPreset = it.isPreset || false;
            return { selector, name: newName, isPreset };
          }
          return it;
        }
      });
      chrome.storage.local.set({ blurSelectors: store }, () => {
        showNotification("✏️ Blur renombrado");
        buildDomainUI(domain);
        // Re-aplicar en la pestaña sin refrescar
        reApplyBlurInTab();
      });
    });
  }

  // Eliminar blur
  function removeBlur(domain, selector) {
    chrome.storage.local.get("blurSelectors", data => {
      const store = data.blurSelectors || {};
      if (!store[domain]) return;

      store[domain] = store[domain].filter(it => {
        if (typeof it === "string") {
          return it !== selector;
        } else {
          return it.selector !== selector;
        }
      });
      chrome.storage.local.set({ blurSelectors: store }, () => {
        showNotification("🗑️ Blur eliminado");
        buildDomainUI(domain);
        // Re-aplicar en la pestaña sin refrescar
        reApplyBlurInTab();
      });
    });
  }

  // Manda mensaje al content script para re-aplicar blur sin refrescar
  function reApplyBlurInTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "reApplyBlur"
        });
      }
    });
  }

  // Nombre por defecto para un selector (p.ej. "img" => "Imagen")
  function getDefaultNameForSelector(selector) {
    const lastPart = selector.split(">").pop().trim();
    const base = lastPart.split(/[.#[]/)[0].toLowerCase();
    const map = {
      button: "Botón",
      img: "Imagen",
      table: "Tabla",
      h1: "Título", h2: "Título", h3: "Título",
      h4: "Título", h5: "Título", h6: "Título",
      input: "Campo",
      textarea: "Área de texto",
      select: "Selector",
      a: "Enlace",
      video: "Video",
      audio: "Audio",
      ul: "Lista", ol: "Lista", li: "Ítem",
      nav: "Navegación",
      form: "Formulario",
      div: "Contenedor",
      p: "Párrafo",
      span: "Texto"
    };
    return map[base] || "Elemento";
  }

  // Exportar config
  document.getElementById("exportBlur").addEventListener("click", () => {
    chrome.storage.local.get(null, data => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "blur_config.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification("📤 Configuración exportada");
    });
  });

  // Importar config
  importBlurButton.addEventListener("click", () => {
    importBtn.click();
  });
  importBtn.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const config = JSON.parse(evt.target.result);
        // Validación mínima
        if (!config.blurSelectors) {
          throw new Error("Formato inválido: falta 'blurSelectors'");
        }
        chrome.storage.local.set(config, () => {
          showNotification("📥 Configuración importada");
          // Reactivar y re-aplicar
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs && tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "toggleExtension",
                enable: true
              });
              const domain = new URL(tabs[0].url).hostname;
              buildDomainUI(domain);
            }
          });
          refreshExtensionToggleUI();
        });
      } catch (err) {
        showNotification("❌ Error al importar: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Añadir oyente para mensajes del content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "selectorAdded" || msg.action === "selectorRemoved") {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs && tabs.length > 0) {
          const domain = new URL(tabs[0].url).hostname;
          buildDomainUI(domain);
        }
      });
    }
  });

  // Inicializar
  function init() {
    refreshEditCheckbox();
    refreshExtensionToggleUI();
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        const domain = new URL(tabs[0].url).hostname;
        buildDomainUI(domain);
      }
    });
  }
  init();
});
