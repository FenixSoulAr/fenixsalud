# Criterios UX Obligatorios - Mi Salud

Este documento define los estándares de experiencia de usuario que deben aplicarse de forma consistente en toda la aplicación.

## 1. Feedback Visible en Acciones

**Regla**: Toda acción del usuario debe tener feedback visual inmediato.

| Acción | Feedback |
|--------|----------|
| Guardar | Toast "Cambios guardados." |
| Eliminar | Toast "Eliminado." |
| Marcar toma | Toast "Toma registrada." |
| Deshacer | Toast "Toma deshecha." |
| Cambiar perfil | Toast "Ahora estás viendo el perfil de {{name}}." |
| Error | Toast "Algo salió mal. Por favor, intentá nuevamente." |
| Plan limitado | Toast "Esta acción está limitada por tu plan actual." |

**Implementación**: Usar `t().toast.*` para todos los mensajes.

## 2. Guardar Cierra la Pantalla

**Regla**: Al guardar exitosamente, el modal/drawer debe cerrarse automáticamente.

**Implementación**:
- Usar `justSavedRef` para evitar reapertura por efectos
- Limpiar parámetros URL (`?new=`, `?edit=`)
- Delay de 300-800ms antes de cerrar para feedback visual

## 3. Perfil Activo Siempre Visible

**Regla**: El nombre del perfil activo y su tipo/plan deben verse en todo momento.

**Ubicaciones**:
- **Sidebar**: `ActiveProfileIndicator` con nombre, rol y badge de plan
- **Banner**: `ActiveProfileBanner` en páginas de salud con rol
- **Tooltip**: Al hacer hover, mostrar detalles del plan/expiración

**Roles visibles**:
- `Propietario` - Perfil propio
- `Familiar` - Perfil familiar (user_id = null)
- `Colaborador` - Acceso compartido con edición
- `Solo lectura` - Acceso compartido sin edición

## 4. Estados con Acciones Coherentes

**Regla**: Cada estado visible debe tener una acción lógica asociada.

| Estado | Acción Disponible |
|--------|-------------------|
| Medicación "Pendiente" | "Marcar como tomado" |
| Medicación "Tomado" (hoy) | "Deshacer" |
| Medicación "Omitido" | Sin acción (pasado) |
| Cita "Próxima" | "Editar" / "Ver" |
| Diagnóstico "Activo" | "Editar" / "Resolver" |

## 5. Orden de Medicación

**Regla**: Los recordatorios de medicación siguen un orden de prioridad:

1. **Vencidos (Missed)** - Tomas pasadas no registradas
2. **Próxima toma (Next)** - La siguiente hora programada
3. **Futuras (Pending)** - Horas posteriores del día

**Implementación**: `TodayMedicationIntakes` agrupa por estos estados.

## 6. Historial con Fecha y Hora

**Regla**: El historial de medicación debe mostrar:
- Fecha programada (dd/MM)
- Hora programada (HH:mm)
- Hora real de toma (si aplica)
- Estado (A tiempo / Tomado tarde)

**Ejemplo visual**:
```
Programado: 26/01 19:00
Tomado: 19:05 ✓ A tiempo
```

## 7. Deshacer Solo si Reversible

**Regla**: La acción "Deshacer" solo está disponible cuando es seguro revertir.

**Criterios**:
- ✅ Tomas del día actual → Deshacer habilitado
- ❌ Tomas de días anteriores → Sin opción de deshacer

**Feedback**: Al deshacer, la toma vuelve inmediatamente a "Pendiente" en la UI.

## 8. Sin Errores Técnicos

**Regla**: Nunca mostrar mensajes técnicos, códigos de error o stack traces.

**Mensajes permitidos**:
- ✅ "Algo salió mal. Por favor, intentá nuevamente."
- ✅ "No pudimos guardar tu perfil. Por favor, intentá de nuevo."
- ❌ "Error 42501: RLS policy violation"
- ❌ "TypeError: Cannot read property 'x' of undefined"

**Logging**: Los errores técnicos se registran en `console.error` con detalles completos para debugging.

## 9. Pantallas Vacías con Guía

**Regla**: Cuando no hay datos, mostrar:
- Icono ilustrativo
- Título explicativo
- Descripción breve
- **Acción primaria** para crear el primer registro

**Ejemplo**:
```tsx
<EmptyState
  icon={Calendar}
  title={t().appointments.noAppointments}
  description={t().appointments.noAppointmentsDescription}
  action={{
    label: t().appointments.addAppointment,
    onClick: () => setIsCreating(true)
  }}
/>
```

---

## Checklist de Implementación

Antes de enviar cualquier cambio, verificar:

- [ ] ¿Todas las acciones tienen toast de feedback?
- [ ] ¿Los modales se cierran al guardar exitosamente?
- [ ] ¿El perfil activo es visible en la pantalla?
- [ ] ¿Los estados tienen acciones coherentes?
- [ ] ¿Las pantallas vacías tienen CTA?
- [ ] ¿Los mensajes de error son amigables?
- [ ] ¿El orden de medicación es correcto?
- [ ] ¿El historial muestra hora programada y real?
