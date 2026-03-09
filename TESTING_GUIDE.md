# 🧪 Guía de Pruebas - Sistema de Distribución Crossdocking

## ⚠️ IMPORTANTE: Ejecutar en ambiente controlado primero

**NO probar directo en producción hasta validar todos los escenarios.**

---

## 📋 Checklist de Pruebas

### ✅ Prueba 1: Distribución Simple (Sin Duplicación)

**Objetivo:** Verificar que una distribución normal funcione correctamente sin duplicados.

**Pasos:**

1. **Preparación:**
   - Seleccionar un pallet de prueba con 1 SKU
   - Anotar valores iniciales:
     ```sql
     -- Inventario inicial del pallet
     SELECT sku, qty_available 
     FROM pallet_inventory 
     WHERE pallet_id = 'TU_PALLET_ID';
     
     -- Estado inicial de la línea de importación
     SELECT sku, tienda, qty_to_send, qty_confirmed, status 
     FROM import_lines 
     WHERE pallet_code = 'TU_PALLET_CODE' AND sku = 'TU_SKU';
     ```

2. **Ejecución:**
   - Abrir modal de distribución
   - Escanear el SKU (o ingresarlo manualmente)
   - Confirmar cantidad pequeña (ej: **2 unidades**)
   - ⏱️ **Esperar a que termine el proceso** (botón debe mostrar "Procesando...")

3. **Verificación inmediata:**
   ```sql
   -- ✅ PASO 1: Verificar inventario del pallet (debe bajar exactamente 2)
   SELECT sku, qty_available, 
          qty_available - LAG(qty_available) OVER (ORDER BY created_at DESC) as delta
   FROM pallet_inventory 
   WHERE pallet_id = 'TU_PALLET_ID' AND sku = 'TU_SKU'
   ORDER BY created_at DESC LIMIT 2;
   -- Esperado: delta = -2
   
   -- ✅ PASO 2: Verificar línea de importación (debe subir exactamente 2)
   SELECT sku, tienda, qty_confirmed, status 
   FROM import_lines 
   WHERE pallet_code = 'TU_PALLET_CODE' AND sku = 'TU_SKU';
   -- Esperado: qty_confirmed aumentó en 2, status cambió a PARTIAL o DONE
   
   -- ✅ PASO 3: Verificar líneas del contenedor (debe haber solo 1 línea nueva)
   SELECT COUNT(*) as total_lines, SUM(qty) as total_qty
   FROM container_lines 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND sku = 'TU_SKU' 
     AND created_at > NOW() - INTERVAL '1 minute';
   -- Esperado: total_lines = 1, total_qty = 2
   
   -- ✅ PASO 4: Verificar eventos (debe haber solo 1 confirmación)
   SELECT event_type, sku, qty, created_at, notes
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND event_type = 'CONFIRM_QTY'
     AND created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC;
   -- Esperado: 1 solo evento CONFIRM_QTY
   ```

4. **Resultado esperado:**
   - ✅ Inventario bajó exactamente 2
   - ✅ Confirmado subió exactamente 2
   - ✅ Solo 1 línea en container_lines
   - ✅ Solo 1 evento CONFIRM_QTY
   - ✅ Sin eventos DIST_DUPLICATE_BLOCKED

---

### ⚡ Prueba 2: Doble Enter / Doble Click (Protección Anti-Duplicado)

**Objetivo:** Verificar que la protección contra duplicados funcione correctamente.

**Pasos:**

1. **Preparación:**
   - Mismo pallet de la prueba anterior
   - Anotar valores actuales

2. **Ejecución (Caso A: Doble Enter):**
   - Escanear SKU
   - Ingresar cantidad (ej: **3 unidades**)
   - **Presionar Enter dos veces rápidamente** (< 500ms entre pulsaciones)

3. **Ejecución (Caso B: Doble Click):**
   - Escanear SKU
   - Ingresar cantidad (ej: **3 unidades**)
   - **Hacer doble click en el botón "Confirmar"**

4. **Verificación:**
   ```sql
   -- ✅ Verificar que solo se procesó 1 confirmación
   SELECT event_type, sku, qty, created_at, 
          EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as seconds_diff
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND event_type IN ('CONFIRM_QTY', 'DIST_DUPLICATE_BLOCKED')
     AND created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC;
   -- Esperado: 1 CONFIRM_QTY, posiblemente 1 DIST_DUPLICATE_BLOCKED si hubo intento duplicado
   
   -- ✅ Verificar que el inventario solo bajó 3 (no 6)
   SELECT sku, qty_available 
   FROM pallet_inventory 
   WHERE pallet_id = 'TU_PALLET_ID' AND sku = 'TU_SKU';
   -- Esperado: qty_available bajó solo 3 desde la última verificación
   
   -- ✅ Verificar líneas del contenedor (no debe haber duplicados)
   SELECT id, qty, created_at
   FROM container_lines 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND sku = 'TU_SKU' 
     AND created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC;
   -- Esperado: 1 sola línea con qty = 3
   ```

