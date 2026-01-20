# Funciones Pendientes para el Robot Bigin

Esta carpeta contiene las especificaciones de funciones que se implementarán en el futuro para el robot de automatización de Bigin CRM.

## Funciones Actuales Implementadas ✅

1. **createOrder** - Crear órdenes en Bigin CRM
   - Llena todos los campos requeridos: Orden Name, Stage, Closing Date, Amount, etc.
   - Llena el campo Description (obligatorio) usando `getElementById('Description')`
   - Maneja sesiones con cookies guardadas
   - Verifica que el formulario se guarde correctamente

2. **findLead** - Buscar leads en Bigin CRM
3. **createLead** - Crear leads en Bigin CRM
4. **addNote** - Agregar notas a registros
5. **logout** - Cerrar sesión del navegador

## Funciones Pendientes por Implementar 📋

### 1. Actualizar Orden (updateOrder)
- Buscar una orden existente por nombre o ID
- Actualizar campos específicos
- Cambiar el Stage de la orden
- Actualizar el monto o fecha de cierre

### 2. Buscar Orden (findOrder)
- Buscar órdenes por nombre
- Buscar órdenes por monto
- Buscar órdenes por stage
- Buscar órdenes por rango de fechas

### 3. Eliminar Orden (deleteOrder)
- Buscar orden
- Eliminar orden con confirmación

### 4. Agregar Producto a Orden (addProductToOrder)
- Buscar orden
- Agregar productos con cantidad y precio

### 5. Actualizar Contact en Orden (updateOrderContact)
- Buscar orden
- Asignar o cambiar el contacto asociado

### 6. Cambiar Stage de Orden (changeOrderStage)
- Buscar orden
- Mover a un stage diferente (Agendado, Falta Info, Falta Confirma, Cancela, etc.)

### 7. Subir Archivo a Orden (uploadFileToOrder)
- Buscar orden
- Subir archivo adjunto (PDF, imagen, etc.)

### 8. Crear Actividad/Tarea (createTask)
- Crear tarea asociada a una orden
- Establecer fecha de vencimiento
- Asignar responsable

### 9. Actualizar Lead (updateLead)
- Buscar lead
- Actualizar campos

### 10. Convertir Lead a Orden (convertLeadToOrder)
- Buscar lead
- Convertir a orden en el pipeline correspondiente

## Notas de Implementación

- Todas las funciones deben usar la sesión guardada en cookies
- Verificar que los cambios se guarden correctamente antes de confirmar éxito
- Usar selectores específicos con IDs cuando estén disponibles
- Disparar eventos JavaScript (input, change, blur) al llenar campos
- Tomar screenshots antes/después de cada operación crítica

## Ubicación de Archivos

- Adapter principal: `/packages/adapters/bigin/src/bigin-adapter.ts`
- Selectores: `/packages/adapters/bigin/src/selectors.ts`
- Tipos: `/packages/adapters/bigin/src/types.ts`
- API: `/packages/robot-api/src/routes/bigin.ts`
- Backups: `/backups/`
