import { supabase } from './supabase';

/**
 * Genera el siguiente código consecutivo para contenedores
 * Formato: 22O00000001 (22O + 8 dígitos)
 */
async function generateContainerCode(): Promise<string> {
  const prefix = '22O';
  
  // Obtener el último código generado
  const { data: lastContainer } = await supabase
    .from('containers')
    .select('code')
    .like('code', `${prefix}%`)
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  
  if (lastContainer?.code) {
    // Extraer el número del código anterior
    const lastNumber = parseInt(lastContainer.code.substring(3), 10);
    nextNumber = lastNumber + 1;
  }

  // Formatear con 8 dígitos
  const paddedNumber = nextNumber.toString().padStart(8, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Obtiene o crea un contenedor OPEN para una tienda específica
 * Si existe un contenedor OPEN para esa tienda e import → lo reutiliza
 * Si no existe → crea uno nuevo con código consecutivo
 */
export async function getOrCreateOpenContainer(
  importId: string,
  tienda: string,
  userId: string
): Promise<string> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 1. Buscar contenedor OPEN existente para esta tienda e import
      const { data: existingContainer } = await supabase
        .from('containers')
        .select('id, code')
        .eq('import_id', importId)
        .eq('tienda', tienda)
        .eq('status', 'OPEN')
        .maybeSingle();

      if (existingContainer) {
        console.log(
          `[ContainerService] ♻️  Reutilizando contenedor OPEN existente` +
          ` | ID: ${existingContainer.id}` +
          ` | Código: ${existingContainer.code}` +
          ` | Import: ${importId}` +
          ` | Tienda: ${tienda}`
        );
        return existingContainer.id;
      }

      // 2. No existe → crear nuevo contenedor
      const code = await generateContainerCode();
      console.log(
        `[ContainerService] 🆕 Creando nuevo contenedor` +
        ` | Código generado: ${code}` +
        ` | Import: ${importId}` +
        ` | Tienda: ${tienda}` +
        ` | Usuario: ${userId}`
      );

      const { data: newContainer, error: insertError } = await supabase
        .from('containers')
        .insert({
          code,
          import_id: importId,
          tienda,
          status: 'OPEN',
          created_by: userId,
        })
        .select('id')
        .single();

      if (insertError) {
        // Si hay error de duplicado de código, reintentar
        if (insertError.code === '23505') {
          console.warn(`[ContainerService] ⚠️  Código duplicado (${code}), reintentando... (intento ${attempt + 1}/${maxRetries})`);
          attempt++;
          continue;
        }
        throw insertError;
      }

      console.log(
        `[ContainerService] ✅ Contenedor creado exitosamente` +
        ` | ID: ${newContainer.id}` +
        ` | Código: ${code}` +
        ` | Tienda: ${tienda}`
      );
      return newContainer.id;
    } catch (error) {
      attempt++;
      console.error(`[ContainerService] ❌ Error en intento ${attempt}/${maxRetries}:`, error);
      if (attempt >= maxRetries) {
        throw new Error(`Error al crear contenedor después de ${maxRetries} intentos: ${error}`);
      }
      // Esperar un poco antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }

  throw new Error('No se pudo crear el contenedor');
}

/**
 * Verifica si un contenedor está en estado que permite agregar líneas
 */
export async function isContainerEditable(containerId: string): Promise<boolean> {
  const { data: container } = await supabase
    .from('containers')
    .select('status')
    .eq('id', containerId)
    .maybeSingle();

  return container?.status === 'OPEN';
}

/**
 * Obtiene todos los contenedores OPEN de un import
 */
export async function getOpenContainersByImport(importId: string) {
  const { data, error } = await supabase
    .from('containers')
    .select('id, code, tienda, created_at')
    .eq('import_id', importId)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Valida y registra una línea en el contenedor con validaciones de concurrencia
 * Retorna true si se insertó correctamente, false si hubo error
 * 
 * ✅ PLAN 2: Reforzada con validación de duplicados en ventana de 10 segundos
 * ✅ PLAN 3: Estrategia de consolidación implementada (Opción A - Múltiples líneas permitidas)
 */
export async function addContainerLineWithValidation(
  containerId: string,
  palletId: string,
  sku: string,
  qty: number,
  sourceImportLineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[ContainerService] 🔍 Validando inserción de línea` +
      ` | Container: ${containerId}` +
      ` | Pallet: ${palletId}` +
      ` | SKU: ${sku}` +
      ` | Qty (delta): ${qty}` +
      ` | Source Line: ${sourceImportLineId}`
    );

    // ✅ PLAN 3: Documentar estrategia de consolidación
    console.log(
      '[CONTAINER_LINE_STRATEGY] 📋 Estrategia: OPCIÓN A - Múltiples líneas permitidas' +
      ' | Cada confirmación crea una línea nueva independiente' +
      ' | Facilita auditoría y reverso individual' +
      ' | No se consolida qty, cada línea mantiene su qty original'
    );

    // ✅ VALIDACIÓN 0A: Verificar duplicados en container_lines (últimos 10 segundos)
    console.log('[CONCURRENCY_CHECK] 🔍 Verificando duplicados en container_lines (ventana: 10s)...');
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    
    const { data: recentContainerLines, error: containerDuplicateError } = await supabase
      .from('container_lines')
      .select('id, created_at')
      .eq('container_id', containerId)
      .eq('pallet_id', palletId)
      .eq('sku', sku)
      .eq('qty', qty)
      .eq('source_import_line_id', sourceImportLineId)
      .gte('created_at', tenSecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (containerDuplicateError) {
      console.error('[CONCURRENCY_CHECK] ❌ Error verificando duplicados en container_lines:', containerDuplicateError);
      // No bloqueamos por error en verificación, continuamos
    } else if (recentContainerLines && recentContainerLines.length > 0) {
      const timeDiff = Date.now() - new Date(recentContainerLines[0].created_at).getTime();
      console.warn('[CONCURRENCY_CHECK] ⚠️ DUPLICADO DETECTADO en container_lines:', {
        existing_line_id: recentContainerLines[0].id,
        existing_created_at: recentContainerLines[0].created_at,
        time_diff_ms: timeDiff,
        container_id: containerId,
        pallet_id: palletId,
        sku,
        qty,
        source_import_line_id: sourceImportLineId
      });

      console.log(
        '[CONTAINER_LINE_STRATEGY] 🚫 BLOQUEADO: Duplicado detectado en ventana de 10s' +
        ` | Línea existente: ${recentContainerLines[0].id}` +
        ` | Diferencia temporal: ${timeDiff}ms` +
        ' | Estrategia: Bloquear inserción para prevenir duplicación accidental'
      );

      // Registrar evento de duplicado bloqueado
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_DUPLICATE_BLOCKED',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          existing_line_id: recentContainerLines[0].id,
          time_diff_ms: timeDiff,
          reason: 'Línea idéntica en container_lines insertada hace menos de 10 segundos',
          source: 'container_lines',
          strategy: 'OPTION_A_MULTIPLE_LINES'
        })
      });

      return { 
        success: false, 
        error: 'Esta línea ya fue registrada hace menos de 10 segundos. Operación duplicada bloqueada.' 
      };
    }

    console.log('[CONCURRENCY_CHECK] ✅ Sin duplicados en container_lines');

    // ✅ VALIDACIÓN 0B: Verificar duplicados en distribution_moves (últimos 10 segundos)
    console.log('[CONCURRENCY_CHECK] 🔍 Verificando duplicados en distribution_moves (ventana: 10s)...');
    
    // Primero obtener user_id y tienda del contexto
    const { data: containerData } = await supabase
      .from('containers')
      .select('tienda')
      .eq('id', containerId)
      .maybeSingle();

    if (containerData) {
      const { data: recentMoves, error: movesDuplicateError } = await supabase
        .from('distribution_moves')
        .select('id, created_at, user_id')
        .eq('pallet_id', palletId)
        .eq('sku', sku)
        .eq('tienda', containerData.tienda)
        .eq('qty', qty)
        .eq('source_import_line_id', sourceImportLineId)
        .gte('created_at', tenSecondsAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (movesDuplicateError) {
        console.error('[CONCURRENCY_CHECK] ❌ Error verificando duplicados en distribution_moves:', movesDuplicateError);
        // No bloqueamos por error en verificación, continuamos
      } else if (recentMoves && recentMoves.length > 0) {
        const timeDiff = Date.now() - new Date(recentMoves[0].created_at).getTime();
        console.warn('[CONCURRENCY_CHECK] ⚠️ DUPLICADO DETECTADO en distribution_moves:', {
          existing_move_id: recentMoves[0].id,
          existing_created_at: recentMoves[0].created_at,
          time_diff_ms: timeDiff,
          pallet_id: palletId,
          sku,
          tienda: containerData.tienda,
          qty,
          user_id: recentMoves[0].user_id,
          source_import_line_id: sourceImportLineId
        });

        console.log(
          '[CONTAINER_LINE_STRATEGY] 🚫 BLOQUEADO: Duplicado detectado en distribution_moves' +
          ` | Movimiento existente: ${recentMoves[0].id}` +
          ` | Diferencia temporal: ${timeDiff}ms` +
          ' | Estrategia: Bloquear para mantener consistencia 1:1 entre container_lines y distribution_moves'
        );

        // Registrar evento de duplicado bloqueado
        await supabase.from('scan_events').insert({
          pallet_id: palletId,
          event_type: 'DIST_DUPLICATE_BLOCKED',
          sku,
          qty,
          notes: JSON.stringify({
            container_id: containerId,
            existing_move_id: recentMoves[0].id,
            time_diff_ms: timeDiff,
            reason: 'Movimiento idéntico en distribution_moves registrado hace menos de 10 segundos',
            source: 'distribution_moves',
            strategy: 'OPTION_A_MULTIPLE_LINES'
          })
        });

        return { 
          success: false, 
          error: 'Este movimiento ya fue registrado hace menos de 10 segundos. Operación duplicada bloqueada.' 
        };
      }

      console.log('[CONCURRENCY_CHECK] ✅ Sin duplicados en distribution_moves');
    }

    // ✅ VALIDACIÓN 1: Verificar que el contenedor esté OPEN
    const { data: container } = await supabase
      .from('containers')
      .select('status, code')
      .eq('id', containerId)
      .maybeSingle();

    if (!container) {
      console.warn(`[ContainerService] ⚠️  Contenedor no encontrado: ${containerId}`);
      
      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          error: 'Contenedor no encontrado'
        })
      });
      
      return { success: false, error: 'Contenedor no encontrado' };
    }

    if (container.status !== 'OPEN') {
      console.warn(`[ContainerService] ⚠️  Contenedor ${container.code} no está OPEN (estado: ${container.status})`);
      
      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          container_code: container.code,
          container_status: container.status,
          error: `El contenedor está en estado ${container.status} y no permite agregar líneas`
        })
      });
      
      return { success: false, error: `El contenedor está en estado ${container.status} y no permite agregar líneas` };
    }

    // ✅ VALIDACIÓN 2: Verificar inventario disponible en tiempo real
    const { data: inventory } = await supabase
      .from('pallet_inventory')
      .select('qty_available')
      .eq('pallet_id', palletId)
      .eq('sku', sku)
      .maybeSingle();

    if (!inventory || inventory.qty_available < qty) {
      console.warn(
        `[ContainerService] ⚠️  Inventario insuficiente` +
        ` | SKU: ${sku}` +
        ` | Disponible: ${inventory?.qty_available ?? 0}` +
        ` | Solicitado: ${qty}`
      );
      
      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          available: inventory?.qty_available ?? 0,
          requested: qty,
          error: 'Cantidad no disponible en inventario del pallet'
        })
      });
      
      return { success: false, error: 'Cantidad no disponible en inventario del pallet' };
    }

    // ✅ VALIDACIÓN 3: Verificar pendiente de la línea de importación
    const { data: importLine } = await supabase
      .from('import_lines')
      .select('qty_to_send, qty_confirmed')
      .eq('id', sourceImportLineId)
      .maybeSingle();

    if (!importLine) {
      console.warn(`[ContainerService] ⚠️  Import line no encontrada: ${sourceImportLineId}`);
      
      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          import_line_id: sourceImportLineId,
          error: 'Línea de importación no encontrada'
        })
      });
      
      return { success: false, error: 'Línea de importación no encontrada' };
    }

    const pending = importLine.qty_to_send - importLine.qty_confirmed;
    if (qty > pending) {
      console.warn(
        `[ContainerService] ⚠️  Qty supera pendiente` +
        ` | Pendiente: ${pending}` +
        ` | Solicitado: ${qty}`
      );
      
      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          import_line_id: sourceImportLineId,
          pending,
          requested: qty,
          error: 'Cantidad mayor al pendiente del pedido'
        })
      });
      
      return { success: false, error: 'Cantidad mayor al pendiente del pedido' };
    }

    // ✅ PLAN 3: Verificar si ya existen líneas similares (solo para logging, no para bloquear)
    const { data: existingLines, count: existingCount } = await supabase
      .from('container_lines')
      .select('id, qty, created_at', { count: 'exact' })
      .eq('container_id', containerId)
      .eq('pallet_id', palletId)
      .eq('sku', sku)
      .eq('source_import_line_id', sourceImportLineId);

    if (existingCount && existingCount > 0) {
      console.log(
        '[CONTAINER_LINE_STRATEGY] ℹ️ Líneas existentes detectadas (permitido en Opción A):' +
        ` | Líneas previas del mismo pallet+sku: ${existingCount}` +
        ` | Total qty acumulada: ${existingLines?.reduce((sum, l) => sum + l.qty, 0) ?? 0}` +
        ` | Nueva qty a agregar: ${qty}` +
        ' | Acción: Insertar nueva línea independiente (no consolidar)'
      );
    } else {
      console.log(
        '[CONTAINER_LINE_STRATEGY] ℹ️ Primera línea de este pallet+sku en el contenedor' +
        ` | Qty: ${qty}` +
        ' | Acción: Insertar nueva línea'
      );
    }

    // ✅ INSERTAR LÍNEA EN CONTENEDOR (siempre INSERT, nunca UPSERT)
    console.log(
      '[CONTAINER_LINE_STRATEGY] 📝 Insertando nueva línea (INSERT)' +
      ' | Estrategia: Cada confirmación = 1 línea nueva' +
      ' | No se consolida con líneas existentes'
    );

    const { error: insertError } = await supabase
      .from('container_lines')
      .insert({
        container_id: containerId,
        pallet_id: palletId,
        sku,
        qty,
        source_import_line_id: sourceImportLineId,
      });

    if (insertError) {
      console.error(`[ContainerService] ❌ Error insertando container_line:`, insertError);
      
      console.log(
        '[CONTAINER_LINE_STRATEGY] ❌ FALLO EN INSERCIÓN' +
        ` | Error: ${insertError.message}` +
        ` | Código: ${insertError.code}` +
        ' | Estrategia: No se realizó consolidación, inserción directa falló'
      );

      // Registrar error
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          import_line_id: sourceImportLineId,
          error: `Error al insertar línea: ${insertError.message}`,
          error_code: insertError.code,
          strategy: 'OPTION_A_MULTIPLE_LINES'
        })
      });
      
      return { success: false, error: `Error al insertar línea: ${insertError.message}` };
    }

    console.log(
      `[ContainerService] ✅ Container line insertada` +
      ` | Container: ${containerId} (${container.code})` +
      ` | SKU: ${sku}` +
      ` | Qty (delta): ${qty}`
    );

    console.log(
      '[CONTAINER_LINE_STRATEGY] ✅ INSERCIÓN EXITOSA' +
      ' | Nueva línea creada independientemente' +
      ' | Trazabilidad: Cada línea mantiene su timestamp y qty original' +
      ' | Reverso: Cada línea puede reversarse individualmente' +
      ` | Total líneas de este pallet+sku en contenedor: ${(existingCount ?? 0) + 1}`
    );
    
    // ✅ Registrar evento de éxito
    await supabase.from('scan_events').insert({
      pallet_id: palletId,
      event_type: 'DIST_CONFIRM',
      sku,
      qty,
      notes: JSON.stringify({
        container_id: containerId,
        container_code: container.code,
        import_line_id: sourceImportLineId,
        success: true,
        strategy: 'OPTION_A_MULTIPLE_LINES',
        existing_lines_count: existingCount ?? 0
      })
    });
    
    return { success: true };
  } catch (error) {
    console.error('[ContainerService] ❌ Error en addContainerLineWithValidation:', error);
    
    console.log(
      '[CONTAINER_LINE_STRATEGY] ❌ ERROR CRÍTICO' +
      ` | Error: ${error instanceof Error ? error.message : 'Error desconocido'}` +
      ' | Estrategia: Opción A (múltiples líneas)' +
      ' | Acción: Operación abortada, sin cambios en BD'
    );

    // Registrar error crítico
    try {
      await supabase.from('scan_events').insert({
        pallet_id: palletId,
        event_type: 'DIST_ERROR',
        sku,
        qty,
        notes: JSON.stringify({
          container_id: containerId,
          error: error instanceof Error ? error.message : 'Error desconocido',
          critical: true,
          strategy: 'OPTION_A_MULTIPLE_LINES'
        })
      });
    } catch (logError) {
      console.error('[ContainerService] ❌ Error registrando evento de error:', logError);
    }
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Cierra un contenedor y valida que tenga líneas
 */
export async function closeContainer(
  containerId: string,
  userId: string
): Promise<{ success: boolean; error?: string; code?: string; lineCount?: number }> {
  try {
    console.log(`[ContainerService] 🔒 Iniciando cierre de contenedor | ID: ${containerId}`);

    // ✅ VALIDACIÓN 1: Verificar que el contenedor exista y esté OPEN
    const { data: container } = await supabase
      .from('containers')
      .select('id, code, status, tienda')
      .eq('id', containerId)
      .maybeSingle();

    if (!container) {
      console.warn(`[ContainerService] ⚠️  Contenedor no encontrado: ${containerId}`);
      return { success: false, error: 'Contenedor no encontrado' };
    }

    if (container.status !== 'OPEN') {
      console.warn(`[ContainerService] ⚠️  Contenedor ${container.code} ya está en estado ${container.status}`);
      return { success: false, error: `El contenedor ya está en estado ${container.status}` };
    }

    // ✅ VALIDACIÓN 2: Verificar que tenga líneas
    const { data: lines, count } = await supabase
      .from('container_lines')
      .select('id', { count: 'exact' })
      .eq('container_id', containerId);

    if (!count || count === 0) {
      console.warn(`[ContainerService] ⚠️  Contenedor ${container.code} no tiene líneas, no se puede cerrar`);
      return { success: false, error: 'El contenedor no tiene líneas. Confirma cantidades antes de cerrar.' };
    }

    // ✅ CERRAR CONTENEDOR
    const { error: updateError } = await supabase
      .from('containers')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      })
      .eq('id', containerId);

    if (updateError) {
      console.error(`[ContainerService] ❌ Error cerrando contenedor ${container.code}:`, updateError);
      return { success: false, error: `Error al cerrar contenedor: ${updateError.message}` };
    }

    console.log(
      `[ContainerService] ✅ Contenedor cerrado exitosamente` +
      ` | Código: ${container.code}` +
      ` | Tienda: ${container.tienda}` +
      ` | Líneas totales: ${count}` +
      ` | Cerrado por: ${userId}`
    );
    return { success: true, code: container.code, lineCount: count };
  } catch (error) {
    console.error('[ContainerService] ❌ Error en closeContainer:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * 🔍 AUDITORÍA TEMPORAL: Detectar duplicados en container_lines
 * Busca registros con misma combinación de container_id + pallet_id + sku + qty + user_id
 * con timestamps cercanos (< 10 segundos)
 * 
 * ⚠️ CÓDIGO TEMPORAL - Remover después de la auditoría
 */
export async function auditDuplicateContainerLines(): Promise<void> {
  console.log('[AUDIT_DUPLICATES] 🔍 Iniciando auditoría de container_lines...');
  
  try {
    // Obtener todas las líneas con created_at de las últimas 24 horas
    const { data: lines, error } = await supabase
      .from('container_lines')
      .select('id, container_id, pallet_id, sku, qty, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AUDIT_DUPLICATES] ❌ Error consultando container_lines:', error);
      return;
    }

    if (!lines || lines.length === 0) {
      console.log('[AUDIT_DUPLICATES] ℹ️ No hay líneas recientes para auditar');
      return;
    }

    console.log(`[AUDIT_DUPLICATES] 📊 Analizando ${lines.length} líneas...`);

    // Agrupar por combinación única
    const groups = new Map<string, typeof lines>();
    
    for (const line of lines) {
      const key = `${line.container_id}__${line.pallet_id}__${line.sku}__${line.qty}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(line);
    }

    // Detectar duplicados (grupos con más de 1 registro)
    let duplicateGroupCount = 0;
    let totalDuplicates = 0;

    for (const [key, groupLines] of groups.entries()) {
      if (groupLines.length <= 1) continue;

      // Verificar si los timestamps están cercanos (< 10 segundos)
      const timestamps = groupLines.map(l => new Date(l.created_at).getTime()).sort();
      const hasSuspiciousTimestamps = timestamps.some((ts, idx) => {
        if (idx === 0) return false;
        const diff = ts - timestamps[idx - 1];
        return diff < 10000; // 10 segundos
      });

      if (hasSuspiciousTimestamps) {
        duplicateGroupCount++;
        totalDuplicates += groupLines.length - 1;

        console.warn('[AUDIT_DUPLICATES] ⚠️ DUPLICADO DETECTADO:', {
          key,
          count: groupLines.length,
          records: groupLines.map(l => ({
            id: l.id,
            created_at: l.created_at,
            container_id: l.container_id,
            pallet_id: l.pallet_id,
            sku: l.sku,
            qty: l.qty
          })),
          time_diffs_ms: timestamps.map((ts, idx) => 
            idx === 0 ? 0 : ts - timestamps[idx - 1]
          )
        });
      }
    }

    console.log('[AUDIT_DUPLICATES] 📋 RESUMEN container_lines:', {
      total_lines: lines.length,
      duplicate_groups: duplicateGroupCount,
      total_duplicates: totalDuplicates,
      clean_records: lines.length - totalDuplicates
    });

  } catch (error) {
    console.error('[AUDIT_DUPLICATES] ❌ Error en auditoría:', error);
  }
}