5. **Resultado esperado:**
   - ✅ Solo 1 confirmación procesada
   - ✅ Botón se bloqueó durante el procesamiento
   - ✅ Si hubo intento duplicado, aparece evento `DIST_DUPLICATE_BLOCKED`
   - ✅ Inventario bajó solo 3 (no 6)

---

### 🔄 Prueba 3: Reverso de Línea

**Objetivo:** Verificar que el reverso devuelva correctamente las cantidades y actualice estados.

**Pasos:**

1. **Preparación:**
   - Tomar una línea recién distribuida (de las pruebas anteriores)
   - Anotar valores antes del reverso:
     ```sql
     -- Estado antes del reverso
     SELECT 
       cl.id as container_line_id,
       cl.sku,
       cl.qty as qty_to_reverse,
       pi.qty_available as pallet_inventory_before,
       il.qty_confirmed as import_confirmed_before,
       il.status as import_status_before
     FROM container_lines cl
     JOIN pallet_inventory pi ON pi.pallet_id = cl.pallet_id AND pi.sku = cl.sku
     JOIN import_lines il ON il.id = cl.source_import_line_id
     WHERE cl.id = 'TU_CONTAINER_LINE_ID';
     ```

2. **Ejecución:**
   - Ir al detalle del contenedor
   - Hacer clic en "Reversar" en la línea seleccionada
   - Confirmar el reverso

3. **Verificación:**
   ```sql
   -- ✅ PASO 1: Verificar que el inventario regresó
   SELECT sku, qty_available 
   FROM pallet_inventory 
   WHERE pallet_id = 'TU_PALLET_ID' AND sku = 'TU_SKU';
   -- Esperado: qty_available = pallet_inventory_before + qty_to_reverse
   
   -- ✅ PASO 2: Verificar que qty_confirmed bajó
   SELECT sku, tienda, qty_confirmed, status 
   FROM import_lines 
   WHERE id = 'TU_IMPORT_LINE_ID';
   -- Esperado: qty_confirmed = import_confirmed_before - qty_to_reverse
   -- Esperado: status cambió correctamente (DONE → PARTIAL, PARTIAL → PENDING si quedó en 0)
   
   -- ✅ PASO 3: Verificar que la línea se eliminó del contenedor
   SELECT COUNT(*) 
   FROM container_lines 
   WHERE id = 'TU_CONTAINER_LINE_ID';
   -- Esperado: 0 (línea eliminada)
   
   -- ✅ PASO 4: Verificar evento de reverso
   SELECT event_type, sku, qty, notes
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND event_type = 'REVERSE'
     AND created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC LIMIT 1;
   -- Esperado: 1 evento REVERSE con metadata completa en notes
   ```

4. **Resultado esperado:**
   - ✅ Inventario regresó exactamente la cantidad reversada
   - ✅ qty_confirmed bajó exactamente esa cantidad
   - ✅ Estado cambió correctamente (DONE → PARTIAL → PENDING)
   - ✅ Línea eliminada de container_lines
   - ✅ Evento REVERSE registrado

---

### 🔁 Prueba 4: Consistencia Completa (Secuencia Compleja)

**Objetivo:** Verificar que múltiples operaciones mantengan consistencia.

**Pasos:**

1. **Preparación:**
   - Pallet nuevo con inventario conocido (ej: 20 unidades de 1 SKU)
   - Anotar valores iniciales

2. **Ejecución:**
   ```
   Operación 1: Distribuir 5 unidades
   Operación 2: Distribuir 3 unidades
   Operación 3: Reversar 3 unidades (de la operación 2)
   ```

