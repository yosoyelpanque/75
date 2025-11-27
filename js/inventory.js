/**
 * inventory.js
 * Lógica de negocio principal: Filtrado, Paginación y Acciones sobre bienes.
 */

import { state, saveState, logActivity, tempCache } from './state.js';
import * as ui from './ui.js';
import { debounce } from './utils.js';

// Variables locales del módulo
let currentPage = 1;
const itemsPerPage = 50;
let filteredItems = [];

// --- INICIALIZACIÓN ---

export function initInventory() {
    // Listeners de Filtros
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const areaFilter = document.getElementById('area-filter-inventory');
    const bookFilter = document.getElementById('book-type-filter');
    
    // Búsqueda con debounce (espera a que el usuario deje de escribir)
    searchInput.addEventListener('input', debounce(() => {
        currentPage = 1;
        filterAndRender();
    }, 300));

    // Filtros directos
    [statusFilter, areaFilter, bookFilter].forEach(el => {
        el.addEventListener('change', () => {
            currentPage = 1;
            filterAndRender();
        });
    });

    // Paginación
    ui.elements.prevBtn.addEventListener('click', () => changePage(-1));
    ui.elements.nextBtn.addEventListener('click', () => changePage(1));

    // Botón Limpiar
    document.getElementById('clear-search-btn').addEventListener('click', clearFilters);

    // Acciones Masivas
    document.getElementById('ubicado-btn').addEventListener('click', () => executeAction('ubicar'));
    document.getElementById('re-etiquetar-btn').addEventListener('click', () => executeAction('re-etiquetar'));
    document.getElementById('desubicar-btn').addEventListener('click', () => executeAction('desubicar'));

    // Checkbox "Seleccionar Todo"
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
        document.querySelectorAll('.inventory-item-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    // Toggle Modo Edición
    document.getElementById('inventory-edit-mode-toggle').addEventListener('change', (e) => {
        state.inventoryEditMode = e.target.checked;
        ui.showToast(state.inventoryEditMode ? 'Modo Edición ACTIVADO' : 'Modo Edición DESACTIVADO', 'warning');
        filterAndRender(); // Re-renderizar para activar/desactivar celdas editables
    });

    // Carga inicial
    filterAndRender();
}

// --- FILTRADO Y BÚSQUEDA ---

export function filterAndRender() {
    const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
    const status = document.getElementById('status-filter').value;
    const area = document.getElementById('area-filter-inventory').value;
    const bookType = document.getElementById('book-type-filter').value;

    // Algoritmo de filtrado optimizado
    filteredItems = state.inventory.filter(item => {
        // 1. Filtro de Texto (Busca en múltiples campos)
        if (searchTerm) {
            const match = [
                item['CLAVE UNICA'], 
                item['DESCRIPCION'], 
                item['MARCA'], 
                item['MODELO'], 
                item['SERIE']
            ].some(field => field && String(field).toLowerCase().includes(searchTerm));
            
            if (!match) return false;
        }

        // 2. Filtros de Selectores
        if (status !== 'all' && item.UBICADO !== status) return false;
        if (area !== 'all' && item.areaOriginal !== area) return false;
        if (bookType !== 'all' && item.listadoOriginal !== bookType) return false;

        return true;
    });

    // Renderizar tabla a través de UI.js
    ui.renderInventoryTable(filteredItems, currentPage, itemsPerPage, searchTerm);
}

// --- PAGINACIÓN ---

function changePage(direction) {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
    const newPage = currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        // Solo re-renderizamos la tabla, no volvemos a filtrar todo el array
        const searchTerm = document.getElementById('search-input').value.trim();
        ui.renderInventoryTable(filteredItems, currentPage, itemsPerPage, searchTerm);
    }
}

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('area-filter-inventory').value = 'all';
    document.getElementById('book-type-filter').value = 'all';
    currentPage = 1;
    filterAndRender();
}

// --- ACCIONES DE NEGOCIO (Ubicar, etc) ---

