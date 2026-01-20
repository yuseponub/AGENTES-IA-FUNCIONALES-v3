# 📋 Análisis y Plan de Reestructuración de Intents v3DSL

**Fecha:** 2026-01-20
**Estado:** PENDIENTE - Guardar para implementación futura
**Autor:** Claude Opus 4.5 + yuseponub

---

## 🎯 RESUMEN EJECUTIVO

### Lo que funciona MUY BIEN (NO TOCAR):
- Flujo transaccional: `hola → precio → captura_datos → ofrecer_promos → resumen → confirmar`
- Sistema `_intents_vistos` con validaciones
- Sistema `primera_vez/siguientes` para plantillas
- Delays realistas (simula humano)
- Templates de Callbell con imágenes
- Prevención de interrupciones (version check)
- Combinaciones `hola+X`
- Tasa de conversión: ~70%

### Lo que falta (AGREGAR):
- Soft intents (mensajes vagos)
- Mejores patrones de selección de pack
- Intents de objeciones
- Intents contextuales
- (Opcional) Intents post-venta

---

## 🏗️ TAXONOMÍA PROPUESTA DE INTENTS

### 4 Tipos de Intent:

```
1. SOFT      → Mensajes vagos, ignorables, piden aclaración
2. INTENT    → Informativos con respuesta directa (actuales)
3. ACTION    → Transaccionales que cambian estado (actuales)
4. META      → Control de flujo: fallback, no_interesa (actuales)
```

### Características por Tipo:

| Tipo | Prioridad | Ignorable | Cambia Estado | Ejemplo |
|------|-----------|-----------|---------------|---------|
| soft | 0 (baja) | Sí | No | "tengo una duda", "ok", "gracias" |
| intent | 1 | No | No | "precio", "envio", "como_se_toma" |
| action | 2 | No | Sí | "captura_datos", "resumen_2x" |
| meta | 3 (alta) | No | Especial | "fallback", "no_interesa" |

---

## 📊 INTENTS ACTUALES CLASIFICADOS

### INTENT (Informativos) - 14 existentes:
- hola, precio, info_promociones, contenido_envase
- como_se_toma, modopago, modopago2, metodos_de_pago
- envio, invima, ubicacion, contraindicaciones, sisirve

### ACTION (Transaccionales) - 6 existentes:
- captura_datos_si_compra → Inicia collecting_data
- ofrecer_promos → Auto cuando 8 campos
- resumen_1x, resumen_2x, resumen_3x → Auto cuando pack
- compra_confirmada → Crea pedido

### META (Control) - 3 existentes:
- fallback → Escala a humano
- no_confirmado → No confirma compra
- no_interesa → Rechaza

### COMBINADOS - 11 existentes:
- hola+precio, hola+como_se_toma, hola+envio, hola+modopago
- hola+captura_datos_si_compra, hola+info_promociones
- hola+contenido_envase, hola+invima, hola+contraindicaciones
- hola+ubicacion, hola+sisirve

---

## ⚠️ GAPS IDENTIFICADOS

### 1. Soft Intents (NO EXISTEN)
```
"tengo una duda"    → Fallback (debería: pedir aclaración)
"ok" (sin contexto) → Ambiguo
"gracias"           → No responde
"aja", "entiendo"   → No responde
```

### 2. Selección de Pack (PATRONES LIMITADOS)
```
"1", "2", "3"           → A veces falla
"el más barato"         → No detecta
"el segundo"            → No detecta
"el del medio"          → No detecta
```

### 3. Contextual Intents (NO EXISTEN)
```
"cuánto demora en llegar?" → Necesita ciudad
"cuánto dura?"             → Ambiguo (frasco vs efecto)
```

### 4. Objeciones (NO EXISTEN)
```
"está caro"            → Fallback
"déjame pensarlo"      → Parcial
"no tengo plata ahora" → Fallback
```

### 5. Post-Venta (NO EXISTE)
```
"no me ha llegado"       → Fallback
"cambiar dirección"      → Fallback
"cuál es mi guía?"       → Fallback
```

---

## 🆕 NUEVOS INTENTS PROPUESTOS

### SOFT INTENTS (6 nuevos):