3. **Verificación final:**
   ```sql
   -- ✅ Verificar resultado final
   SELECT 
     pi.sku,
     pi.qty_available as inventario_actual,
     20 - 5 as inventario_esperado, -- (inicial - op1)
     il.qty_confirmed as confirmado_actual,
     5 as confirmado_esperado, -- (op1 + op2 - op3 = 5 + 3 - 3 = 5)
     il.status
   FROM pallet_inventory pi
   JOIN import_lines il ON il.sku = pi.sku AND il.pallet_code = 'TU_PALLET_CODE'
   WHERE pi.pallet_id = 'TU_PALLET_ID';
   -- Esperado: inventario_actual = 15, confirmado_actual = 5
   
   -- ✅ Verificar líneas del contenedor
   SELECT COUNT(*) as total_lines, SUM(qty) as total_qty
   FROM container_lines 
   WHERE pallet_id = 'TU_PALLET_ID' AND sku = 'TU_SKU';
   -- Esperado: total_lines = 1 (solo queda la op1), total_qty = 5
   
   -- ✅ Verificar eventos
   SELECT event_type, qty, created_at
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND event_type IN ('CONFIRM_QTY', 'REVERSE')
     AND created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at;
   -- Esperado: 2 CONFIRM_QTY + 1 REVERSE
   ```

4. **Resultado esperado:**
   - ✅ Inventario final = 15 (20 - 5)
   - ✅ Confirmado final = 5
   - ✅ Solo 1 línea en contenedor con qty = 5
   - ✅ Secuencia de eventos correcta

---

### 📱 Prueba 5: Handheld (Caso Crítico)

**Objetivo:** Verificar que el handheld no cause duplicados por Enter automático.

**Pasos:**

1. **Preparación:**
   - Configurar handheld en modo escaneo
   - Pallet de prueba con 1 SKU

2. **Ejecución:**
   - Abrir modal de distribución
   - **Escanear SKU con handheld** (el handheld envía Enter automáticamente)
   - Ingresar cantidad
   - **Escanear cantidad con handheld** (si aplica) o presionar Enter

3. **Verificación:**
   ```sql
   -- ✅ Verificar normalización del input
   SELECT event_type, raw_code, sku, notes
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND event_type = 'SCAN_SKU'
     AND created_at > NOW() - INTERVAL '1 minute'
   ORDER BY created_at DESC;
   -- Verificar que raw_code fue normalizado correctamente (sin \r\n\t)
   
   -- ✅ Verificar que no hubo duplicados
   SELECT event_type, COUNT(*) as total
   FROM scan_events 
   WHERE pallet_id = 'TU_PALLET_ID' 
     AND created_at > NOW() - INTERVAL '1 minute'
   GROUP BY event_type;
   -- Esperado: SCAN_SKU = 1, CONFIRM_QTY = 1
   ```

4. **Resultado esperado:**
   - ✅ Input normalizado correctamente
   - ✅ Solo 1 confirmación procesada
   - ✅ Sin duplicados por Enter automático

---

### 🔍 Prueba 6: Auditoría de Duplicados Históricos

**Objetivo:** Detectar si existen duplicados en el sistema.

**Ejecución:**

1. **En consola del navegador:**
   ```javascript
   // Importar función de auditoría
   import { runFullAudit } from './lib/containerService';
   
   // Ejecutar auditoría completa
   runFullAudit();
   ```

2. **Revisar logs en consola:**
   - Buscar `[AUDIT_DUPLICATES]`
   - Verificar si hay duplicados reportados

3. **Consulta SQL alternativa:**
   ```sql
   -- Detectar duplicados en container_lines (últimas 24h)
   WITH duplicates AS (
     SELECT 
       container_id,
       pallet_id,
       sku,
       qty,
       COUNT(*) as occurrences,
       ARRAY_AGG(id ORDER BY created_at) as line_ids,
       ARRAY_AGG(created_at ORDER BY created_at) as timestamps
     FROM container_lines
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY container_id, pallet_id, sku, qty
     HAVING COUNT(*) > 1
   )
   SELECT 
     *,
     EXTRACT(EPOCH FROM (timestamps[2] - timestamps[1])) as seconds_between
   FROM duplicates
   WHERE EXTRACT(EPOCH FROM (timestamps[2] - timestamps[1])) < 10;
   -- Si retorna filas: hay duplicados sospechosos
   
   -- Detectar duplicados en distribution_moves
   WITH duplicates AS (
     SELECT 
       pallet_id,
       sku,
       tienda,
       qty,
       user_id,
       COUNT(*) as occurrences,
       ARRAY_AGG(id ORDER BY created_at) as move_ids,
       ARRAY_AGG(created_at ORDER BY created_at) as timestamps
     FROM distribution_moves
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY pallet_id, sku, tienda, qty, user_id
     HAVING COUNT(*) > 1
   )
   SELECT 
     *,
     EXTRACT(EPOCH FROM (timestamps[2] - timestamps[1])) as seconds_between
   FROM duplicates
   WHERE EXTRACT(EPOCH FROM (timestamps[2] - timestamps[1])) < 10;
   ```

4. **Resultado esperado:**
   - ✅ Sin duplicados detectados
   - ✅ Si hay duplicados antiguos, deben estar fuera de la ventana de 24h

