# Agentes Logistica

Sistema de automatizacion para generar guias de envio con diferentes transportadoras.

## Estructura

```
Agentes Logistica/
├── Robots Logistica.json    # Workflow n8n completo
├── robot-interrapidisimo/   # Servidor para Inter, Bogota y Envia
└── robot-coordinadora/      # Servidor para Coordinadora
```

## Transportadoras Soportadas

| Transportadora | Stage Bigin | Robot | Puerto |
|----------------|-------------|-------|--------|
| Interrapidisimo | ROBOT INTER | robot-interrapidisimo | 3002 |
| Bogota | ROBOT BOGOTA | robot-interrapidisimo | 3002 |
| Envia | ROBOT ENVIA | robot-interrapidisimo | 3002 |
| Coordinadora | ROBOT COORD | robot-coordinadora | 3001 |

## Flujo General

1. Usuario escribe comando en Slack (ej: "generar guias inter")
2. n8n filtra el mensaje y activa el flujo correspondiente
3. Se obtiene token de Bigin (Zoho)
4. Se buscan ordenes en el stage correspondiente
5. Se llama al robot para generar guias/excel
6. Se actualiza Bigin (Stage, Transportadora, Guia)
7. Se envia mensaje a Slack con resultado y link de descarga

## Comandos Slack

| Comando | Accion |
|---------|--------|
| `subir ordenes coord` | Crea pedidos en Coordinadora |
| `generar guias inter` | Genera PDF guias Interrapidisimo |
| `generar guias bogota` | Genera PDF guias Bogota |
| `generar excel envia` | Genera Excel para Envia |

## Instalacion

### 1. Robots

```bash
# Robot Interrapidisimo (puerto 3002)
cd robot-interrapidisimo
npm install
npm run dev

# Robot Coordinadora (puerto 3001)
cd robot-coordinadora
npm install
npm run dev
```

### 2. n8n

Importar `Robots Logistica.json` en n8n.

### 3. Caddy (para servir archivos)

Los archivos se generan en `/opt/n8n/local-files/` y se sirven via Caddy.
