# INFRAESTRUCTURA COMPLETA: Sistema SOMNIO v3DSL

> **Fecha de documentacion**: Febrero 2026
> **Version**: v3.1.0

---

## 1. VISION GENERAL

El sistema SOMNIO v3DSL es una plataforma de **agentes conversacionales autonomos** para automatizar ventas de productos de bienestar via WhatsApp, con integracion completa de logistica.

---

## 2. ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │         SERVICIOS             │
                    │          EXTERNOS             │
                    │                               │
                    │  ┌─────────┐  ┌───────────┐  │
                    │  │ Callbell│  │  Slack    │  │
                    │  │WhatsApp │  │  #bots    │  │
                    │  └────┬────┘  └─────┬─────┘  │
                    │       │             │        │
                    │  ┌────┴────┐  ┌─────┴─────┐  │
                    │  │  Zoho   │  │ Anthropic │  │
                    │  │ Bigin   │  │ Claude AI │  │
                    │  └─────────┘  └───────────┘  │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    │ HTTPS
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                               VPS SERVER                                   │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                           CADDY (Reverse Proxy)                       │ │
│  │                              Puerto 443 (HTTPS)                       │ │
│  └──────────────────────────────────┬───────────────────────────────────┘ │
│                                     │                                      │
│            ┌────────────────────────┼────────────────────────┐            │
│            │                        │                        │            │
│            ▼                        ▼                        ▼            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │
│  │   n8n (Docker)   │  │  robot-inter-    │  │  robot-coordinadora  │    │
│  │   Puerto: 5678   │  │  envia-bog       │  │     Puerto: 3001     │    │
│  │                  │  │  Puerto: 3002    │  │                      │    │
│  │  Workflows:      │  │                  │  │  - Playwright        │    │
│  │  - Historial V3  │  │  - PDFKit        │  │  - TMS Integration   │    │
│  │  - Carolina V3   │  │  - ExcelJS       │  │                      │    │
│  │  - State Analyzer│  │  - Express       │  │                      │    │
│  │  - Data Extractor│  │                  │  │                      │    │
│  │  - Order Manager │  │                  │  │                      │    │
│  │  - Robots Log.   │  │                  │  │                      │    │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘    │
│           │                     │                       │                 │
│           │                     ▼                       │                 │
│           │         ┌──────────────────────┐            │                 │
│           │         │ /opt/n8n/local-files │            │                 │
│           │         │  (PDFs, Excel)       │            │                 │
│           │         └──────────────────────┘            │                 │
│           │                                             │                 │
│           ▼                                             │                 │
│  ┌──────────────────┐                                   │                 │
│  │   PostgreSQL     │◀──────────────────────────────────┘                 │
│  │   Puerto: 5432   │                                                     │
│  │                  │                                                     │
│  │  Tablas:         │                                                     │
│  │  - sessions_v3   │                                                     │
│  │  - messages_v3   │                                                     │
│  └──────────────────┘                                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. COMPONENTES DEL SISTEMA

### 3.1 Servicios Externos

| Servicio | Funcion | Endpoint |
|----------|---------|----------|
| **Callbell** | Gateway WhatsApp | Webhooks entrantes |
| **Slack** | Comandos operadores | Canal #bots |
| **Zoho Bigin** | CRM / Base de ordenes | API REST |
| **Anthropic Claude** | IA para analisis | API /v1/messages |

### 3.2 Infraestructura VPS

| Componente | Puerto | Tecnologia | Funcion |
|------------|--------|------------|---------|
| **Caddy** | 443 | Go | Reverse proxy, HTTPS, archivos |
| **n8n** | 5678 | Node.js/Docker | Orquestacion workflows |
| **PostgreSQL** | 5432 | PostgreSQL | Base de datos |
| **robot-inter-envia-bog** | 3002 | Node.js/TypeScript | Generacion PDF/Excel |
| **robot-coordinadora** | 3001 | Node.js/Playwright | Automatizacion TMS |

### 3.3 Red Docker

