# Sistema v3DSL - Bot Conversacional Somnio

## 📋 Descripción General

Sistema de bot conversacional inteligente para **Somnio** (Elixir del Sueño) construido con **n8n**, **PostgreSQL** y **Claude AI**. Maneja conversaciones de WhatsApp vía Callbell, detecta intenciones, captura datos de clientes y crea pedidos automáticamente en Bigin CRM.

## 🏗️ Arquitectura

### Vista de Alto Nivel

```
┌─────────────┐
│   Callbell  │ (WhatsApp)
│   Webhook   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    HISTORIAL V3                             │
│  • Receptor central de mensajes                             │
│  • Gestor de sesiones (PostgreSQL)                          │
│  • Orquestador de agentes                                  │
└───────┬──────────────────────────────────────┬─────────────┘
        │                                      │
        ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐
│ STATE ANALYZER   │                  │ DATA EXTRACTOR   │
│ • Claude API     │                  │ • Claude API     │
│ • Detecta intent │                  │ • Extrae datos   │
│ • Validaciones   │                  │ • Limpia campos  │
└────────┬─────────┘                  └────────┬─────────┘
         │                                     │
         └───────────────┬─────────────────────┘
                        │
                        ▼
                ┌──────────────────┐
                │   CAROLINA V3    │
                │ • Selector de    │
                │   plantillas     │
                │ • Envío con      │
                │   delays         │
                │ • Prevención de  │
                │   interrupciones │
                └────────┬─────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  Callbell   │
                  │  API Send   │
                  └─────────────┘

Workflows Auxiliares:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  ORDER MANAGER   │  │    SNAPSHOT      │  │ PROACTIVE TIMERS │
│ • Bigin CRM      │  │ • Read-only API  │  │ • Recordatorios  │
│ • Crea pedidos   │  │ • Estado actual  │  │ • Órdenes auto   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Flujo de Datos

```
1. ENTRADA (Inbound Message)
   Cliente → Callbell Webhook → Historial v3

2. PROCESAMIENTO
   Historial v3 → State Analyzer (detecta intent)
                ↓
                → Data Extractor (extrae datos si collecting_data)
                ↓
                → Merge & Save to PostgreSQL

3. DECISIÓN
   ¿Crear orden? → Order Manager → Bigin CRM
   ↓
   Trigger Carolina v3

4. RESPUESTA (Outbound Messages)
   Carolina v3 → Selecciona templates
              → Loop con delays
              → Prevención de interrupciones
              → Envía a Callbell
              → Guarda en Historial v3

5. PROACTIVO (Timers)
   Cada minuto: Proactive Timers
              → Revisa sesiones inactivas
              → Envía recordatorios (6 min)
              → Crea órdenes auto (10 min)