function executeAction(action) {
    if (state.readOnlyMode) return ui.showToast('Modo lectura activo.', 'warning');

    // Obtener seleccionados
    const checkboxes = Array.from(document.querySelectorAll('.inventory-item-checkbox:checked'));
    if (checkboxes.length === 0) return ui.showToast('Selecciona al menos un bien.', 'error');

    const selectedClaves = checkboxes.map(cb => cb.closest('tr').dataset.clave);
    
    // DES-UBICAR (No requiere usuario activo)
    if (action === 'desubicar') {
        if (!confirm(`¿Des-ubicar ${selectedClaves.length} bienes? Se perderá la asignación actual.`)) return;
        
        selectedClaves.forEach(clave => {
            const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
            if (item) {
                item.UBICADO = 'NO';
                item['NOMBRE DE USUARIO'] = '';
                item['IMPRIMIR ETIQUETA'] = 'NO';
                item.ubicacionEspecifica = '';
                item.fechaUbicado = null;
                item.areaIncorrecta = false;
            }
        });
        
        finishAction('Bienes marcados como pendientes.', selectedClaves);
        return;
    }

    // UBICAR / RE-ETIQUETAR (Requiere usuario activo)
    if (!state.activeResguardante) {
        return ui.showToast('¡Error! Debes activar un USUARIO primero (Pestaña Usuarios).', 'error');
    }

    const activeUser = state.activeResguardante;
    // Obtener ubicación precisa del selector en UI
    const locationSelect = document.getElementById('active-user-location-select');
    const preciseLocation = locationSelect ? locationSelect.value : (activeUser.locationWithId || 'N/A');

    let conflictCount = 0;

    selectedClaves.forEach(clave => {
        const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
        if (!item) return;

        // Detectar si ya es de otro
        if (item.UBICADO === 'SI' && item['NOMBRE DE USUARIO'] !== activeUser.name) {
            conflictCount++;
            // En esta versión simplificada, reasignamos automáticamente si seleccionó explícitamente.
            // (Podrías añadir un confirm extra aquí si quisieras ser estricto)
        }

        // Aplicar cambios
        item.UBICADO = 'SI';
        item['NOMBRE DE USUARIO'] = activeUser.name;
        item.fechaUbicado = new Date().toISOString();
        item.ubicacionEspecifica = preciseLocation;
        item.areaIncorrecta = (item.areaOriginal !== activeUser.area);

        if (action === 're-etiquetar') {
            item['IMPRIMIR ETIQUETA'] = 'SI';
        } else if (action === 'ubicar') {
            // Si solo ubica, quitamos la marca de etiqueta pendiente si la tenía
            if (item['IMPRIMIR ETIQUETA'] === 'SI') item['IMPRIMIR ETIQUETA'] = 'NO';
        }
    });

    const msg = action === 're-etiquetar' 
        ? `${selectedClaves.length} bienes ubicados y marcados para etiqueta.` 
        : `${selectedClaves.length} bienes ubicados exitosamente.`;

    logActivity(action.toUpperCase(), `${selectedClaves.length} bienes asignados a ${activeUser.name} en ${preciseLocation}`);
    
    if (conflictCount > 0) {
        ui.showToast(`Atención: ${conflictCount} bienes fueron reasignados de otros usuarios.`, 'warning');
    }

    finishAction(msg, selectedClaves);
    
    // Verificar si el área se completó
    checkAreaCompletion(activeUser.area);
}

function finishAction(message, selectedClaves) {
    saveState();
    ui.renderDashboard();
    filterAndRender(); // Refrescar tabla
    ui.showToast(message, 'success');
    
    // Limpiar selección
    document.getElementById('select-all-checkbox').checked = false;
    
    // Limpiar input búsqueda para seguir trabajando rápido
    document.getElementById('search-input').value = '';
    document.getElementById('search-input').focus();
}

// --- LOGICA DE FINALIZACIÓN ---

function checkAreaCompletion(areaId) {
    if (!areaId || state.completedAreas[areaId]) return;

    const areaItems = state.inventory.filter(i => i.areaOriginal === areaId);
    if (areaItems.length === 0) return;

    const allLocated = areaItems.every(i => i.UBICADO === 'SI');

    if (allLocated) {
        state.completedAreas[areaId] = true;
        ui.showToast(`🎉 ¡Felicidades! Has completado el área ${areaId}.`, 'success');
        logActivity('Área Completada', `Área ${areaId} finalizada.`);
        saveState();
        // Aquí podrías disparar un modal de celebración o sugerir el acta de cierre
    }
}