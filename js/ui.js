/**
 * ui.js
 * Módulo encargado de la manipulación del DOM y renderizado visual.
 * No contiene lógica de negocio compleja, solo presentación.
 */

import { state } from './state.js';
import { photoDB } from './db.js';
import { escapeHTML, highlightText, truncateText } from './utils.js';

// Cache de elementos DOM para acceso rápido
export const elements = {
    // Contenedores Principales
    dashboard: document.getElementById('header-and-dashboard'),
    mainContent: document.getElementById('main-content-area'),
    
    // Dashboard Stats
    totalItems: document.getElementById('total-items'),
    locatedItems: document.getElementById('located-items'),
    pendingItems: document.getElementById('pending-items'),
    dailyProgress: document.getElementById('daily-progress'),
    workingAreas: document.getElementById('working-areas-count'),
    additionalCount: document.getElementById('additional-items-count'),
    
    // Tablas y Listas
    inventoryBody: document.getElementById('inventory-table-body'),
    userList: document.getElementById('registered-users-list'),
    additionalList: document.getElementById('adicionales-list'),
    
    // Paginación
    pageInfo: document.getElementById('page-info'),
    prevBtn: document.getElementById('prev-page-btn'),
    nextBtn: document.getElementById('next-page-btn'),
    
    // Banner Usuario Activo
    activeUserBanner: {
        container: document.getElementById('active-user-banner'),
        name: document.getElementById('active-user-banner-name'),
        area: document.getElementById('active-user-banner-area'),
        locationSelect: document.getElementById('active-user-location-select'),
        mobileSelect: document.getElementById('active-user-location-select-mobile')
    },

    // Contenedor de Toasts
    toastContainer: document.getElementById('toast-container')
};

// --- NOTIFICACIONES (TOASTS) ---

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    let colors = 'bg-gray-800'; // Info
    if (type === 'success') colors = 'bg-green-600';
    if (type === 'error') colors = 'bg-red-600';
    if (type === 'warning') colors = 'bg-yellow-600';

    toast.className = `toast-notification flex items-center w-full max-w-xs p-4 mb-4 text-white rounded-lg shadow-lg ${colors} transition-all duration-300 transform translate-y-2 opacity-0`;
    toast.innerHTML = `
        <div class="text-sm font-normal">${escapeHTML(message)}</div>
    `;

    elements.toastContainer.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto-eliminar a los 3 segundos
    setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- RENDERIZADO DEL DASHBOARD ---

export function renderDashboard() {
    const total = state.inventory.length;
    const located = state.inventory.filter(i => i.UBICADO === 'SI').length;
    const additional = state.additionalItems.length;
    
    // Cálculo de avance diario
    const today = new Date().toISOString().slice(0, 10);
    const dailyInv = state.inventory.filter(i => i.fechaUbicado && i.fechaUbicado.startsWith(today)).length;
    const dailyAdd = state.additionalItems.filter(i => i.fechaRegistro && i.fechaRegistro.startsWith(today)).length;

    // Áreas únicas
    const areas = new Set(state.inventory.map(i => i.areaOriginal)).size;

    elements.totalItems.textContent = total;
    elements.locatedItems.textContent = located;
    elements.pendingItems.textContent = total - located;
    elements.dailyProgress.textContent = dailyInv + dailyAdd;
    elements.workingAreas.textContent = areas;
    elements.additionalCount.textContent = additional;
}

// --- RENDERIZADO DE TABLAS ---

/**
 * Renderiza la tabla principal de inventario.
 * @param {Array} items - Lista filtrada de bienes a mostrar.
 * @param {number} page - Página actual.
 * @param {number} itemsPerPage - Elementos por página.
 * @param {string} searchTerm - Término de búsqueda para resaltar.
 */