/**
 * 🔍 AUDITORÍA TEMPORAL: Detectar duplicados en distribution_moves
 * Busca registros con misma combinación de pallet_id + sku + tienda + qty + user_id
 * con timestamps cercanos (< 10 segundos)
 * 
 * ⚠️ CÓDIGO TEMPORAL - Remover después de la auditoría
 */
export async function auditDuplicateDistributionMoves(): Promise<void> {
  console.log('[AUDIT_DUPLICATES] 🔍 Iniciando auditoría de distribution_moves...');
  
  try {
    // Obtener todos los movimientos de las últimas 24 horas
    const { data: moves, error } = await supabase
      .from('distribution_moves')
      .select('id, pallet_id, sku, tienda, qty, user_id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AUDIT_DUPLICATES] ❌ Error consultando distribution_moves:', error);
      return;
    }

    if (!moves || moves.length === 0) {
      console.log('[AUDIT_DUPLICATES] ℹ️ No hay movimientos recientes para auditar');
      return;
    }

    console.log(`[AUDIT_DUPLICATES] 📊 Analizando ${moves.length} movimientos...`);

    // Agrupar por combinación única
    const groups = new Map<string, typeof moves>();
    
    for (const move of moves) {
      const key = `${move.pallet_id}__${move.sku}__${move.tienda}__${move.qty}__${move.user_id}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(move);
    }

    // Detectar duplicados (grupos con más de 1 registro)
    let duplicateGroupCount = 0;
    let totalDuplicates = 0;

    for (const [key, groupMoves] of groups.entries()) {
      if (groupMoves.length <= 1) continue;

      // Verificar si los timestamps están cercanos (< 10 segundos)
      const timestamps = groupMoves.map(m => new Date(m.created_at).getTime()).sort();
      const hasSuspiciousTimestamps = timestamps.some((ts, idx) => {
        if (idx === 0) return false;
        const diff = ts - timestamps[idx - 1];
        return diff < 10000; // 10 segundos
      });

      if (hasSuspiciousTimestamps) {
        duplicateGroupCount++;
        totalDuplicates += groupMoves.length - 1;

        console.warn('[AUDIT_DUPLICATES] ⚠️ DUPLICADO DETECTADO:', {
          key,
          count: groupMoves.length,
          records: groupMoves.map(m => ({
            id: m.id,
            created_at: m.created_at,
            pallet_id: m.pallet_id,
            sku: m.sku,
            tienda: m.tienda,
            qty: m.qty,
            user_id: m.user_id
          })),
          time_diffs_ms: timestamps.map((ts, idx) => 
            idx === 0 ? 0 : ts - timestamps[idx - 1]
          )
        });
      }
    }

    console.log('[AUDIT_DUPLICATES] 📋 RESUMEN distribution_moves:', {
      total_moves: moves.length,
      duplicate_groups: duplicateGroupCount,
      total_duplicates: totalDuplicates,
      clean_records: moves.length - totalDuplicates
    });

  } catch (error) {
    console.error('[AUDIT_DUPLICATES] ❌ Error en auditoría:', error);
  }
}

/**
 * 🔍 AUDITORÍA TEMPORAL: Detectar duplicados en scan_events (CONFIRM_QTY)
 * Busca eventos de confirmación con misma combinación de pallet_id + sku + tienda + qty + user_id
 * con timestamps cercanos (< 10 segundos)
 * 
 * ⚠️ CÓDIGO TEMPORAL - Remover después de la auditoría
 */
export async function auditDuplicateScanEvents(): Promise<void> {
  console.log('[AUDIT_DUPLICATES] 🔍 Iniciando auditoría de scan_events (CONFIRM_QTY)...');
  
  try {
    // Obtener todos los eventos CONFIRM_QTY de las últimas 24 horas
    const { data: events, error } = await supabase
      .from('scan_events')
      .select('id, pallet_id, event_type, sku, tienda, qty, user_id, created_at')
      .eq('event_type', 'CONFIRM_QTY')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AUDIT_DUPLICATES] ❌ Error consultando scan_events:', error);
      return;
    }

    if (!events || events.length === 0) {
      console.log('[AUDIT_DUPLICATES] ℹ️ No hay eventos CONFIRM_QTY recientes para auditar');
      return;
    }

    console.log(`[AUDIT_DUPLICATES] 📊 Analizando ${events.length} eventos...`);

    // Agrupar por combinación única
    const groups = new Map<string, typeof events>();
    
    for (const event of events) {
      const key = `${event.pallet_id}__${event.sku}__${event.tienda}__${event.qty}__${event.user_id}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    // Detectar duplicados (grupos con más de 1 registro)
    let duplicateGroupCount = 0;
    let totalDuplicates = 0;

    for (const [key, groupEvents] of groups.entries()) {
      if (groupEvents.length <= 1) continue;

      // Verificar si los timestamps están cercanos (< 10 segundos)
      const timestamps = groupEvents.map(e => new Date(e.created_at).getTime()).sort();
      const hasSuspiciousTimestamps = timestamps.some((ts, idx) => {
        if (idx === 0) return false;
        const diff = ts - timestamps[idx - 1];
        return diff < 10000; // 10 segundos
      });

      if (hasSuspiciousTimestamps) {
        duplicateGroupCount++;
        totalDuplicates += groupEvents.length - 1;

        console.warn('[AUDIT_DUPLICATES] ⚠️ DUPLICADO DETECTADO:', {
          key,
          count: groupEvents.length,
          records: groupEvents.map(e => ({
            id: e.id,
            created_at: e.created_at,
            pallet_id: e.pallet_id,
            sku: e.sku,
            tienda: e.tienda,
            qty: e.qty,
            user_id: e.user_id
          })),
          time_diffs_ms: timestamps.map((ts, idx) => 
            idx === 0 ? 0 : ts - timestamps[idx - 1]
          )
        });
      }
    }

    console.log('[AUDIT_DUPLICATES] 📋 RESUMEN scan_events (CONFIRM_QTY):', {
      total_events: events.length,
      duplicate_groups: duplicateGroupCount,
      total_duplicates: totalDuplicates,
      clean_records: events.length - totalDuplicates
    });

  } catch (error) {
    console.error('[AUDIT_DUPLICATES] ❌ Error en auditoría:', error);
  }
}

