# Bigin Robot v2 - Browser On-Demand

Robot de automatización para Bigin CRM con arquitectura **browser on-demand**.

## Diferencias vs v1

| Característica | v1 (Original) | v2 (Este) |
|----------------|---------------|-----------|
| Navegador | Siempre abierto 24/7 | Solo durante operación |
| CPU idle | 30-60% | ~0% |
| RAM idle | 300-500MB | ~50MB (solo Node) |
| Sesiones | Manejo complejo de cookies | Sin sesiones (login cada vez) |
| Código | ~1000 líneas | ~400 líneas |

## Arquitectura

```
Petición llega
     │
     ▼
┌─────────────┐
│ Crear       │
│ Navegador   │  ← Solo cuando hay petición
└─────────────┘
     │
     ▼
┌─────────────┐
│ Login       │
│ Bigin       │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Ejecutar    │
│ Operación   │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Cerrar      │
│ Navegador   │  ← Libera recursos
└─────────────┘
     │
     ▼
Respuesta enviada
(VPS libre hasta próxima petición)
```

## Instalación en VPS

### 1. Subir archivos

```bash
cd /root
git clone <tu-repo> bigin-robot-v2
# O subir manualmente a /root/bigin-robot-v2
```

### 2. Instalar dependencias

```bash
cd /root/bigin-robot-v2
npm install
npx playwright install chromium
npx playwright install-deps
```

### 3. Configurar variables

```bash
cp .env.example .env
nano .env
# Editar con tus credenciales de Bigin
```

### 4. Compilar

```bash
npm run build
```

### 5. Iniciar

```bash
npm start
```

## Ejecutar como servicio (systemd)

### Crear servicio

```bash
sudo nano /etc/systemd/system/robot-api-v2.service
```

```ini
[Unit]
Description=Bigin Robot API v2 (Browser On-Demand)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/bigin-robot-v2
ExecStart=/usr/bin/node /root/bigin-robot-v2/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Activar servicio

```bash
sudo systemctl daemon-reload
sudo systemctl enable robot-api-v2
sudo systemctl start robot-api-v2
sudo systemctl status robot-api-v2
```

### Ver logs

```bash
journalctl -u robot-api-v2 -f
```

## API Endpoints

### Health Check

```bash
GET /health
```

### Crear Orden

```bash
POST /bigin/create-order
Content-Type: application/json

{
  "ordenName": "Orden Juan Perez",
  "stage": "Nuevo Ingreso",
  "amount": 109900,
  "telefono": "573137549286",
  "direccion": "Calle 31 #39-15",
  "municipio": "Bucaramanga",
  "departamento": "Santander",
  "email": "juan@example.com",
  "description": "WPP",
  "callBell": "https://dash.callbell.eu/chat/xxxxx"
}
```

## Migración desde v1

Si tienes el robot v1 corriendo:

1. **Detener v1:**
   ```bash
   systemctl stop robot-api
   # o
   /root/v3dsl-bot/bigin-robot/robot-api-manager.sh stop
   ```

2. **Instalar v2** (pasos arriba)

3. **Cambiar puerto si es necesario** (o usar el mismo 3000)

4. **n8n no necesita cambios** - los endpoints son iguales

## Troubleshooting

### El robot tarda mucho

Es normal que tarde 60-90 segundos porque:
- Inicia navegador (~5s)
- Login (~10-30s dependiendo de 2FA)
- Navega y llena formulario (~30-45s)
- Cierra navegador (~2s)

### Error de Playwright

```bash
# Reinstalar Playwright
npx playwright install chromium
npx playwright install-deps
```

### Error de permisos

```bash
chmod +x /root/bigin-robot-v2/dist/index.js
```

## Comparación de recursos

### VPS con v1 (navegador 24/7)
```
CPU: 30-60% constante
RAM: 500-800MB constante
```

### VPS con v2 (on-demand)
```
CPU: ~0% idle, pico durante operación
RAM: ~50MB idle, pico ~400MB durante operación
```