export function renderInventoryTable(items, page, itemsPerPage, searchTerm = '') {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = items.slice(start, end);
    const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

    elements.inventoryBody.innerHTML = '';

    if (paginatedItems.length === 0) {
        elements.inventoryBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">No se encontraron resultados.</td></tr>`;
    } else {
        const fragment = document.createDocumentFragment();
        
        paginatedItems.forEach(item => {
            const tr = document.createElement('tr');
            const clave = item['CLAVE UNICA'];
            const isLocated = item.UBICADO === 'SI';
            const hasNote = state.notes[clave];
            const hasPhoto = state.photos[clave];
            
            // Clases dinámicas
            let rowClass = 'hover:bg-gray-50 border-b transition-colors';
            if (isLocated) rowClass += ' bg-green-50';
            if (hasNote) rowClass += ' bg-yellow-50';
            tr.className = rowClass;
            tr.dataset.clave = clave; // Importante para eventos

            // Preparar celdas
            const userDisplay = item['NOMBRE DE USUARIO'] || '';
            const locationDisplay = item.ubicacionEspecifica ? `<br><span class="text-xs text-indigo-600 font-bold">📍 ${escapeHTML(item.ubicacionEspecifica)}</span>` : '';

            // Edición en línea (si está activa)
            const isEdit = state.inventoryEditMode;
            const cellClass = isEdit ? 'border-2 border-dashed border-gray-300 p-1 bg-white cursor-text focus:border-indigo-500 outline-none' : '';
            const editableAttr = isEdit ? 'contenteditable="true"' : '';

            tr.innerHTML = `
                <td class="p-2 text-center"><input type="checkbox" class="inventory-item-checkbox w-4 h-4 rounded text-indigo-600"></td>
                <td class="p-2 font-mono text-sm text-gray-600">${highlightText(clave, searchTerm)}</td>
                <td class="p-2 text-sm">
                    <div class="${cellClass}" ${editableAttr} data-field="DESCRIPCION">${isEdit ? escapeHTML(item.DESCRIPCION) : highlightText(truncateText(item.DESCRIPCION, 40), searchTerm)}</div>
                </td>
                <td class="p-2 text-sm">
                    <div class="${cellClass}" ${editableAttr} data-field="MARCA">${isEdit ? escapeHTML(item.MARCA) : highlightText(item.MARCA, searchTerm)}</div>
                </td>
                <td class="p-2 text-sm">
                    <div class="${cellClass}" ${editableAttr} data-field="SERIE">${isEdit ? escapeHTML(item.SERIE) : highlightText(item.SERIE, searchTerm)}</div>
                </td>
                <td class="p-2 text-sm text-gray-700">
                    ${highlightText(userDisplay, searchTerm)}${locationDisplay}
                </td>
                <td class="p-2 text-center text-sm font-bold ${isLocated ? 'text-green-600' : 'text-red-400'}">
                    ${isLocated ? 'SI' : 'NO'}
                </td>
                <td class="p-2 text-center flex justify-center gap-3">
                    <i class="fa-solid fa-note-sticky text-lg cursor-pointer ${hasNote ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'} note-icon" title="Nota"></i>
                    <i class="fa-solid fa-camera text-lg cursor-pointer ${hasPhoto ? 'text-indigo-500' : 'text-gray-300 hover:text-indigo-500'} camera-icon" title="Foto"></i>
                    <i class="fa-solid fa-qrcode text-lg cursor-pointer text-gray-300 hover:text-gray-800 view-qr-btn" title="Ver QR"></i>
                </td>
            `;
            fragment.appendChild(tr);
        });
        elements.inventoryBody.appendChild(fragment);
    }

    // Actualizar controles de paginación
    elements.pageInfo.textContent = `Página ${page} de ${totalPages}`;
    elements.prevBtn.disabled = page === 1;
    elements.nextBtn.disabled = page >= totalPages;
    
    // Estilos visuales de botones deshabilitados
    elements.prevBtn.classList.toggle('opacity-50', page === 1);
    elements.nextBtn.classList.toggle('opacity-50', page >= totalPages);
}

// --- RENDERIZADO DE LISTA DE USUARIOS ---