```

## 🗂️ Estructura del Repositorio

```
v3dsl-bot/
├── README.md                           # Este archivo
├── architecture/
│   ├── ARQUITECTURA-GENERAL.md         # Documento de arquitectura detallado
│   ├── FLUJO-DE-INTENTS.md            # Diagrama de flujo de intents
│   └── BASE-DE-DATOS.md               # Esquema de BD y queries
├── workflows/
│   ├── 01-historial-v3.json              # Workflow Historial v3
│   ├── 02-carolina-v3.json               # Workflow Carolina v3
│   ├── 03-state-analyzer.json            # Workflow State Analyzer
│   ├── 04-data-extractor.json            # Workflow Data Extractor
│   ├── 05-order-manager.json             # Workflow Order Manager
│   ├── 06-proactive-timer-instance.json  # Workflow Proactive Timer ✅ ACTIVO
│   └── 07-snapshot.json                  # Workflow Snapshot
├── docs/
│   ├── 01-HISTORIAL-V3.md             # Doc técnica Historial v3
│   ├── 02-CAROLINA-V3.md              # Doc técnica Carolina v3
│   ├── 03-STATE-ANALYZER.md           # Doc técnica State Analyzer
│   ├── 04-DATA-EXTRACTOR.md           # Doc técnica Data Extractor
│   ├── 05-ORDER-MANAGER.md            # Doc técnica Order Manager
│   ├── 06-PROACTIVE-TIMER.md          # Doc técnica Proactive Timer ✅
│   └── 07-SNAPSHOT.md                 # Doc técnica Snapshot
└── TODO.md                            # Lista de tareas pendientes
```

## 📚 Workflows del Sistema

### 1. **Historial v3** (Orquestador Principal)
- **Propósito:** Receptor central, gestor de sesiones, orquestador
- **Trigger:** Webhook desde Callbell
- **Responsabilidades:**
  - Recibir mensajes de Callbell
  - Filtrar por tags bloqueados y mensajes antiguos
  - Crear/actualizar sesiones en PostgreSQL
  - Guardar mensajes en PostgreSQL
  - Llamar State Analyzer para detectar intent
  - Llamar Data Extractor si modo collecting_data
  - Decidir si crear orden (Order Manager)
  - Trigger Carolina v3 para responder

### 2. **Carolina v3** (Generador de Respuestas)
- **Propósito:** Selector de plantillas y enviador de mensajes
- **Trigger:** Llamado por Historial v3
- **Responsabilidades:**
  - Obtener snapshot actual de la conversación
  - Verificar tags bloqueados y mensajes pendientes
  - Extraer intent del state (ya detectado por State Analyzer)
  - Seleccionar templates según intent y si es primera vez
  - Filtrar templates ya enviados
  - Enviar mensajes con delays controlados
  - Prevenir interrupciones (version tracking)
  - Guardar mensajes outbound en historial

### 3. **State Analyzer** (Detector de Intenciones)
- **Propósito:** Detectar intent del cliente usando Claude AI
- **Trigger:** Llamado por Historial v3
- **Responsabilidades:**
  - Analizar historial completo + mensajes pendientes
  - Detectar intent con Claude Sonnet 4.5
  - Aplicar validaciones de flujo (condicionales)
  - Auto-detectar intents transaccionales (ofrecer_promos, resumen_Xx)
  - Extraer datos básicos del mensaje
  - Determinar cambios de modo (collecting_data ↔ conversacion)
  - Registrar intents vistos

### 4. **Data Extractor** (Extractor de Datos)
- **Propósito:** Extraer datos personales con Claude AI
- **Trigger:** Llamado por Historial v3 (solo si collecting_data)
- **Responsabilidades:**
  - Extraer 8 campos: nombre, apellido, telefono, direccion, barrio, ciudad, departamento, correo
  - Detectar negaciones ("no tengo correo" → correo: "N/A")
  - Limpiar y normalizar datos
  - Capitalizar nombres propios
  - Normalizar teléfonos (agregar prefijo 57)
  - Normalizar ciudades y departamentos
  - Merge con datos existentes

### 5. **Order Manager** (Creador de Pedidos)
- **Propósito:** Crear pedidos en Bigin CRM
- **Trigger:** Llamado por Historial v3 (cuando pack + datos completos)
- **Responsabilidades:**
  - Validar datos mínimos (6 campos)
  - Preparar body del pedido con precios según pack
  - Llamar Robot API para crear en Bigin CRM
  - Marcar order_created en PostgreSQL
  - Retornar éxito/error

### 6. **Snapshot** (API de Estado)
- **Propósito:** Endpoint de solo lectura para obtener estado de conversación
- **Trigger:** GET request con phone
- **Responsabilidades:**
  - Obtener sesión activa
  - Obtener mensajes ordenados
  - Calcular mensajes pendientes (inbound después de último outbound)
  - Retornar snapshot completo: sesión, mensajes, pending, state, tags, version

### 7. **Proactive Timers** (Acciones Automáticas) ✅ ACTIVO
- **Propósito:** Recordatorios y acciones automáticas por tiempo
- **Trigger:** Webhook POST + loop interno cada 2 minutos
- **Responsabilidades:**
  - Monitorear sesiones activas en modo collecting_data
  - Enviar recordatorio sin datos (10 min sin respuesta)
  - Solicitar datos faltantes (6 min con datos parciales)
  - Ofrecer promos cuando datos mínimos completos (2 min)
  - Crear orden automática (10 min después de ofrecer promos)
  - Prevenir acciones duplicadas con flags de idempotencia

## 🗄️ Base de Datos (PostgreSQL)

### Tabla: `sessions_v3`
```sql
CREATE TABLE sessions_v3 (
  session_id VARCHAR PRIMARY KEY,
  phone VARCHAR NOT NULL,
  contact_id VARCHAR,
  callbell_conversation_href TEXT,
  business_id VARCHAR DEFAULT 'somnio',
  state JSONB DEFAULT '{}',
  mode VARCHAR DEFAULT 'conversacion',
  tags TEXT[],
  status VARCHAR DEFAULT 'active',
  version INTEGER DEFAULT 0,
  last_processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);
```

**Campos clave:**
- `state`: Datos capturados del cliente + metadata
- `mode`: 'conversacion' | 'collecting_data'
- `tags`: Tags de Callbell (WPP, P/W, RECO, bot_off)
- `version`: Contador para detectar interrupciones

### Tabla: `messages_v3`
```sql
CREATE TABLE messages_v3 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR REFERENCES sessions_v3(session_id),
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  direction VARCHAR NOT NULL,
  callbell_message_id VARCHAR UNIQUE,
  business_id VARCHAR DEFAULT 'somnio',
  intent VARCHAR,
  payload_raw JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Campos clave:**
