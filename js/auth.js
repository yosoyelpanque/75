/**
 * auth.js
 * Gestión de autenticación, sesiones y control de acceso.
 */

import { state, saveState, logActivity, resetState } from './state.js';
import { VERIFIERS } from './utils.js';
import { showToast, renderDashboard, renderUserList, updateActiveUserBanner } from './ui.js';
import { deleteDatabase } from './db.js';
// Importamos funciones de otros módulos para inicializar vistas al entrar
import { filterAndRender } from './inventory.js';

// Elementos DOM
const loginPage = document.getElementById('login-page');
const mainApp = document.getElementById('main-app');
const loginInput = document.getElementById('employee-number-input');
const loginBtn = document.getElementById('employee-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const clearSessionLink = document.getElementById('clear-session-link');
const currentUserDisplay = document.getElementById('current-user-name');
const summaryAuthor = document.getElementById('summary-author');

/**
 * Inicializa los escuchadores de eventos para autenticación.
 */
export function initAuth() {
    // Botón Ingresar
    loginBtn.addEventListener('click', handleLogin);
    
    // Enter en el input
    loginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    });

    // Botón Salir
    logoutBtn.addEventListener('click', handleLogout);

    // Link Limpiar Sesión (Reset total)
    clearSessionLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('¡PELIGRO!\n\nEsto borrará TODO el inventario, usuarios y fotos de este dispositivo.\n¿Estás seguro de que quieres reiniciar de cero?')) {
            handleFullReset();
        }
    });
}

/**
 * Verifica si hay una sesión activa al cargar la página.
 */
export function checkSession() {
    if (state.loggedIn && state.currentUser) {
        showMainApp();
        logActivity('Sesión restaurada', `Usuario: ${state.currentUser.name}`);
    } else {
        showLoginPage();
    }
}

/**
 * Lógica de Login
 */
function handleLogin() {
    const number = loginInput.value.trim();
    const name = VERIFIERS[number];

    if (name) {
        const newUser = { number, name };

        // Si ya había alguien logueado diferente (caso raro pero posible)
        if (state.loggedIn && state.currentUser && state.currentUser.number !== number) {
            if (!confirm(`Hay una sesión activa de ${state.currentUser.name}. ¿Deseas cerrarla e iniciar como ${name}?`)) {
                return;
            }
        }

        // Establecer estado
        state.loggedIn = true;
        state.currentUser = newUser;
        if (!state.sessionStartTime) state.sessionStartTime = new Date().toISOString();

        saveState();
        logActivity('Inicio de Sesión', `Usuario: ${name}`);
        showToast(`Bienvenido, ${name}`);
        
        loginInput.value = ''; // Limpiar input
        showMainApp();
    } else {
        showToast('Número de empleado no autorizado.', 'error');
        loginInput.classList.add('shake-animation'); // (Opcional: necesitaría CSS)
        setTimeout(() => loginInput.classList.remove('shake-animation'), 500);
    }
}

/**
 * Lógica de Logout
 */
function handleLogout() {
    logActivity('Cierre de Sesión', `Usuario: ${state.currentUser?.name}`);
    saveState(); // Guardar antes de salir
    
    // No borramos los datos (state.inventory), solo la bandera de logueo
    // Para que al volver a entrar, los datos sigan ahí.
    // Si quieres que el logout borre la sesión de memoria ram pero persista en disco:
    // state.loggedIn = false; (Pero esto requeriría recargar la página para limpiar variables en memoria)
    
    // Lo mejor para una SPA segura: Recargar la página al salir
    window.location.reload();
}

/**
 * Reseteo completo de la aplicación (Borrado de fábrica)
 */
async function handleFullReset() {
    try {
        localStorage.removeItem('inventarioProState');
        await deleteDatabase(); // Borrar IndexedDB
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert('Error al borrar datos. Intenta borrar la caché del navegador manualmente.');
    }
}

// --- FUNCIONES DE CAMBIO DE VISTA ---

function showMainApp() {
    loginPage.classList.add('hidden');
    mainApp.classList.remove('hidden');
    
    // Actualizar nombres en la UI
    if (state.currentUser) {
        currentUserDisplay.textContent = state.currentUser.name;
        if (summaryAuthor) summaryAuthor.value = state.currentUser.name;
    }

    // Inicializar Vistas con datos
    renderDashboard();
    renderUserList(); // Cargar lista de usuarios
    updateActiveUserBanner(); // Si había uno activo
    filterAndRender(); // Cargar tabla inventario
    
    // Iniciar autoguardado (definido en app.js o aquí)
    // startAutosave(); -> Se maneja en app.js mejor
}

function showLoginPage() {
    mainApp.classList.add('hidden');
    loginPage.classList.remove('hidden');
}