export function renderUserList(searchTerm = '') {
    const list = elements.userList;
    list.innerHTML = '';

    const filteredUsers = state.resguardantes.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        String(u.area).includes(searchTerm)
    );

    document.getElementById('user-count-badge').textContent = `${filteredUsers.length} / ${state.resguardantes.length}`;

    if (filteredUsers.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-center py-4">No se encontraron usuarios.</p>';
        return;
    }

    filteredUsers.forEach((user, index) => {
        const isActive = state.activeResguardante?.id === user.id;
        const item = document.createElement('div');
        
        // Estilos
        item.className = `flex items-center justify-between p-3 rounded-lg shadow-sm mb-2 transition-all ${isActive ? 'bg-green-50 border-l-4 border-green-500' : 'bg-white hover:bg-gray-50'}`;
        
        // Ubicaciones
        const locs = user.locations && user.locations.length > 0 
            ? user.locations.join(', ') 
            : (user.locationWithId || 'Sin ubicación');

        // Render HTML
        item.innerHTML = `
            <div class="flex-grow cursor-pointer user-row-click" data-id="${user.id}">
                <p class="font-bold text-gray-800">${escapeHTML(user.name)}</p>
                <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <span class="bg-gray-200 px-2 py-0.5 rounded">Área ${escapeHTML(user.area)}</span>
                    <span class="truncate max-w-[150px]" title="${escapeHTML(locs)}"><i class="fa-solid fa-map-pin mr-1"></i>${escapeHTML(locs)}</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="activate-user-btn text-xs font-bold px-3 py-1 rounded transition-colors ${isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}" data-index="${index}">
                    ${isActive ? 'Activo' : 'Activar'}
                </button>
                <button class="edit-user-btn text-blue-500 hover:bg-blue-50 p-2 rounded" data-index="${index}"><i class="fa-solid fa-pencil"></i></button>
                <button class="delete-user-btn text-red-500 hover:bg-red-50 p-2 rounded" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- ACTUALIZAR BANNER USUARIO ACTIVO ---

export function updateActiveUserBanner() {
    const banner = elements.activeUserBanner;
    const user = state.activeResguardante;

    if (!user) {
        banner.container.classList.add('hidden');
        return;
    }

    banner.container.classList.remove('hidden');
    banner.name.textContent = user.name;
    banner.area.textContent = state.areaNames[user.area] || `Área ${user.area}`;

    // Llenar selectores de ubicación
    const locs = user.locations && user.locations.length > 0 ? user.locations : [user.locationWithId];
    const options = locs.map(l => `<option value="${l}">${l}</option>`).join('');
    
    banner.locationSelect.innerHTML = options;
    banner.mobileSelect.innerHTML = options;
    
    // Sincronizar eventos de cambio
    banner.locationSelect.onchange = (e) => banner.mobileSelect.value = e.target.value;
    banner.mobileSelect.onchange = (e) => banner.locationSelect.value = e.target.value;
}

// --- RENDERIZADO ADICIONALES ---

export function renderAdicionalesList(filteredItems) {
    const list = elements.additionalList;
    list.innerHTML = '';
    
    // Actualizar contador
    document.getElementById('additional-items-total').textContent = filteredItems.length;

    if (filteredItems.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 py-4">No hay bienes adicionales.</p>';
        return;
    }

    filteredItems.forEach((item, idx) => {
        const div = document.createElement('div');
        const isPersonal = item.personal === 'Si';
        const hasPhoto = state.additionalPhotos[item.id];
        
        div.className = `flex justify-between items-center p-3 mb-2 rounded-lg border-l-4 shadow-sm ${isPersonal ? 'bg-yellow-50 border-yellow-400' : 'bg-green-50 border-green-400'}`;
        
        div.innerHTML = `
            <div>
                <p class="font-bold text-sm">
                    ${idx + 1}. ${escapeHTML(item.descripcion)}
                    ${isPersonal ? '<span class="text-xs bg-yellow-200 text-yellow-800 px-1 rounded ml-2">Personal</span>' : ''}
                </p>
                <p class="text-xs text-gray-600 mt-1">
                    <span class="mr-2">Clave: <b>${escapeHTML(item.clave || 'S/C')}</b></span>
                    <span>Usuario: <b>${escapeHTML(item.usuario)}</b></span>
                </p>
            </div>
            <div class="flex gap-2">
                <button class="add-photo-btn text-gray-400 hover:text-indigo-600 ${hasPhoto ? 'text-indigo-600' : ''}" data-id="${item.id}"><i class="fa-solid fa-camera"></i></button>
                <button class="edit-add-btn text-gray-400 hover:text-blue-600" data-id="${item.id}"><i class="fa-solid fa-pencil"></i></button>
                <button class="del-add-btn text-gray-400 hover:text-red-600" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- GESTIÓN DE MODALES ---

export function closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('show');
    
    // Limpieza específica si es modal de fotos
    if (modalElement.id === 'photo-modal' || modalElement.id === 'item-detail-view-modal') {
        const img = modalElement.querySelector('img');
        if (img && img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
            img.src = '';
        }
    }
}

export function openModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('show');
    
    // Enfocar primer input si existe
    const firstInput = modalElement.querySelector('input, button');
    if (firstInput) firstInput.focus();
}