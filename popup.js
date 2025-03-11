document.addEventListener("DOMContentLoaded", () => {
  // Definición de respaldo para PREDEFINED_BLURS en caso de que no esté definido
  if (typeof PREDEFINED_BLURS === 'undefined') {
    console.warn("PREDEFINED_BLURS no está definido, usando objeto vacío");
    window.PREDEFINED_BLURS = {};
  }
  
  // Verificar disponibilidad del content script al inicio
  let contentScriptAvailable = false;
  
  // Variable global para almacenar el dominio actual
  let currentDomain = '';
  
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

  // Función para verificar la disponibilidad del content script
  function checkContentScriptAvailability() {
    return new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs || tabs.length === 0) {
          contentScriptAvailable = false;
          resolve(false);
          return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id || activeTab.id <= 0) {
          contentScriptAvailable = false;
          resolve(false);
          return;
        }
        
        // Intentar obtener el dominio actual
        try {
          currentDomain = new URL(activeTab.url).hostname;
        } catch (error) {
          console.log("No se pudo obtener el dominio:", error.message);
          currentDomain = '';
        }
        
        // Verificar si la pestaña permite content scripts
        if (!activeTab.url || activeTab.url.startsWith("chrome:") || 
            activeTab.url.startsWith("chrome-extension:") || 
            activeTab.url.startsWith("about:")) {
          contentScriptAvailable = false;
          resolve(false);
          return;
        }
        
        try {
          chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, response => {
            if (chrome.runtime.lastError) {
              console.log("Content script no disponible en esta página");
              contentScriptAvailable = false;
              resolve(false);
            } else {
              console.log("Content script disponible:", response);
              contentScriptAvailable = true;
              resolve(true);
            }
          });
        } catch (error) {
          console.log("Error al comunicarse con content script:", error.message);
          contentScriptAvailable = false;
          resolve(false);
        }
      });
    });
  }

  // Verificar disponibilidad al cargar el popup
  checkContentScriptAvailability().then(available => {
    console.log("Estado del content script:", available ? "Disponible" : "No disponible");
    
    // Continuar inicialización independientemente de la disponibilidad
    init();
  });

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

  // Implementar una función segura para verificar si existen personajes
  function hasCharacterElements() {
    return !!(
      document.getElementById("blurCharacterImage") || 
      document.getElementById("deleteCharacterImage") ||
      document.querySelector(".blur-character") ||
      document.querySelector(".delete-character")
    );
  }

  // Función para actualizar la visualización de los personajes de forma segura
  function updateCharacters() {
    console.log("Actualizando personajes...");
    
    // Verificar si los elementos existen antes de intentar manipularlos
    const blurCharacterImg = document.getElementById("blurCharacterImage");
    const deleteCharacterImg = document.getElementById("deleteCharacterImage");
    const editTextCharacterImg = document.getElementById("editTextCharacterImage");
    const blurCharacter = document.querySelector(".blur-character");
    const deleteCharacter = document.querySelector(".delete-character");
    const editTextCharacter = document.querySelector(".edit-text-character");
    
    // Si no existen los elementos, simplemente salimos de la función sin error
    if ((!blurCharacterImg && !deleteCharacterImg && !editTextCharacterImg) && 
        (!blurCharacter && !deleteCharacter && !editTextCharacter)) {
      console.log("No se encontraron elementos de personajes en el DOM - omitiendo actualización");
      return;
    }
    
    // Actualizar los personajes según el estado actual
    chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "editTextMode"], data => {
      const isActive = data.extensionActive ?? false;
      const isEditMode = data.editMode ?? false;
      const isDeleteMode = data.deleteMode ?? false;
      const isEditTextMode = data.editTextMode ?? false;
      
      // Determinar qué personaje debe estar activo
      let activeCharacter = "none";
      if (isActive) {
        if (isDeleteMode) {
          activeCharacter = "delete";
        } else if (isEditTextMode) {
          activeCharacter = "editText";
        } else {
          activeCharacter = "blur";
        }
      }
      
      // Actualizar imágenes de personajes si existen
      if (blurCharacterImg) {
        blurCharacterImg.classList.toggle("active", activeCharacter === "blur");
        blurCharacterImg.classList.toggle("inactive", activeCharacter !== "blur");
      }
      
      if (deleteCharacterImg) {
        deleteCharacterImg.classList.toggle("active", activeCharacter === "delete");
        deleteCharacterImg.classList.toggle("inactive", activeCharacter !== "delete");
      }
      
      if (editTextCharacterImg) {
        editTextCharacterImg.classList.toggle("active", activeCharacter === "editText");
        editTextCharacterImg.classList.toggle("inactive", activeCharacter !== "editText");
      }
      
      // Actualizar contenedores de personajes si existen
      if (blurCharacter) {
        blurCharacter.classList.toggle("active", activeCharacter === "blur");
        blurCharacter.classList.toggle("inactive", activeCharacter !== "blur");
      }
      
      if (deleteCharacter) {
        deleteCharacter.classList.toggle("active", activeCharacter === "delete");
        deleteCharacter.classList.toggle("inactive", activeCharacter !== "delete");
      }
      
      if (editTextCharacter) {
        editTextCharacter.classList.toggle("active", activeCharacter === "editText");
        editTextCharacter.classList.toggle("inactive", activeCharacter !== "editText");
      }
    });
  }
  
  // Función segura para actualizar personajes que no lanza errores
  function safeUpdateCharacters() {
    try {
      updateCharacters();
    } catch (error) {
      console.warn("Error no crítico al actualizar personajes:", error);
    }
  }

  // Reemplazar refreshExtensionToggleUI para usar la función segura
  function refreshExtensionToggleUI() {
    chrome.storage.local.get("extensionActive", data => {
      const active = data.extensionActive ?? false;
      toggleExtensionBtn.innerHTML = `
        <span class="toggle-icon">${active ? "🚫" : "🎯"}</span>
        <span class="toggle-text">${active ? "Desactivar" : "Activar"} Extensión</span>
      `;
      toggleExtensionBtn.className = `btn ${active ? "btn-secondary" : "btn-primary"}`;
      
      // Usar la función segura
      safeUpdateCharacters();
    });
  }

  // Reemplazar updateStateIcons para usar la función segura
  function updateStateIcons() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        try {
          const domain = new URL(tabs[0].url).hostname;
          
          chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
            const isActive = data.extensionActive ?? false;
            const disabledStateImage = document.getElementById("disabledStateImage");
            const disabledEditStateImage = document.getElementById("disabledEditStateImage");
            const blurStateImage = document.getElementById("blurStateImage");
            const deleteStateImage = document.getElementById("deleteStateImage");
            const editTextStateImage = document.getElementById("editTextStateImage");
            
            // Verificar si existen los elementos
            if (!disabledStateImage || !blurStateImage || !deleteStateImage || !editTextStateImage) {
              console.error("No se encontraron todos los elementos de estado en el DOM");
              return;
            }
            
            // Primero ocultamos todos los iconos
            disabledStateImage.style.display = "none";
            if (disabledEditStateImage) disabledEditStateImage.style.display = "none";
            blurStateImage.style.display = "none";
            deleteStateImage.style.display = "none";
            editTextStateImage.style.display = "none";
            
            // Hacemos las imágenes de estado más grandes
            blurStateImage.style.width = "100px";
            blurStateImage.style.height = "100px";
            deleteStateImage.style.width = "100px";
            deleteStateImage.style.height = "100px";
            editTextStateImage.style.width = "100px";
            editTextStateImage.style.height = "100px";
            disabledStateImage.style.width = "100px";
            disabledStateImage.style.height = "100px";
            
            // Verificar si hay elementos configurados
            const hasBlurElements = data.blurSelectors && 
                                 data.blurSelectors[domain] && 
                                 data.blurSelectors[domain].length > 0;
            
            const hasDeleteElements = data.deleteSelectors && 
                                   data.deleteSelectors[domain] && 
                                   data.deleteSelectors[domain].length > 0;
            
            const hasEditTextElements = data.editTextSelectors && 
                                     data.editTextSelectors[domain] && 
                                     data.editTextSelectors[domain].length > 0;
            
            // Si la extensión está desactivada
            if (!isActive) {
              // Mostrar las imágenes de desactivado según los elementos que haya
              if (hasBlurElements) {
                disabledStateImage.style.display = "block";
              }
              
              if (hasDeleteElements) {
                deleteStateImage.src = "desactivado.png";
                deleteStateImage.style.display = "block";
              }
              
              if (hasEditTextElements && disabledEditStateImage) {
                disabledEditStateImage.style.display = "block";
              }
              
              // Si no hay elementos, mostrar la imagen de desactivado genérica
              if (!hasBlurElements && !hasDeleteElements && !hasEditTextElements) {
                disabledStateImage.style.display = "block";
              }
              
              return;
            }
            
            // Si la extensión está activa, mostrar los iconos correspondientes
            if (hasBlurElements) {
              blurStateImage.style.display = "block";
              blurStateImage.src = "blur.png";
            }
            
            if (hasDeleteElements) {
              deleteStateImage.style.display = "block";
              deleteStateImage.src = "borrar.png";
            }
            
            if (hasEditTextElements) {
              editTextStateImage.style.display = "block";
              editTextStateImage.src = "editar.png";
            }
            
            // Si no hay ningún elemento pero la extensión está activa
            if (!hasBlurElements && !hasDeleteElements && !hasEditTextElements) {
              blurStateImage.style.display = "block";
            }
          });
        } catch (error) {
          console.error("Error al actualizar iconos de estado:", error);
        }
      }
    });
  }

  // Manda mensaje al content script para re-aplicar sin refrescar
  function reApplyInTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || tabs.length === 0) {
        console.warn("No se encontraron pestañas activas para re-aplicar");
        return;
      }
      
      // Verificar si la pestaña es válida
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || activeTab.id <= 0) {
        console.warn("La pestaña activa no es válida:", activeTab);
        return;
      }
      
      // Verificar si la pestaña permite content scripts
      if (!activeTab.url || activeTab.url.startsWith("chrome:") || 
          activeTab.url.startsWith("chrome-extension:") || 
          activeTab.url.startsWith("about:")) {
        console.warn("La pestaña activa no permite content scripts:", activeTab.url);
        return;
      }
      
      try {
        // Función simple que no hace nada pero captura el lastError
        const noop = () => {
          if (chrome.runtime.lastError) {
            // Solo registrar el error, no mostrar al usuario
            console.log("Error esperado (no problemático):", chrome.runtime.lastError.message);
            return true; // Devolver true para indicar que el error fue manejado
          }
        };
        
        // Primero comprobar si el content script está disponible
        chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, response => {
          if (chrome.runtime.lastError) {
            console.log("Content script no disponible (normal en algunas páginas)");
            return;
          }
          
          // Si llegamos aquí, el content script está disponible
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "reApply", timestamp: Date.now() },
            noop
          );
        });
      } catch (error) {
        console.log("Error controlado al enviar mensaje:", error.message);
      }
    });
  }

  // Función mejorada para comunicarse con el content script con detección previa
  function sendMessageToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs || tabs.length === 0) {
          console.log("No se encontraron pestañas activas");
          resolve(null); // Resolver con null en lugar de rechazar
          return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id || activeTab.id <= 0) {
          console.log("Pestaña activa no válida");
          resolve(null);
          return;
        }
        
        // Verificar si la pestaña permite content scripts
        if (!activeTab.url || activeTab.url.startsWith("chrome:") || 
            activeTab.url.startsWith("chrome-extension:") || 
            activeTab.url.startsWith("about:")) {
          console.log("Pestaña no permite content scripts:", activeTab.url);
          resolve(null);
          return;
        }
        
        try {
          // Verificar primero si el content script está disponible
          chrome.tabs.sendMessage(activeTab.id, { action: "ping" }, pingResponse => {
            // Si hay error, significa que el content script no está disponible
            if (chrome.runtime.lastError) {
              console.log("Content script no disponible:", chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            
            // Si el content script está disponible, enviar el mensaje real
            chrome.tabs.sendMessage(
              activeTab.id,
              { ...message, timestamp: Date.now() },
              response => {
                if (chrome.runtime.lastError) {
                  console.log("Error esperado:", chrome.runtime.lastError.message);
                  resolve(null);
                  return;
                }
                resolve(response);
              }
            );
          });
        } catch (error) {
          console.log("Error controlado:", error.message);
          resolve(null); // Resolver con null para evitar romper promesas
        }
      });
    });
  }

  // Actualizar toggleExtensionBtn para usar la nueva función
  toggleExtensionBtn.addEventListener("click", () => {
    chrome.storage.local.get("extensionActive", data => {
      const wasActive = data.extensionActive ?? true;
      const newState = !wasActive;

      chrome.storage.local.set({ extensionActive: newState }, () => {
        refreshExtensionToggleUI();
        updateStateIcons();
        
        // Usar la nueva función - manejar silenciosamente errores
        sendMessageToContentScript({
              action: "toggleExtension",
              enable: newState
        }).then(response => {
          // Solo procesar respuesta si no es null
          if (response) {
            console.log("Respuesta del content script:", response);
          }
        }).catch(error => {
          // Nunca debería llegar aquí porque siempre resolvemos
          console.log("Error inesperado:", error.message);
        });
        
        showNotification(newState ? "🎉 Extensión activada" : "👋 Extensión desactivada");
      });
    });
  });

  // Actualizar toggleEditMode para activar automáticamente la extensión si está desactivada
  function toggleEditMode() {
    chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "editTextMode"], data => {
      const isActive = data.extensionActive ?? false;
      let isEditing = data.editMode ?? false;
      const isDeleteMode = data.deleteMode ?? false;
      const isEditTextMode = data.editTextMode ?? false;
      
      // Si la extensión no está activa, la activamos automáticamente
      if (!isActive) {
        // Activar la extensión primero
        chrome.storage.local.set({ extensionActive: true }, () => {
          // Luego activar el modo edición
          chrome.storage.local.set({ editMode: true }, () => {
        refreshExtensionToggleUI();
            modeSelector.style.display = "grid";
        refreshStateIcons();
            
            // Enviar mensaje al content script para activar la extensión y el modo edición
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
              if (tabs && tabs.length > 0) {
                // Primero activar la extensión
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: "toggleExtension",
                  enable: true
                }, () => {
                  // Luego activar el modo edición
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggleEditMode",
                    enable: true,
                    deleteMode: isDeleteMode,
                    editTextMode: isEditTextMode
                  });
                });
              }
            });
            
            // Añadir iconos de modo a la UI
        createModeIcons();
        
            showNotification("🎯 Extensión y modo selección activados");
          });
        });
        return;
      }
      
      // Cambiar el modo edición
      isEditing = !isEditing;
      
      if (isEditing) {
        // Si activamos el toggle, activamos el modo edición
        chrome.storage.local.set({ editMode: true }, async () => {
          modeSelector.style.display = "grid";
          refreshStateIcons();
          
          // Enviar mensaje al content script para activar modo edición
          try {
            await sendMessageToContentScript({
              action: "toggleEditMode",
              enable: true,
              deleteMode: isDeleteMode,
              editTextMode: isEditTextMode
            });
            
            // También obtener el dominio actual y reconstruir la UI
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
              if (tabs && tabs.length > 0) {
                const domain = new URL(tabs[0].url).hostname;
                buildDomainUI(domain);
              }
            });
          } catch (error) {
            console.error("Error al activar modo edición:", error);
          }
          
          // Añadir iconos de modo a la UI
          createModeIcons();
        
        showNotification("🎯 Modo selección activado");
      });
    } else {
      // Si desactivamos el toggle, solo desactivamos el modo edición
      chrome.storage.local.set({ editMode: false }, async () => {
        modeSelector.style.display = "none";
        refreshStateIcons();
        
        try {
          await sendMessageToContentScript({
            action: "toggleEditMode",
            enable: false
          });
          
          // Obtener el dominio actual y reconstruir la UI
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs && tabs.length > 0) {
              const domain = new URL(tabs[0].url).hostname;
              buildDomainUI(domain);
            }
          });
        } catch (error) {
          console.error("Error al desactivar modo edición:", error);
        }
        
        showNotification("📌 Modo selección desactivado");
      });
    }
    });
  }
  
  // Actualizar switchModes para usar la nueva función
  const switchModes = (isDeleteMode, isEditTextMode = false) => {
    chrome.storage.local.set({
      deleteMode: isDeleteMode,
      editTextMode: isEditTextMode
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error al cambiar modo:", chrome.runtime.lastError);
        return;
      }
      
      // Luego notificamos al content script del cambio
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "changeMode",
            deleteMode: isDeleteMode,
            editTextMode: isEditTextMode
          }, response => {
            if (chrome.runtime.lastError) {
              console.log("Content script no disponible o error:", chrome.runtime.lastError);
              return;
            }
            
            if (response && response.success) {
              console.log("Modo cambiado exitosamente");
              refreshStateIcons();
            }
          });
        }
      });
    });
  };

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
    chrome.storage.local.get(["extensionActive", "editMode", "deleteMode", "editTextMode"], data => {
            const isActive = data.extensionActive ?? false;
      const isEditMode = data.editMode ?? false;
      const isDeleteMode = data.deleteMode ?? false;
      const isEditTextMode = data.editTextMode ?? false;
      
      const disabledStateImage = document.getElementById("disabledStateImage");
            const blurStateImage = document.getElementById("blurStateImage");
            const deleteStateImage = document.getElementById("deleteStateImage");
      const editTextStateImage = document.getElementById("editTextStateImage");
      
      if (disabledStateImage) {
        disabledStateImage.style.display = isActive ? "none" : "block";
      }
      
      if (blurStateImage) {
        blurStateImage.style.display = (isActive && !isDeleteMode && !isEditTextMode) ? "block" : "none";
      }
      
      if (deleteStateImage) {
        deleteStateImage.style.display = (isActive && isDeleteMode) ? "block" : "none";
      }
      
      if (editTextStateImage) {
        editTextStateImage.style.display = (isActive && isEditTextMode) ? "block" : "none";
      }
      
      const modeSelector = document.getElementById("modeSelector");
      if (modeSelector) {
        modeSelector.style.display = isEditMode ? "grid" : "none";
      }
    });
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
    chrome.storage.local.get(["blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
      const domainWrapper = document.getElementById("domainWrapper");
      if (!domainWrapper) return;
      
      const blurSelectors = (data.blurSelectors && data.blurSelectors[domain]) || [];
      const deleteSelectors = (data.deleteSelectors && data.deleteSelectors[domain]) || [];
      const editTextSelectors = (data.editTextSelectors && data.editTextSelectors[domain]) || [];
      
      // Limpiar el contenedor
      domainWrapper.innerHTML = "";
      
      if (blurSelectors.length === 0 && deleteSelectors.length === 0 && editTextSelectors.length === 0) {
        // Si no hay selectores, mostrar mensaje de vacío
        domainWrapper.innerHTML = `
          <div class="empty-state">
            No hay elementos modificados en este sitio.<br>
            Activa el modo edición y selecciona elementos de la página.
          </div>
        `;
        return;
      }

      // Construir sección de blurs
      const blurStore = data.blurSelectors?.[domain] || [];
      if (blurStore.length > 0) {
        const blurDetails = document.createElement("details");
        blurDetails.innerHTML = `
          <summary>Blur (${blurStore.length})</summary>
          <div class="blur-items"></div>
        `;
        blurDetails.open = true;
        
        const blurItemsContainer = blurDetails.querySelector(".blur-items");
        blurStore.forEach(item => {
          const selector = typeof item === "string" ? item : item.selector;
          const name = typeof item === "string" ? getDefaultNameForSelector(selector) : item.name;
          
          const blurItem = document.createElement("div");
          blurItem.className = "blur-item";
          blurItem.innerHTML = `
            <span class="blur-name" contenteditable="false">${name}</span>
              <div class="buttons-blur">
              <button class="rename-blur">✏️</button>
              <button class="remove-blur">🗑️</button>
            </div>
          `;
          
          // Manejar renombrar
          const renameBtn = blurItem.querySelector(".rename-blur");
          renameBtn.onclick = () => inlineRenameBlur(domain, selector, blurItem, "blur");
          
          // Manejar eliminar
          const removeBtn = blurItem.querySelector(".remove-blur");
          removeBtn.onclick = () => removeBlur(domain, selector, "blur");
          
          blurItemsContainer.appendChild(blurItem);
        });
        
        domainWrapper.appendChild(blurDetails);
      }
      
      // Construir sección de textos editados
      const editTextStore = data.editTextSelectors?.[domain] || [];
      if (editTextStore.length > 0) {
        const editTextDetails = document.createElement("details");
        editTextDetails.open = true;  // Aseguramos que esté desplegado por defecto
        editTextDetails.innerHTML = `
          <summary>Textos Editados (${editTextStore.length})</summary>
        `;
        const editTextList = document.createElement("div");
        editTextList.className = "blur-items";
        
        editTextStore.forEach(item => {
          const editTextItem = document.createElement("div");
          editTextItem.className = "blur-item";
          const originalText = item.originalText || "Sin texto original";
          editTextItem.innerHTML = `
            <div>
              <div class="blur-name" contenteditable="false">${item.name}</div>
              <small style="color: var(--text-light);">${originalText} -> ${item.customText}</small>
        </div>
            <div class="buttons-blur">
              <button class="rename-blur" title="Renombrar">✏️</button>
              <button class="remove-blur" title="Eliminar">🗑️</button>
        </div>
      `;
          
          // Manejar renombrar
          const renameBtn = editTextItem.querySelector(".rename-blur");
          renameBtn.onclick = () => inlineRenameBlur(domain, item.selector, editTextItem, "editText");
          
          // Manejar eliminar
          const removeBtn = editTextItem.querySelector(".remove-blur");
          removeBtn.onclick = () => removeBlur(domain, item.selector, "editText");
          
          editTextList.appendChild(editTextItem);
        });
        
        editTextDetails.appendChild(editTextList);
        domainWrapper.appendChild(editTextDetails);
      }

      // Construir sección de borrados
      const deleteStore = data.deleteSelectors?.[domain] || [];
      if (deleteStore.length > 0) {
        const deleteDetails = document.createElement("details");
        deleteDetails.innerHTML = `
          <summary>Borrados (${deleteStore.length})</summary>
          <div class="blur-items"></div>
        `;
        deleteDetails.open = true;
        
        const deleteItemsContainer = deleteDetails.querySelector(".blur-items");
        deleteStore.forEach(item => {
          const selector = typeof item === "string" ? item : item.selector;
          const name = typeof item === "string" ? getDefaultNameForSelector(selector) : item.name;
          
          const deleteItem = document.createElement("div");
          deleteItem.className = "blur-item";
          deleteItem.innerHTML = `
            <span class="blur-name" contenteditable="false">${name}</span>
            <div class="buttons-blur">
              <button class="rename-blur">✏️</button>
              <button class="remove-blur">🗑️</button>
          </div>
        `;
          
          // Manejar renombrar
          const renameBtn = deleteItem.querySelector(".rename-blur");
          renameBtn.onclick = () => inlineRenameBlur(domain, selector, deleteItem, "delete");
          
          // Manejar eliminar
          const removeBtn = deleteItem.querySelector(".remove-blur");
          removeBtn.onclick = () => removeBlur(domain, selector, "delete");
          
          deleteItemsContainer.appendChild(deleteItem);
        });
        
        domainWrapper.appendChild(deleteDetails);
      }
    });
  }
  
  // Crear iconos para los modos blur y borrar
  function createModeIcons() {
    const modeSelector = document.getElementById("modeSelector");
    if (!modeSelector) return;

    // Obtener las opciones dentro del selector de modos
    const modeOptions = modeSelector.querySelectorAll(".mode-option");

    // Verificar si ya hay listeners (para evitar duplicación)
    if (modeOptions.length > 0 && !modeOptions[0].hasAttribute("data-has-listener")) {
      modeOptions.forEach(option => {
        // Marcar que tiene listener
        option.setAttribute("data-has-listener", "true");
        
        option.addEventListener("click", () => {
          // Eliminar la clase 'active' de todas las opciones
          modeOptions.forEach(opt => opt.classList.remove("active"));
          
          // Agregar la clase 'active' a la opción seleccionada
          option.classList.add("active");
          
          // Obtener el modo de la opción
          const mode = option.getAttribute("data-mode");
          
          // Cambiar al modo seleccionado
          if (mode === "delete") {
            switchModes(true, false);
          } else if (mode === "editText") {
            switchModes(false, true);
          } else {
            // Modo blur (default)
            switchModes(false, false);
          }
        });
      });
    }

    // Actualizar la visualización según el modo actual
    chrome.storage.local.get(["deleteMode", "editTextMode"], data => {
      const deleteMode = data.deleteMode || false;
      const editTextMode = data.editTextMode || false;
      
      modeOptions.forEach(option => {
        const mode = option.getAttribute("data-mode");
        
        if ((mode === "delete" && deleteMode) || 
            (mode === "editText" && editTextMode) || 
            (mode === "blur" && !deleteMode && !editTextMode)) {
          option.classList.add("active");
        } else {
          option.classList.remove("active");
        }
      });
    });
  }

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

      // Usar la función segura
      safeUpdateCharacters();
    });
  }

  // Renombrado inline
  function inlineRenameBlur(domain, selector, blurItemEl, type = "blur") {
    const nameEl = blurItemEl.querySelector(".blur-name");
    const originalName = nameEl.textContent;
    
    // Hacer el elemento editable
    nameEl.contentEditable = "true";
    nameEl.focus();
    
    // Seleccionar todo el texto
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameEl.blur();
      }
      if (e.key === "Escape") {
        nameEl.textContent = originalName;
        nameEl.blur();
      }
    };
    
    const onBlur = () => {
      nameEl.contentEditable = "false";
      nameEl.removeEventListener("keydown", onKeyDown);
      nameEl.removeEventListener("blur", onBlur);
      
      const newName = nameEl.textContent.trim();
      if (newName && newName !== originalName) {
      renameBlurInStorage(domain, selector, newName, type);
      } else {
        nameEl.textContent = originalName;
      }
    };
    
    nameEl.addEventListener("keydown", onKeyDown);
    nameEl.addEventListener("blur", onBlur);
  }

  // Reemplazar renameBlurInStorage para usar la función segura
  function renameBlurInStorage(domain, selector, newName, type = "blur") {
    const storageKey = type === "delete" ? "deleteSelectors" : 
                      type === "editText" ? "editTextSelectors" : "blurSelectors";
    
    chrome.storage.local.get(storageKey, data => {
      const store = data[storageKey] || {};
      if (!store[domain]) return;

      const index = store[domain].findIndex(item => {
        if (typeof item === "string") {
          return item === selector;
        } else {
          return item.selector === selector;
        }
      });
      
      if (index !== -1) {
        if (typeof store[domain][index] === "string") {
          store[domain][index] = { selector, name: newName };
        } else {
          store[domain][index].name = newName;
        }
        
        chrome.storage.local.set({ [storageKey]: store }, () => {
          console.log(`${type} renombrado a:`, newName);
        });
      }
    });
  }

  // Reemplazar removeBlur para usar la función segura
  function removeBlur(domain, selector, type = "blur") {
    const storageKey = type === "delete" ? "deleteSelectors" : 
                      type === "editText" ? "editTextSelectors" : "blurSelectors";
    
    chrome.storage.local.get(storageKey, data => {
      const store = data[storageKey] || {};
      if (!store[domain]) return;

      store[domain] = store[domain].filter(item => {
        if (typeof item === "string") {
          return item !== selector;
        } else {
          return item.selector !== selector;
        }
      });
      
      chrome.storage.local.set({ [storageKey]: store }, () => {
        // Notificar al content script para que actualice la UI
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "reApply"
            });
          }
        });
        
        // Actualizar la UI del popup
        buildDomainUI(domain);
      });
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
    
    // Verificar que tenemos todos los elementos necesarios
    if (!toggleExtensionBtn || !toggleEdit || !modeSelector) {
      console.error("Elementos críticos no encontrados en el DOM");
      return;
    }
    
    // Verificar disponibilidad del content script
    checkContentScriptAvailability();
    
    // Actualizar UI según el estado actual
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs && tabs.length > 0) {
        try {
          const domain = new URL(tabs[0].url).hostname;
          
          // Construir UI del dominio actual (activos y sugeridos)
          buildDomainUI(domain);
          buildSuggestionsUI(domain);
          
          // También intentar actualizar personajes si los hay
          safeUpdateCharacters();
          
          // Y actualizar los iconos de estado
          refreshStateIcons();
        } catch (e) {
          console.error("Error al obtener dominio:", e);
        }
      }
    });
    
    // Configurar las pestañas
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Activar pestaña seleccionada y desactivar las demás
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Mostrar contenido correspondiente
        const tabId = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.toggle('active', content.id === tabId);
        });
        
        // Si cambiamos a la pestaña de sugeridos, actualizar su contenido
        if (tabId === 'suggested-blurs') {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs && tabs.length > 0) {
          try {
          const domain = new URL(tabs[0].url).hostname;
                buildSuggestionsUI(domain);
              } catch (e) {
                console.error("Error al obtener dominio:", e);
              }
            }
          });
        }
      });
    });

    // Actualizar el botón de alternar extensión
    refreshExtensionToggleUI();
    
    // Botones de exportar/importar
    const exportBtn = document.getElementById('exportBlur');
    const importBtn = document.getElementById('importBlurButton');
    const importInput = document.getElementById('importBlur');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        chrome.storage.local.get(['blurSelectors', 'deleteSelectors', 'editTextSelectors'], data => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `blurgy_export_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          showNotification("💾 Exportación completada");
        });
      });
    }
    
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });
      
      importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            
            if (!data.blurSelectors && !data.deleteSelectors && !data.editTextSelectors) {
              throw new Error("Formato de archivo inválido");
            }
            
            chrome.storage.local.get(['blurSelectors', 'deleteSelectors', 'editTextSelectors'], currentData => {
              // Combinar los datos importados con los actuales
              const combined = {
                blurSelectors: { ...currentData.blurSelectors, ...data.blurSelectors },
                deleteSelectors: { ...currentData.deleteSelectors, ...data.deleteSelectors },
                editTextSelectors: { ...currentData.editTextSelectors, ...data.editTextSelectors }
              };
              
              chrome.storage.local.set(combined, () => {
                showNotification("📥 Importación completada");
                
                // Actualizar la UI
                chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                  if (tabs && tabs.length > 0) {
                    try {
                      const domain = new URL(tabs[0].url).hostname;
                      buildDomainUI(domain);
                      buildSuggestionsUI(domain);
                      
                      // Re-aplicar modificaciones
                      reApplyInTab();
                    } catch (e) {
                      console.error("Error al obtener dominio:", e);
                    }
                  }
                });
              });
            });
          } catch (error) {
            showNotification("❌ Error al importar: " + error.message);
          }
        };
        reader.readAsText(file);
      });
    }
    
    // Toggle extensión
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
          
          // Actualizar personajes e iconos
          safeUpdateCharacters();
          refreshStateIcons();
        });
      });
    });

    // Creamos los iconos de modo y actualizamos la UI
    createModeIcons();
    refreshStateIcons();
  }

  // Función para actualizar la visualización de los personajes
  function updateCharacters() {
    console.log("Actualizando personajes...");
        
    // Verificar si los elementos existen antes de intentar manipularlos
          const blurCharacterImg = document.getElementById("blurCharacterImage");
          const deleteCharacterImg = document.getElementById("deleteCharacterImage");
          const blurCharacter = document.querySelector(".blur-character");
          const deleteCharacter = document.querySelector(".delete-character");
          
    // Si no existen los elementos, simplemente salimos de la función sin error
    if (!blurCharacterImg && !deleteCharacterImg && !blurCharacter && !deleteCharacter) {
      console.log("No se encontraron elementos de personajes en el DOM - omitiendo actualización");
            return;
          }
          
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || tabs.length === 0) {
        console.log("No hay pestañas activas para actualizar personajes");
            return;
          }
      
      try {
        const domain = new URL(tabs[0].url).hostname;
        
        chrome.storage.local.get(["extensionActive", "blurSelectors", "deleteSelectors"], data => {
          if (chrome.runtime.lastError) {
            console.warn("Error al obtener datos para personajes:", chrome.runtime.lastError);
            return;
          }
          
          const isActive = data.extensionActive ?? false;
          
          // Verificar elementos con blur
          const hasBlurElements = data.blurSelectors && 
                                 data.blurSelectors[domain] && 
                                 data.blurSelectors[domain].length > 0;
          
          // Verificar elementos borrados
          const hasDeleteElements = data.deleteSelectors && 
                                   data.deleteSelectors[domain] && 
                                   data.deleteSelectors[domain].length > 0;
          
          console.log(`Dominio: ${domain} - Tiene blur: ${hasBlurElements} - Tiene borrados: ${hasDeleteElements}`);
          
          // Actualizar personaje de blur si existe
          if (blurCharacterImg) {
            blurCharacterImg.src = isActive && hasBlurElements ? "blur.png" : "desactivado.png";
          }
          
          if (blurCharacter) {
            if (isActive && hasBlurElements) {
            blurCharacter.classList.add("active");
          } else {
            blurCharacter.classList.remove("active");
            }
          }
          
          // Actualizar personaje de borrado si existe
          if (deleteCharacterImg) {
            deleteCharacterImg.src = isActive && hasDeleteElements ? "borrar.png" : "desactivado.png";
          }
          
          if (deleteCharacter) {
            if (isActive && hasDeleteElements) {
            deleteCharacter.classList.add("active");
          } else {
            deleteCharacter.classList.remove("active");
            }
          }
        });
      } catch (error) {
        console.warn("Error en updateCharacters:", error);
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

  function editCustomText(domain, selector, currentText, element) {
    const newText = prompt("Editar texto:", currentText || "");
    
    if (newText === null) return; // Usuario canceló
    
    if (!newText.trim()) {
      // Si el texto está vacío, eliminar la personalización
      removeBlur(domain, selector, "editText");
      return;
    }
    
    // Actualizar en storage
    chrome.storage.local.get("editTextSelectors", data => {
      const store = data.editTextSelectors || {};
      if (!store[domain]) {
        store[domain] = [];
      }
      
      // Buscar la entrada existente
      const existsIndex = store[domain].findIndex(item => {
        if (typeof item === "object") {
          return item.selector === selector;
        }
        return false;
      });
      
      if (existsIndex !== -1) {
        // Actualizar el texto personalizado
        store[domain][existsIndex].customText = newText;
        
        chrome.storage.local.set({ editTextSelectors: store }, () => {
          // Actualizar el UI
          if (element) {
            element.innerHTML = `<strong>${store[domain][existsIndex].name}</strong><br>"${newText.substring(0, 30)}${newText.length > 30 ? '...' : ''}"`;
            element.title = newText;
            element.dataset.customText = newText;
          }
          
          // Re-aplicar modificaciones sin refrescar
          reApplyInTab();
          
          showNotification("✅ Texto actualizado");
        });
      }
    });
  }

  // Construir UI de sugerencias para el dominio actual
  function buildSuggestionsUI(domain) {
    const suggestedWrapper = document.getElementById("suggestedWrapper");
    if (!suggestedWrapper) return;
    
    // Limpiar el contenedor
    suggestedWrapper.innerHTML = "";
    
    // Comprobar si tenemos sugerencias predefinidas para este dominio
    if (!PREDEFINED_BLURS || !PREDEFINED_BLURS[domain] || !Array.isArray(PREDEFINED_BLURS[domain])) {
      suggestedWrapper.innerHTML = `
        <div class="empty-state">
          No hay sugerencias predefinidas para este sitio.<br>
          Puedes añadir elementos manualmente en el modo edición.
        </div>
      `;
      return;
    }
    
    // Filtramos las sugerencias para que no aparezcan las que ya están aplicadas
    chrome.storage.local.get(["blurSelectors", "deleteSelectors", "editTextSelectors"], data => {
      const blurStore = (data.blurSelectors && data.blurSelectors[domain]) || [];
      const deleteStore = (data.deleteSelectors && data.deleteSelectors[domain]) || [];
      const editTextStore = (data.editTextSelectors && data.editTextSelectors[domain]) || [];
      
      // Filtrar las sugerencias que ya están aplicadas
      const appliedSelectors = [
        ...blurStore.map(item => typeof item === "string" ? item : item.selector),
        ...deleteStore.map(item => typeof item === "string" ? item : item.selector),
        ...editTextStore.map(item => typeof item === "string" ? item : item.selector)
      ];
      
      const filteredSuggestions = PREDEFINED_BLURS[domain].filter(suggestion => {
        return !appliedSelectors.includes(suggestion.selector);
      });
      
      if (filteredSuggestions.length === 0) {
        suggestedWrapper.innerHTML = `
          <div class="empty-state">
            Todas las sugerencias ya han sido aplicadas.<br>
            Puedes añadir elementos manualmente en el modo edición.
          </div>
        `;
        return;
      }
      
      // Agrupar sugerencias por tipo
      const blurSuggestions = filteredSuggestions.filter(s => !s.type || s.type === "blur");
      const deleteSuggestions = filteredSuggestions.filter(s => s.type === "delete");
      
      // Crear el grupo para sugerencias de blur
      if (blurSuggestions.length > 0) {
        const blurDetails = document.createElement("details");
        blurDetails.open = true;
        
        const blurSummary = document.createElement("summary");
        blurSummary.textContent = `Blur Sugerido (${blurSuggestions.length})`;
        blurDetails.appendChild(blurSummary);
        
        const blurItems = document.createElement("div");
        blurItems.className = "blur-items";
        
        blurSuggestions.forEach(suggestion => {
          const blurItem = document.createElement("div");
          blurItem.className = "blur-item preset-item";
          
          const blurName = document.createElement("div");
          blurName.className = "blur-name";
          blurName.textContent = suggestion.name || getDefaultNameForSelector(suggestion.selector);
          
          const addBtn = document.createElement("button");
          addBtn.className = "add-blur";
          addBtn.innerHTML = "➕";
          addBtn.title = "Aplicar sugerencia";
          addBtn.onclick = () => addSuggestion(domain, suggestion.selector, suggestion.name || getDefaultNameForSelector(suggestion.selector));
          
          blurItem.appendChild(blurName);
          blurItem.appendChild(addBtn);
          
          blurItems.appendChild(blurItem);
        });
        
        blurDetails.appendChild(blurItems);
        suggestedWrapper.appendChild(blurDetails);
      }
      
      // Crear el grupo para sugerencias de delete
      if (deleteSuggestions.length > 0) {
        const deleteDetails = document.createElement("details");
        deleteDetails.open = true;
        
        const deleteSummary = document.createElement("summary");
        deleteSummary.textContent = `Borrar Sugerido (${deleteSuggestions.length})`;
        deleteDetails.appendChild(deleteSummary);
        
        const deleteItems = document.createElement("div");
        deleteItems.className = "blur-items";
        
        deleteSuggestions.forEach(suggestion => {
          const deleteItem = document.createElement("div");
          deleteItem.className = "blur-item delete-preset";
          
          const deleteName = document.createElement("div");
          deleteName.className = "blur-name";
          deleteName.textContent = suggestion.name || getDefaultNameForSelector(suggestion.selector);
          
          const addBtn = document.createElement("button");
          addBtn.className = "add-blur";
          addBtn.innerHTML = "➕";
          addBtn.title = "Aplicar sugerencia";
          addBtn.onclick = () => addSuggestion(domain, suggestion.selector, suggestion.name || getDefaultNameForSelector(suggestion.selector));
          
          deleteItem.appendChild(deleteName);
          deleteItem.appendChild(addBtn);
          
          deleteItems.appendChild(deleteItem);
        });
        
        deleteDetails.appendChild(deleteItems);
        suggestedWrapper.appendChild(deleteDetails);
      }
    });
  }
});