/**
 * 🔍 AUDITORÍA COMPLETA: Ejecutar todas las auditorías
 * 
 * ⚠️ CÓDIGO TEMPORAL - Remover después de la auditoría
 * 
 * Uso:
 * import { runFullAudit } from './lib/containerService';
 * runFullAudit(); // Ejecutar en consola del navegador
 */
export async function runFullAudit(): Promise<void> {
  console.log('[AUDIT_DUPLICATES] 🚀 INICIANDO AUDITORÍA COMPLETA DEL SISTEMA');
  console.log('[AUDIT_DUPLICATES] ⏰ Timestamp:', new Date().toISOString());
  console.log('[AUDIT_DUPLICATES] 📅 Ventana de análisis: últimas 24 horas');
  console.log('[AUDIT_DUPLICATES] ⚠️ Umbral de duplicado: timestamps < 10 segundos');
  console.log('');

  await auditDuplicateContainerLines();
  console.log('');
  
  await auditDuplicateDistributionMoves();
  console.log('');
  
  await auditDuplicateScanEvents();
  console.log('');

  console.log('[AUDIT_DUPLICATES] ✅ AUDITORÍA COMPLETA FINALIZADA');
  console.log('[AUDIT_DUPLICATES] 💡 Revisa los logs anteriores para ver duplicados detectados');
}

