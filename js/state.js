/**
 * state.js
 * Gestiona el estado global de la aplicación (Store).
 * Aquí viven los datos que persisten en localStorage.
 */

// Estado inicial por defecto (Vacío)
const defaultState = {
    // Sesión
    loggedIn: false,
    currentUser: null,
    sessionStartTime: null,
    readOnlyMode: false,
    theme: 'light', // 'light' o 'dark'
    lastAutosave: null,

    // Datos Principales
    inventory: [],          // Array de bienes del Excel
    additionalItems: [],    // Bienes agregados manualmente
    resguardantes: [],      // Usuarios creados
    activeResguardante: null, // Usuario seleccionado actualmente

    // Datos Auxiliares
    locations: {},          // Contadores de ubicaciones (para generar IDs)
    areas: [],              // Lista de áreas únicas
    areaNames: {},          // Mapeo ID -> Nombre completo
    
    // Directorios y Gestión
    areaDirectory: {},      // Responsables de área (Nombre, Cargo)
    closedAreas: {},        // Áreas con acta de cierre generada
    completedAreas: {},     // Áreas marcadas como completadas
    persistentAreas: [],    // Áreas que no se borran al quitar listados

    // Metadatos de UI
    notes: {},              // Notas por Clave Única
    photos: {},             // Booleans (true si tiene foto) - inventory
    additionalPhotos: {},   // Booleans - additional
    locationPhotos: {},     // Booleans - locations

    // Logs
    activityLog: [],

    // Checkboxes de Reportes (Persistencia de selección)
    institutionalReportCheckboxes: {},
    actionCheckboxes: {
        labels: {},
        notes: {},
        additional: {},
        mismatched: {},
        personal: {}
    },
    reportCheckboxes: {
        notes: {},
        mismatched: {}
    },

    // Editor de Croquis (Layout)
    mapLayout: { 'page1': {} },
    currentLayoutPage: 'page1',
    layoutPageNames: { 'page1': 'Página 1' },
    layoutImages: {},
    layoutPageColors: { 'page1': '#ffffff' },
    layoutItemColors: {}
};

// Objeto reactivo (lo exportamos para que otros módulos lo lean/modifiquen)
export let state = JSON.parse(JSON.stringify(defaultState));

// Cachés temporales (No se guardan en localStorage, se reconstruyen)
export const tempCache = {
    serialNumberCache: new Set(),
    cameraStream: null
};

// --- FUNCIONES DE GESTIÓN DEL ESTADO ---

/**
 * Carga el estado desde localStorage.
 * Retorna true si había datos guardados, false si es nuevo.
 */
export function loadState() {
    try {
        const stored = localStorage.getItem('inventarioProState');
        if (stored) {
            const loaded = JSON.parse(stored);
            
            // Fusionar con defaultState para asegurar que existan nuevas propiedades 
            // si actualizamos la versión de la app.
            state = { ...defaultState, ...loaded };

            // Reparar inconsistencias comunes
            if (!state.mapLayout || !state.mapLayout.page1) {
                if (Object.keys(state.mapLayout || {}).length > 0 && !state.mapLayout.page1) {
                    // Migración de datos viejos
                    const oldLayout = { ...state.mapLayout };
                    state.mapLayout = { 'page1': oldLayout };
                    state.currentLayoutPage = 'page1';
                    state.layoutPageNames = { 'page1': 'Página 1' };
                } else {
                    state.mapLayout = { 'page1': {} };
                }
            }

            // Reconstruir cachés
            rebuildSerialNumberCache();
            return true;
        }
    } catch (e) {
        console.error('Error crítico al cargar estado:', e);
        // Si falla, resetear a default por seguridad
        resetState(); 
    }
    return false;
}

/**
 * Guarda el estado actual en localStorage.
 * Maneja errores de cuota (almacenamiento lleno).
 */
export function saveState() {
    if (state.readOnlyMode) return;

    try {
        // Creamos una copia limpia para guardar (sin las cachés temporales)
        // Nota: state ya es el objeto de datos, tempCache está separado.
        localStorage.setItem('inventarioProState', JSON.stringify(state));
        state.lastAutosave = new Date().toISOString();
    } catch (e) {
        console.error('Error crítico al guardar:', e);
        
        // Activar modo solo lectura si el disco está lleno
        state.readOnlyMode = true;
        
        // Disparar evento para que la UI se entere (Overlay rojo)
        window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
    }
}

/**
 * Reinicia el estado a los valores por defecto (Borrar sesión).
 * Mantiene el usuario actual si se especifica, para transiciones suaves.
 */
export function resetState(keepUser = null) {
    const theme = state.theme; // Preservar preferencia de tema
    state = JSON.parse(JSON.stringify(defaultState));
    state.theme = theme;
    
    if (keepUser) {
        state.loggedIn = true;
        state.currentUser = keepUser;
        state.sessionStartTime = new Date().toISOString();
    }
    
    rebuildSerialNumberCache();
    saveState();
}

/**
 * Registra una acción en el log de actividad.
 */
export function logActivity(action, details = '') {
    const timestamp = new Date().toLocaleString('es-MX');
    const entry = `[${timestamp}] ${action}: ${details}`;
    
    state.activityLog.push(entry);

    // Limitar log a 500 entradas para no saturar memoria
    if (state.activityLog.length > 500) {
        state.activityLog = state.activityLog.slice(-500);
    }
}

/**
 * Reconstruye el Set de series para búsquedas rápidas de duplicados.
 */
export function rebuildSerialNumberCache() {
    tempCache.serialNumberCache.clear();
    
    // Indexar inventario
    state.inventory.forEach(item => {
        if (item.SERIE) tempCache.serialNumberCache.add(String(item.SERIE).trim().toLowerCase());
        if (item['CLAVE UNICA']) tempCache.serialNumberCache.add(String(item['CLAVE UNICA']).trim().toLowerCase());
    });

    // Indexar adicionales
    state.additionalItems.forEach(item => {
        if (item.serie) tempCache.serialNumberCache.add(String(item.serie).trim().toLowerCase());
        if (item.clave) tempCache.serialNumberCache.add(String(item.clave).trim().toLowerCase());
        if (item.claveAsignada) tempCache.serialNumberCache.add(String(item.claveAsignada).trim().toLowerCase());
    });
}

// Exportar función para inyectar datos (útil para importación de backups)
export function injectState(newState) {
    state = newState;
    rebuildSerialNumberCache();
    saveState();
}