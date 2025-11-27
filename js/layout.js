/**
 * layout.js
 * Editor de Croquis (Layout Editor).
 * Permite arrastrar ubicaciones al lienzo, añadir formas y guardar coordenadas.
 * Dependencia: interact.js (Global)
 */

import { state, saveState, logActivity } from './state.js';
import * as ui from './ui.js';
import { photoDB } from './db.js';
import { generateUUID } from './utils.js';

// Cache de objetos URL para liberar memoria
let activeLayoutUrls = [];

export function initLayout() {
    // Botones del Editor
    document.getElementById('open-layout-editor-btn').addEventListener('click', openEditor);
    document.getElementById('layout-close-btn').addEventListener('click', () => ui.closeModal(document.getElementById('layout-editor-modal')));
    document.getElementById('layout-save-btn').addEventListener('click', saveLayout);
    
    // Herramientas
    document.getElementById('layout-add-image-btn').addEventListener('click', () => document.getElementById('layout-image-input').click());
    document.getElementById('layout-image-input').addEventListener('change', handleImageUpload);
    
    // Paginación
    document.getElementById('layout-page-add').addEventListener('click', addPage);
    document.getElementById('layout-page-remove').addEventListener('click', removePage);
    document.getElementById('layout-page-prev').addEventListener('click', () => changePage(-1));
    document.getElementById('layout-page-next').addEventListener('click', () => changePage(1));
    document.getElementById('layout-page-name').addEventListener('change', renamePage);
    document.getElementById('layout-page-reset').addEventListener('click', resetCanvas);

    // Sidebar (Drag & Drop desde la lista)
    // Nota: Interact.js se configura al abrir el editor para asegurar que el DOM es visible
}

function openEditor() {
    if (state.readOnlyMode) return ui.showToast('Modo lectura.', 'warning');
    
    const modal = document.getElementById('layout-editor-modal');
    ui.openModal(modal);
    
    // Inicializar Interact.js si no se ha hecho
    initInteract();
    
    // Cargar datos
    if (!state.currentLayoutPage) state.currentLayoutPage = 'page1';
    loadPage(state.currentLayoutPage);
    renderSidebar();
}

// --- INTERACT.JS CONFIGURACIÓN ---

let interactInitialized = false;

function initInteract() {
    if (interactInitialized) return;
    
    // 1. Elementos en el lienzo (Movimiento y Redimensión)
    interact('.layout-shape.layout-on-canvas')
        .draggable({
            listeners: { move: dragMoveListener },
            modifiers: [
                interact.modifiers.snap({
                    targets: [ interact.snappers.grid({ x: 10, y: 10 }) ],
                    range: Infinity,
                    relativePoints: [ { x: 0, y: 0 } ]
                }),
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ]
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move (event) {
                    let target = event.target;
                    let x = (parseFloat(target.dataset.x) || 0) + event.deltaRect.left;
                    let y = (parseFloat(target.dataset.y) || 0) + event.deltaRect.top;

                    target.style.width = event.rect.width + 'px';
                    target.style.height = event.rect.height + 'px';

                    target.style.transform = `translate(${x}px, ${y}px) rotate(${target.dataset.rotation || 0}deg)`;
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            },
            modifiers: [
                interact.modifiers.snap({ targets: [ interact.snappers.grid({ x: 10, y: 10 }) ] }),
                interact.modifiers.restrictSize({ min: { width: 50, height: 50 } })
            ]
        });

    // 2. Elementos de la barra lateral (Solo arrastrables para clonar)
    interact('.draggable-tool, .draggable-item').draggable({
        listeners: { move: dragMoveListener },
        inertia: true
    });

    // 3. Zona de soltar (El lienzo)
    interact('#layout-canvas').dropzone({
        accept: '.draggable-tool, .draggable-item',
        overlap: 0.50,
        ondrop: handleDrop
    });

    // 4. Rotación (Manija especial)
    interact('.layout-rotate-handle').draggable({
        onmove: handleRotate
    });

    interactInitialized = true;
}

function dragMoveListener(event) {
    var target = event.target;
    var x = (parseFloat(target.dataset.x) || 0) + event.dx;
    var y = (parseFloat(target.dataset.y) || 0) + event.dy;

    target.style.transform = `translate(${x}px, ${y}px)`;
    target.dataset.x = x;
    target.dataset.y = y;
}

function handleRotate(event) {
    const handle = event.target;
    const shape = handle.closest('.layout-shape');
    if (!shape) return;

    const rect = shape.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calcular ángulo basado en la posición del mouse relativo al centro
    const angle = Math.atan2(event.pageY - centerY, event.pageX - centerX) * (180 / Math.PI);
    let rotation = Math.round(angle + 90); // Ajuste de offset
    rotation = Math.round(rotation / 15) * 15; // Snap a 15 grados

    const x = parseFloat(shape.dataset.x) || 0;
    const y = parseFloat(shape.dataset.y) || 0;

    shape.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    shape.dataset.rotation = rotation;
    event.stopPropagation();
}

