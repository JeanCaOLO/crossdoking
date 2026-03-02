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

    // ✅ VALIDACIÓN 1: Verificar que el contenedor esté OPEN
    const { data: container } = await supabase
      .from('containers')
      .select('status, code')
      .eq('id', containerId)
      .maybeSingle();

    if (!container) {
      console.warn(`[ContainerService] ⚠️  Contenedor no encontrado: ${containerId}`);
      return { success: false, error: 'Contenedor no encontrado' };
    }

    if (container.status !== 'OPEN') {
      console.warn(`[ContainerService] ⚠️  Contenedor ${container.code} no está OPEN (estado: ${container.status})`);
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
      return { success: false, error: 'Línea de importación no encontrada' };
    }

    const pending = importLine.qty_to_send - importLine.qty_confirmed;
    if (qty > pending) {
      console.warn(
        `[ContainerService] ⚠️  Qty supera pendiente` +
        ` | Pendiente: ${pending}` +
        ` | Solicitado: ${qty}`
      );
      return { success: false, error: 'Cantidad mayor al pendiente del pedido' };
    }

    // ✅ INSERTAR LÍNEA EN CONTENEDOR
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
      return { success: false, error: `Error al insertar línea: ${insertError.message}` };
    }

    console.log(
      `[ContainerService] ✅ Container line insertada` +
      ` | Container: ${containerId} (${container.code})` +
      ` | SKU: ${sku}` +
      ` | Qty (delta): ${qty}`
    );
    return { success: true };
  } catch (error) {
    console.error('[ContainerService] ❌ Error en addContainerLineWithValidation:', error);
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