```json
{
  "duda_generica": {
    "type": "soft",
    "regex": "(?i)(tengo una (duda|pregunta|inquietud)|una pregunta|consulta)",
    "respuesta": "Claro que sí! ¿Qué te gustaría saber sobre el Elixir del Sueño? 😊"
  },
  "reconocimiento": {
    "type": "soft",
    "regex": "(?i)^(ok|aja|ah ok|ya veo|entiendo|mmm)$",
    "respuesta": "¿Tienes alguna otra pregunta sobre el producto? 😊"
  },
  "agradecimiento": {
    "type": "soft",
    "regex": "(?i)(gracias|muchas gracias|te agradezco)",
    "respuesta": "Con gusto! ¿Hay algo más en lo que pueda ayudarte? 🤍"
  },
  "interes_vago": {
    "type": "soft",
    "regex": "(?i)(me interesa|estoy interesado|suena bien)",
    "respuesta": "Qué bueno! ¿Qué te gustaría saber primero? ¿El precio, cómo funciona, o cómo hacer el pedido?"
  },
  "mas_info_vago": {
    "type": "soft",
    "regex": "(?i)(más info|más información|cuéntame más|dame más)",
    "respuesta": "Con gusto! ¿Sobre qué aspecto te gustaría más información? Precio, modo de uso, envíos, o efectos?"
  },
  "disponibilidad_vaga": {
    "type": "soft",
    "regex": "(?i)(tienen disponible|hay stock|lo tienen)",
    "respuesta": "Sí! Tenemos disponibilidad inmediata ✅ ¿Te gustaría conocer el precio o prefieres que te cuente cómo funciona?"
  }
}
```

### INTENTS DE OBJECIÓN (4 nuevos):

```json
{
  "precio_caro": {
    "type": "intent",
    "regex": "(?i)(está caro|muy costoso|es caro|precio alto|no me alcanza)",
    "respuesta": "Entiendo tu preocupación. Ten en cuenta que cada frasco dura 3 meses y te ayuda a descansar mejor cada noche. Además con el pack 2x ahorras $45,900 💰"
  },
  "pensar_despues": {
    "type": "meta",
    "regex": "(?i)(déjame pensarlo|lo pienso|después te aviso|después lo compro|mañana)",
    "respuesta": "Claro que sí! Recuerda que el envío es gratis y pagas al recibir. Aquí estaré cuando estés listo 😊"
  },
  "desconfianza": {
    "type": "intent",
    "regex": "(?i)(es real|es confiable|es estafa|es seguro|fraude)",
    "respuesta": "Somos una empresa 100% legítima ✅ Tenemos registro INVIMA, enviamos a toda Colombia, y el pago es contraentrega (pagas al recibir). ¿Te gustaría hacer tu pedido?"
  },
  "vale_la_pena": {
    "type": "intent",
    "regex": "(?i)(vale la pena|me conviene|es bueno|funciona de verdad)",
    "respuesta": "Claro que sí! El Elixir del Sueño funciona regulando tu ciclo de sueño naturalmente. Verás resultados en 3-7 días. ¿Te gustaría probarlo?"
  }
}
```

### CONTEXTUAL INTENTS (3 nuevos):

```json
{
  "tiempo_entrega": {
    "type": "contextual",
    "regex": "(?i)(cuándo llega|cuánto demora|tiempo de entrega|días de envío)",
    "requiere": ["ciudad"],
    "si_tiene_ciudad": "A {{ciudad}} demora aproximadamente {{dias}} días hábiles 📦",
    "si_no_tiene": "¿A qué ciudad sería el envío? 🚚"
  },
  "duracion_ambigua": {
    "type": "intent",
    "regex": "(?i)(cuánto dura|para cuánto tiempo|duración)",
    "respuesta": "El frasco contiene 90 comprimidos que te duran 3 meses (1 diario). El efecto lo verás desde los primeros 3-7 días 😴"
  },
  "envio_ciudad": {
    "type": "contextual",
    "regex": "(?i)(envían a|llegan a|cobertura en) ([A-Za-záéíóúñÁÉÍÓÚÑ]+)",
    "extraer": "ciudad",
    "respuesta": "Sí! Enviamos a {{ciudad}} 🚚 El envío es gratis. ¿Te gustaría hacer tu pedido?"
  }
}
```

### MEJORAS SELECCIÓN DE PACK:

```javascript
// Agregar a regex de detección de pack en State Analyzer:
const packPatterns = {
  '1x': /(?i)(^1$|1x|uno|el primero|el más barato|el sencillo|pack 1|un frasco)/,
  '2x': /(?i)(^2$|2x|dos|el segundo|el del medio|pack 2|dos frascos)/,
  '3x': /(?i)(^3$|3x|tres|el tercero|el más grande|el completo|pack 3|tres frascos)/
};
```

---

## 📐 ESTRUCTURA DE ARCHIVOS PROPUESTA

### `/plantillas/intents.json` (actualizado):

```json
{
  "version": "2.0.0",
  "description": "Intents con clasificación por tipo",

  "intent_types": {
    "soft": {
      "description": "Mensajes vagos que piden aclaración",
      "priority": 0,
      "ignorable": true,
      "changes_state": false
    },
    "intent": {
      "description": "Informativos con respuesta directa",
      "priority": 1,
      "ignorable": false,
      "changes_state": false
    },
    "action": {
      "description": "Transaccionales que cambian estado",
      "priority": 2,
      "ignorable": false,
      "changes_state": true
    },
    "meta": {
      "description": "Control de flujo especial",
      "priority": 3,
      "ignorable": false,
      "changes_state": "special"
    }
  },

  "intents": {
    // Cada intent existente + type
    // + nuevos intents
  }
}
```

