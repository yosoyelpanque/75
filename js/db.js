/**
 * db.js
 * Capa de abstracción para IndexedDB.
 * Se usa para almacenar datos pesados (BLOBs de imágenes) que no caben en localStorage.
 */

const DB_NAME = 'InventarioProPhotosDB';
const DB_VERSION = 2; // Incrementa esto si cambias la estructura de los stores

export const photoDB = {
    db: null,

    /**
     * Inicializa la conexión a la base de datos.
     * Crea los almacenes (stores) si no existen.
     */
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            // Migraciones: Se ejecuta si la versión cambia o la DB no existe
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para fotos de inventario, adicionales y ubicaciones
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos');
                }
                
                // Store para imágenes de fondo del croquis
                if (!db.objectStoreNames.contains('layoutImages')) {
                    db.createObjectStore('layoutImages');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[IndexedDB] Base de datos conectada.');
                resolve();
            };

            request.onerror = (event) => {
                console.error('[IndexedDB] Error de conexión:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    /**
     * Cierra la conexión. Necesario antes de borrar la base de datos.
     */
    close: function() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    },

    /**
     * Guarda un valor (Blob/File) en el store especificado.
     * @param {string} storeName - 'photos' o 'layoutImages'
     * @param {string} key - ID único (ej: 'inventory-12345')
     * @param {Blob} value - El archivo de imagen
     */
    setItem: function(storeName, key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB no inicializada');
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Recupera un valor por su clave.
     */
    getItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB no inicializada');

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Elimina un elemento.
     */
    deleteItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB no inicializada');

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Obtiene TODOS los elementos de un store (clave y valor).
     * Útil para exportar el backup .zip.
     */
    getAllItems: function(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB no inicializada');

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            // Usamos cursores o getAllKeys+getAll para obtener pares key/value
            const keysRequest = store.getAllKeys();
            const valuesRequest = store.getAll();

            Promise.all([
                new Promise((res, rej) => { 
                    keysRequest.onsuccess = () => res(keysRequest.result); 
                    keysRequest.onerror = (e) => rej(e.target.error); 
                }),
                new Promise((res, rej) => { 
                    valuesRequest.onsuccess = () => res(valuesRequest.result); 
                    valuesRequest.onerror = (e) => rej(e.target.error); 
                })
            ]).then(([keys, values]) => {
                // Combinamos llaves y valores en un array de objetos
                const result = keys.map((key, index) => ({ key, value: values[index] }));
                resolve(result);
            }).catch(reject);
        });
    }
};

/**
 * Función auxiliar para borrar la base de datos completa.
 * Se usa al "Limpiar sesión completa" o restaurar de cero.
 */
export function deleteDatabase() {
    return new Promise((resolve, reject) => {
        // Primero cerramos cualquier conexión abierta para evitar bloqueos
        photoDB.close();

        const request = indexedDB.deleteDatabase(DB_NAME);

        request.onsuccess = () => {
            console.log('[IndexedDB] Base de datos eliminada correctamente.');
            resolve();
        };

        request.onerror = (event) => {
            console.error('[IndexedDB] Error al eliminar DB:', event.target.error);
            reject(event.target.error);
        };

        request.onblocked = () => {
            console.warn('[IndexedDB] Eliminación bloqueada. Cierra otras pestañas de la app.');
            // A veces el navegador se queda pillado, resolvemos para no colgar la UI
            resolve();
        };
    });
}