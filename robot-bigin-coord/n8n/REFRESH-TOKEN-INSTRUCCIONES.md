# Refresh Token de Bigin - Instrucciones

## El Problema
El access_token de Zoho/Bigin **expira cada hora**. Cuando expira, las llamadas a la API fallan con error `INVALID_TOKEN`.

## Solución: Refresh Automático

### Credenciales actuales:
```
CLIENT_ID: 1000.1O753Z59ILMC38F7RO0639XVTQGNAL
CLIENT_SECRET: 0d3d0df40e7c665812a6379e660791c1ad47f75696
REFRESH_TOKEN: 1000.ffacc81e6474de4c1e55afbedad4f8ef.10de44fb974487be41421eb8a292754d
```

---

## Opción 1: Workflow Automático (Recomendado)

**Archivo:** `refresh-bigin-token.json`

Este workflow:
- Se ejecuta **cada 50 minutos** automáticamente
- También se puede ejecutar **manualmente**
- Devuelve el nuevo `access_token`

### Cómo importar:
1. En n8n: **...** → **Import from File**
2. Selecciona: `n8n/refresh-bigin-token.json`
3. **Activa** el workflow (switch arriba a la derecha)

### Output:
```json
{
  "status": "success",
  "access_token": "1000.xxxxx.xxxxx",
  "expires_at": "2026-01-21T20:00:00.000Z"
}
```

---

## Opción 2: Sub-Workflow (Para llamar antes de Bigin)

**Archivo:** `bigin-get-token-subworkflow.json`

Este sub-workflow se puede **llamar desde otros workflows** usando el nodo "Execute Workflow".

### Cómo usar:
1. Importa `bigin-get-token-subworkflow.json`
2. En tu workflow principal, agrega nodo **"Execute Workflow"**
3. Selecciona el workflow **"[Sub] Bigin - Get Fresh Token"**
4. El nodo devuelve:
```json
{
  "access_token": "1000.xxxxx.xxxxx",
  "authorization": "Zoho-oauthtoken 1000.xxxxx.xxxxx"
}
```
5. Usa `{{ $json.authorization }}` en el header de tus HTTP Request a Bigin

### Ejemplo de uso en HTTP Request:
```
Header: Authorization = {{ $('Execute Workflow').item.json.authorization }}
```

---

## Opción 3: HTTP Request Manual

Si necesitas refrescar el token manualmente con curl:

```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "refresh_token=1000.ffacc81e6474de4c1e55afbedad4f8ef.10de44fb974487be41421eb8a292754d" \
  -d "client_id=1000.1O753Z59ILMC38F7RO0639XVTQGNAL" \
  -d "client_secret=0d3d0df40e7c665812a6379e660791c1ad47f75696" \
  -d "grant_type=refresh_token"
```

Respuesta:
```json
{
  "access_token": "1000.nuevo_token_aqui.xxx",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

## Integración con Workflow de Coordinadora

Para que el workflow de Coordinadora siempre tenga un token válido:

### Flujo recomendado:
```
Slack Trigger → Get Fresh Token → Bigin API → Claude → Robot Coordinadora
```

1. Abre `workflow-coordinadora.json`
2. Agrega nodo **"Execute Workflow"** después del trigger de Slack
3. Conecta a **"[Sub] Bigin - Get Fresh Token"**
4. En el nodo de Bigin HTTP Request, usa:
   - Header: `Authorization` = `{{ $('Execute Workflow').item.json.authorization }}`

---

## Troubleshooting

### Error: "invalid_code" o "invalid_client"
- Verifica que el `refresh_token` sea válido
- Puede que necesites regenerarlo en https://api-console.zoho.com/

### Error: "INVALID_TOKEN" en Bigin API
- El access_token expiró
- Ejecuta el workflow de refresh manualmente
- Verifica que el workflow automático esté activo

### El refresh_token expiró
Los refresh_token de Zoho **no expiran** mientras se usen regularmente. Si llevas mucho tiempo sin usarlo:
1. Ve a https://api-console.zoho.com/
2. Crea un nuevo Self Client
3. Genera nuevos tokens con scope `ZohoBigin.modules.ALL`
4. Actualiza los valores en los workflows
