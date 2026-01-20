# 🤖 Robot API - Modelo IA Distribuida

API REST para controlar robots de automatización del modelo de IA distribuida.

## 🚀 Quick Start

### 1. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Bigin CRM
BIGIN_URL=https://accounts.zoho.com/signin
BIGIN_EMAIL=tu-email@example.com
BIGIN_PASSWORD=tu-password
BIGIN_PASSPHRASE=tu-passphrase-oneauth

# API Server
ROBOT_API_PORT=3000

# Storage
STORAGE_PATH=/path/to/storage
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Compilar

```bash
npm run build
```

### 4. Iniciar servidor

```bash
npm start
```

O en modo desarrollo (con hot reload):

```bash
npm run dev
```

## 📡 API Endpoints

### General

#### `GET /`
Información general de la API.

**Response:**
```json
{
  "success": true,
  "message": "Robot API is running",
  "data": {
    "version": "0.1.0",
    "endpoints": {
      "bigin": "/bigin/*",
      "health": "/health"
    }
  }
}
```

#### `GET /health`
Health check del servidor.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 123.456,
    "timestamp": "2025-12-31T21:00:00.000Z"
  }
}
```

---

### Bigin Robot

#### `POST /bigin/create-order`
Crear una nueva orden en Bigin CRM.

**Request Body:**
```json
{
  "ordenName": "Orden Cliente XYZ",
  "contactName": "Juan Pérez",
  "subPipeline": "Ventas Somnio Standard",
  "stage": "Nuevo Ingreso",
  "closingDate": "31/12/2025",
  "amount": 50000,
  "telefono": "573001234567",
  "direccion": "Calle 123 #45-67 Barrio Centro",
  "municipio": "Bogotá",
  "departamento": "Cundinamarca",
  "email": "cliente@example.com",
  "description": "WPP",
  "callBell": "https://callbell.link/...",
  "transportadora": "Servientrega",
  "guia": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "ordenName": "Orden Cliente XYZ"
  }
}
```

#### `POST /bigin/find-lead`
Buscar un lead por teléfono, email o nombre.

**Request Body:**
```json
{
  "phone": "573001234567",
  "email": "cliente@example.com",
  "name": "Juan Pérez"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead found",
  "data": {
    "id": "lead-id-123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "fullName": "Juan Pérez",
    "email": "cliente@example.com",
    "phone": "573001234567"
  }
}
```

#### `POST /bigin/create-lead`
Crear un nuevo lead.

**Request Body:**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "573001234567",
  "email": "cliente@example.com",
  "company": "Empresa XYZ",
  "source": "WhatsApp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "id": "new-lead-id",
    "firstName": "Juan",
    "lastName": "Pérez",
    "fullName": "Juan Pérez",
    "phone": "573001234567",
    "email": "cliente@example.com"
  }
}
```

#### `POST /bigin/add-note`
Agregar una nota a un lead.

**Request Body:**
```json
{
  "leadId": "lead-id-123",
  "note": "Cliente interesado en producto X"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Note added successfully"
}
```

#### `GET /bigin/health`
Verificar estado del robot Bigin.

**Response:**
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "status": "ready"
  }
}
```

#### `POST /bigin/logout`
Cerrar sesión y limpiar recursos.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🧪 Ejemplos con curl

### Crear orden
```bash
curl -X POST http://localhost:3000/bigin/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "ordenName": "Orden Test",
    "subPipeline": "Ventas Somnio Standard",
    "stage": "Nuevo Ingreso",
    "closingDate": "31/12/2025",
    "amount": 50000,
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "municipio": "Bogotá",
    "departamento": "Cundinamarca",
    "email": "test@example.com",
    "description": "WPP"
  }'
```

### Buscar lead
```bash
curl -X POST http://localhost:3000/bigin/find-lead \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "573001234567"
  }'
```

---

## 🔌 Integración con n8n

### ⚙️ Configuración de Docker (REQUERIDO)

Si n8n corre en Docker, necesitas configurar `extra_hosts` para que pueda comunicarse con el Robot API en el host.

**Edita tu `docker-compose.yml` de n8n:**

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    # ... otras configuraciones ...
    extra_hosts:
      - "robot-api.local:172.18.0.1"  # Mapea robot-api.local al gateway Docker
    # ... resto de configuración ...
```

**Luego reinicia n8n:**

```bash
cd /ruta/a/n8n
docker compose up -d n8n
```

**Verifica que se aplicó:**

```bash
docker inspect n8n-n8n-1 --format '{{.HostConfig.ExtraHosts}}'
# Debe mostrar: [robot-api.local:172.18.0.1]
```

> **📝 Nota:** Si tu red Docker usa un gateway diferente a `172.18.0.1`, obtén el correcto con:
> ```bash
> docker network inspect n8n_default | grep Gateway
> ```

---

### HTTP Request Node

1. **Method:** POST
2. **URL:** `http://robot-api.local:3000/bigin/create-order`
   - ⚠️ Si n8n NO está en Docker, usa: `http://localhost:3000/bigin/create-order`
3. **Authentication:** None (por ahora)
4. **Timeout:** `180000` (3 minutos) - El robot puede tardar 60-90s
5. **Body Content Type:** JSON
6. **Body:**
```json
{
  "ordenName": "{{ $json.customerName }}",
  "telefono": "{{ $json.phone }}",
  "email": "{{ $json.email }}",
  "amount": {{ $json.amount }},
  "direccion": "{{ $json.address }}",
  "municipio": "{{ $json.city }}",
  "departamento": "{{ $json.state }}",
  "description": "WPP",
  "subPipeline": "Ventas Somnio Standard",
  "stage": "Nuevo Ingreso",
  "closingDate": "{{ $today }}"
}
```

### 🧪 Testing desde n8n

Después de configurar `extra_hosts`, prueba la conexión:

```bash
# Test desde el host (debe funcionar)
curl http://localhost:3000/health

# Test desde dentro del contenedor n8n (debe funcionar después de extra_hosts)
docker exec n8n-n8n-1 wget -qO- http://robot-api.local:3000/health
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────┐
│      n8n / Cliente / App        │
└────────────┬────────────────────┘
             │ HTTP REST
             ▼
┌─────────────────────────────────┐
│      Robot API (Express)        │
│  ┌───────────────────────────┐  │
│  │ Routes                    │  │
│  │ - /bigin/*               │  │
│  │ - /callbell/* (futuro)   │  │
│  │ - /shopify/* (futuro)    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Adapters                  │  │
│  │ - BiginAdapter           │  │
│  │ - CallBellAdapter        │  │
│  │ - ShopifyAdapter         │  │
│  └───────────────────────────┘  │
└────────────┬────────────────────┘
             │
             ▼
      Servicios Externos
      (Bigin, CallBell, etc.)
```

---

## 🔒 Seguridad

**⚠️ IMPORTANTE:** Esta API no tiene autenticación actualmente.

Para producción, deberías:
1. Agregar API keys o JWT
2. Usar HTTPS
3. Rate limiting
4. Validación de entrada
5. Logging de seguridad

---

## 🚧 Roadmap

- [ ] Autenticación con API keys
- [ ] Rate limiting
- [ ] Webhook support
- [ ] CallBell adapter
- [ ] Shopify adapter
- [ ] Email adapter
- [ ] Queue system (Bull/BullMQ)
- [ ] Metrics y monitoring
- [ ] Docker container
- [ ] Documentación Swagger/OpenAPI

---

## 📝 License

MIT