/**
 * 🧪 PLAN 5: Simulación de concurrencia - Ejecutar confirmaciones simultáneas
 * 
 * Simula 2+ usuarios confirmando la misma distribución al mismo tiempo
 * para validar que las protecciones de idempotencia funcionen correctamente.
 * 
 * @param palletId - ID del pallet a usar en la simulación
 * @param sku - SKU a distribuir
 * @param tienda - Tienda destino
 * @param qty - Cantidad a distribuir
 * @param containerId - ID del contenedor destino
 * @param sourceImportLineId - ID de la línea de importación
 * @param concurrentCount - Número de confirmaciones simultáneas (default: 2)
 * 
 * ⚠️ CÓDIGO DE PRUEBA - Solo usar en ambiente controlado
 */
export async function simulateConcurrentDistribution(
  palletId: string,
  sku: string,
  tienda: string,
  qty: number,
  containerId: string,
  sourceImportLineId: string,
  concurrentCount: number = 2
): Promise<void> {
  console.log('[CONCURRENCY_TEST] 🧪 INICIANDO SIMULACIÓN DE CONCURRENCIA');
  console.log('[CONCURRENCY_TEST] 📋 Parámetros:', {
    palletId,
    sku,
    tienda,
    qty,
    containerId,
    sourceImportLineId,
    concurrentCount,
    timestamp: new Date().toISOString()
  });

  // Crear promesas de confirmación simultáneas
  const promises = Array.from({ length: concurrentCount }, (_, index) => {
    const simulatedUserId = `test-user-${index + 1}`;
    
    console.log(`[CONCURRENCY_TEST] 🚀 Lanzando confirmación ${index + 1}/${concurrentCount}`, {
      simulated_user_id: simulatedUserId,
      timestamp: new Date().toISOString()
    });

    return addContainerLineWithValidation(
      containerId,
      palletId,
      sku,
      qty,
      sourceImportLineId
    ).then(result => ({
      user: simulatedUserId,
      index: index + 1,
      result,
      timestamp: new Date().toISOString()
    }));
  });

  // Ejecutar todas las confirmaciones simultáneamente
  console.log(`[CONCURRENCY_TEST] ⏳ Ejecutando ${concurrentCount} confirmaciones simultáneas...`);
  const results = await Promise.allSettled(promises);

  // Analizar resultados
  let successCount = 0;
  let blockedCount = 0;
  let errorCount = 0;

  console.log('[CONCURRENCY_TEST] 📊 RESULTADOS:');
  console.log('');

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { user, result: opResult, timestamp } = result.value;
      
      if (opResult.success) {
        successCount++;
        console.log(`[CONCURRENCY_TEST] ✅ Confirmación ${index + 1} EXITOSA:`, {
          user,
          timestamp,
          message: 'Línea insertada correctamente'
        });
      } else {
        blockedCount++;
        console.log(`[CONCURRENCY_TEST] 🚫 Confirmación ${index + 1} BLOQUEADA:`, {
          user,
          timestamp,
          error: opResult.error,
          reason: 'Duplicado detectado por idempotencia'
        });
      }
    } else {
      errorCount++;
      console.error(`[CONCURRENCY_TEST] ❌ Confirmación ${index + 1} ERROR:`, {
        error: result.reason,
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('');
  console.log('[CONCURRENCY_TEST] 📈 RESUMEN:');
  console.log(`  ✅ Exitosas: ${successCount}`);
  console.log(`  🚫 Bloqueadas: ${blockedCount}`);
  console.log(`  ❌ Errores: ${errorCount}`);
  console.log(`  📊 Total: ${concurrentCount}`);
  console.log('');

  // Validación de resultado esperado
  if (successCount === 1 && blockedCount === concurrentCount - 1) {
    console.log('[CONCURRENCY_TEST] ✅ PRUEBA EXITOSA: Solo 1 confirmación procesada, las demás bloqueadas por idempotencia');
  } else if (successCount > 1) {
    console.warn('[CONCURRENCY_TEST] ⚠️ ALERTA: Múltiples confirmaciones exitosas detectadas. Posible duplicación.');
  } else if (successCount === 0) {
    console.warn('[CONCURRENCY_TEST] ⚠️ ALERTA: Ninguna confirmación exitosa. Revisar validaciones.');
  }

  console.log('[CONCURRENCY_TEST] 🏁 SIMULACIÓN FINALIZADA');
}

/**
 * 🔍 PLAN 5: Auditoría de consistencia - Verificar integridad de datos
 * 
 * Verifica que no haya inconsistencias entre:
 * - pallet_inventory.qty_available vs sum(container_lines.qty)
 * - import_lines.qty_confirmed vs sum(distribution_moves.qty)
 * 
 * Ventana de análisis: últimas 48 horas
 * 
 * ⚠️ CÓDIGO DE AUDITORÍA - Ejecutar periódicamente para monitoreo
 */
export async function auditDataConsistency(): Promise<{
  inventoryInconsistencies: any[];
  importLineInconsistencies: any[];
  summary: {
    totalInventoryChecked: number;
    inventoryInconsistenciesFound: number;
    totalImportLinesChecked: number;
    importLineInconsistenciesFound: number;
  };
}> {
  console.log('[CONSISTENCY_AUDIT] 🔍 INICIANDO AUDITORÍA DE CONSISTENCIA');
  console.log('[CONSISTENCY_AUDIT] 📅 Ventana: últimas 48 horas');
  console.log('');

  const inventoryInconsistencies: any[] = [];
  const importLineInconsistencies: any[] = [];

  try {
    // ✅ AUDITORÍA 1: Verificar consistencia de pallet_inventory
    console.log('[CONSISTENCY_AUDIT] 📦 Auditando pallet_inventory...');
    
    const { data: pallets, error: palletsError } = await supabase
      .from('pallets')
      .select('id, pallet_code')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    if (palletsError) {
      console.error('[CONSISTENCY_AUDIT] ❌ Error consultando pallets:', palletsError);
    } else if (pallets && pallets.length > 0) {
      console.log(`[CONSISTENCY_AUDIT] 📊 Analizando ${pallets.length} pallets...`);

      for (const pallet of pallets) {
        // Obtener inventario actual
        const { data: inventory } = await supabase
          .from('pallet_inventory')
          .select('sku, qty_received, qty_available')
          .eq('pallet_id', pallet.id);

        if (!inventory || inventory.length === 0) continue;

        for (const inv of inventory) {
          // Calcular total distribuido desde container_lines
          const { data: containerLines } = await supabase
            .from('container_lines')
            .select('qty')
            .eq('pallet_id', pallet.id)
            .eq('sku', inv.sku);

          const totalDistributed = containerLines?.reduce((sum, line) => sum + line.qty, 0) ?? 0;
          const expectedAvailable = inv.qty_received - totalDistributed;

          if (inv.qty_available !== expectedAvailable) {
            const inconsistency = {
              pallet_id: pallet.id,
              pallet_code: pallet.pallet_code,
              sku: inv.sku,
              qty_received: inv.qty_received,
              qty_available_actual: inv.qty_available,
              qty_available_expected: expectedAvailable,
              total_distributed: totalDistributed,
              difference: inv.qty_available - expectedAvailable
            };

            inventoryInconsistencies.push(inconsistency);

            console.warn('[CONSISTENCY_AUDIT] ⚠️ INCONSISTENCIA EN INVENTARIO:', inconsistency);
          }
        }
      }
    }

    // ✅ AUDITORÍA 2: Verificar consistencia de import_lines
    console.log('');
    console.log('[CONSISTENCY_AUDIT] 📋 Auditando import_lines...');

    const { data: importLines, error: importLinesError } = await supabase
      .from('import_lines')
      .select('id, sku, tienda, qty_to_send, qty_confirmed')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    if (importLinesError) {
      console.error('[CONSISTENCY_AUDIT] ❌ Error consultando import_lines:', importLinesError);
    } else if (importLines && importLines.length > 0) {
      console.log(`[CONSISTENCY_AUDIT] 📊 Analizando ${importLines.length} líneas de importación...`);

      for (const line of importLines) {
        // Calcular total confirmado desde distribution_moves
        const { data: moves } = await supabase
          .from('distribution_moves')
          .select('qty')
          .eq('source_import_line_id', line.id);

        const totalFromMoves = moves?.reduce((sum, move) => sum + move.qty, 0) ?? 0;

        if (line.qty_confirmed !== totalFromMoves) {
          const inconsistency = {
            import_line_id: line.id,
            sku: line.sku,
            tienda: line.tienda,
            qty_to_send: line.qty_to_send,
            qty_confirmed_actual: line.qty_confirmed,
            qty_confirmed_expected: totalFromMoves,
            difference: line.qty_confirmed - totalFromMoves
          };

          importLineInconsistencies.push(inconsistency);

          console.warn('[CONSISTENCY_AUDIT] ⚠️ INCONSISTENCIA EN IMPORT_LINE:', inconsistency);
        }
      }
    }

    // ✅ RESUMEN
    console.log('');
    console.log('[CONSISTENCY_AUDIT] 📈 RESUMEN:');
    console.log(`  📦 Pallets auditados: ${pallets?.length ?? 0}`);
    console.log(`  ⚠️ Inconsistencias en inventario: ${inventoryInconsistencies.length}`);
    console.log(`  📋 Import lines auditadas: ${importLines?.length ?? 0}`);
    console.log(`  ⚠️ Inconsistencias en import_lines: ${importLineInconsistencies.length}`);
    console.log('');

    if (inventoryInconsistencies.length === 0 && importLineInconsistencies.length === 0) {
      console.log('[CONSISTENCY_AUDIT] ✅ SISTEMA CONSISTENTE: No se detectaron inconsistencias');
    } else {
      console.warn('[CONSISTENCY_AUDIT] ⚠️ INCONSISTENCIAS DETECTADAS: Revisar logs anteriores');
    }

    console.log('[CONSISTENCY_AUDIT] 🏁 AUDITORÍA FINALIZADA');

    return {
      inventoryInconsistencies,
      importLineInconsistencies,
      summary: {
        totalInventoryChecked: pallets?.length ?? 0,
        inventoryInconsistenciesFound: inventoryInconsistencies.length,
        totalImportLinesChecked: importLines?.length ?? 0,
        importLineInconsistenciesFound: importLineInconsistencies.length
      }
    };

  } catch (error) {
    console.error('[CONSISTENCY_AUDIT] ❌ Error en auditoría:', error);
    throw error;
  }
}

/**
 * 🧪 PLAN 5: Test completo de concurrencia - Ejecutar todas las pruebas
 * 
 * Ejecuta:
 * 1. Auditoría de duplicados históricos
 * 2. Auditoría de consistencia de datos
 * 3. Simulación de concurrencia (si se proporcionan parámetros)
 * 
 * Genera reporte JSON completo con resultados y recomendaciones
 * 
 * Uso en consola:
 * import { runConcurrencyTest } from './lib/containerService';
 * await runConcurrencyTest();
 * 
 * ⚠️ CÓDIGO DE PRUEBA - Solo usar en ambiente controlado
 */
export async function runConcurrencyTest(simulationParams?: {
  palletId: string;
  sku: string;
  tienda: string;
  qty: number;
  containerId: string;
  sourceImportLineId: string;
  concurrentCount?: number;
}): Promise<{
  timestamp: string;
  duplicatesAudit: {
    completed: boolean;
    message: string;
  };
  consistencyAudit: {
    completed: boolean;
    inventoryInconsistencies: any[];
    importLineInconsistencies: any[];
    summary: any;
  };
  concurrencySimulation?: {
    completed: boolean;
    message: string;
  };
  recommendations: string[];
}> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 PLAN 5: TEST COMPLETO DE CONCURRENCIA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');

  const report: any = {
    timestamp: new Date().toISOString(),
    duplicatesAudit: { completed: false, message: '' },
    consistencyAudit: { completed: false, inventoryInconsistencies: [], importLineInconsistencies: [], summary: {} },
    recommendations: []
  };

  try {
    // ✅ PASO 1: Auditoría de duplicados
    console.log('📋 PASO 1/3: Auditoría de duplicados históricos');
    console.log('───────────────────────────────────────────────────────────');
    await runFullAudit();
    report.duplicatesAudit = {
      completed: true,
      message: 'Auditoría de duplicados completada. Revisar logs anteriores para detalles.'
    };
    console.log('');

    // ✅ PASO 2: Auditoría de consistencia
    console.log('📋 PASO 2/3: Auditoría de consistencia de datos');
    console.log('───────────────────────────────────────────────────────────');
    const consistencyResult = await auditDataConsistency();
    report.consistencyAudit = {
      completed: true,
      ...consistencyResult
    };
    console.log('');

    // ✅ PASO 3: Simulación de concurrencia (opcional)
    if (simulationParams) {
      console.log('📋 PASO 3/3: Simulación de concurrencia');
      console.log('───────────────────────────────────────────────────────────');
      await simulateConcurrentDistribution(
        simulationParams.palletId,
        simulationParams.sku,
        simulationParams.tienda,
        simulationParams.qty,
        simulationParams.containerId,
        simulationParams.sourceImportLineId,
        simulationParams.concurrentCount
      );
      report.concurrencySimulation = {
        completed: true,
        message: 'Simulación de concurrencia completada. Revisar logs anteriores para resultados.'
      };
      console.log('');
    } else {
      console.log('📋 PASO 3/3: Simulación de concurrencia');
      console.log('───────────────────────────────────────────────────────────');
      console.log('⏭️  OMITIDO: No se proporcionaron parámetros de simulación');
      console.log('💡 Para ejecutar simulación, proporciona: { palletId, sku, tienda, qty, containerId, sourceImportLineId }');
      console.log('');
    }

    // ✅ GENERAR RECOMENDACIONES
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 RECOMENDACIONES');
    console.log('═══════════════════════════════════════════════════════════');

    if (consistencyResult.summary.inventoryInconsistenciesFound > 0) {
      const rec = `⚠️ Se detectaron ${consistencyResult.summary.inventoryInconsistenciesFound} inconsistencias en inventario. Revisar pallet_inventory vs container_lines.`;
      report.recommendations.push(rec);
      console.log(rec);
    }

    if (consistencyResult.summary.importLineInconsistenciesFound > 0) {
      const rec = `⚠️ Se detectaron ${consistencyResult.summary.importLineInconsistenciesFound} inconsistencias en import_lines. Revisar qty_confirmed vs distribution_moves.`;
      report.recommendations.push(rec);
      console.log(rec);
    }

    if (consistencyResult.summary.inventoryInconsistenciesFound === 0 && 
        consistencyResult.summary.importLineInconsistenciesFound === 0) {
      const rec = '✅ Sistema consistente. No se detectaron inconsistencias en los datos.';
      report.recommendations.push(rec);
      console.log(rec);
    }

    report.recommendations.push('🔍 Ejecutar auditoría periódicamente (cada 24-48h) para monitoreo continuo.');
    console.log('🔍 Ejecutar auditoría periódicamente (cada 24-48h) para monitoreo continuo.');

    report.recommendations.push('🧪 Ejecutar simulación de concurrencia en ambiente de prueba antes de producción.');
    console.log('🧪 Ejecutar simulación de concurrencia en ambiente de prueba antes de producción.');

    report.recommendations.push('📊 Revisar logs con prefijos [CONCURRENCY_CHECK], [DIST_TRANSACTION], [CONSISTENCY_AUDIT].');
    console.log('📊 Revisar logs con prefijos [CONCURRENCY_CHECK], [DIST_TRANSACTION], [CONSISTENCY_AUDIT].');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETO FINALIZADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    return report;

  } catch (error) {
    console.error('❌ ERROR EN TEST DE CONCURRENCIA:', error);
    report.recommendations.push('❌ Error durante la ejecución del test. Revisar logs de error.');
    throw error;
  }
}