| Red | Gateway | Robots conectados |
|-----|---------|-------------------|
| n8n_default | 172.18.0.1 | robot-inter-envia-bog |
| bridge | 172.17.0.1 | robot-coordinadora |

---

## 4. FLUJOS DE DATOS

### 4.1 Flujo de Ventas (WhatsApp)

```
Cliente WhatsApp
       │
       ▼
┌─────────────┐
│  Callbell   │ ──webhook──▶ n8n (Historial V3)
└─────────────┘                     │
                                    ▼
                           State Analyzer (Claude)
                                    │
                                    ▼
                           Data Extractor (Claude)
                                    │
                                    ▼
                           Order Manager
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
              Bigin (CRM)                    Carolina V3
         Stage: ROBOT INTER              (respuestas WhatsApp)
```

### 4.2 Flujo de Logistica (Slack)

```
Operador Slack
       │
       │  "generar guias inter"
       ▼
┌─────────────┐
│   Slack     │ ──webhook──▶ n8n (Robots Logistica)
└─────────────┘                     │
                                    ▼
                           Bigin: Obtener ordenes
                           Stage = "ROBOT INTER"
                                    │
                                    ▼
                           Claude: Transformar datos
                                    │
                                    ▼
                           Robot Inter/Envia/Bog
                           POST /api/generar-guias
                                    │
                                    ▼
                           PDF generado en
                           /opt/n8n/local-files/
                                    │
                                    ▼
                           Bigin: Actualizar
                           Stage = "ESPERANDO GUIAS"
                                    │
                                    ▼
                           Slack: Enviar link PDF
```

---

## 5. BASE DE DATOS (PostgreSQL)

### 5.1 Tabla: sessions_v3

