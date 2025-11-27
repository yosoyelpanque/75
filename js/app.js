/**
 * app.js
 * Punto de entrada principal (Entry Point).
 * Inicializa la base de datos, carga el estado, registra el Service Worker
 * y coordina la inicialización de todos los módulos.
 */

import { state, loadState, saveState, logActivity } from './state.js';
import { photoDB } from './db.js';
import * as ui from './ui.js';

// Módulos funcionales
import { initAuth, checkSession } from './auth.js';
import { initInventory, filterAndRender } from './inventory.js';
import { initFileHandlers } from './files.js';
import { initScanner } from './scanner.js';
import { initReports } from './reports.js';
import { initLayout } from './layout.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Inventario Pro v8.0...');

    // 1. Inicializar Base de Datos (IndexedDB)
    try {
        await photoDB.init();
    } catch (e) {
        console.error('Error crítico al iniciar DB:', e);
        ui.showToast('Error al acceder al almacenamiento local.', 'error');
    }

    // 2. Registrar Service Worker (PWA Offline)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            console.log('✅ Service Worker registrado:', reg.scope);
        } catch (err) {
            console.error('❌ Fallo al registrar Service Worker:', err);
        }
    }

    // 3. Cargar Estado Previo
    const hasData = loadState();
    if (hasData) {
        console.log('💾 Estado cargado correctamente.');
    } else {
        console.log('✨ Iniciando nueva sesión (Estado limpio).');
    }

    // 4. Inicializar Módulos
    initAuth();          // Login/Logout
    initInventory();     // Lógica de tabla y filtros
    initFileHandlers();  // Carga de Excel y Backups
    initScanner();       // Cámara y QR
    initReports();       // Impresión
    initLayout();        // Croquis

    // 5. Configuración Global de UI (Tabs y Temas)
    initGlobalUI();

    // 6. Verificar Sesión (Router Básico)
    checkSession();

    // 7. Iniciar Autoguardado
    startAutosave();
});

/**
 * Configura oyentes globales para navegación y temas.
 */
function initGlobalUI() {
    // Sistema de Pestañas
    const tabsContainer = document.getElementById('tabs-container');
    tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;

        const tabName = btn.dataset.tab;
        
        // Actualizar botones
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'border-indigo-500', 'text-indigo-600'));
        btn.classList.add('active'); // La clase active maneja el estilo en CSS o Tailwind

        // Mostrar contenido
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        // Lógica específica al cambiar de tab
        handleTabChange(tabName);
    });

    // Tema Oscuro / Claro (Si existe el control en settings)
    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            state.theme = theme;
            applyTheme(theme);
            saveState();
        });
    });

    // Aplicar tema guardado al inicio
    applyTheme(state.theme);
}

/**
 * Ejecuta acciones específicas al entrar a una pestaña.
 */
function handleTabChange(tabName) {
    // Efecto visual en el contenedor principal
    const mainContainer = document.getElementById('main-content-area');
    mainContainer.className = `p-6 rounded-xl shadow-md glass-effect transition-colors duration-500 bg-tab-${tabName}`;
    
    // Actualizar Banner de usuario activo
    ui.updateActiveUserBanner();

    if (tabName === 'inventory') {
        // Enfocar búsqueda y refrescar tabla (por si hubo cambios externos)
        filterAndRender();
        setTimeout(() => document.getElementById('search-input').focus(), 100);
    }
    else if (tabName === 'users') {
        ui.renderUserList();
    }
    else if (tabName === 'reports') {
        // Refrescar selectores y gráficas
        const areaSelect = document.getElementById('report-area-filter');
        const userSelect = document.getElementById('report-user-filter');
        // Aquí podrías llamar a una función populateFilters() si la exportaras de inventory.js o ui.js
        // Por ahora confiamos en que el estado está actualizado.
    }
    else if (tabName === 'settings') {
        // Refrescar listas de backups cargados
        // ui.renderLoadedLists();
    }
}

/**
 * Aplica las clases de Tailwind para modo oscuro.
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        document.body.classList.remove('bg-gray-50');
        document.body.classList.add('bg-slate-900');
    } else {
        document.body.classList.remove('dark');
        document.body.classList.add('bg-gray-50');
        document.body.classList.remove('bg-slate-900');
    }
}

/**
 * Sistema de Autoguardado periódico.
 */
let autosaveIntervalId;

function startAutosave() {
    // Leer configuración (o default 30s)
    const intervalInput = document.getElementById('autosave-interval');
    let seconds = 30;
    
    if (intervalInput) {
        seconds = parseInt(intervalInput.value) || 30;
        // Actualizar si el usuario lo cambia
        intervalInput.addEventListener('change', () => startAutosave());
    }

    if (autosaveIntervalId) clearInterval(autosaveIntervalId);

    console.log(`⏱️ Autoguardado configurado cada ${seconds} segundos.`);

    autosaveIntervalId = setInterval(() => {
        if (state.loggedIn && !state.readOnlyMode) {
            saveState();
            // Opcional: ui.showToast('Guardado automático', 'info'); 
            // (Comentado para no ser molesto)
        }
    }, seconds * 1000);
}