---

### 🎯 Prueba 7: Escenarios Múltiples

**Objetivo:** Validar casos complejos.

#### Escenario A: 1 SKU, Varias Tiendas

```sql
-- Preparación: Verificar que el SKU tenga pedidos para múltiples tiendas
SELECT tienda, qty_to_send, qty_confirmed, status
FROM import_lines
WHERE pallet_code = 'TU_PALLET_CODE' AND sku = 'TU_SKU'
ORDER BY tienda;
```

**Pasos:**
1. Distribuir 5 unidades a Tienda A
2. Distribuir 3 unidades a Tienda B
3. Verificar que cada tienda tenga su contenedor correcto

**Verificación:**
```sql
-- ✅ Verificar que cada tienda tiene su contenedor
SELECT 
  c.code as container_code,
  c.tienda,
  cl.sku,
  SUM(cl.qty) as total_qty
FROM containers c
JOIN container_lines cl ON cl.container_id = c.id
WHERE cl.pallet_id = 'TU_PALLET_ID' AND cl.sku = 'TU_SKU'
GROUP BY c.code, c.tienda, cl.sku;
-- Esperado: 2 filas (Tienda A: 5, Tienda B: 3)
```

#### Escenario B: Varias Confirmaciones Seguidas

**Pasos:**
1. Confirmar 2 unidades
2. Confirmar 3 unidades (mismo SKU, misma tienda)
3. Confirmar 1 unidad

**Verificación:**
```sql
-- ✅ Verificar que todas las confirmaciones se registraron
SELECT qty, created_at
FROM container_lines
WHERE pallet_id = 'TU_PALLET_ID' AND sku = 'TU_SKU'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at;
-- Esperado: 3 filas (2, 3, 1)

-- ✅ Verificar total confirmado
SELECT qty_confirmed
FROM import_lines
WHERE pallet_code = 'TU_PALLET_CODE' AND sku = 'TU_SKU';
-- Esperado: qty_confirmed = 6 (2 + 3 + 1)
```

#### Escenario C: Reverso Parcial vs Total

**Reverso Parcial:**
- Distribuir 10 unidades
- Reversar 3 unidades
- Verificar que queden 7 confirmadas

**Reverso Total:**
- Distribuir 5 unidades
- Reversar 5 unidades
- Verificar que status vuelva a PENDING

```sql
-- ✅ Verificar reverso parcial
SELECT qty_confirmed, status
FROM import_lines
WHERE id = 'TU_IMPORT_LINE_ID';
-- Esperado: qty_confirmed = 7, status = PARTIAL

-- ✅ Verificar reverso total
SELECT qty_confirmed, status
FROM import_lines
WHERE id = 'TU_IMPORT_LINE_ID';
-- Esperado: qty_confirmed = 0, status = PENDING
```

---

## 📊 Queries de Monitoreo Continuo

### Dashboard de Eventos (últimas 24h)

```sql
-- Resumen de eventos por tipo
SELECT 
  event_type,
  COUNT(*) as total,
  COUNT(DISTINCT pallet_id) as pallets_affected,
  COUNT(DISTINCT user_id) as users_involved
FROM scan_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total DESC;
```

### Detección de Duplicados en Tiempo Real

```sql
-- Duplicados bloqueados (últimas 24h)
SELECT 
  pallet_id,
  sku,
  tienda,
  qty,
  notes,
  created_at
FROM scan_events
WHERE event_type = 'DIST_DUPLICATE_BLOCKED'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Errores Recientes

```sql
-- Errores de distribución (últimas 24h)
SELECT 
  event_type,
  pallet_id,
  sku,
  tienda,
  notes,
  created_at
FROM scan_events
WHERE event_type IN ('DIST_ERROR', 'REVERSE_ERROR')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Consistencia de Inventario

```sql
-- Verificar que inventario = inicial - distribuido + reversado
WITH movements AS (
  SELECT 
    pallet_id,
    sku,
    SUM(CASE WHEN event_type = 'CONFIRM_QTY' THEN -qty ELSE 0 END) as distributed,
    SUM(CASE WHEN event_type = 'REVERSE' THEN qty ELSE 0 END) as reversed
  FROM scan_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY pallet_id, sku
)
SELECT 
  pi.pallet_id,
  pi.sku,
  pi.qty_available as current_inventory,
  m.distributed,
  m.reversed,
  pi.qty_available - m.distributed - m.reversed as expected_delta
FROM pallet_inventory pi
JOIN movements m ON m.pallet_id = pi.pallet_id AND m.sku = pi.sku
WHERE ABS(pi.qty_available - m.distributed - m.reversed) > 0.01;
-- Si retorna filas: hay inconsistencias
```