```sql
CREATE TABLE sessions_v3 (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    callbell_contact_uuid VARCHAR(100),
    current_state JSONB DEFAULT '{}',
    labels TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Campos del estado (current_state):**
```json
{
  "nombre": "Juan",
  "apellido": "Perez",
  "telefono": "3001234567",
  "direccion": "Calle 100 #15-20",
  "ciudad": "Bogota",
  "departamento": "Cundinamarca",
  "barrio": "Chapinero",
  "correo": "juan@email.com",
  "pack_seleccionado": "2x",
  "precio": 109900,
  "intent_history": ["hola", "precio", "compra_confirmada"],
  "order_created": true,
  "proactive_timer_iteration": 3
}
```

### 5.2 Tabla: messages_v3

```sql
CREATE TABLE messages_v3 (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions_v3(id),
    callbell_message_id VARCHAR(100) UNIQUE,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    content TEXT,
    detected_intent VARCHAR(100),
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. WORKFLOWS N8N

### 6.1 Sistema de Ventas (WhatsApp)

| Workflow | ID | Funcion |
|----------|----|---------|
| Historial V3 | 01-historial-v3 | Orquestador central, recibe webhooks |
| Carolina V3 | 02-carolina-v3 | Envia respuestas por WhatsApp |
| State Analyzer | 03-state-analyzer | Detecta intenciones con Claude |
| Data Extractor | 04-data-extractor | Extrae datos de mensajes |
| Order Manager | 05-order-manager | Crea ordenes en Bigin |
| Proactive Timer | 06-proactive-timer | Recordatorios automaticos |
| Snapshot | 07-snapshot | Estado solo lectura |

### 6.2 Sistema de Logistica (Slack)

| Workflow | Archivo | Funcion |
|----------|---------|---------|
| Robots Logistica | Robots Logistica.json | Orquesta generacion de guias |

---

## 7. ROBOTS NODE.JS

### 7.1 robot-inter-envia-bog

| Caracteristica | Valor |
|----------------|-------|
| **Ubicacion** | `/Agentes Logistica/robot-inter-envia-bog/` |
| **Puerto** | 3002 |
| **IP Docker** | 172.18.0.1 |
| **Tecnologia** | Express + PDFKit + ExcelJS |
| **Funcion** | Generar PDFs y Excel |

**Endpoints:**
| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | `/api/health` | Estado del servicio |
| POST | `/api/generar-guias` | Generar PDF de guias |
| POST | `/api/generar-excel-envia` | Generar Excel |
| GET | `/api/descargar/:file` | Descargar archivo |
| GET | `/api/listar-pdfs` | Listar archivos |

### 7.2 robot-coordinadora

| Caracteristica | Valor |
|----------------|-------|
| **Ubicacion** | `/Agentes Logistica/robot-coordinadora/` |
| **Puerto** | 3001 |
| **IP Docker** | 172.17.0.1 |
| **Tecnologia** | Express + Playwright |
| **Funcion** | Crear pedidos en TMS Coordinadora |

**Endpoints:**
| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | `/api/health` | Estado del servicio |
| POST | `/api/validar-pedidos` | Validar municipios |
| POST | `/api/crear-pedidos-batch` | Crear pedidos |

### 7.3 bigin-robot-api-rest

| Caracteristica | Valor |
|----------------|-------|
| **Ubicacion** | `/bigin-robot-api-rest/` |
| **Puerto** | 3000 |
| **Tecnologia** | Express + Zoho API |
| **Funcion** | Crear ordenes en Bigin via API |

**Endpoints:**
| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | `/health` | Estado del servicio |
| POST | `/bigin/create-order` | Crear orden en CRM |

---

## 8. ALMACENAMIENTO DE ARCHIVOS

### Configuracion

| Parametro | Valor |
|-----------|-------|
| **Directorio** | `/opt/n8n/local-files/` |
| **Servidor** | Caddy |
| **Protocolo** | HTTPS |
| **URL publica** | `https://tu-dominio.com/files/` |

### Permisos
```bash
chmod 755 /opt/n8n/local-files/
chown -R node:node /opt/n8n/local-files/
```

### Configuracion Caddy
```caddyfile
tu-dominio.com {
    # Webhook n8n
    handle /webhook/* {
        reverse_proxy localhost:5678
    }

    # Archivos generados
    handle /files/* {
        root * /opt/n8n/local-files
        file_server
    }

    # n8n UI
    handle /* {
        reverse_proxy localhost:5678
    }
}
```

---

## 9. AUTENTICACION Y SEGURIDAD

### 9.1 Credenciales requeridas

| Servicio | Tipo | Variables |
|----------|------|-----------|
| Zoho Bigin | OAuth2 | CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN |
| Anthropic | API Key | ANTHROPIC_API_KEY |
| Slack | Bot Token | SLACK_BOT_TOKEN |
| Callbell | Bearer Token | CALLBELL_API_KEY |

### 9.2 Flujo OAuth Zoho

```
1. Refresh token almacenado en n8n
         │
         ▼
2. POST https://accounts.zoho.com/oauth/v2/token
   Body: grant_type=refresh_token&...
         │
         ▼
3. Recibe access_token (valido 1 hora)
         │
         ▼
4. Header: Authorization: Zoho-oauthtoken [token]
```

### 9.3 Tags de bloqueo

Etiquetas que bloquean procesamiento de mensajes:

| Tag | Significado |
|-----|-------------|
| `WPP` | Orden creada via WhatsApp |
| `P/W` | Proceso web pendiente |
| `RECO` | Remarketing manual |
| `bot_off` | Bot deshabilitado |

---

## 10. COMANDOS DE OPERACION

### 10.1 Comandos Slack

| Comando | Accion |
|---------|--------|
| `subir ordenes coord` | Crear pedidos en Coordinadora |
| `generar guias inter` | Generar PDF Interrapidisimo |
| `generar guias bogota` | Generar PDF Bogota |
| `generar excel envia` | Generar Excel Envia |

### 10.2 Comandos de mantenimiento

```bash
# Ver estado de robots
curl http://localhost:3001/api/health  # Coordinadora
curl http://localhost:3002/api/health  # Inter/Envia/Bog

# Reiniciar robots (PM2)
pm2 restart robot-guias
pm2 restart robot-coord

# Ver logs
pm2 logs robot-guias
pm2 logs robot-coord

# Matar proceso por puerto
lsof -i :3002 -t | xargs kill -9
```

---

## 11. DESPLIEGUE

### 11.1 Requisitos

| Componente | Version minima |
|------------|----------------|
| Node.js | 18.x |
| Docker | 20.x |
| PostgreSQL | 14.x |
| Caddy | 2.x |

### 11.2 Instalacion robots

```bash
# Robot Inter/Envia/Bog
cd /Agentes\ Logistica/robot-inter-envia-bog
npm install
npm run dev  # Desarrollo
pm2 start npm --name "robot-guias" -- run dev  # Produccion

# Robot Coordinadora
cd /Agentes\ Logistica/robot-coordinadora
npm install
npm run dev  # Desarrollo
pm2 start npm --name "robot-coord" -- run dev  # Produccion
```

### 11.3 Variables de entorno

```env
# robot-inter-envia-bog
PORT=3002
OUTPUT_DIR=/opt/n8n/local-files

# robot-coordinadora
PORT=3001
HEADLESS=true

# bigin-robot-api-rest
PORT=3000
ZOHO_CLIENT_ID=xxx
ZOHO_CLIENT_SECRET=xxx
ZOHO_REFRESH_TOKEN=xxx
```

---

## 12. TROUBLESHOOTING

| Problema | Causa | Solucion |
|----------|-------|----------|
| EADDRINUSE | Puerto ocupado | `lsof -i :3002 -t \| xargs kill -9` |
| Connection Refused | IP incorrecta | Usar 172.18.0.1 o 172.17.0.1 |
| Token 401 | Token expirado | Workflow hace refresh automatico |
| PDF no genera | Permisos | `chmod 755 /opt/n8n/local-files/` |
| Timeout Claude | Query muy grande | Aumentar timeout a 60s+ |
| Stage no existe | Case-sensitive | Verificar Stage exacto en Bigin |

---

## 13. MONITOREO

### Metricas sugeridas

| Metrica | Descripcion |
|---------|-------------|
| Mensajes procesados/hora | Volumen de WhatsApp |
| Ordenes creadas/dia | Conversion |
| Guias generadas/dia | Operacion logistica |
| Tiempo respuesta Claude | Latencia IA |
| Errores por workflow | Salud del sistema |

### Logs importantes

```bash
# n8n
docker logs n8n_container -f

# PostgreSQL
docker logs postgres_container -f

# Robots
pm2 logs robot-guias
pm2 logs robot-coord
```

---

## 14. ESCALABILIDAD

### Cuellos de botella identificados

| Componente | Limite | Mitigacion |
|------------|--------|------------|
| Claude API | Rate limits | Cache Redis, colas |
| PostgreSQL | Conexiones | Connection pooling, replicas |
| Callbell | Rate limits | Throttling, colas |
| Playwright | Memoria | Pool de browsers |

### Mejoras propuestas para MorfX

- **Multi-tenant**: Configuracion por empresa
- **Multi-canal**: WhatsApp, Telegram, Instagram
- **CRM agnostico**: Adaptadores para Hubspot, Salesforce
- **Bus de eventos**: Observabilidad centralizada
- **A/B testing**: Plantillas de respuesta

---

## 15. REFERENCIAS

### Repositorio
- [AGENTES-IA-FUNCIONALES-v3](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3)

### Documentacion interna
- [Arquitectura General](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/architecture/ARQUITECTURA-GENERAL.md)
- [Arquitectura Logistica](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/ARQUITECTURA.md)
- [Workflows docs](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/tree/master/docs)

### APIs externas
- [n8n Documentation](https://docs.n8n.io)
- [Bigin API](https://www.bigin.com/developer/docs/apis/)
- [Claude API](https://docs.anthropic.com/claude/reference)
- [Callbell API](https://docs.callbell.eu)
