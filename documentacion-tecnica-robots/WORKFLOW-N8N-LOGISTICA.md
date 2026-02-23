# DOCUMENTACION: Workflow n8n - Robots Logistica

> **Archivo fuente**: `Agentes Logistica/Robots Logistica.json`
> **Workflow ID**: `eaG7RWwFFu1tbbEC`
> **Fecha documentacion**: Febrero 2026

---

## 1. DESCRIPCION GENERAL

Este workflow n8n automatiza la generacion de guias de envio para cuatro transportadoras colombianas, integrando:

- **Slack**: Interfaz de comandos
- **Bigin/Zoho CRM**: Base de datos de ordenes
- **Claude AI**: Transformacion inteligente de datos
- **Robots Node.js**: Generacion de documentos

---

## 2. DIAGRAMA DE FLUJO PRINCIPAL

```
                    ┌─────────────────┐
                    │  Slack Webhook  │
                    │    (Trigger)    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Switch:         │
                    │ "¿Que Robot?"   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ COORDINADORA  │  │ INTER/BOGOTA  │  │    ENVIA      │
│   (puerto     │  │   (puerto     │  │   (puerto     │
│    3001)      │  │    3002)      │  │    3002)      │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## 3. COMANDOS SLACK

| Comando | Rama | Robot | Puerto |
|---------|------|-------|--------|
| `subir ordenes coord` | 1 | robot-coordinadora | 3001 |
| `generar guias inter` | 2 | robot-inter-envia-bog | 3002 |
| `generar guias bogota` | 3 | robot-inter-envia-bog | 3002 |
| `generar excel envia` | 4 | robot-inter-envia-bog | 3002 |

**Canal Slack**: `#bots` (ID: `C0A9M96C0AK`)

---

## 4. FLUJO COORDINADORA (Rama 1)

### Comando
```
subir ordenes coord
```

### Nodos del flujo
```
1. Slack Trigger
       │
       ▼
2. 🔄 Refresh Bigin Token
   POST https://accounts.zoho.com/oauth/v2/token
       │
       ▼
3. Bigin: Obtener Ordenes
   GET /bigin/v1/Deals/search
   Criteria: Stage = "ROBOT COORD"
       │
       ▼
4. ¿Hay ordenes?
   ├── NO → Slack: "No hay ordenes en ROBOT COORD"
   │
   └── SI ↓
       │
       ▼
5. Call Claude API
   Modelo: claude-sonnet-4-20250514
   Timeout: 60s
   Prompt: Transformar datos al formato Coordinadora
       │
       ▼
6. Parsear Respuesta Claude
   Extraer JSON del response
       │
       ▼
7. Validar Ciudades
   POST http://172.17.0.1:3001/api/validar-pedidos
   - Valida contra 1,488 municipios registrados
       │
       ├── INVALIDAS → Slack: "Ciudades invalidas: [lista]"
       │
       └── VALIDAS ↓
           │
           ▼
8. Preparar Batch COORD
   Agrupar pedidos en formato batch
       │
       ▼
9. Robot: Crear Pedido
   POST http://172.17.0.1:3001/api/crear-pedidos-batch
   (Usa Playwright para automatizar TMS)
       │
       ▼
10. Generar Resumen
    Contar exitos/fallos
       │
       ▼
11. Actualizar Bigin COORD
    PUT /bigin/v1/Deals
    Stage: "COORDINADORA"
       │
       ▼
12. Slack: Enviar Resumen
    "✅ X pedidos creados en Coordinadora"
```

### Campos extraidos por Claude (Coordinadora)
| Campo | Formato | Ejemplo |
|-------|---------|---------|
| identificacion | 10 digitos (sin 57) | `3163709528` |
| nombres | Mayusculas | `JUAN` |
| apellidos | Mayusculas | `PEREZ GOMEZ` |
| direccion | Texto | `Calle 100 #15-20` |
| ciudad | `MUNICIPIO (ABREV)` | `BUCARAMANGA (STDER)` |
| celular | 10 digitos | `3001234567` |
| referencia | Fijo | `AA1` |
| unidades | 1-3 | `2` |
| total | COP | `109900` |
| valorDeclarado | Fijo | `55000` |
| recaudoContraentrega | boolean | `true/false` |
| peso | Fijo | `0.08` |
| dimensiones | Fijo | `5x5x10` |

---

## 5. FLUJO INTERRAPIDISIMO (Rama 2)

### Comando
```
generar guias inter
```

### Nodos del flujo
```
1. Slack Trigger
       │
       ▼
2. 🔄 Refresh Bigin Token
       │
       ▼
3. Bigin: Ordenes Inter
   Criteria: Stage = "ROBOT INTER"
       │
       ▼
4. ¿Hay ordenes?
   ├── NO → Slack: "No hay ordenes en ROBOT INTER"
   │
   └── SI ↓
       │
       ▼
5. Claude: Procesar Inter
   Extraer: nombre, apellido, direccion, barrio, ciudad, celular, monto
       │
       ▼
6. Preparar payload guias
   Formatear array de guias
       │
       ▼
7. HTTP Request: Generar Guias PDF
   POST http://172.18.0.1:3002/api/generar-guias
   Body: { guias: [...] }
       │
       ▼
8. Respuesta del robot
   { success: true, pdfUrl: "...", filename: "..." }
       │
       ▼
9. Actualizar Bigin INTER
   PUT /bigin/v1/Deals
   - Stage: "ESPERANDO GUIAS"
   - Transportadora: "INTERRAPIDISIMO"
       │
       ▼
10. Slack: Enviar link
    "📄 Guias generadas: [link PDF]"
```

