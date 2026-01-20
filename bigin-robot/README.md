# 🤖 Modelo IA Distribuida - Robot Base + Bigin Adapter

Sistema de robots que operan CRMs y plataformas logísticas.

## 📁 Estructura del Proyecto

```
modelo-ia-distribuida/
├── packages/
│   ├── robot-base/              # Core del robot (Playwright, screenshots, sessions)
│   └── adapters/
│       └── bigin/               # Adapter para Bigin CRM (Zoho) - TEMPORAL
├── apps/
│   └── orchestrator-api/        # API (próximo)
└── storage/
    ├── artifacts/               # Screenshots
    ├── logs/                    # Logs
    └── sessions/                # Cookies guardadas
```

## 🚀 Setup Rápido

### 1. Instalar dependencias

```bash
cd /home/n8n-claude/proyectos/modelo-ia-distribuida

# Instalar root
npm install

# Instalar packages
npm install --workspace=@modelo-ia/robot-base
npm install --workspace=@modelo-ia/adapter-bigin

# Instalar Playwright browsers
cd packages/robot-base
npx playwright install chromium
cd ../..
```

### 2. Configurar credenciales

```bash
# Copiar ejemplo
cp .env.example .env

# Editar con tus credenciales de Bigin
nano .env
```

**.env debe contener:**
```
BIGIN_URL=https://crm.zoho.com/crm/org123456/tab/Leads
BIGIN_EMAIL=tu-email@example.com
BIGIN_PASSWORD=tu-password

STORAGE_PATH=/home/n8n-claude/proyectos/modelo-ia-distribuida/storage

PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_SLOW_MO=500

LOG_LEVEL=debug
```

### 3. Build packages

```bash
npm run build
```

### 4. Test login a Bigin

```bash
npm run test:login --workspace=@modelo-ia/adapter-bigin
```

**Deberías ver:**
- Browser abrirse
- Login automático a Bigin
- Screenshot guardado en `storage/artifacts/`
- Mensaje: ✅ Login test passed!

---

## 🧪 Tests Disponibles

### Test Login (ya creado)
```bash
npm run test:login --workspace=@modelo-ia/adapter-bigin
```

Verifica que el login funciona y guarda sesión.

---

## 📚 Próximos Pasos

### ✅ Completado:
- [x] Robot Base (Playwright, screenshots, sessions)
- [x] Bigin Adapter base
- [x] Login funcional
- [x] **🆕 Sistema de timeout de sesión (30 min)**
- [x] **🆕 Verificación de ventanas cerradas**
- [x] **🆕 Sistema de relogin automático mejorado**
- [x] **🆕 Sistema de retry con backoff exponencial**
- [x] **🆕 Notificaciones al equipo en caso de fallo**
- [x] **🆕 Campo CallBell clickeable en órdenes**
- [x] **🆕 Retorno de Order ID y URL**
- [x] Tool: `find_lead`
- [x] Tool: `add_note`
- [x] Tool: `create_order` (completo con todas las funcionalidades)

### 📋 Por hacer:
- [ ] Implementar notificaciones reales (Slack, Email, WhatsApp)
- [ ] Tool: `update_field`
- [ ] Orchestrator API
- [ ] Courier adapters
- [ ] Playbooks end-to-end

---

## 🆕 Nuevas Funcionalidades (Enero 2026)

**Ver documentación completa:** [`docs/NUEVAS-FUNCIONALIDADES.md`](docs/NUEVAS-FUNCIONALIDADES.md)

### Resumen de Mejoras:

1. **🕐 Timeout de Sesión (30 min)**: Gestión automática de sesiones con timeout de 30 minutos
2. **🪟 Verificación de Ventanas**: Detección de ventanas cerradas o sesiones perdidas
3. **🔄 Relogin Automático**: Sistema inteligente que garantiza sesión válida antes de operaciones
4. **🔁 Retry con Backoff**: Reintento automático de operaciones fallidas (max 3 intentos: 1s, 2s, 4s)
5. **🚨 Notificaciones**: Alertas al equipo cuando operaciones críticas fallan
6. **🔗 Campo CallBell**: Link de conversación de Callbell en órdenes
7. **🆔 Order ID/URL**: Retorno automático del ID y URL de órdenes creadas

### Ejemplo de Uso:

```typescript
const result = await adapter.createOrder({
  ordenName: 'Orden #12345',
  telefono: '+573001234567',
  callBell: 'https://dash.callbell.eu/chat/abc123', // ✅ Nuevo
  // ...otros campos...
});

console.log('✅ Order ID:', result.orderId);
console.log('🔗 Order URL:', result.orderUrl);
```

**Beneficios:**
- ✅ Mayor confiabilidad con retry automático
- ✅ No más sesiones expiradas
- ✅ Recuperación automática de ventanas cerradas
- ✅ Monitoreo proactivo con notificaciones
- ✅ Trazabilidad completa con Order IDs

---

## 🐛 Troubleshooting

### Error: "Playwright browser not found"
```bash
cd packages/robot-base
npx playwright install chromium
```

### Error: "Cannot find module '@modelo-ia/robot-base'"
```bash
npm run build
```

### Error: "Login failed"
- Verifica que BIGIN_URL, BIGIN_EMAIL, BIGIN_PASSWORD son correctos
- Verifica que no tienes 2FA activado en Bigin
- Revisa screenshot en `storage/artifacts/error-*.png`

### Browser no se abre (headless mode)
```bash
# En .env, cambiar a:
PLAYWRIGHT_HEADLESS=false
```

---

## 📝 Notas

- **Bigin Adapter es TEMPORAL**: Lo usamos mientras el developer crea tu CRM propio
- **Selectores pueden cambiar**: Si Zoho actualiza Bigin, necesitarás ajustar `bigin/src/selectors.ts`
- **Sessions se guardan**: Después del primer login, usa cookies guardadas (no login cada vez)

---

**Siguiente:** Implementar `find_lead` tool para buscar leads en Bigin.