---

## 🚨 Señales de Alerta

### ❌ Problemas Detectados

Si encuentras alguno de estos casos, **DETENER PRUEBAS** y reportar:

1. **Duplicados confirmados:**
   - 2 líneas idénticas en `container_lines` con timestamps < 10 segundos
   - Inventario bajó el doble de lo esperado

2. **Reverso inconsistente:**
   - Inventario no regresó después del reverso
   - qty_confirmed no bajó correctamente
   - Status no cambió (DONE → PARTIAL → PENDING)

3. **Eventos faltantes:**
   - No hay evento `CONFIRM_QTY` después de confirmar
   - No hay evento `REVERSE` después de reversar

4. **Errores sin bloqueo:**
   - Aparecen eventos `DIST_ERROR` pero la operación se completó igual

### ✅ Señales de Éxito

1. **Protección activa:**
   - Aparecen eventos `DIST_DUPLICATE_BLOCKED` cuando hay intentos duplicados
   - Botones se bloquean durante procesamiento

2. **Consistencia perfecta:**
   - Inventario = inicial - distribuido + reversado
   - qty_confirmed = suma de confirmaciones - suma de reversos

3. **Logs completos:**
   - Todos los eventos tienen metadata en campo `notes`
   - Timestamps coherentes

---

## 📝 Plantilla de Reporte de Pruebas

```markdown
## Reporte de Pruebas - [FECHA]

### Ambiente
- [ ] Desarrollo
- [ ] Staging
- [ ] Producción (con pallet de prueba)

### Pruebas Ejecutadas

#### ✅ Prueba 1: Distribución Simple
- Pallet: [CÓDIGO]
- SKU: [SKU]
- Cantidad: [QTY]
- Resultado: [OK / FALLO]
- Observaciones: [DETALLES]

#### ✅ Prueba 2: Doble Enter
- Resultado: [OK / FALLO]
- Duplicados bloqueados: [SÍ / NO]
- Observaciones: [DETALLES]

#### ✅ Prueba 3: Reverso
- Línea reversada: [ID]
- Cantidad: [QTY]
- Resultado: [OK / FALLO]
- Inventario regresó: [SÍ / NO]
- Observaciones: [DETALLES]

#### ✅ Prueba 4: Consistencia
- Secuencia: [OPERACIONES]
- Resultado final: [OK / FALLO]
- Inventario esperado vs actual: [VALORES]
- Observaciones: [DETALLES]

#### ✅ Prueba 5: Handheld
- Dispositivo: [MODELO]
- Resultado: [OK / FALLO]
- Duplicados: [SÍ / NO]
- Observaciones: [DETALLES]

### Auditoría de Duplicados
- Duplicados encontrados: [CANTIDAD]
- Ventana de tiempo: [RANGO]
- Detalles: [QUERY RESULTS]

### Conclusión
- [ ] Todas las pruebas pasaron
- [ ] Algunas pruebas fallaron (ver observaciones)
- [ ] Sistema listo para producción
- [ ] Requiere correcciones adicionales

### Próximos Pasos
1. [ACCIÓN 1]
2. [ACCIÓN 2]
3. [ACCIÓN 3]
```

---

## 🔧 Troubleshooting

### Problema: "No se puede reversar línea de contenedor despachado"

**Causa:** El contenedor ya fue despachado (status = DISPATCHED)

**Solución:** Esto es correcto. No se deben reversar líneas de contenedores despachados.

### Problema: "Cantidad mayor al disponible en pallet"

**Causa:** Inventario insuficiente o duplicado previo

**Solución:**
1. Verificar inventario actual: `SELECT * FROM pallet_inventory WHERE pallet_id = 'X'`
2. Buscar duplicados: ejecutar auditoría
3. Si hay duplicados, corregir manualmente

### Problema: "Esta línea ya fue registrada hace menos de 5 segundos"

**Causa:** Protección anti-duplicado activada

**Solución:** Esto es correcto. Esperar 5 segundos y reintentar si es necesario.

---

## 📞 Contacto

Si encuentras problemas durante las pruebas, reportar con:

1. **Logs de consola** (buscar `[DIST_CONFIRM]`, `[DIST_REVERSE]`, `[IDEMPOTENCY_CHECK]`)
2. **Queries SQL** con resultados
3. **Screenshots** del UI
4. **Timestamp** exacto del incidente
5. **Pallet/SKU/Tienda** afectados

---

**Última actualización:** [FECHA]
**Versión del sistema:** 69