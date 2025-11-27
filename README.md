# Inventario Pro v8.0 (PWA Modular)

Sistema de gestión de inventario físico y activos fijos, diseñado como una **Progressive Web App (PWA)**.
Esta versión es modular, no requiere instalación de servidores (Node.js/Python) y puede ejecutarse 100% offline una vez instalada.

## 📂 Estructura de Carpetas

Para que el sistema funcione, tu carpeta debe verse exactamente así:

```text
/inventario-pro
│
├── index.html           # Punto de entrada
├── manifest.json        # Configuración de instalación PWA
├── sw.js                # Service Worker (Modo Offline)
├── logo.png             # Tu logotipo (Debe llamarse así)
├── README.md            # Este archivo
│
├── /css
│   └── styles.css       # Estilos personalizados
│
├── /js                  # Lógica Modular
│   ├── app.js
│   ├── auth.js
│   ├── db.js
│   ├── files.js
│   ├── inventory.js
│   ├── layout.js
│   ├── reports.js
│   ├── scanner.js
│   ├── state.js
│   ├── ui.js
│   └── utils.js
│
└── /libs                # ⚠️ IMPORTANTE: Librerías Externas
    ├── xlsx.full.min.js
    ├── qrcode.min.js
    ├── html5-qrcode.min.js
    ├── jszip.min.js
    └── interact.min.js