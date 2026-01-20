# 📋 Plantillas de Carolina - Guía de Actualización

## 🗂️ Ubicación de los archivos

### En GitHub (v3dsl-bot)
```
/root/v3dsl-bot/plantillas/
├── intents.json      # Definición de intents y respuestas
└── mensajes.json     # Textos de los mensajes
```

### En n8n (Docker)
```
Host:      /opt/n8n/local-files/plantillas/
Container: /files/plantillas/
```

Carolina (workflow de n8n) lee desde: `/files/plantillas/`

---

## 🔄 Cómo actualizar las plantillas desde GitHub

### ✨ Automático (Recomendado)

Gracias al **git hook** configurado, solo necesitas hacer:

```bash
cd /root/v3dsl-bot
git pull origin master
```

**¡Eso es todo!** El hook automáticamente:
- ✅ Detecta si hay cambios en `plantillas/`
- ✅ Ejecuta el script de sincronización
- ✅ Copia **TODOS** los archivos de `plantillas/` a n8n

**Ejemplo de output:**
```
🔄 Git Hook: Sincronizando plantillas a n8n...
✅ Cambios detectados en plantillas/
🔄 Sincronizando plantillas de GitHub → n8n...
'/root/v3dsl-bot/plantillas/festivos_colombia.json' -> '/opt/n8n/local-files/plantillas/festivos_colombia.json'
'/root/v3dsl-bot/plantillas/intents.json' -> '/opt/n8n/local-files/plantillas/intents.json'
'/root/v3dsl-bot/plantillas/mensajes.json' -> '/opt/n8n/local-files/plantillas/mensajes.json'
'/root/v3dsl-bot/plantillas/tiempos_entrega_municipios.json' -> '/opt/n8n/local-files/plantillas/tiempos_entrega_municipios.json'
✅ Plantillas sincronizadas
```

### 🔧 Manual (Si prefieres control explícito)

```bash
cd /root/v3dsl-bot
git pull origin master
./sync-plantillas.sh
```

---

## 📝 Editar plantillas

### Opción 1: Editar en GitHub (RECOMENDADO)
1. Edita los archivos en tu repositorio GitHub
2. Haz commit y push
3. En el servidor: `git pull && ./sync-plantillas.sh`

### Opción 2: Editar directamente en el servidor
```bash
# Editar archivo
nano /root/v3dsl-bot/plantillas/mensajes.json

# Sincronizar a n8n
/root/v3dsl-bot/sync-plantillas.sh

# Commitear cambios (opcional)
cd /root/v3dsl-bot
git add plantillas/
git commit -m "Update mensajes"
git push origin master
```

---

## 🧪 Verificar que Carolina lee los archivos correctos

Ejecuta este comando para ver qué archivos está leyendo n8n:

```bash
ls -lh /opt/n8n/local-files/plantillas/
```

Deberías ver:
- `intents.json`
- `mensajes.json`

---

## ⚠️ Importante

- **NUNCA** edites directamente `/opt/n8n/local-files/plantillas/` → Edita en GitHub
- Siempre ejecuta `sync-plantillas.sh` después de `git pull`
- Los cambios en plantillas NO requieren reiniciar n8n
- Los cambios aplican inmediatamente en el siguiente mensaje

---

## 🔍 Troubleshooting

### Carolina sigue enviando mensajes viejos
```bash
# Verificar fecha de modificación
ls -lh /opt/n8n/local-files/plantillas/mensajes.json

# Forzar sincronización
/root/v3dsl-bot/sync-plantillas.sh
```

### Los archivos no se actualizan
```bash
# Verificar permisos
ls -la /opt/n8n/local-files/plantillas/

# Si hay problemas de permisos
chmod 644 /opt/n8n/local-files/plantillas/*.json
```