function handleDrop(event) {
    const draggableElement = event.relatedTarget;
    const canvasWrapper = document.getElementById('layout-canvas-wrapper');
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const itemRect = draggableElement.getBoundingClientRect();

    // Calcular posición relativa al canvas (ajustando por scroll)
    const x = (itemRect.left - wrapperRect.left) + canvasWrapper.scrollLeft - 20; 
    const y = (itemRect.top - wrapperRect.top) + canvasWrapper.scrollTop - 20;
    
    // Snap a rejilla
    const snappedX = Math.round(x / 10) * 10;
    const snappedY = Math.round(y / 10) * 10;

    if (draggableElement.classList.contains('draggable-item')) {
        // Es una Ubicación Real
        const locId = draggableElement.dataset.locId;
        createShape(generateUUID(), snappedX, snappedY, 180, 60, 'location', { text: locId });
        draggableElement.classList.add('hidden'); // Ocultar de la lista
    } else {
        // Es una Herramienta (Texto, Flecha, Nota)
        const type = draggableElement.dataset.toolType; // 'text', 'arrow', 'note'
        let w = 100, h = 50;
        if (type === 'note') { w = 200; h = 100; }
        if (type === 'arrow') { w = 50; h = 50; }
        
        createShape(generateUUID(), snappedX, snappedY, w, h, type);
    }

    // Resetear posición del elemento arrastrado en la barra lateral
    draggableElement.style.transform = 'none';
    draggableElement.dataset.x = 0;
    draggableElement.dataset.y = 0;
    
    saveLayout(); // Guardar automáticamente al soltar
}

// --- LÓGICA DEL LIENZO ---

function createShape(id, x, y, w, h, type, extra = {}) {
    const canvas = document.getElementById('layout-canvas');
    const el = document.createElement('div');
    el.className = `layout-shape layout-on-canvas tool-${type}`;
    el.dataset.id = id;
    el.dataset.type = type;
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.rotation = extra.rotation || 0;
    
    el.style.transform = `translate(${x}px, ${y}px) rotate(${extra.rotation || 0}deg)`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    // Contenido Interno
    let content = '';
    
    if (type === 'location') {
        const icon = 'fa-solid fa-location-dot'; // Simplificado
        content = `
            <div class="border-b border-gray-400 font-bold text-xs pb-1 mb-1 truncate">
                <i class="${icon} mr-1"></i>${extra.text}
            </div>
            <div class="text-[10px] text-gray-600">Arrastra para mover</div>
        `;
        el.dataset.locId = extra.text; // Guardar ID ubicación real
    } 
    else if (type === 'text' || type === 'note') {
        content = `<textarea class="w-full h-full bg-transparent resize-none outline-none text-sm font-bold text-center" placeholder="Escribir...">${extra.text || ''}</textarea>`;
    }
    else if (type === 'arrow') {
        content = `<i class="fa-solid fa-arrow-up text-4xl text-indigo-500 opacity-80 w-full h-full flex items-center justify-center"></i>`;
    }
    else if (type === 'image') {
        if (extra.src) el.style.backgroundImage = `url(${extra.src})`;
        else content = '<span class="text-xs text-gray-400">Cargando...</span>';
    }

    // Botones de control (Borrar y Rotar)
    const controls = `
        <div class="layout-delete-btn"><i class="fa-solid fa-xmark"></i></div>
        <div class="layout-rotate-handle"><i class="fa-solid fa-rotate-right"></i></div>
    `;

    el.innerHTML = content + controls;
    canvas.appendChild(el);

    // Listener para borrar
    el.querySelector('.layout-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar seleccionar
        el.remove();
        if (type === 'location') renderSidebar(); // Mostrar de nuevo en la lista
        saveLayout();
    });
    
    // Listener para guardar texto al escribir
    const textarea = el.querySelector('textarea');
    if (textarea) {
        textarea.addEventListener('change', saveLayout);
    }
}

// --- GESTIÓN DE PÁGINAS Y DATOS ---

async function loadPage(pageId) {
    const canvas = document.getElementById('layout-canvas');
    canvas.innerHTML = '';
    
    // Limpiar memoria
    activeLayoutUrls.forEach(url => URL.revokeObjectURL(url));
    activeLayoutUrls = [];

    // Actualizar controles paginación
    document.getElementById('layout-page-name').value = state.layoutPageNames[pageId] || pageId;
    
    const layoutData = state.mapLayout[pageId] || {};
    
    for (const id in layoutData) {
        const item = layoutData[id];
        let extra = { text: item.text, rotation: item.rotation };
        
        if (item.type === 'image' && item.imageId) {
            try {
                const blob = await photoDB.getItem('layoutImages', item.imageId);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    activeLayoutUrls.push(url);
                    extra.src = url;
                }
            } catch (e) { console.error(e); }
        }
        
        createShape(id, item.x, item.y, item.width, item.height, item.type, extra);
    }
}

