# ARQUITECTURA COMPLETA - Sistema de Robots Logistica

## Indice

1. [Vision General](#vision-general)
2. [Diagrama de Arquitectura](#diagrama-de-arquitectura)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Flujos por Transportadora](#flujos-por-transportadora)
5. [GUIA BIGIN/ZOHO - Configuracion y Problemas](#guia-biginzoho---configuracion-y-problemas)
6. [Configuracion de Robots](#configuracion-de-robots)
7. [Troubleshooting General](#troubleshooting-general)

---

## Vision General

El sistema automatiza la generacion de guias de envio para 4 transportadoras diferentes, integrando:
- **Slack**: Interfaz de usuario (comandos)
- **n8n**: Orquestador de workflows
- **Bigin (Zoho CRM)**: Base de datos de ordenes
- **Claude AI**: Transformacion inteligente de datos
- **Robots Node.js**: Generacion de PDFs/Excel y creacion de pedidos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUJO GENERAL DEL SISTEMA                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Usuario         n8n              Bigin           Robot           Slack    │
│      │             │                 │               │               │      │
│      │──comando───►│                 │               │               │      │
│      │             │───refresh───────►               │               │      │
│      │             │◄──token─────────│               │               │      │
│      │             │───buscar────────►               │               │      │
│      │             │◄──ordenes───────│               │               │      │
│      │             │                 │               │               │      │
│      │             │────────────────────────────────►│               │      │
│      │             │◄───────────resultado────────────│               │      │
│      │             │                 │               │               │      │
│      │             │───actualizar────►               │               │      │
│      │             │◄──confirmacion──│               │               │      │
│      │             │                 │               │               │      │
│      │             │─────────────────────────────────────────────────►      │
│      │◄────────────────────────mensaje con link──────────────────────│      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Diagrama de Arquitectura

```
                                    ┌──────────────────┐
                                    │      SLACK       │
                                    │   Canal: #bots   │
                                    │ C0A9M96C0AK      │
                                    └────────┬─────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              n8n WORKFLOW                                   │
│                     (Docker: puerto interno 5678)                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────┐     ┌─────────────────┐                              │
│  │  Slack Trigger  │────►│ Filtrar Mensaje │                              │
│  └─────────────────┘     └────────┬────────┘                              │
│                                   │                                        │
│                          ┌────────▼────────┐                              │
│                          │   ¿Que Robot?   │                              │
│                          │    (Switch)     │                              │
│                          └───┬───┬───┬───┬─┘                              │
│                              │   │   │   │                                 │
│           ┌──────────────────┘   │   │   └──────────────────┐             │
│           │              ┌───────┘   └───────┐              │             │
│           ▼              ▼                   ▼              ▼             │
│  ┌────────────┐  ┌────────────┐     ┌────────────┐  ┌────────────┐       │
│  │COORDINADORA│  │   INTER    │     │   BOGOTA   │  │   ENVIA    │       │
│  │  (COORD)   │  │  (INTER)   │     │  (BOGOTA)  │  │  (ENVIA)   │       │
│  └─────┬──────┘  └─────┬──────┘     └─────┬──────┘  └─────┬──────┘       │
│        │               │                   │               │              │
│        ▼               ▼                   ▼               ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                     BIGIN/ZOHO API                               │    │
│  │   1. Refresh Token → 2. Buscar Ordenes → 3. Actualizar Stage     │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                │                │                   │               │
                ▼                ▼                   ▼               ▼
        ┌───────────┐    ┌───────────┐       ┌───────────┐   ┌───────────┐
        │  Claude   │    │  Claude   │       │  Claude   │   │   Code    │
        │    AI     │    │    AI     │       │    AI     │   │   Node    │
        │ Procesar  │    │ Procesar  │       │ Procesar  │   │ Preparar  │
        └─────┬─────┘    └─────┬─────┘       └─────┬─────┘   └─────┬─────┘
              │                │                   │               │
              ▼                ▼                   ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ROBOTS (Express.js)                            │
├───────────────────────────────────┬─────────────────────────────────────┤
│                                   │                                      │
│  ┌─────────────────────────────┐  │  ┌─────────────────────────────┐   │
│  │   robot-coordinadora        │  │  │   robot-inter-envia-bog     │   │
│  │   Puerto: 3001              │  │  │   Puerto: 3002              │   │
│  │                             │  │  │                             │   │
│  │   Endpoints:                │  │  │   Endpoints:                │   │
│  │   - /api/validar-pedidos    │  │  │   - /api/generar-guias      │   │
│  │   - /api/crear-pedidos-batch│  │  │   - /api/generar-excel-envia│   │
│  │                             │  │  │                             │   │
│  │   Tecnologia: Playwright    │  │  │   Tecnologia: PDFKit/ExcelJS│   │
│  └─────────────────────────────┘  │  └─────────────────────────────┘   │
│                                   │                                      │
└───────────────────────────────────┴─────────────────────────────────────┘
                │                                    │
                ▼                                    ▼
        ┌───────────────────────────────────────────────────────────┐
        │              /opt/n8n/local-files/                        │
        │                                                           │
        │   guias-inter-1234567890.pdf                             │
        │   guias-bogota-1234567890.pdf                            │
        │   envia-1234567890.xlsx                                  │
        │                                                           │
        │   Servido por: Caddy (HTTPS)                             │
        │   URL: https://tu-dominio.com/files/                     │
        └───────────────────────────────────────────────────────────┘
```

---

## Componentes del Sistema

### 1. Slack
| Elemento | Valor |
|----------|-------|
| Canal ID | `C0A9M96C0AK` |
| Credencial n8n | `Y6LxxE3sffV7XYLy` |
| Tipo | Bot con permisos de lectura/escritura |

### 2. n8n Workflow
| Elemento | Valor |
|----------|-------|
| Workflow ID | `eaG7RWwFFu1tbbEC` |
| Tag | Logistica |
| Estado | Activo |
| Execution Order | v1 |

### 3. Bigin/Zoho
| Elemento | Valor |
|----------|-------|
| OAuth URL | `https://accounts.zoho.com/oauth/v2/token` |
| API URL | `https://www.zohoapis.com/bigin/v1/` |
| Modulo | Deals |

### 4. Claude AI
| Elemento | Valor |
|----------|-------|
| API URL | `https://api.anthropic.com/v1/messages` |
| Modelo | `claude-sonnet-4-20250514` |
| Credencial n8n | `a60NiYpV50szsxWN` |
| Timeout | 30-180 segundos |

### 5. Robots
| Robot | Puerto | IP Docker | Tecnologia |
|-------|--------|-----------|------------|
| robot-coordinadora | 3001 | 172.18.0.1 | Playwright |
| robot-inter-envia-bog | 3002 | 172.18.0.1 | PDFKit/ExcelJS |

---

## Flujos por Transportadora

### FLUJO 1: COORDINADORA
**Comando Slack:** `subir ordenes coord`
**Stage Bigin:** `ROBOT COORD`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FLUJO COORDINADORA (Detallado)                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 🔄 Refresh Bigin Token                                              │
│     POST https://accounts.zoho.com/oauth/v2/token                       │
│     → Obtiene access_token                                              │
│                                                                          │
│  2. Bigin: Obtener Ordenes                                              │
│     GET https://www.zohoapis.com/bigin/v1/Deals/search                  │
│     criteria: (Stage:equals:ROBOT COORD)                                │
│     → Lista de ordenes                                                  │
│                                                                          │
│  3. ¿Hay Ordenes?                                                       │
│     SI → Continua                                                       │
│     NO → Slack: "No hay ordenes en ROBOT COORD"                         │
│                                                                          │
│  4. Call Claude API                                                     │
│     - Transforma datos de Bigin al formato Coordinadora                 │
│     - Mapea departamentos a abreviaturas                                │
│     - Calcula unidades segun Amount                                     │
│     - Determina si es contraentrega                                     │
│                                                                          │
│  5. Parsear Respuesta Claude                                            │
│     - Extrae JSON array de la respuesta                                 │
│                                                                          │
│  6. Validar Ciudades                                                    │
│     POST http://172.18.0.1:3001/api/validar-pedidos                     │
│     - Valida que las ciudades existan en Coordinadora                   │
│     - Marca pedidos como _valido: true/false                            │
│                                                                          │
│  7. ¿Ciudad Valida?                                                     │
│     SI → Preparar batch COORD                                           │
│     NO → Error: Ciudad Invalida (mensaje detallado)                     │
│                                                                          │
│  8. Robot: Crear Pedido                                                 │
│     POST http://172.17.0.1:3001/api/crear-pedidos-batch                 │
│     ⚠️ NOTA: Usa 172.17.0.1 (diferente al validador!)                   │
│     - Crea pedidos en portal Coordinadora via Playwright                │
│     - Retorna numeros de pedido                                         │
│                                                                          │
│  9. Generar Resumen                                                     │
│     - Agrupa exitosos y fallidos                                        │
│     - Formatea mensaje para Slack                                       │
│                                                                          │
│ 10. Actualizar Bigin COORD                                              │
│     PUT https://www.zohoapis.com/bigin/v1/Deals                         │
│     - Stage: "COORDINADORA"                                             │
│     - Transportadora: "COORDINADORA"                                    │
│     - Guia: [numero de pedido]                                          │
│                                                                          │
│ 11. Combinar Mensajes + Slack: Enviar Resultado                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Campos transformados por Claude para Coordinadora:**
```javascript
{
  identificacion: "3163709528",    // Telefono limpio (10 digitos)
  nombres: "Juan",                 // Primera palabra de Deal_Name
  apellidos: "Perez Garcia",       // Resto de Deal_Name
  direccion: "Calle 123",          // Direcci_n exacto
  ciudad: "BUCARAMANGA (STDER)",   // Municipio (ABREV_DEPTO)
  departamento: "Santander",       // Departamento original
  celular: "3163709528",           // Igual que identificacion
  email: null,                     // Campo email si existe
  referencia: "AA1",               // SIEMPRE "AA1"
  unidades: 1,                     // 77900=1, 109900=2, 139900=3
  totalIva: 0,                     // SIEMPRE 0
  totalConIva: 77900,              // Amount exacto
  valorDeclarado: 55000,           // SIEMPRE 55000
  esRecaudoContraentrega: true,    // false si tiene "&" o "PAGO ANTICIPADO"
  peso: 0.08,                      // SIEMPRE 0.08
  alto: 5,                         // SIEMPRE 5
  largo: 5,                        // SIEMPRE 5
  ancho: 10,                       // SIEMPRE 10
  biginOrderId: "123456",          // ID de la orden
  biginOrderName: "Juan Perez"     // Deal_Name completo
}
```

---

### FLUJO 2: INTERRAPIDISIMO
**Comando Slack:** `generar guias inter`
**Stage Bigin:** `ROBOT INTER`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FLUJO INTERRAPIDISIMO (Detallado)                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 🔄 Refresh Bigin Token2                                             │
│     POST https://accounts.zoho.com/oauth/v2/token                       │
│                                                                          │
│  2. Bigin: Ordenes Inter                                                │
│     GET https://www.zohoapis.com/bigin/v1/Deals/search                  │
│     criteria: (Stage:equals:ROBOT INTER)                                │
│                                                                          │
│  3. ¿Hay Ordenes Inter?                                                 │
│     SI → Continua                                                       │
│     NO → Slack: "No hay ordenes en ROBOT INTER"                         │
│                                                                          │
│  4. Claude: Procesar Inter                                              │
│     - Extrae campos para guia PDF                                       │
│     - Timeout: 30 segundos                                              │
│                                                                          │
│  5. Parsear Claude Inter                                                │
│     - Retorna { pedidos: [...] }                                        │
│                                                                          │
│  6. Generar Guias PDF                                                   │
│     POST http://172.18.0.1:3002/api/generar-guias                       │
│     - Genera PDF con PDFKit (formato 4x6)                               │
│     - Guarda en /opt/n8n/local-files/                                   │
│     - Retorna downloadUrl                                               │
│                                                                          │
│  7. Actualizar Bigin INTER                                              │
│     PUT https://www.zohoapis.com/bigin/v1/Deals                         │
│     - Stage: "ESPERANDO GUIAS"                                          │
│     - Transportadora: "INTERRAPIDISIMO"                                 │
│     - Guia: [numero generado]                                           │
│                                                                          │
│  8. Formato Slack Inter → Slack: Resultado Inter                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Campos para PDF Interrapidisimo:**
```javascript
{
  nombres: "Juan",
  apellidos: "Perez Garcia",
  direccion: "Calle 123 #45-67",
  barrio: "Centro",
  ciudad: "BOGOTA",
  celular: "3163709528",
  totalConIva: 77900
}
```

---

### FLUJO 3: BOGOTA
**Comando Slack:** `generar guias bogota`
**Stage Bigin:** `ROBOT BOGOTA`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        FLUJO BOGOTA (Detallado)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 🔄 Refresh Bigin Token Bogota                                       │
│  2. Bigin: Ordenes Bogota (Stage:equals:ROBOT BOGOTA)                   │
│  3. ¿Hay Ordenes Bogota?                                                │
│  4. Claude: Procesar Bogota                                             │
│  5. Parsear Claude Bogota                                               │
│  6. Generar Guias PDF Bogota                                            │
│     POST http://172.18.0.1:3002/api/generar-guias                       │
│  7. Formato Slack Bogota                                                │
│  8. Slack: Resultado Bogota                                             │
│                                                                          │
│  ⚠️ NOTA: Este flujo NO actualiza Bigin automaticamente                 │
│     (A diferencia de Inter y Envia)                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### FLUJO 4: ENVIA
**Comando Slack:** `generar excel envia`
**Stage Bigin:** `ROBOT ENVIA`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FLUJO ENVIA (Detallado)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 🔄 Refresh Bigin Token Envia1                                       │
│                                                                          │
│  2. Bigin: Ordenes Envia1                                               │
│     criteria: (Stage:equals:ROBOT ENVIA)                                │
│                                                                          │
│  3. ¿Hay Ordenes Envia?1                                                │
│                                                                          │
│  4. Preparar Excel Envia1 (Nodo Code - NO Claude)                       │
│     - Extrae y formatea datos directamente                              │
│     - Guarda biginIds para actualizar despues                           │
│                                                                          │
│  5. Robot: Generar Excel                                                │
│     POST http://172.18.0.1:3002/api/generar-excel-envia                 │
│     - Genera Excel con ExcelJS                                          │
│     - Columnas: Valor, Nombre, Telefono, Direccion, Municipio, Depto    │
│                                                                          │
│  6. Actualizar Bigin Envia1                                             │
│     PUT https://www.zohoapis.com/bigin/v1/Deals                         │
│     - Stage: "ESPERANDO GUIAS"                                          │
│     - Transportadora: "ENVIA"                                           │
│                                                                          │
│  7. Formato Slack Envia1 → Slack: Resultado Envia1                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Formato Excel Envia:**
| Columna | Origen |
|---------|--------|
| Valor | Amount |
| Nombre completo | Deal_Name |
| Telefono | Telefono (limpio, sin 57) |
| Direccion completa | Direcci_n |
| Municipio | Municipio_Dept |
| Departamento | Departamento |

---

## GUIA BIGIN/ZOHO - Configuracion y Problemas

### AUTENTICACION OAUTH 2.0

Bigin usa OAuth 2.0 con refresh tokens. El flujo es:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE AUTENTICACION BIGIN                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐                      ┌─────────────┐             │
│   │   n8n       │  POST /oauth/v2/token│   Zoho      │             │
│   │             │─────────────────────►│   OAuth     │             │
│   │             │   refresh_token      │             │             │
│   │             │   client_id          │             │             │
│   │             │   client_secret      │             │             │
│   │             │   grant_type         │             │             │
│   │             │◄─────────────────────│             │             │
│   │             │   access_token       │             │             │
│   │             │   (valido ~1 hora)   │             │             │
│   └─────────────┘                      └─────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### CREDENCIALES ACTUALES

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  CREDENCIALES DE PRODUCCION - NO COMPARTIR PUBLICAMENTE  ⚠️   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  refresh_token: 1000.ffacc81e6474de4c1e55afbedad4f8ef.             │
│                 10de44fb974487be41421eb8a292754d                    │
│                                                                     │
│  client_id:     1000.1O753Z59ILMC38F7RO0639XVTQGNAL                │
│                                                                     │
│  client_secret: 0d3d0df40e7c665812a6379e660791c1ad47f75696         │
│                                                                     │
│  grant_type:    refresh_token                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ENDPOINTS BIGIN UTILIZADOS

| Operacion | Metodo | URL | Uso |
|-----------|--------|-----|-----|
| Refresh Token | POST | `https://accounts.zoho.com/oauth/v2/token` | Obtener access_token |
| Buscar Deals | GET | `https://www.zohoapis.com/bigin/v1/Deals/search` | Listar ordenes por Stage |
| Actualizar Deals | PUT | `https://www.zohoapis.com/bigin/v1/Deals` | Actualizar Stage, Guia, Transportadora |

---

### PROBLEMAS COMUNES CON BIGIN Y SOLUCIONES

#### PROBLEMA 1: Token Expirado (Error 401)
```
{
  "code": "INVALID_TOKEN",
  "message": "invalid oauth token"
}
```

**Causa:** El access_token expira cada ~1 hora.

**Solucion:**
- El workflow SIEMPRE hace refresh del token antes de cualquier operacion
- Cada flujo tiene su propio nodo de refresh (🔄 Refresh Bigin Token)
- El access_token se pasa via expresion: `{{ $json.access_token }}`

**Verificar:**
```javascript
// En el nodo de Bigin, el header debe ser:
{
  "Authorization": "Zoho-oauthtoken {{ $json.access_token }}"
}
// ⚠️ NOTA: Es "Zoho-oauthtoken" (sin guion medio), NO "Bearer"
```

---

#### PROBLEMA 2: Refresh Token Revocado
```
{
  "error": "invalid_code"
}
```

**Causa:** El refresh_token fue revocado o expiro (raro, pero posible).

**Solucion:**
1. Ir a https://api-console.zoho.com/
2. Regenerar el refresh_token
3. Actualizar en TODOS los nodos de refresh del workflow
4. Los nodos que deben actualizarse son:
   - `🔄 Refresh Bigin Token` (Coordinadora)
   - `🔄 Refresh Bigin Token2` (Inter)
   - `🔄 Refresh Bigin Token Bogota`
   - `🔄 Refresh Bigin Token Envia1`

---

#### PROBLEMA 3: Authorization en Query vs Headers
```
{
  "code": "INVALID_REQUEST_METHOD"
}
```

**Causa:** El token se esta pasando en el lugar incorrecto.

**Configuracion CORRECTA para buscar ordenes:**
```
sendHeaders: true
headerParameters:
  - name: "Authorization"
    value: "=Zoho-oauthtoken {{ $json.access_token }}"

sendQuery: true
queryParameters:
  - name: "criteria"
    value: "(Stage:equals:ROBOT COORD)"
```

**ERROR COMUN encontrado en el JSON:**
```javascript
// ❌ INCORRECTO - Authorization en Query Parameters
queryParameters: [
  { name: "Authorization", value: "=Zoho-oauthtoken..." },  // ❌
  { name: "criteria", value: "(Stage:equals:ROBOT COORD)" }
]

// ✅ CORRECTO - Authorization en Headers
headerParameters: [
  { name: "Authorization", value: "=Zoho-oauthtoken..." }  // ✅
]
queryParameters: [
  { name: "criteria", value: "(Stage:equals:ROBOT COORD)" }
]
```

---

#### PROBLEMA 4: Criterio de Busqueda Incorrecto
```
{
  "data": [],
  "info": { "count": 0 }
}
```

**Causa:** El Stage en Bigin no coincide exactamente con el criterio.

**Stages EXACTOS que deben existir en Bigin:**
| Stage en Bigin | Criterio en n8n |
|----------------|-----------------|
| `ROBOT COORD` | `(Stage:equals:ROBOT COORD)` |
| `ROBOT INTER` | `(Stage:equals:ROBOT INTER)` |
| `ROBOT BOGOTA` | `(Stage:equals:ROBOT BOGOTA)` |
| `ROBOT ENVIA` | `(Stage:equals:ROBOT ENVIA)` |

**Verificar:**
1. Ir a Bigin → Pipeline → Verificar nombres de Stages
2. Los nombres son CASE-SENSITIVE
3. No debe haber espacios extra

---

#### PROBLEMA 5: Error al Actualizar Deals
```
{
  "code": "INVALID_DATA",
  "message": "the id given seems to be invalid"
}
```

**Causa:** El biginOrderId no es valido o no existe.

**Solucion:**
- Verificar que `biginOrderId` se esta pasando correctamente
- El formato de actualizacion debe ser:
```javascript
{
  "data": [
    {
      "id": "1234567890123456789",  // ID de 19 digitos
      "Stage": "COORDINADORA",
      "Transportadora": "COORDINADORA",
      "Guia": "12345"
    }
  ]
}
```

---

#### PROBLEMA 6: Limite de Rate (429 Too Many Requests)
```
{
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**Causa:** Demasiadas llamadas a la API en poco tiempo.

**Limites de Bigin:**
- 5,000 requests/dia (Free)
- 25,000 requests/dia (Premium)
- Max 100 records por request

**Solucion:**
- Usar batch updates (PUT con array de data)
- No hacer mas de 1 request por segundo
- El workflow actual ya usa batch para actualizaciones

---

#### PROBLEMA 7: Campos de Bigin No Encontrados
```javascript
// Error: Cannot read property 'Direcci_n' of undefined
```

**Causa:** El nombre del campo en Bigin tiene caracteres especiales.

**Campos de Bigin utilizados:**
| Campo API | Nombre en Bigin |
|-----------|-----------------|
| `Deal_Name` | Nombre del Deal |
| `Amount` | Monto |
| `Stage` | Etapa |
| `Telefono` | Telefono (custom) |
| `Direcci_n` | Direccion (custom - nota la ñ codificada) |
| `Municipio_Dept` | Municipio (custom) |
| `Departamento` | Departamento (custom) |
| `Barrio` | Barrio (custom) |
| `Tag` | Etiquetas |
| `Guia` | Guia (custom) |
| `Transportadora` | Transportadora (custom) |

**Verificar nombres de campos:**
1. Ir a Bigin → Settings → Modules → Deals → Fields
2. Click en cada campo para ver el "API Name"
3. Los campos custom tienen formato: `Campo_Name`

---

### CHECKLIST DE CONFIGURACION BIGIN

```
□ 1. Verificar que los Stages existen en el Pipeline:
     □ ROBOT COORD
     □ ROBOT INTER
     □ ROBOT BOGOTA
     □ ROBOT ENVIA
     □ COORDINADORA
     □ ESPERANDO GUIAS

□ 2. Verificar campos custom en Deals:
     □ Telefono
     □ Direcci_n (con acento codificado)
     □ Municipio_Dept
     □ Departamento
     □ Barrio
     □ Guia
     □ Transportadora

□ 3. Verificar credenciales OAuth:
     □ refresh_token es valido
     □ client_id es correcto
     □ client_secret es correcto
     □ Todos los nodos de refresh tienen las mismas credenciales

□ 4. Verificar permisos de la API:
     □ ZohoBigin.modules.deals.READ
     □ ZohoBigin.modules.deals.UPDATE
     □ ZohoBigin.modules.deals.CREATE
```

---

### COMO REGENERAR CREDENCIALES BIGIN

Si las credenciales dejan de funcionar:

1. **Ir a Zoho API Console:**
   ```
   https://api-console.zoho.com/
   ```

2. **Seleccionar la aplicacion "Self Client"**

3. **Generar nuevo codigo de autorizacion:**
   - Scope: `ZohoBigin.modules.deals.ALL`
   - Time Duration: 10 minutes
   - Copiar el codigo generado

4. **Intercambiar por tokens:**
   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=TU_CLIENT_ID" \
     -d "client_secret=TU_CLIENT_SECRET" \
     -d "code=CODIGO_GENERADO"
   ```

5. **Guardar el nuevo refresh_token** (no expira normalmente)

6. **Actualizar en n8n:**
   - Abrir workflow "Robots Logistica"
   - Editar cada nodo "🔄 Refresh Bigin Token..."
   - Reemplazar el refresh_token

---

## Configuracion de Robots

### ROBOT COORDINADORA (Puerto 3001)

**Ubicacion del codigo:**
```
/Agentes Logistica/robot-coordinadora/
├── package.json
├── src/
│   └── server.ts
└── README.md
```

**Iniciar servidor:**
```bash
cd robot-coordinadora
npm install
npm run dev          # Desarrollo
# o
pm2 start npm --name "robot-coord" -- run dev
```

**Verificar estado:**
```bash
curl http://localhost:3001/health
# Debe responder: { "status": "ok" }
```

**IP desde Docker (n8n):**
```
http://172.18.0.1:3001
```

⚠️ **IMPORTANTE:** El archivo JSON tiene una inconsistencia:
- Validar pedidos usa: `172.18.0.1:3001`
- Crear pedidos usa: `172.17.0.1:3001`

Ambos deberian usar `172.18.0.1`. Verificar la red Docker.

---

### ROBOT INTER/ENVIA/BOG (Puerto 3002)

**Ubicacion del codigo:**
```
/Agentes Logistica/robot-inter-envia-bog/
├── package.json
├── src/
│   └── server.ts
└── README.md
```

**Iniciar servidor:**
```bash
cd robot-inter-envia-bog
npm install
npm run dev          # Desarrollo
# o
pm2 start npm --name "robot-inter" -- run dev
```

**Verificar estado:**
```bash
curl http://localhost:3002/health
# Debe responder: { "status": "ok" }
```

**IP desde Docker (n8n):**
```
http://172.18.0.1:3002
```

---

### CADDY (Servidor de archivos)

Los PDFs y Excel se guardan en `/opt/n8n/local-files/` y se sirven via Caddy.

**Configuracion Caddy:**
```
tu-dominio.com {
    handle /files/* {
        root * /opt/n8n/local-files
        file_server
    }
}
```

**URL publica de archivos:**
```
https://tu-dominio.com/files/guias-inter-1234567890.pdf
https://tu-dominio.com/files/envia-1234567890.xlsx
```

---

## Troubleshooting General

### Error: EADDRINUSE (Puerto en uso)

```bash
# Ver que proceso usa el puerto
lsof -i :3001
lsof -i :3002

# Matar el proceso
kill -9 <PID>

# O con un comando
lsof -i :3001 -t | xargs kill -9
```

### Error: Connection Refused desde n8n

```
Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Causa:** n8n corre en Docker y no puede acceder a localhost del host.

**Solucion:** Usar la IP del gateway de Docker:
```
# ❌ INCORRECTO
http://localhost:3001

# ✅ CORRECTO
http://172.18.0.1:3001
```

**Verificar IP del gateway:**
```bash
docker network inspect n8n_default | grep Gateway
```

### Error: Timeout en Claude API

```
Error: timeout of 30000ms exceeded
```

**Solucion:** Aumentar timeout en el nodo HTTP Request:
```javascript
options: {
  timeout: 60000  // 60 segundos
}
```

### Error: PDF/Excel no se genera

1. Verificar que `/opt/n8n/local-files/` existe y tiene permisos:
   ```bash
   ls -la /opt/n8n/local-files/
   # Debe tener permisos 755 o 777
   ```

2. Verificar que el robot puede escribir:
   ```bash
   touch /opt/n8n/local-files/test.txt
   rm /opt/n8n/local-files/test.txt
   ```

### Logs de los robots

```bash
# Ver logs de pm2
pm2 logs robot-coord
pm2 logs robot-inter

# Ver logs en tiempo real
pm2 logs --lines 100
```

---

## Resumen de URLs y Puertos

| Servicio | Puerto | URL Local | URL Docker | URL Publica |
|----------|--------|-----------|------------|-------------|
| n8n | 5678 | localhost:5678 | - | tu-dominio.com:5678 |
| Robot Coord | 3001 | localhost:3001 | 172.18.0.1:3001 | - |
| Robot Inter | 3002 | localhost:3002 | 172.18.0.1:3002 | - |
| Archivos | 443 | - | - | tu-dominio.com/files/ |

---

## Comandos Rapidos

```bash
# Reiniciar todos los robots
pm2 restart all

# Ver estado
pm2 status

# Reiniciar n8n
docker restart n8n

# Ver logs de n8n
docker logs -f n8n

# Probar endpoint de guias
curl -X POST http://localhost:3002/api/generar-guias \
  -H "Content-Type: application/json" \
  -d '{"pedidos":[{"nombres":"Test","apellidos":"User","direccion":"Calle 1","ciudad":"BOGOTA","celular":"3001234567","totalConIva":77900}]}'

# Probar endpoint de excel
curl -X POST http://localhost:3002/api/generar-excel-envia \
  -H "Content-Type: application/json" \
  -d '{"ordenes":[{"Valor":77900,"Nombre completo":"Test User","Telefono":"3001234567","Direccion completa":"Calle 1","Municipio":"Bogota","Departamento":"Cundinamarca"}],"biginIds":[]}'
```

---

## Archivos de Referencia

| Archivo | Descripcion | Ubicacion |
|---------|-------------|-----------|
| Robots Logistica.json | Workflow n8n completo | `/Agentes Logistica/` |
| README.md (principal) | Resumen del proyecto | `/Agentes Logistica/` |
| README.md (coord) | Documentacion robot-coordinadora | `/Agentes Logistica/robot-coordinadora/` |
| README.md (inter) | Documentacion robot-inter-envia-bog | `/Agentes Logistica/robot-inter-envia-bog/` |
| ARQUITECTURA.md | Este documento | `/Agentes Logistica/` |

---

*Documento creado: Enero 2026*
*Ultima actualizacion: Enero 2026*
