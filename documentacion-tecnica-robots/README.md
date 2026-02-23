# Documentacion Tecnica - Robots de Logistica

> **Fecha de generacion**: Febrero 2026
> **Generado por**: Claude AI (Documentacion automatizada)

---

## Contenido de esta carpeta

Esta carpeta contiene la documentacion tecnica detallada de los robots de logistica del sistema SOMNIO v3DSL.

### Documentos disponibles

| Archivo | Descripcion |
|---------|-------------|
| [ROBOT-INTER-ENVIA-BOG.md](./ROBOT-INTER-ENVIA-BOG.md) | Documentacion completa del robot que genera PDFs y Excel para Interrapidisimo, Bogota y Envia |
| [WORKFLOW-N8N-LOGISTICA.md](./WORKFLOW-N8N-LOGISTICA.md) | Documentacion del workflow n8n que orquesta los robots de logistica |
| [INFRAESTRUCTURA-COMPLETA.md](./INFRAESTRUCTURA-COMPLETA.md) | Vision general de toda la infraestructura del sistema |

---

## Resumen del Sistema

### Componentes principales

```
┌─────────────────────────────────────────────────────────────┐
│                      SISTEMA SOMNIO                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INTERFAZ          ORQUESTACION          ROBOTS             │
│  ────────          ────────────          ──────             │
│  Slack #bots  ───▶ n8n (Docker)  ───▶ robot-inter-envia-bog │
│                          │             (puerto 3002)        │
│                          │                                  │
│                          └───────────▶ robot-coordinadora   │
│                                        (puerto 3001)        │
│                                                              │
│  BASE DE DATOS        IA                ARCHIVOS            │
│  ────────────         ──                ────────            │
│  Bigin/Zoho CRM       Claude AI         /opt/n8n/local-files│
│                       (Anthropic)       Servido por Caddy   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Transportadoras soportadas

| Transportadora | Robot | Puerto | Salida | Comando Slack |
|---------------|-------|--------|--------|---------------|
| Interrapidisimo | robot-inter-envia-bog | 3002 | PDF | `generar guias inter` |
| Bogota | robot-inter-envia-bog | 3002 | PDF | `generar guias bogota` |
| Envia | robot-inter-envia-bog | 3002 | Excel | `generar excel envia` |
| Coordinadora | robot-coordinadora | 3001 | API TMS | `subir ordenes coord` |

---

## Quick Start

### 1. Iniciar robot-inter-envia-bog
```bash
cd /Agentes\ Logistica/robot-inter-envia-bog
npm install
npm run dev
```

### 2. Verificar estado
```bash
curl http://localhost:3002/api/health
```

### 3. Probar desde Slack
```
#bots: generar guias inter
```

---

## Enlaces utiles

### Codigo fuente
- [robot-inter-envia-bog](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/tree/master/Agentes%20Logistica/robot-inter-envia-bog)
- [robot-coordinadora](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/tree/master/Agentes%20Logistica/robot-coordinadora)
- [Workflow n8n](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/Robots%20Logistica.json)

### Otra documentacion del repositorio
- [Arquitectura General](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/architecture/ARQUITECTURA-GENERAL.md)
- [Arquitectura Logistica](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/ARQUITECTURA.md)
- [Documentacion de Workflows](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/tree/master/docs)
