# Bigin Robot - Automatización CRM

Robot de automatización para Bigin CRM usando Playwright.

## 📁 Estructura

```
bigin-robot/
├── packages/
│   ├── robot-base/      # Base framework para robots
│   ├── robot-api/       # API REST del robot
│   └── adapters/
│       └── bigin/       # Adaptador específico para Bigin CRM
├── storage/             # Almacenamiento de datos
│   ├── sessions/        # Sesiones de navegador
│   ├── artifacts/       # Screenshots y evidencias
│   └── logs/           # Logs de operaciones
└── robot-api-manager.sh # Script de gestión del robot
```

## 🚀 Instalación y Configuración

### 1. Instalar dependencias

```bash
cd /root/v3dsl-bot/bigin-robot
npm install
```

### 2. Compilar TypeScript

```bash
npm run build
```

### 3. Iniciar el robot

#### Opción A: Usando el script de gestión (recomendado)

```bash
# Iniciar
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh start

# Detener
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh stop

# Reiniciar
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh restart

# Ver estado
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh status

# Ver logs en tiempo real
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh logs

# Recompilar código
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh build
```

#### Opción B: Usando systemd (inicio automático)

```bash
# Habilitar inicio automático
sudo systemctl enable robot-api

# Iniciar servicio
sudo systemctl start robot-api

# Ver estado
sudo systemctl status robot-api

# Ver logs
journalctl -u robot-api -f
```

#### Opción C: Manual

```bash
cd /root/v3dsl-bot/bigin-robot/packages/robot-api
npm run start
```

## 📡 API Endpoints

El robot expone una API REST en `http://localhost:3000`:

### Health Check
```bash
GET /health
```

### Crear Orden en Bigin
```bash
POST /bigin/create-order
Content-Type: application/json

{
  "ordenName": "Juan Perez",
  "stage": "Nuevo Ingreso",
  "amount": 109900,
  "telefono": "573137549286",
  "direccion": "Calle 31 #39-15",
  "municipio": "Bucaramanga",
  "departamento": "Santander",
  "email": "juan@example.com",
  "callBell": "https://dash.callbell.eu/chat/xxxxx"
}
```

## 🔄 Actualización del Robot

Cuando hagas cambios en el código del robot en GitHub:

1. **Pull los cambios:**
   ```bash
   cd /root/v3dsl-bot
   git pull origin master
   ```

2. **Recompilar y reiniciar:**
   ```bash
   /root/v3dsl-bot/bigin-robot/robot-api-manager.sh build
   /root/v3dsl-bot/bigin-robot/robot-api-manager.sh restart
   ```

## 📋 Características

- ✅ Creación automática de órdenes en Bigin CRM
- ✅ Gestión de sesiones con timeout (30 minutos)
- ✅ Auto-relogin cuando expira sesión
- ✅ Retry automático con backoff exponencial
- ✅ Screenshots de evidencia
- ✅ Logs detallados de operaciones
- ✅ Campo CallBell clickeable para WhatsApp

## 🔧 Desarrollo

### Estructura de paquetes

El proyecto usa **npm workspaces** con 3 paquetes:

1. **robot-base**: Framework base para crear robots
2. **robot-api**: API REST que expone funcionalidad del robot
3. **adapter-bigin**: Implementación específica para Bigin CRM

### Scripts disponibles

```bash
npm run build         # Compilar todos los paquetes
npm run dev          # Modo desarrollo con watch
npm run start        # Iniciar en producción
```

## 📝 Logs

Los logs se guardan en:
- `/tmp/robot-api.log` - Log principal del robot
- `storage/logs/` - Logs de operaciones específicas

## 🔐 Seguridad

- Las sesiones se guardan encriptadas en `storage/sessions/`
- El robot valida automáticamente la sesión antes de cada operación
- Timeout de 30 minutos de inactividad

## 🐛 Troubleshooting

### El robot no inicia
```bash
# Verificar si el puerto 3000 está ocupado
lsof -i :3000

# Ver logs
tail -f /tmp/robot-api.log
```

### Error de sesión
```bash
# Eliminar sesiones antiguas
rm -f /root/v3dsl-bot/bigin-robot/storage/sessions/*.json

# Reiniciar robot
/root/v3dsl-bot/bigin-robot/robot-api-manager.sh restart
```

### Errores de compilación
```bash
# Limpiar y reinstalar
cd /root/v3dsl-bot/bigin-robot
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🔗 Integración con n8n

El robot se integra con n8n a través del workflow **05-order-manager.json** que envía peticiones HTTP a `http://robot-api.local:3000/bigin/create-order`.

### Configuración DNS

El robot es accesible desde contenedores Docker (n8n) mediante:
- `http://robot-api.local:3000` (hostname configurado en Docker)
- `http://localhost:3000` (desde el host)

Las reglas de iptables están configuradas en `/etc/iptables-docker-robot.sh`.
