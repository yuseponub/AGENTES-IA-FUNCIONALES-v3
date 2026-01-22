# Configuración del Workflow n8n - Coordinadora Bot

## Flujo del Workflow

```
SLACK                    n8n                           ROBOT
  │                       │                              │
  │ "SUBIR ORDENES COORD" │                              │
  ├──────────────────────►│                              │
  │                       │ GET /Deals (stage=ROBOT COORD)
  │                       ├──────────────────────────────►│ Bigin API
  │                       │◄──────────────────────────────┤
  │                       │                              │
  │                       │ Claude: Limpiar datos        │
  │                       ├─────────┐                    │
  │                       │         │                    │
  │                       │◄────────┘                    │
  │                       │                              │
  │                       │ POST /api/crear-pedido       │
  │                       ├──────────────────────────────►│ Robot
  │                       │◄──────────────────────────────┤
  │                       │                              │
  │ "✅ Pedidos creados"  │                              │
  │◄──────────────────────┤                              │
```

---

## Paso 1: Importar Workflow

1. Abre n8n
2. Click en **"..."** → **"Import from File"**
3. Selecciona: `n8n/workflow-coordinadora.json`
4. El workflow aparecerá con nodos en rojo (necesitan configuración)

---

## Paso 2: Configurar Credenciales

### A. Slack API

1. Ve a https://api.slack.com/apps
2. Crea una nueva app o usa una existente
3. En **OAuth & Permissions**, agrega scopes:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `users:read`
4. Instala la app en tu workspace
5. Copia el **Bot User OAuth Token**

En n8n:
1. Click en cualquier nodo de Slack
2. Click en **"Create new credential"**
3. Pega el token
4. Guarda

### B. Zoho Bigin OAuth2

1. Ve a https://api-console.zoho.com/
2. Crea un **Self Client**
3. Genera tokens con scopes:
   - `ZohoBigin.modules.ALL`
   - `ZohoBigin.settings.ALL`
4. Anota:
   - Client ID
   - Client Secret
   - Refresh Token

En n8n:
1. Click en el nodo **"Bigin: Obtener Órdenes"**
2. Click en **"Create new credential"** → **"OAuth2 API"**
3. Configura:
   - **Authorization URL**: `https://accounts.zoho.com/oauth/v2/auth`
   - **Access Token URL**: `https://accounts.zoho.com/oauth/v2/token`
   - **Client ID**: (tu client ID)
   - **Client Secret**: (tu client secret)
   - **Scope**: `ZohoBigin.modules.ALL`
   - **Auth URI Query Parameters**: `access_type=offline&prompt=consent`
4. Click en **"Connect"** y autoriza

### C. Anthropic API (Claude)

1. Ve a https://console.anthropic.com/
2. Crea una API Key
3. En n8n:
   - Click en el nodo **"Claude: Procesar Datos"**
   - **"Create new credential"** → **"Anthropic API"**
   - Pega tu API Key

---

## Paso 3: Ajustar Query de Bigin

El nodo **"Bigin: Obtener Órdenes"** busca órdenes con:
```
(Stage:equals:ROBOT COORD)
```

Si tu stage tiene otro nombre, cámbialo en:
1. Click en el nodo
2. **Query Parameters** → **criteria**
3. Cambia `ROBOT COORD` por el nombre exacto de tu stage

### Filtrar por Pipeline (Logistica)

Si necesitas filtrar también por pipeline, cambia la URL a:
```
https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:ROBOT COORD)and(Pipeline:equals:Logistica)
```

---

## Paso 4: Verificar Robot API

Asegúrate que el robot esté corriendo:

```bash
# En el servidor
cd /root/proyectos/coordinadora-bot
xvfb-run --auto-servernum npm run api

# Verificar
curl http://localhost:3001/api/health
```

Si el robot está en otro servidor, cambia la URL en el nodo **"Robot: Crear Pedido"**.

---

## Paso 5: Probar el Workflow

1. Activa el workflow (switch arriba a la derecha)
2. En Slack, escribe en un canal donde esté el bot:
   ```
   SUBIR ORDENES COORD
   ```
3. El bot responderá con el resultado

---

## Estructura de Datos

### Orden de Bigin (entrada)
```json
{
  "id": "123456789",
  "Deal_Name": "Orden #123",
  "Telefono": "+ 57 316 3709528",
  "Nombre": "Juan Perez Garcia",
  "Direccion": "Calle 123 #45-67",
  "Municipio": "Bogota",
  "Departamento": "Cundinamarca",
  "Email": "juan@email.com",
  "Amount": 77900,
  "Description": "Producto X (1 unidad)",
  "Stage": "ROBOT COORD",
  "Tag": ["PAGO ANTICIPADO"]
}
```

### Pedido transformado (salida de Claude)
```json
{
  "identificacion": "3163709528",
  "nombres": "Juan",
  "apellidos": "Perez Garcia",
  "direccion": "Calle 123 #45-67",
  "ciudad": "BOGOTA",
  "departamento": "Cundinamarca",
  "celular": "3163709528",
  "email": "juan@email.com",
  "referencia": "AA1",
  "unidades": 1,
  "totalConIva": 77900,
  "valorDeclarado": 55000,
  "esRecaudoContraentrega": false,
  "peso": 0.08,
  "alto": 5,
  "largo": 5,
  "ancho": 10,
  "biginOrderId": "123456789",
  "biginOrderName": "Orden #123"
}
```

---

## Comandos de Slack Adicionales (futuro)

Puedes extender el workflow para otros comandos:

| Comando | Acción |
|---------|--------|
| `SUBIR ORDENES COORD` | Sube órdenes a Coordinadora |
| `ESTADO PEDIDO 9599` | Consulta estado en Coordinadora |
| `ORDENES PENDIENTES` | Lista órdenes en ROBOT COORD |
| `TRACKING 53180509486` | Rastrea guía de Coordinadora |

---

## Troubleshooting

### Error: "No hay órdenes"
- Verifica que haya órdenes en el stage "ROBOT COORD"
- Revisa el nombre exacto del stage en Bigin

### Error: "401 Unauthorized" en Bigin
- El token de Zoho expiró
- Reconecta las credenciales OAuth2

### Error: "Connection refused" al robot
- El robot no está corriendo
- Ejecuta: `xvfb-run --auto-servernum npm run api`

### Error: "Teléfono inválido"
- Claude no pudo normalizar el teléfono
- Revisa el formato en Bigin

---

## Logs

Los logs del robot están en la consola donde se ejecuta:
```bash
# Ver logs en tiempo real
xvfb-run --auto-servernum npm run api 2>&1 | tee -a logs/robot.log
```