function saveLayout() {
    const canvas = document.getElementById('layout-canvas');
    const items = {};
    
    canvas.querySelectorAll('.layout-on-canvas').forEach(el => {
        const id = el.dataset.id;
        const type = el.dataset.type;
        const x = parseFloat(el.dataset.x);
        const y = parseFloat(el.dataset.y);
        const w = parseFloat(el.style.width);
        const h = parseFloat(el.style.height);
        const rot = parseFloat(el.dataset.rotation) || 0;
        
        const itemData = { type, x, y, width: w, height: h, rotation: rot };
        
        // Guardar texto de notas
        const textarea = el.querySelector('textarea');
        if (textarea) itemData.text = textarea.value;
        
        // Guardar ID de ubicación
        if (type === 'location') itemData.text = el.dataset.locId;
        
        // Guardar referencia de imagen
        if (type === 'image') {
            // Buscamos si ya tenía imageId en el estado anterior para preservarlo
            const oldItem = state.mapLayout[state.currentLayoutPage]?.[id];
            if (oldItem && oldItem.imageId) itemData.imageId = oldItem.imageId;
            // Si es nueva imagen, se asignó al crear (ver handleImageUpload)
            if (el.dataset.imageId) itemData.imageId = el.dataset.imageId;
        }

        items[id] = itemData;
    });

    state.mapLayout[state.currentLayoutPage] = items;
    saveState();
}

function renderSidebar() {
    const container = document.getElementById('layout-sidebar-locations');
    container.innerHTML = '';
    
    // Obtener ubicaciones que NO están en el lienzo actual
    const usedLocs = new Set();
    const currentData = state.mapLayout[state.currentLayoutPage] || {};
    Object.values(currentData).forEach(i => {
        if (i.type === 'location') usedLocs.add(i.text);
    });

    // Obtener todas las ubicaciones únicas de los usuarios
    const allLocs = new Set();
    state.resguardantes.forEach(u => {
        if (u.locations) u.locations.forEach(l => allLocs.add(l));
        else if (u.locationWithId) allLocs.add(u.locationWithId);
    });

    Array.from(allLocs).sort().forEach(loc => {
        if (usedLocs.has(loc)) return; // Ya está en el lienzo

        const div = document.createElement('div');
        div.className = 'draggable-item bg-white border p-2 rounded shadow-sm cursor-move text-xs flex items-center gap-2 hover:bg-indigo-50';
        div.dataset.locId = loc;
        div.innerHTML = `<i class="fa-solid fa-location-dot text-indigo-500"></i> ${loc}`;
        container.appendChild(div);
    });
}

// --- MANEJO DE IMÁGENES ---

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const imageId = `img_${Date.now()}`;
    const shapeId = generateUUID();

    try {
        // Guardar en DB
        await photoDB.setItem('layoutImages', imageId, file);
        
        // Crear visualmente
        const url = URL.createObjectURL(file);
        const el = createShape(shapeId, 50, 50, 200, 200, 'image', { src: url });
        
        // Marcar el elemento DOM con el ID de imagen para que saveLayout lo capture
        const shape = document.querySelector(`[data-id="${shapeId}"]`);
        if(shape) shape.dataset.imageId = imageId;

        saveLayout();
        e.target.value = '';
    } catch (err) {
        console.error(err);
        ui.showToast('Error al cargar imagen.', 'error');
    }
}

// --- PAGINACIÓN ---

function addPage() {
    const id = `page_${Date.now()}`;
    const num = Object.keys(state.layoutPageNames).length + 1;
    state.layoutPageNames[id] = `Página ${num}`;
    state.mapLayout[id] = {};
    changePageTo(id);
}

function removePage() {
    const keys = Object.keys(state.layoutPageNames);
    if (keys.length <= 1) return ui.showToast('Mínimo una página.', 'error');
    
    if (confirm('¿Eliminar esta página?')) {
        delete state.mapLayout[state.currentLayoutPage];
        delete state.layoutPageNames[state.currentLayoutPage];
        // Ir a la primera página disponible
        changePageTo(Object.keys(state.layoutPageNames)[0]);
    }
}

function changePage(dir) {
    const keys = Object.keys(state.layoutPageNames);
    const idx = keys.indexOf(state.currentLayoutPage);
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < keys.length) {
        changePageTo(keys[newIdx]);
    }
}

function changePageTo(id) {
    state.currentLayoutPage = id;
    loadPage(id);
    renderSidebar(); // Actualizar lista (ubicaciones usadas cambian por página)
    saveState();
}

function renamePage(e) {
    const newName = e.target.value.trim();
    if (newName) {
        state.layoutPageNames[state.currentLayoutPage] = newName;
        saveState();
    }
}

function resetCanvas() {
    if (confirm('¿Limpiar todo el lienzo?')) {
        state.mapLayout[state.currentLayoutPage] = {};
        loadPage(state.currentLayoutPage);
        renderSidebar();
        saveState();
    }
}