- `callbell_message_id`: UNIQUE para evitar duplicados
- `role`: 'user' | 'assistant'
- `direction`: 'inbound' | 'outbound'

## 🎯 Flujo de Intents

### Intents Informativos (sin restricciones)
- `hola`, `precio`, `info_promociones`, `contenido_envase`
- `como_se_toma`, `modopago`, `envio`, `invima`
- `ubicacion`, `contraindicaciones`, `fallback`

### Intents Combinados
- `hola+precio`, `hola+como_se_toma`, `hola+envio`
- `hola+modopago`, `hola+captura_datos_si_compra`

### Flujo Transaccional (con validaciones)

```
1. Cliente: "Quiero comprar"
   → Intent: captura_datos_si_compra
   → Mode: collecting_data (activado)

2. Cliente proporciona datos (nombre, apellido, etc.)
   → Data Extractor extrae y limpia
   → Guarda en state

3. [AUTO] Cuando 8 campos completos + sin pack
   → Intent: ofrecer_promos
   → Carolina envía imagen con opciones 1x/2x/3x

4. Cliente: "el 2x"
   → Pack detectado: "2x"
   → Intent: resumen_2x (auto-activado)
   → Carolina envía confirmación con datos + precio

5. Cliente: "sí"
   → Intent: compra_confirmada
   → Order Manager crea pedido en Bigin
   → Carolina confirma orden creada
   → Tag WPP agregado (bot se desactiva)
```

### Validaciones de Intents

| Intent | Requiere |
|--------|----------|
| `ofrecer_promos` | 8 campos completos |
| `resumen_1x/2x/3x` | `ofrecer_promos` visto |
| `compra_confirmada` | Algún `resumen_Xx` visto |
| `no_confirmado` | Algún `resumen_Xx` visto |

## 🔧 Configuración y Despliegue

### Requisitos
- **n8n:** v1.0+
- **PostgreSQL:** v13+
- **Node.js:** v18+ (para Robot API)
- **Claude API:** Cuenta Anthropic con API key

### Variables de Entorno
```bash
# PostgreSQL
POSTGRES_HOST=...
POSTGRES_DB=historial_v3
POSTGRES_USER=...
POSTGRES_PASSWORD=...

# Claude API
ANTHROPIC_API_KEY=...

# Callbell
CALLBELL_API_TOKEN=...

# Robot API (Bigin CRM)
ROBOT_API_URL=http://robot-api.local:3000
BIGIN_API_KEY=...
```

### Credenciales n8n
1. **Postgres Historial v3** - Conexión a PostgreSQL
2. **Anthropic API** - Claude API key
3. **Callbell API** - Bearer token para Callbell
4. **Header Auth account** - Token para Callbell (alternativo)

### Endpoints
- **Historial v3:** `POST /webhook/historial-v3-callbell-webhook`
- **Carolina v3:** `POST /webhook/carolina-v3-process`
- **State Analyzer:** `POST /webhook/state-analyzer`
- **Data Extractor:** `POST /webhook/data-extractor`
- **Order Manager:** `POST /webhook/order-manager`
- **Snapshot:** `GET /webhook/historial-v3-snapshot?phone=57...`

### Importar Workflows
1. Abrir n8n
2. Ir a Workflows → Import from File
3. Importar cada JSON en orden:
   1. `01-historial-v3.json`
   2. `02-carolina-v3.json`
   3. `03-state-analyzer.json`
   4. `04-data-extractor.json`
   5. `05-order-manager.json`
   6. `06-snapshot.json`
   7. `06-proactive-timer-instance.json` ✅ YA ACTIVO

4. Configurar credenciales en cada workflow
5. Activar todos los workflows

## 🧪 Testing

### Test de Historial v3
```bash
curl -X POST https://n8n.automatizacionesmorf.com/webhook/historial-v3-callbell-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "test-'$(date +%s)'",
    "from": "573137549286",
    "to": "573105879824",
    "text": "hola",
    "status": "sent",
    "createdAt": '$(date +%s000)',
    "contact": {
      "uuid": "test-contact",
      "tags": []
    }
  }'
```

### Test de Snapshot
```bash
curl "https://n8n.automatizacionesmorf.com/webhook/historial-v3-snapshot?phone=573137549286"
```

