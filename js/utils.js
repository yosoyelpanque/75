/**
 * utils.js
 * Funciones de utilidad genéricas y constantes de configuración estática.
 */

// --- CONSTANTES ---

// Lista de empleados autorizados para Login
export const VERIFIERS = {
    '41290': 'BENÍTEZ HERNÁNDEZ MARIO',
    '41292': 'ESCAMILLA VILLEGAS BRYAN ANTONY',
    '41282': 'LÓPEZ QUINTANA ALDO',
    '41287': 'MARIN ESPINOSA MIGUEL',
    '41289': 'SANCHEZ ARELLANES RICARDO',
    '41293': 'EDSON OSNAR TORRES JIMENEZ',
    '15990': 'CHÁVEZ SÁNCHEZ ALFONSO',
    '17326': 'DOMÍNGUEZ VAZQUEZ FRANCISCO JAVIER',
    '11885': 'ESTRADA HERNÁNDEZ ROBERTO',
    '19328': 'LÓPEZ ESTRADA LEOPOLDO',
    '44925': 'MENDOZA SOLARES JOSE JUAN',
    '16990': 'PÉREZ RODRÍGUEZ DANIEL',
    '16000': 'PÉREZ YAÑEZ JUAN JOSE',
    '17812': 'RODRÍGUEZ RAMÍREZ RENE',
    '44095': 'LOPEZ JIMENEZ ALAN GABRIEL',
    '2875': 'VIZCAINO ROJAS ALVARO'
};

// --- FUNCIONES DE AYUDA (HELPERS) ---

/**
 * Genera un Identificador Único Universal (UUID v4)
 * Usado para IDs de usuarios, bienes adicionales y logs.
 */
export function generateUUID() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para navegadores muy viejos (aunque no deberíamos necesitarlos)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Escapa caracteres HTML para prevenir ataques XSS (Inyección de código)
 * Crítico cuando insertamos texto de Excel directamente en el DOM.
 */
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Función Debounce
 * Retrasa la ejecución de una función hasta que el usuario deje de escribir.
 * Útil para la barra de búsqueda (para no filtrar en cada tecla pulsada).
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Obtiene la fecha actual en formato local (dd/mm/aaaa)
 * Usado para los reportes impresos.
 */
export function getLocalDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Trunca un texto si excede cierta longitud y añade "..."
 * Usado en las tablas para que las descripciones largas no rompan el diseño.
 */
export function truncateText(str, len) {
    if (str && String(str).length > len) {
        return String(str).substring(0, len) + '...';
    }
    return str || '';
}

/**
 * Resalta el texto de búsqueda dentro de una cadena.
 * Devuelve HTML con la coincidencia marcada en amarillo.
 */
export function highlightText(text, searchTerm) {
    if (!searchTerm || !searchTerm.trim() || !text) {
        return escapeHTML(text);
    }
    
    // Escapamos primero el texto base por seguridad
    const safeText = escapeHTML(text);
    const safeTerm = escapeHTML(searchTerm.trim());
    
    // Crear regex insensible a mayúsculas
    const regex = new RegExp(`(${safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    // Reemplazamos en el texto seguro
    // Nota: Esto es una aproximación simple. Para HTML complejo se requeriría un parser.
    return safeText.replace(regex, `<mark class="bg-yellow-300 rounded-sm px-1 text-black">$1</mark>`);
}