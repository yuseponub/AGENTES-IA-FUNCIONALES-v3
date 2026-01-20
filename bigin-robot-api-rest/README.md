# Bigin Robot API REST

Robot para crear órdenes en Bigin usando la **API REST de Zoho** en lugar de browser automation.

## ✅ Ventajas sobre Playwright

- 🚀 **Mucho más rápido** - Sin esperar carga de páginas
- 🔒 **Más confiable** - Sin problemas de sesión expirada
- ⚡ **Sin OneAuth** - No requiere aprobación 2FA
- 💾 **Menos recursos** - No necesita navegador Chromium
- 📊 **Más simple** - Código limpio y fácil de mantener

## 🔧 Configuración

### Credenciales (`.env`)

```bash
ZOHO_CLIENT_ID=1000.1O753Z59ILMC38F7RO0639XVTQGNAL
ZOHO_CLIENT_SECRET=0d3d0df40e7c665812a6379e660791c1ad47f75696
ZOHO_REFRESH_TOKEN=1000.ffacc81e6474de4c1e55afbedad4f8ef.10de44fb974487be41421eb8a292754d
ZOHO_ACCESS_TOKEN=1000.e9f41d4d5ab6192e9be8f90453932343.f3b40ede7183dd0f8458ec1f7ac6fab4
```

### Instalación

```bash
npm install
```

### Arrancar

```bash
./start.sh
# O manualmente:
node src/index.js
```

## 📖 API Endpoints

### POST /bigin/create-order

Crea una orden en Bigin.

**Request:**
```json
{
  "ordenName": "Nombre Cliente",
  "stage": "Nuevo Ingreso",
  "closingDate": "21/01/2026",
  "amount": 139900,
  "telefono": "3113595778",
  "direccion": "Calle 8#6-27",
  "municipio": "Zarzal",
  "departamento": "Valle del Cauca",
  "email": "cliente@example.com",
  "description": "WPP",
  "callBell": "https://dash.callbell.eu/chat/xxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "ordenName": "Nombre Cliente",
    "orderId": "6331846000204950564",
    "orderUrl": "https://bigin.zoho.com/bigin/org857936781/Home#/deals/6331846000204950564?section=activities"
  }
}
```

### GET /health

Health check del robot.

## 🔄 Refresh Token Automático

El robot automáticamente refresca el access token cuando expira (cada hora).

## 📝 Logs

Los logs se guardan en `/tmp/robot-api-rest.log`

```bash
tail -f /tmp/robot-api-rest.log
```

## 🎯 Integración con Order Manager

El workflow `05-order-manager.json` ya está configurado para usar:
```
http://robot-api.local:3000/bigin/create-order
```

Asegúrate que `/etc/hosts` tenga:
```
127.0.0.1 robot-api.local
```

## ✅ Prueba

```bash
curl -X POST http://localhost:3000/bigin/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "ordenName": "Test Order",
    "stage": "Nuevo Ingreso",
    "closingDate": "21/01/2026",
    "amount": 100000
  }'
```

## 🔗 Referencias

- [Bigin API Docs](https://www.bigin.com/developer/docs/apis/v2/)
- [Zoho OAuth](https://www.zoho.com/accounts/protocol/oauth.html)
