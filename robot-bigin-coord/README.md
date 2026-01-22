# Robot Bigin → Coordinadora

Bot que automatiza la creación de pedidos en Coordinadora desde órdenes de Bigin CRM.

## Arquitectura

```
Slack/Webhook → n8n → Bigin API → Claude (procesa datos) → Validar Ciudades → Robot Playwright → Coordinadora
```

## Componentes

### 1. API Server (`src/api/server.ts`)
- **Puerto:** 3001
- **Endpoints:**
  - `POST /api/crear-pedido` - Crea un pedido en Coordinadora via Playwright
  - `POST /api/validar-pedidos` - Valida ciudades y recaudo contraentrega

### 2. Workflow n8n (`n8n/`)
- Trigger por Slack o Webhook
- Consulta órdenes de Bigin en stage "ROBOT COORD"
- Claude procesa y formatea los datos
- Valida ciudades contra lista de Coordinadora
- Crea pedidos via el robot
- Reporta resultados a Slack

### 3. Listas de Ciudades
- `ciudades-coordinadora.txt` - 1489 ciudades totales
- `ciudades-SI-recaudo.txt` - 1181 ciudades que aceptan recaudo contraentrega

## Configuración

### Variables de entorno
```env
COORDINADORA_USER=usuario
COORDINADORA_PASS=contraseña
```

### n8n Credentials necesarias
- Zoho Bigin OAuth2
- Anthropic API (Claude)
- Slack API

## Instalación

```bash
npm install
npx playwright install chromium
```

## Ejecución

```bash
# Solo API server
npx tsx src/api/server.ts
```

## Flujo del Workflow

1. **Trigger** - Mensaje en Slack o webhook
2. **Bigin** - Obtiene órdenes en stage "ROBOT COORD"
3. **Claude** - Transforma datos al formato de Coordinadora
4. **Validar Ciudades** - Verifica ciudad existe y acepta recaudo
5. **Robot** - Crea pedido en Coordinadora via browser automation
6. **Slack** - Reporta resultados (exitosos/fallidos)

## Formato de Ciudad

El campo ciudad debe ser: `MUNICIPIO (ABREV_DEPTO)`

Ejemplos:
- `BUCARAMANGA (STDER)`
- `MEDELLIN (ANT)`
- `BOGOTA (C/MARCA)`
