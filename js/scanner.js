/**
 * scanner.js
 * Gestión del hardware de cámara para escanear códigos QR y tomar fotografías.
 * Dependencias: html5-qrcode (QR) y API nativa getUserMedia (Fotos).
 */

import { state, logActivity, tempCache } from './state.js';
import * as ui from './ui.js';
import { photoDB } from './db.js';
import { filterAndRender } from './inventory.js';
import { renderAdicionalesList, renderUserList } from './ui.js';

let html5QrCode = null;

export function initScanner() {
    // QR Scanner
    document.getElementById('qr-scan-btn').addEventListener('click', startQrScanner);
    document.getElementById('qr-scanner-close-btn').addEventListener('click', stopQrScanner);

    // Botones de Foto (En modales)
    document.getElementById('use-camera-btn').addEventListener('click', startPhotoCamera);
    document.getElementById('capture-photo-btn').addEventListener('click', capturePhoto);
    document.getElementById('switch-to-upload-btn').addEventListener('click', stopPhotoCamera); // Volver a subir archivo
    
    // Cerrar cámara si cierran el modal de foto con la X o cancelar
    document.getElementById('photo-close-btn').addEventListener('click', stopPhotoCamera);
}

// --- ESCÁNER DE CÓDIGOS QR ---

async function startQrScanner() {
    if (state.readOnlyMode) return ui.showToast('Modo lectura.', 'warning');

    const modal = document.getElementById('qr-scanner-modal');
    ui.openModal(modal);

    // Limpiar instancia previa si existe
    if (html5QrCode) {
        await stopQrScanner();
    }

    html5QrCode = new Html5Qrcode("qr-reader");

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, // Preferir cámara trasera
            config,
            onQrCodeSuccess,
            (errorMessage) => {
                // Ignoramos errores de "no code found" por frame para no saturar la consola
            }
        );
        logActivity('Cámara', 'Escáner QR iniciado.');
    } catch (err) {
        console.error("Error al iniciar QR:", err);
        ui.showToast('No se pudo acceder a la cámara. Verifica permisos.', 'error');
        ui.closeModal(modal);
    }
}

function onQrCodeSuccess(decodedText, decodedResult) {
    // Detener al encontrar código
    stopQrScanner();
    
    // Inyectar en búsqueda
    const searchInput = document.getElementById('search-input');
    searchInput.value = decodedText;
    
    // Ejecutar búsqueda (simulando evento input o llamando directo)
    // Importante: Llamamos a filterAndRender desde inventory.js (a través de imports circulares o eventos)
    // En esta arquitectura, inventory.js exporta filterAndRender, así que lo usamos.
    filterAndRender(); 

    // Cambiar a tab inventario si no estamos ahí
    document.querySelector('[data-tab="inventory"]').click();

    ui.showToast(`Código encontrado: ${decodedText}`, 'success');
    logActivity('QR Escaneado', `Clave: ${decodedText}`);
}

export async function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error("Error al detener QR:", err);
        }
    }
    const modal = document.getElementById('qr-scanner-modal');
    ui.closeModal(modal);
}

// --- CÁMARA DE FOTOS (EVIDENCIA) ---

async function startPhotoCamera() {
    if (state.readOnlyMode) return;

    const viewContainer = document.getElementById('camera-view-container');
    const uploadContainer = document.getElementById('photo-upload-container');
    const video = document.getElementById('camera-stream');

    // Ocultar subida, mostrar video
    uploadContainer.classList.add('hidden');
    viewContainer.classList.remove('hidden');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } // Trasera
            });
            
            video.srcObject = stream;
            tempCache.cameraStream = stream; // Guardar referencia para detenerla luego
            
        } catch (err) {
            console.error("Error cámara fotos:", err);
            ui.showToast('Error al acceder a la cámara.', 'error');
            stopPhotoCamera(); // Revertir UI
        }
    } else {
        ui.showToast('Tu navegador no soporta cámara web.', 'error');
    }
}

export function stopPhotoCamera() {
    const video = document.getElementById('camera-stream');
    const viewContainer = document.getElementById('camera-view-container');
    const uploadContainer = document.getElementById('photo-upload-container');

    // Detener tracks
    if (tempCache.cameraStream) {
        tempCache.cameraStream.getTracks().forEach(track => track.stop());
        tempCache.cameraStream = null;
    }
    
    if (video) video.srcObject = null;

    // Restaurar UI del modal
    if (viewContainer) viewContainer.classList.add('hidden');
    if (uploadContainer) uploadContainer.classList.remove('hidden');
}

function capturePhoto() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('photo-canvas');
    const input = document.getElementById('photo-input'); // Usado para saber el ID/Tipo en el modal original
    
    // Obtener contexto del modal para saber qué estamos fotografiando
    // Esto es un poco "hacky" porque reutilizamos el input file para guardar metadatos
    // Una opción más limpia sería guardar metadatos en un objeto global UI state
    // Pero mantendremos la lógica original del input dataset para compatibilidad.
    const type = input.dataset.type; // 'inventory', 'additional', 'location'
    const id = input.dataset.id;

    if (!video || !tempCache.cameraStream) return;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir a Blob y Guardar
    canvas.toBlob(blob => {
        if (!blob) return ui.showToast('Error al procesar imagen.', 'error');
        
        // Guardar en IndexedDB
        let key = `${type}-${id}`;
        
        photoDB.setItem('photos', key, blob).then(() => {
            // Actualizar estado en memoria
            if (type === 'inventory') {
                state.photos[id] = true;
                // Refrescar icono en tabla
                const row = document.querySelector(`tr[data-clave="${id}"]`);
                if (row) {
                    const icon = row.querySelector('.camera-icon');
                    if (icon) {
                        icon.classList.remove('text-gray-300');
                        icon.classList.add('text-indigo-500');
                    }
                }
            } 
            else if (type === 'additional') {
                state.additionalPhotos[id] = true;
                renderAdicionalesList(state.additionalItems); // Refrescar lista completa
            }
            else if (type === 'location') {
                state.locationPhotos[id] = true;
                renderUserList(); // Refrescar lista usuarios
            }

            ui.showToast('Foto guardada correctamente.', 'success');
            stopPhotoCamera();
            ui.closeModal(document.getElementById('photo-modal'));
            
        }).catch(err => {
            console.error(err);
            ui.showToast('Error al guardar en base de datos.', 'error');
        });

    }, 'image/jpeg', 0.85); // Calidad 85%
}