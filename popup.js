document.addEventListener("DOMContentLoaded", () => {
  const toggleEdit = document.getElementById("toggleEdit");
  const toggleExtensionBtn = document.getElementById("toggleExtension");
  const blurStateImage = document.getElementById("blurStateImage");
  const deleteStateImage = document.getElementById("deleteStateImage");
  const domainWrapper = document.getElementById("domainWrapper");
  const suggestedWrapper = document.getElementById("suggestedWrapper");
  const importBtn = document.getElementById("importBlur");
  const importBlurButton = document.getElementById("importBlurButton");
  const modeSelector = document.getElementById("modeSelector");
  const modeOptions = document.querySelectorAll('.mode-option');
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

  // Refresca el botón e imagen superior
  function refreshExtensionToggleUI() {
    chrome.storage.local.get("extensionActive", data => {
      const active = data.extensionActive ?? false;
      toggleExtensionBtn.innerHTML = `
        <span class="toggle-icon">${active ? "🚫" : "🎯"}</span>
        <span class="toggle-text">${active ? "Desactivar" : "Activar"} Extensión</span>
      `;
      toggleExtensionBtn.className = `btn ${active ? "btn-secondary" : "btn-primary"}`;
      
      // Actualizar personajes
      updateCharacters();
    });
  }

  // Crear iconos para los modos blur y borrar
  function createModeIcons() {
    const blurOption = document.querySelector('.mode-option[data-mode="blur"]');
    const deleteOption = document.querySelector('.mode-option[data-mode="delete"]');
    
    // Eliminar iconos existentes si los hay para evitar duplicados
    const existingBlurIcon = document.getElementById("modeBlurIcon");
    const existingDeleteIcon = document.getElementById("modeDeleteIcon");
    
    if (existingBlurIcon) existingBlurIcon.remove();
    if (existingDeleteIcon) existingDeleteIcon.remove();
    
    // Crear nuevo icono para modo blur
    if (blurOption) {
      const modeBlurIcon = document.createElement("img");
      modeBlurIcon.id = "modeBlurIcon";
      modeBlurIcon.className = "mode-icon";
      modeBlurIcon.src = "blur.png";
      modeBlurIcon.alt = "Modo Blur";
      modeBlurIcon.style.backgroundColor = "transparent";
      modeBlurIcon.style.objectFit = "contain";
      blurOption.appendChild(modeBlurIcon);
    }
    
    // Crear nuevo icono para modo borrar
    if (deleteOption) {
      const modeDeleteIcon = document.createElement("img");
      modeDeleteIcon.id = "modeDeleteIcon";
      modeDeleteIcon.className = "mode-icon";
      modeDeleteIcon.src = "borrar.png";
      modeDeleteIcon.alt = "Modo Borrar";
      modeDeleteIcon.style.backgroundColor = "transparent";
      modeDeleteIcon.style.objectFit = "contain";
      deleteOption.appendChild(modeDeleteIcon);
    }
  }

  // Función actualizada para gestionar los iconos de estado
  function updateStateIcons() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        const domain = new URL(tabs[0].url).hostname;
        
        chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors"], data => {
          const isActive = data.extensionActive ?? false;
          const disabledStateImage = document.getElementById("disabledStateImage");
          const blurStateImage = document.getElementById("blurStateImage");
          const deleteStateImage = document.getElementById("deleteStateImage");
          
          // Verificar si existen los elementos
          if (!disabledStateImage || !blurStateImage || !deleteStateImage) {
            console.error("No se encontraron todos los elementos de estado en el DOM");
            return;
          }
          
          // Primero ocultamos todos los iconos
          disabledStateImage.style.display = "none";
          blurStateImage.style.display = "none";
          deleteStateImage.style.display = "none";
          
          // Hacemos las imágenes de estado más grandes
          blurStateImage.style.width = "100px";  // Aumentado de 38px a 100px
          blurStateImage.style.height = "100px"; // Aumentado de 38px a 100px
          deleteStateImage.style.width = "100px"; // Aumentado de 38px a 100px
          deleteStateImage.style.height = "100px"; // Aumentado de 38px a 100px
          disabledStateImage.style.width = "100px"; // Aumentado de 38px a 100px
          disabledStateImage.style.height = "100px"; // Aumentado de 38px a 100px
          
          // Asegurar que los iconos tengan un z-index alto
          blurStateImage.style.zIndex = "1000";
          deleteStateImage.style.zIndex = "1000";
          disabledStateImage.style.zIndex = "1000";
          
          if (!isActive) {
            // Si la extensión está desactivada, SIEMPRE mostramos el icono de desactivado
            disabledStateImage.style.display = "block";
            return;
          }
          
          // Si está activada, verificamos qué elementos hay en la página
          const hasBlurElements = data.blurSelectors && 
                                 data.blurSelectors[domain] && 
                                 data.blurSelectors[domain].length > 0;
          
          const hasDeleteElements = data.deleteSelectors && 
                                   data.deleteSelectors[domain] && 
                                   data.deleteSelectors[domain].length > 0;
          
          // Mostrar los iconos correspondientes
          if (hasBlurElements) {
            blurStateImage.style.display = "block";
            blurStateImage.style.zIndex = "10000"; // Aseguramos que esté por encima
          }
          
          if (hasDeleteElements) {
            deleteStateImage.style.display = "block";
            deleteStateImage.style.zIndex = "10000"; // Aseguramos que esté por encima
          }
          
          // Si no hay ningún elemento pero la extensión está activa, mostramos el icono de blur por defecto
          if (!hasBlurElements && !hasDeleteElements) {
            blurStateImage.style.display = "block";
            blurStateImage.style.zIndex = "10000"; // Aseguramos que esté por encima
          }
          
          // Actualizar también los personajes
          updateCharacters();
        });
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
        updateStateIcons(); // Actualizar los iconos inmediatamente después de activar/desactivar
        
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
    chrome.storage.local.get(["extensionActive", "editMode", "deleteMode"], data => {
      const isActive = data.extensionActive ?? false;
      const isEditing = data.editMode ?? false;
      const isDeleting = data.deleteMode ?? false;
      
      // Solo mostrar el toggle como activado si la extensión está activa y el modo edición está activado
      toggleEdit.checked = isActive && isEditing;
      
      // Mostrar/ocultar selector de modo según corresponda
      modeSelector.style.display = (isActive && isEditing) ? "flex" : "none";
      
      // Actualizar opciones de modo
      modeOptions.forEach(option => {
        if (option.dataset.mode === 'blur') {
          option.classList.toggle('active', !isDeleting);
        } else if (option.dataset.mode === 'delete') {
          option.classList.toggle('active', isDeleting);
        }
      });
      
      // Actualizar iconos de estado
      refreshStateIcons();
    });
  }

  // Actualizar iconos de estado en base a la configuración y elementos en la página
  function refreshStateIcons() {
    // Primero obtenemos el dominio actual de la pestaña activa
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        const domain = new URL(tabs[0].url).hostname;
        
        chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors"], data => {
          const isActive = data.extensionActive ?? false;
          
          // Verificar si hay elementos con blur en este dominio
          const blurActive = isActive && 
            data.blurSelectors && 
            data.blurSelectors[domain] && 
            data.blurSelectors[domain].length > 0;
          
          // Verificar si hay elementos borrados en este dominio
          const deleteActive = isActive && 
            data.deleteSelectors && 
            data.deleteSelectors[domain] && 
            data.deleteSelectors[domain].length > 0;
          
          // Actualizar visibilidad de los iconos - asegurarse que están visibles
          const blurStateImage = document.getElementById("blurStateImage");
          const deleteStateImage = document.getElementById("deleteStateImage");
          const disabledStateImage = document.getElementById("disabledStateImage");
          
          // Primero ocultamos todos los iconos
          if (disabledStateImage) disabledStateImage.style.display = "none";
          if (blurStateImage) blurStateImage.style.display = "none";
          if (deleteStateImage) deleteStateImage.style.display = "none";
          
          if (!isActive) {
            // Si la extensión está desactivada, mostramos el icono de desactivado
            if (disabledStateImage) disabledStateImage.style.display = "block";
            return;
          }
          
          // Mostrar los iconos correspondientes según el estado
          if (blurActive && blurStateImage) {
            blurStateImage.style.display = "block";
            blurStateImage.style.zIndex = "9999";
          }
          
          if (deleteActive && deleteStateImage) {
            deleteStateImage.style.display = "block";
            deleteStateImage.style.zIndex = "9999";
          }
          
          // Si no hay ningún elemento pero la extensión está activa, mostramos el icono de blur por defecto
          if (!blurActive && !deleteActive && blurStateImage) {
            blurStateImage.style.display = "block";
            blurStateImage.style.zIndex = "9999";
          }
          
          // Actualizar también los personajes
          updateCharacters();
        });
      }
    });
  }

  function toggleEditMode() {
    const isOn = toggleEdit.checked;
    
    if (isOn) {
      // Si activamos el toggle, asegurarse que la extensión también se active
      chrome.storage.local.set({ 
        extensionActive: true,  // Activar extensión automáticamente
        editMode: true          // Activar modo edición
      }, () => {
        // Actualizar UI completa
        refreshExtensionToggleUI();
        refreshStateIcons();
        modeSelector.style.display = "flex";
        
        // Añadimos los iconos de modo
        createModeIcons();
        
        // Actualizamos la visibilidad de los iconos según el modo activo
        chrome.storage.local.get("deleteMode", data => {
          const isDeleteMode = data.deleteMode ?? false;
          const modeBlurIcon = document.getElementById("modeBlurIcon");
          const modeDeleteIcon = document.getElementById("modeDeleteIcon");
          
          if (modeBlurIcon) modeBlurIcon.style.display = !isDeleteMode ? "block" : "none";
          if (modeDeleteIcon) modeDeleteIcon.style.display = isDeleteMode ? "block" : "none";
        });
        
        // Notificar al content script
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs && tabs.length > 0) {
            // Primero activar la extensión
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleExtension",
              enable: true
            }, (response) => {
              // Comprobar si hay errores de conexión (podría pasar si el content script no está cargado)
              if (chrome.runtime.lastError) {
                console.error("Error al activar extensión:", chrome.runtime.lastError);
                // Inyectar el content script si hay error
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  files: ['content.js']
                }).then(() => {
                  // Reintentamos activar la extensión
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: "toggleExtension",
                      enable: true
                    });
                  }, 200);
                });
                return;
              }
              
              // Después activar el modo edición
              chrome.storage.local.get("deleteMode", deleteData => {
                const isDeleting = deleteData.deleteMode ?? false;
                
                // Forzar tiempo de espera para asegurar que los cambios previos se han aplicado
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggleEditMode",
                    enable: true,
                    deleteMode: isDeleting
                  }, (response) => {
                    // Verificar si la respuesta indica éxito
                    if (response && response.success) {
                      console.log("Modo edición activado:", response);
                    } else {
                      console.warn("No se recibió confirmación de activación");
                    }
                    
                    // Obtener el dominio actual y reconstruir la UI para reflejar cambios
                    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                      if (tabs && tabs.length > 0) {
                        const domain = new URL(tabs[0].url).hostname;
                        buildDomainUI(domain);
                        
                        // Forzar reAplicación después de un breve tiempo para asegurar que todo está aplicado
                        setTimeout(() => reApplyInTab(), 300);
                      }
                    });
                  });
                }, 200);
              });
            });
          }
        });
        
        showNotification("🎯 Modo selección activado");
      });
    } else {
      // Si desactivamos el toggle, solo desactivamos el modo edición
      chrome.storage.local.set({ editMode: false }, () => {
        modeSelector.style.display = "none";
        refreshStateIcons();
        
        // Notificar al content script
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleEditMode",
              enable: false
            }, () => {
              if (chrome.runtime.lastError) {
                console.error("Error al desactivar modo edición:", chrome.runtime.lastError);
                return;
              }
              
              // Obtener el dominio actual y reconstruir la UI
              const domain = new URL(tabs[0].url).hostname;
              buildDomainUI(domain);
            });
          }
        });
        
        showNotification("📌 Modo selección desactivado");
      });
    }
  }
  
  // Manejar el cambio de modo (blur o borrar)
  modeOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      // Prevenir comportamiento por defecto
      e.preventDefault();
      e.stopPropagation();
      
      // Obtener el modo del atributo data-mode
      const newMode = option.getAttribute('data-mode');
      const isDeleteMode = newMode === 'delete';
      
      // Verificar si el modo es diferente al actual
      chrome.storage.local.get("deleteMode", data => {
        const currentDeleteMode = data.deleteMode ?? false;
        
        // Solo cambiamos si es diferente
        if (currentDeleteMode !== isDeleteMode) {
          // Actualizar la UI inmediatamente para mejor feedback
          modeOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          
          // Llamar a la función de cambio de modo
          switchModes(isDeleteMode);
          
          // Añadir iconos de modo
          createModeIcons();
          
          // Actualizar la visibilidad de los iconos
          const modeBlurIcon = document.getElementById("modeBlurIcon");
          const modeDeleteIcon = document.getElementById("modeDeleteIcon");
          
          if (modeBlurIcon) modeBlurIcon.style.display = !isDeleteMode ? "block" : "none";
          if (modeDeleteIcon) modeDeleteIcon.style.display = isDeleteMode ? "block" : "none";
        }
      });
    });
  });
  
  toggleEdit.addEventListener("change", toggleEditMode);

  // Construir UI del dominio actual
  function buildDomainUI(domain) {
    chrome.storage.local.get(["blurSelectors", "deleteSelectors"], data => {
      const blurStore = data.blurSelectors || {};
      const deleteStore = data.deleteSelectors || {};
      const blurItems = blurStore[domain] || [];
      const deleteItems = deleteStore[domain] || [];
      
      // Actualizamos los iconos según los elementos actuales
      refreshStateIcons();

      if (blurItems.length === 0 && deleteItems.length === 0) {
        domainWrapper.innerHTML = `
          <div class="empty-state">
            No hay elementos modificados para <strong>${domain}</strong>
          </div>
        `;
        return;
      }

      let html = "";
      
      // Elementos con blur
      if (blurItems.length > 0) {
        html += `
          <details open>
            <summary>Elementos con blur en ${domain} (${blurItems.length})</summary>
            <div class="blur-items">
        `;
        blurItems.forEach((item, i) => {
          const sel = typeof item === "string" ? item : item.selector;
          const nm = (typeof item === "object" && item.name) ? item.name : getDefaultNameForSelector(sel);
          const isPreset = typeof item === "object" && item.isPreset === true;
          
          html += `
            <div class="blur-item ${isPreset ? 'preset-item' : ''}">
              <span class="blur-name">${i + 1}. ${nm}</span>
              <div class="buttons-blur">
                <button class="rename-blur" data-domain="${domain}" data-selector="${sel}" data-type="blur">✏️</button>
                <button class="remove-blur" data-domain="${domain}" data-selector="${sel}" data-type="blur">❌</button>
              </div>
            </div>
          `;
        });
        html += `</div></details>`;
      }
      
      // Elementos borrados
      if (deleteItems.length > 0) {
        html += `
          <details open>
            <summary>Elementos borrados en ${domain} (${deleteItems.length})</summary>
            <div class="blur-items">
        `;
        deleteItems.forEach((item, i) => {
          const sel = typeof item === "string" ? item : item.selector;
          const nm = (typeof item === "object" && item.name) ? item.name : getDefaultNameForSelector(sel);
          const isPreset = typeof item === "object" && item.isPreset === true;
          
          html += `
            <div class="blur-item ${isPreset ? 'preset-item' : ''}">
              <span class="blur-name">${i + 1}. ${nm}</span>
              <div class="buttons-blur">
                <button class="rename-blur" data-domain="${domain}" data-selector="${sel}" data-type="delete">✏️</button>
                <button class="remove-blur" data-domain="${domain}" data-selector="${sel}" data-type="delete">❌</button>
              </div>
            </div>
          `;
        });
        html += `</div></details>`;
      }
      
      domainWrapper.innerHTML = html;

      // Listeners para renombrar/eliminar
      domainWrapper.querySelectorAll(".rename-blur").forEach(btn => {
        btn.addEventListener("click", () => {
          inlineRenameBlur(btn.dataset.domain, btn.dataset.selector, btn.closest(".blur-item"), btn.dataset.type);
        });
      });
      
      domainWrapper.querySelectorAll(".remove-blur").forEach(btn => {
        btn.addEventListener("click", () => {
          removeBlur(btn.dataset.domain, btn.dataset.selector, btn.dataset.type);
        });
      });

      // Actualizar personajes
      updateCharacters();
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
    chrome.storage.local.get(["blurSelectors", "deleteSelectors"], data => {
      const blurStore = data.blurSelectors || {};
      const deleteStore = data.deleteSelectors || {};
      
      const activeBlurSelectors = (blurStore[domain] || []).map(item => 
        typeof item === "string" ? item : item.selector
      );
      
      const activeDeleteSelectors = (deleteStore[domain] || []).map(item => 
        typeof item === "string" ? item : item.selector
      );
      
      // Combinamos ambos conjuntos de selectores activos
      const activeSelectors = [...activeBlurSelectors, ...activeDeleteSelectors];
      
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
        const itemType = item.type === 'delete' ? 'delete' : 'blur';
        const typeIcon = itemType === 'delete' ? '🗑️' : '💨';
        
        html += `
          <div class="blur-item preset-item ${itemType}-preset">
            <span class="blur-name">${i + 1}. ${item.name} ${typeIcon}</span>
            <div class="buttons-blur">
              <button class="add-blur" data-domain="${domain}" data-selector="${item.selector}" data-name="${item.name}" data-type="${itemType}">➕</button>
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

    // Actualizar personajes
    updateCharacters();
  }
  
  // Agregar una sugerencia a los blurs activos
  function addSuggestion(domain, selector, name) {
    // Primero verificamos si el elemento existe en predefinidos
    let suggestedType = 'blur'; // Tipo por defecto
    
    if (PREDEFINED_BLURS[domain]) {
      const suggestion = PREDEFINED_BLURS[domain].find(item => item.selector === selector);
      // Si existe en predefinidos y tiene un tipo establecido, usamos ese tipo
      if (suggestion && suggestion.type) {
        suggestedType = suggestion.type;
      }
    }
    
    // Usamos el tipo correcto para almacenar, independientemente del modo actual
    const storageKey = suggestedType === 'delete' ? "deleteSelectors" : "blurSelectors";
    
    chrome.storage.local.get(storageKey, data => {
      const store = data[storageKey] || {};
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
      
      // Agregamos la sugerencia con el tipo correcto
      store[domain].push({ 
        selector, 
        name, 
        isPreset: true,
        type: suggestedType 
      });
      
      chrome.storage.local.set({ [storageKey]: store }, () => {
        showNotification(`✅ Sugerencia ${suggestedType === "delete" ? "borrado" : "blur"} activada`);
        
        // Actualizamos las interfaces
        buildDomainUI(domain);
        buildSuggestionsUI(domain);
        
        // Re-aplicar sin refrescar
        reApplyInTab();
      });

      // Actualizar personajes
      updateCharacters();
    });
  }

  // Renombrado inline
  function inlineRenameBlur(domain, selector, blurItemEl, type = "blur") {
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

      renameBlurInStorage(domain, selector, newName, type);
    };
    nameSpan.addEventListener("keydown", onKeyDown);
    nameSpan.addEventListener("blur", onBlur);
  }

  function renameBlurInStorage(domain, selector, newName, type = "blur") {
    const storageKey = type === "delete" ? "deleteSelectors" : "blurSelectors";
    
    chrome.storage.local.get(storageKey, data => {
      const store = data[storageKey] || {};
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
      chrome.storage.local.set({ [storageKey]: store }, () => {
        showNotification(`✏️ ${type === "delete" ? "Elemento borrado" : "Blur"} renombrado`);
        buildDomainUI(domain);
        // Re-aplicar en la pestaña sin refrescar
        reApplyInTab();
      });
    });

    // Actualizar personajes
    updateCharacters();
  }

  // Eliminar blur o elemento borrado
  function removeBlur(domain, selector, type = "blur") {
    const storageKey = type === "delete" ? "deleteSelectors" : "blurSelectors";
    
    chrome.storage.local.get(storageKey, data => {
      const store = data[storageKey] || {};
      if (!store[domain]) return;

      store[domain] = store[domain].filter(it => {
        if (typeof it === "string") {
          return it !== selector;
        } else {
          return it.selector !== selector;
        }
      });
      chrome.storage.local.set({ [storageKey]: store }, () => {
        showNotification(`🗑️ ${type === "delete" ? "Elemento borrado" : "Blur"} eliminado`);
        buildDomainUI(domain);
        // Re-aplicar en la pestaña sin refrescar
        reApplyInTab();
      });
    });

    // Actualizar personajes
    updateCharacters();
  }

  // Manda mensaje al content script para re-aplicar sin refrescar
  function reApplyInTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "reApply"
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
    console.log("Inicializando popup...");
    
    // Verificamos si los elementos críticos existen en el DOM
    const toggleEdit = document.getElementById("toggleEdit");
    const toggleExtensionBtn = document.getElementById("toggleExtension");
    const disabledStateImage = document.getElementById("disabledStateImage");
    const blurStateImage = document.getElementById("blurStateImage");
    const deleteStateImage = document.getElementById("deleteStateImage");
    
    if (!toggleEdit || !toggleExtensionBtn || !blurStateImage || !deleteStateImage || !disabledStateImage) {
      console.error("Error: No se encontraron todos los elementos necesarios en el DOM");
      return;
    }
    
    // Inicializamos los componentes en este orden:
    chrome.storage.local.get(["extensionActive", "editMode", "deleteMode"], data => {
      console.log("Estado actual:", data);
      
      // 1. Actualizar checkbox de edición según estado actual
      refreshEditCheckbox();
      
      // 2. Actualizar botón principal según estado extensionActive
      refreshExtensionToggleUI();
      
      // 3. Actualizar iconos de estado 
      updateStateIcons();
      
      // 4. Actualizar interfaz del dominio actual (incluye sugerencias)
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs && tabs.length > 0) {
          const domain = new URL(tabs[0].url).hostname;
          console.log("Dominio actual:", domain);
          
          // Construir UI para dominio actual
          buildDomainUI(domain);
        }
      });
    });

    // Inicializar la gestión de los modos
    chrome.storage.local.get("deleteMode", data => {
      const isDeleteMode = data.deleteMode ?? false;
      
      // Actualizamos las clases de los botones
      modeOptions.forEach(opt => {
        if (opt.dataset.mode === (isDeleteMode ? 'delete' : 'blur')) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });
      
      // Añadimos los iconos de modo después de que la UI se ha construido
      setTimeout(createModeIcons, 100);
    });

    // Evento para togglear la extensión
    toggleExtensionBtn.addEventListener("click", () => {
      chrome.storage.local.get("extensionActive", data => {
        const currentActive = data.extensionActive ?? false;
        const newActive = !currentActive;
        
        chrome.storage.local.set({
          extensionActive: newActive
        }, () => {
          refreshExtensionToggleUI();
          
          // Si desactivamos la extensión, también desactivamos el modo edición
          if (!newActive) {
            chrome.storage.local.set({
              editMode: false
            }, () => {
              toggleEdit.checked = false;
              modeSelector.style.display = "none";
              
              // Notificar al content script del cambio
              chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                if (tabs && tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggleExtension",
                    enable: newActive
                  });
                }
              });
            });
          } else {
            // Si activamos, solo notificamos
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
              if (tabs && tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "toggleExtension",
                  enable: newActive
                });
              }
            });
          }
        });
      });
    });
  }
  init();

  // Función para actualizar la visualización de los personajes
  function updateCharacters() {
    console.log("Actualizando personajes...");
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        const domain = new URL(tabs[0].url).hostname;
        
        chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors"], data => {
          const isActive = data.extensionActive ?? false;
          const blurCharacterImg = document.getElementById("blurCharacterImage");
          const deleteCharacterImg = document.getElementById("deleteCharacterImage");
          const blurCharacter = document.querySelector(".blur-character");
          const deleteCharacter = document.querySelector(".delete-character");
          
          // Verificar que existan los elementos
          if (!blurCharacterImg || !deleteCharacterImg || !blurCharacter || !deleteCharacter) {
            console.error("No se encontraron todos los elementos de personajes en el DOM");
            return;
          }
          
          if (!isActive) {
            // Extensión desactivada: ambos personajes con ojos cerrados
            blurCharacterImg.src = "desactivado.png";
            deleteCharacterImg.src = "desactivado.png";
            blurCharacter.classList.remove("active");
            deleteCharacter.classList.remove("active");
            console.log("Personajes desactivados");
            return;
          }
          
          // Verificar elementos con blur
          const hasBlurElements = data.blurSelectors && 
                                 data.blurSelectors[domain] && 
                                 data.blurSelectors[domain].length > 0;
          
          // Verificar elementos borrados
          const hasDeleteElements = data.deleteSelectors && 
                                   data.deleteSelectors[domain] && 
                                   data.deleteSelectors[domain].length > 0;
          
          console.log(`Dominio: ${domain} - Tiene blur: ${hasBlurElements} - Tiene borrados: ${hasDeleteElements}`);
          
          // Actualizar personaje de blur
          if (hasBlurElements) {
            blurCharacterImg.src = "blur.png"; // Personaje con ojos abiertos
            blurCharacter.classList.add("active");
          } else {
            blurCharacterImg.src = "desactivado.png"; // Personaje con ojos cerrados
            blurCharacter.classList.remove("active");
          }
          
          // Actualizar personaje de borrado
          if (hasDeleteElements) {
            deleteCharacterImg.src = "borrar.png"; // Personaje con antifaz
            deleteCharacter.classList.add("active");
          } else {
            deleteCharacterImg.src = "desactivado.png"; // Personaje con ojos cerrados
            deleteCharacter.classList.remove("active");
          }
        });
      }
    });
  }

  // Añadir estilos para los nuevos iconos de modo
  const style = document.createElement('style');
  style.textContent = `
    .mode-icon {
      position: relative;
      display: block;
      margin: 10px auto 0;
      width: 36px;
      height: 36px;
      z-index: 1000;
      background-color: transparent;
      border-radius: 0;
      box-shadow: none;
    }
    
    .blur-preset {
      border-left: 3px solid #3498db !important;
    }
    
    .delete-preset {
      border-left: 3px solid #e74c3c !important;
    }
    
    .mode-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-bottom: 10px;
      text-align: center;
    }
    
    .mode-option.active {
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);

  // Cambio de modo (blur/delete)
  const switchModes = (isDeleteMode) => {
    // Guardar el modo
    chrome.storage.local.set({
      deleteMode: isDeleteMode
    }, () => {
      // Actualizamos el mensaje en el selector
      const modeLabel = document.getElementById("currentModeLabel");
      if (modeLabel) {
        modeLabel.textContent = isDeleteMode ? "Modo Borrar" : "Modo Blur";
      }
      
      // Actualizar clases en los botones
      modeOptions.forEach(opt => {
        if (opt.dataset.mode === (isDeleteMode ? 'delete' : 'blur')) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });
      
      // Eliminar iconos actuales
      const existingBlurIcon = document.getElementById("modeBlurIcon");
      const existingDeleteIcon = document.getElementById("modeDeleteIcon");
      
      if (existingBlurIcon) existingBlurIcon.remove();
      if (existingDeleteIcon) existingDeleteIcon.remove();
      
      // Actualizar iconos de modo - asegurarnos de que están creados correctamente
      setTimeout(() => {
        createModeIcons();
        
        // Actualizar visibilidad de los iconos
        const modeBlurIcon = document.getElementById("modeBlurIcon");
        const modeDeleteIcon = document.getElementById("modeDeleteIcon");
        
        if (modeBlurIcon) {
          modeBlurIcon.style.display = !isDeleteMode ? "block" : "none";
          modeBlurIcon.style.backgroundColor = "transparent";
        }
        
        if (modeDeleteIcon) {
          modeDeleteIcon.style.display = isDeleteMode ? "block" : "none";
          modeDeleteIcon.style.backgroundColor = "transparent";
        }
      }, 50);
      
      // Aplicar el cambio en la pestaña actual
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "changeDeleteMode",
            deleteMode: isDeleteMode
          }, () => {
            // Forzar una replicación para asegurar que los cambios se aplican
            reApplyInTab();
          });
        }
      });
    });
  };
});