### Base de datos (opcional):

```sql
-- Agregar campo en messages_v3
ALTER TABLE messages_v3 ADD COLUMN intent_type VARCHAR(20);

-- Agregar en sessions_v3.state
{
  "_last_intent_type": "action",
  "_soft_intents_pendientes": []
}
```

---

## 🔄 METODOLOGÍAS QUE FUNCIONAN (RESCATAR)

### 1. BANT Lite (Calificación Rápida)
- **B**udget: ¿Preguntó precio? ✓
- **A**uthority: N/A (low ticket, decide solo)
- **N**eed: ¿Expresó interés? ("quiero comprar")
- **T**imeline: ¿Urgencia? ("lo necesito ya")

**Implementación:** Agregar flags en state
```json
{
  "bant": {
    "budget_checked": true,
    "need_expressed": true,
    "urgency": false
  }
}
```

### 2. AIDA (Funnel de Conversión)
```
A - Attention  → hola, saludo
I - Interest   → precio, como_se_toma, sisirve
D - Desire     → info_promociones, ofrecer_promos
A - Action     → captura_datos, resumen_Xx, compra_confirmada
```

**Implementación:** Agregar `funnel_stage` en state
```json
{
  "_funnel_stage": "desire"  // attention, interest, desire, action
}
```

### 3. Objection Handling (4 pasos)
```
1. Acknowledge → Reconocer objeción
2. Clarify     → Hacer pregunta si necesario
3. Respond     → Dar valor que resuelve
4. Confirm     → Verificar si se resolvió
```

**Implementación:** Plantillas de objeción incluyen los 4 pasos

### 4. Sistema primera_vez/siguientes (YA FUNCIONA)
- Primera vez: Info completa (3-4 mensajes)
- Siguientes: Info concisa (1-2 mensajes)

### 5. Validaciones Transaccionales (YA FUNCIONA)
```
ofrecer_promos    → REQUIERE 8 campos
resumen_Xx        → REQUIERE ofrecer_promos visto
compra_confirmada → REQUIERE resumen_Xx visto
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Fase 1: Soft Intents (1-2 días)
- [ ] Agregar 6 soft intents nuevos
- [ ] Agregar 6 plantillas nuevas
- [ ] Modificar State Analyzer para detectar type
- [ ] Testing

### Fase 2: Selección de Pack (1 día)
- [ ] Mejorar regex de detección de pack
- [ ] Testing con "1", "el segundo", "el más barato"

### Fase 3: Objeciones (1-2 días)
- [ ] Agregar 4 intents de objeción
- [ ] Agregar 4 plantillas
- [ ] Testing

### Fase 4: Contextual (2-3 días)
- [ ] Implementar tiempo_entrega con directorio municipios
- [ ] Agregar lógica de "requiere contexto"
- [ ] Testing

### Fase 5: Métricas (1 día)
- [ ] Agregar intent_type a messages_v3
- [ ] Agregar funnel_stage a sessions_v3.state
- [ ] Dashboard básico

---

## 📈 MÉTRICAS ESPERADAS POST-IMPLEMENTACIÓN

| Métrica | Actual | Esperado |
|---------|--------|----------|
| Conversión total | ~70% | ~75-80% |
| Fallback rate | ~15% | ~5% |
| Mensajes antes de compra | 8-12 | 6-10 |
| Satisfacción (estimada) | Buena | Excelente |

---

## 🔗 REFERENCIAS

### Documentación del Sistema:
- `/docs/ARQUITECTURA-GENERAL.md`
- `/docs/01-HISTORIAL-V3.md`
- `/docs/02-CAROLINA-V3.md`
- `/docs/03-STATE-ANALYZER.md`
- `/docs/04-DATA-EXTRACTOR.md`

### Archivos de Plantillas:
- `/plantillas/intents.json`
- `/plantillas/mensajes.json`

### Investigación de Frameworks:
- AIDA Model (HubSpot, Shopify)
- BANT/SPIN Sales (Dialpad, Claap)
- Intent Classification (AIMultiple, Tidio)
- Objection Handling (Apollo, SalesHive)
- WhatsApp Commerce LATAM (Infobip, Hello24)

---

## ✅ CHECKLIST PRE-IMPLEMENTACIÓN

- [ ] Bot actual funcionando estable
- [ ] Backup de intents.json y mensajes.json
- [ ] Ambiente de testing configurado
- [ ] Métricas baseline documentadas
- [ ] Tiempo disponible para testing (2-3 días)

---

**Última actualización:** 2026-01-20
**Próxima revisión:** Cuando el bot actual esté estable