### Test de Carolina v3
```bash
curl -X POST https://n8n.automatizacionesmorf.com/webhook/carolina-v3-process \
  -H "Content-Type: application/json" \
  -d '{"phone": "573137549286"}'
```

## 📊 Métricas y Monitoreo

### Logs Importantes
- `📥 WEBHOOK RECEIVED` - Mensaje recibido en Historial
- `🏷️ CHECKING TAGS` - Verificación de tags bloqueados
- `🤖 INTENT FROM STATE` - Intent detectado
- `📸 Snapshot built` - Snapshot construido
- `✅ MESSAGE SENT SUCCESSFULLY` - Mensaje enviado por Carolina
- `⚠️ INTERRUPTED` - Cliente interrumpió cadena de mensajes
- `📦 ORDER CREATED` - Orden creada en Bigin

### Dashboard Recomendado
- Tasa de conversión (hola → compra_confirmada)
- Tiempo promedio de conversación
- Órdenes creadas por día
- Tasa de abandono en cada paso
- Intents más comunes
- Errores de API (Claude, Callbell, Bigin)

## 🚨 Troubleshooting

### Problema: "Bot no responde"
**Posibles causas:**
1. Tag bloqueado (WPP, P/W, RECO, bot_off) → Verificar tags en Callbell
2. Mensaje antiguo (> 2 min) → Normal, protección contra duplicados
3. Direction = outbound → Normal, solo procesa inbound
4. pending_count = 0 → Ya se respondió, no hay mensajes pendientes

### Problema: "Intent incorrecto"
**Posibles causas:**
1. Claude no entendió → Revisar prompt en State Analyzer
2. Validación bloqueó intent → Verificar intents_vistos
3. Intent no configurado → Agregar a intents.json

### Problema: "No extrae datos"
**Posibles causas:**
1. Mode no es collecting_data → State Analyzer debe activarlo
2. Data Extractor no llamado → Verificar Historial v3 flow
3. Claude no detectó datos → Mensaje no contiene datos personales

### Problema: "Orden no se crea"
**Posibles causas:**
1. Campos incompletos → Verificar 6 campos mínimos
2. Pack no detectado → State Analyzer debe detectar 1x/2x/3x
3. order_created ya true → Verificar state en PostgreSQL
4. Robot API caído → Verificar http://robot-api.local:3000

## 📝 Mantenimiento

### Limpiar Sesiones de Testing
```sql
-- Borrar sesión de testing
DELETE FROM messages_v3
WHERE session_id IN (
  SELECT session_id FROM sessions_v3
  WHERE phone = '573137549286'
);

DELETE FROM sessions_v3
WHERE phone = '573137549286';
```

### Actualizar Plantillas
1. Editar `/files/plantillas/mensajes.json`
2. Editar `/files/plantillas/intents.json`
3. No requiere reiniciar workflows

### Agregar Nuevo Intent
1. Agregar a `intents.json`:
```json
{
  "intents": {
    "nuevo_intent": {
      "respuesta": {
        "primera_vez": ["/plantilla_nueva"],
        "siguientes": ["/plantilla_nueva"]
      }
    }
  }
}
```

2. Agregar plantilla a `mensajes.json`:
```json
{
  "plantillas_base": {
    "/plantilla_nueva": {
      "texto": "Respuesta para nuevo intent",
      "delay_s": 2
    }
  }
}
```

3. Agregar intent a prompt de State Analyzer si necesario

## 🔐 Seguridad

### API Keys
- **Guardar en n8n credentials:** No hardcodear en workflows
- **Rotar periódicamente:** Claude API, Callbell API
- **Limitar acceso:** PostgreSQL solo desde n8n

### Datos Sensibles
- **Encriptación:** PostgreSQL con TLS
- **Logs:** No loggear teléfonos completos en producción
- **Backups:** Diarios de sessions_v3 y messages_v3

## 🤝 Contribución

### Reportar Issues
- Crear issue en GitHub con:
  - Descripción del problema
  - Logs relevantes
  - Pasos para reproducir

### Sugerir Mejoras
- Crear issue con label "enhancement"
- Describir caso de uso
- Proponer solución

## 📄 Licencia

Propiedad privada de **Somnio**. Todos los derechos reservados.

## 👥 Equipo

- **Desarrollador:** [Tu Nombre]
- **Cliente:** Somnio
- **Usuario GitHub:** yuseponub

## 📞 Soporte

Para soporte técnico, contactar a:
- GitHub: [@yuseponub](https://github.com/yuseponub)
- Repositorio: [yuseponub/AGENTES-IA-FUNCIONALES-v3](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3)

---

**Última actualización:** 22 de Enero 2026
**Versión:** v3.1.0