### Campos extraidos por Claude (Interrapidisimo)
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| nombre | string | Primer nombre |
| apellido | string | Apellidos |
| direccion | string | Direccion completa |
| barrio | string | Barrio/localidad |
| ciudad | string | Ciudad destino |
| celular | string | Telefono 10 digitos |
| monto | number | Valor a cobrar |

---

## 6. FLUJO BOGOTA (Rama 3)

### Comando
```
generar guias bogota
```

### Descripcion
Identico al flujo Interrapidisimo, pero:
- Busca ordenes con Stage diferente (si aplica)
- Transportadora: `INTERRAPIDISIMO` (mismo carrier)
- PDF adaptado para entregas en Bogota

---

## 7. FLUJO ENVIA (Rama 4)

### Comando
```
generar excel envia
```

### Nodos del flujo
```
1. Slack Trigger
       │
       ▼
2. 🔄 Refresh Bigin Token
       │
       ▼
3. Bigin: Ordenes Envia
   Criteria: Stage = "ROBOT ENVIA"
       │
       ▼
4. ¿Hay ordenes?
   ├── NO → Slack: "No hay ordenes en ROBOT ENVIA"
   │
   └── SI ↓
       │
       ▼
5. Preparar Excel Envia
   Formatear datos para columnas Excel
       │
       ▼
6. HTTP Request: Generar Excel
   POST http://172.18.0.1:3002/api/generar-excel-envia
   Body: { ordenes: [...] }
       │
       ▼
7. Respuesta del robot
   { success: true, excelUrl: "...", filename: "..." }
       │
       ▼
8. Actualizar Bigin Envia
   PUT /bigin/v1/Deals
   - Stage: "ESPERANDO GUIAS"
   - Transportadora: "ENVIA"
       │
       ▼
9. Slack: Enviar link
    "📊 Excel generado: [link XLSX]"
```

### Columnas del Excel
| Columna | Descripcion |
|---------|-------------|
| Valor | Monto a cobrar (COP) |
| Nombre | Nombre completo |
| Telefono | Numero de contacto |
| Direccion | Direccion de entrega |
| Municipio | Ciudad/Municipio |
| Departamento | Departamento |

---

## 8. INTEGRACION BIGIN (ZOHO CRM)

### Autenticacion OAuth 2.0

```javascript
// Nodo: Refresh Bigin Token
POST https://accounts.zoho.com/oauth/v2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id={{$credentials.clientId}}
&client_secret={{$credentials.clientSecret}}
&refresh_token={{$credentials.refreshToken}}
```

**Respuesta:**
```json
{
  "access_token": "1000.xxx...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Buscar ordenes

```javascript
// Nodo: Bigin Obtener Ordenes
GET https://www.zohoapis.com/bigin/v1/Deals/search
Authorization: Zoho-oauthtoken {{accessToken}}

?criteria=(Stage:equals:ROBOT INTER)
```

### Actualizar ordenes

```javascript
// Nodo: Actualizar Bigin
PUT https://www.zohoapis.com/bigin/v1/Deals
Authorization: Zoho-oauthtoken {{accessToken}}
Content-Type: application/json

{
  "data": [
    {
      "id": "{{dealId}}",
      "Stage": "ESPERANDO GUIAS",
      "Transportadora": "INTERRAPIDISIMO"
    }
  ]
}
```

### Stages del Pipeline

| Stage | Descripcion | Robot responsable |
|-------|-------------|-------------------|
| `ROBOT COORD` | Listo para Coordinadora | robot-coordinadora |
| `ROBOT INTER` | Listo para Interrapidisimo | robot-inter-envia-bog |
| `ROBOT ENVIA` | Listo para Envia | robot-inter-envia-bog |
| `ESPERANDO GUIAS` | PDF/Excel generado | - |
| `COORDINADORA` | Pedido creado en TMS | - |

---

## 9. INTEGRACION CLAUDE AI

### Configuracion

```javascript
// Nodo: Call Claude API
POST https://api.anthropic.com/v1/messages
x-api-key: {{$credentials.anthropicApiKey}}
anthropic-version: 2023-06-01
Content-Type: application/json

{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "{{prompt_con_datos}}"
    }
  ]
}
```

### Prompt para Coordinadora (ejemplo)
```
Extrae la siguiente informacion de estas ordenes de Bigin:

ORDENES:
{{JSON.stringify(ordenes)}}

Para cada orden, devuelve un JSON con:
- identificacion: Quitar prefijo 57, dejar 10 digitos
- nombres: En mayusculas
- apellidos: En mayusculas
- direccion: Direccion completa
- ciudad: Formato "MUNICIPIO (ABREV)" donde ABREV es la abreviatura del departamento
- celular: 10 digitos
- referencia: "AA1"
- unidades: Calcular segun precio (77900=1, 109900=2, 139900=3)
- total: Precio total
- valorDeclarado: 55000 (fijo)
- recaudoContraentrega: false si Deal_Name contiene "&" o si Tag es "PAGO ANTICIPADO"
- peso: 0.08
- dimensiones: { alto: 5, ancho: 5, largo: 10 }

Responde SOLO con el JSON, sin explicaciones.
```

### Reglas de transformacion

| Regla | Input | Output |
|-------|-------|--------|
| Telefono | `573163709528` | `3163709528` |
| Ciudad | `bucaramanga, santander` | `BUCARAMANGA (STDER)` |
| Unidades (precio) | `$77,900` | `1` |
| Unidades (precio) | `$109,900` | `2` |
| Unidades (precio) | `$139,900` | `3` |
| Contraentrega | Deal con "&" en nombre | `false` |
| Contraentrega | Tag "PAGO ANTICIPADO" | `false` |

---

## 10. PUNTOS DE INTEGRACION

### Endpoints de robots

| Robot | URL | Funcion |
|-------|-----|---------|
| Coordinadora - Validar | `http://172.17.0.1:3001/api/validar-pedidos` | Validar municipios |
| Coordinadora - Crear | `http://172.17.0.1:3001/api/crear-pedidos-batch` | Crear pedidos en TMS |
| Inter/Bog - Guias | `http://172.18.0.1:3002/api/generar-guias` | Generar PDF |
| Envia - Excel | `http://172.18.0.1:3002/api/generar-excel-envia` | Generar Excel |

### IPs Docker
- **172.17.0.1**: Gateway para robot-coordinadora
- **172.18.0.1**: Gateway para robot-inter-envia-bog

---

## 11. MANEJO DE ERRORES

### Escenarios y respuestas

| Escenario | Mensaje Slack |
|-----------|---------------|
| Sin ordenes en stage | "No hay ordenes en stage [STAGE]" |
| Ciudad invalida | "Ciudades invalidas: [lista]. Corregir y reintentar." |
| Error de robot | "Error generando guias: [mensaje]" |
| Token expirado | Refresh automatico (transparente) |
| Timeout Claude | "Timeout procesando ordenes. Reintentar." |

### Comportamiento
- **Sin ordenes**: Notifica y termina flujo
- **Error robot**: Notifica error, igual intenta actualizar Bigin
- **Token expirado**: Refresh automatico antes de cada llamada

---

## 12. NOTIFICACIONES SLACK

### Formato de mensajes

**Exito con guias:**
```
📄 Guias Interrapidisimo generadas!

✅ 5 guias procesadas
📥 Descargar: https://dominio.com/files/guias_xxx.pdf

Ordenes actualizadas a "ESPERANDO GUIAS"
```

**Exito con Excel:**
```
📊 Excel Envia generado!

✅ 8 ordenes procesadas
📥 Descargar: https://dominio.com/files/ordenes_xxx.xlsx

Ordenes actualizadas a "ESPERANDO GUIAS"
```

**Error:**
```
❌ Error generando guias Inter

Mensaje: Connection refused
Ordenes no procesadas: 5

Verificar estado del robot-inter-envia-bog (puerto 3002)
```

---

## 13. CONFIGURACION DEL WORKFLOW

### Importar en n8n

1. Abrir n8n: `http://tu-servidor:5678`
2. Menu → Import from file
3. Seleccionar: `Agentes Logistica/Robots Logistica.json`
4. Configurar credenciales:
   - Slack Bot Token
   - Zoho OAuth (client_id, client_secret, refresh_token)
   - Anthropic API Key

### Credenciales requeridas

| Credencial | Tipo | Campos |
|------------|------|--------|
| Slack | OAuth2 | Bot Token |
| Zoho Bigin | OAuth2 | Client ID, Client Secret, Refresh Token |
| Anthropic | API Key | API Key |

### Variables de entorno n8n
```env
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=xxx
WEBHOOK_URL=https://tu-dominio.com
```

---

## 14. MONITOREO Y LOGS

### Ver ejecuciones
1. n8n → Menu → Executions
2. Filtrar por workflow "Robots Logistica"

### Logs importantes
- Resultado de Claude (verificar parsing correcto)
- Response de robots (success/error)
- Updates a Bigin (confirmar actualizacion)

### Metricas sugeridas
- Guias generadas por dia
- Tiempo promedio de ejecucion
- Tasa de errores por transportadora
- Ordenes procesadas por comando

---

## 15. REFERENCIAS

- **Workflow JSON**: [Robots Logistica.json](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/Robots%20Logistica.json)
- **Documentacion n8n**: https://docs.n8n.io
- **API Bigin**: https://www.bigin.com/developer/docs/apis/
- **API Claude**: https://docs.anthropic.com/claude/reference
