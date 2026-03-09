import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../components/base/Toast';
import { useAuth } from '../../../../contexts/AuthContext';

interface LineDetails {
  id: string;
  container_id: string;
  pallet_id: string;
  sku: string;
  qty: number;
  source_import_line_id: string;
  pallet_code: string;
  descripcion: string;
  tienda: string;
}

interface Props {
  lineId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReverseLineModal({ lineId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lineDetails, setLineDetails] = useState<LineDetails | null>(null);
  const [error, setError] = useState('');

  // Cargar detalles de la línea
  useEffect(() => {
    loadLineDetails();
  }, [lineId]);

  const loadLineDetails = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('container_lines')
        .select(`
          id,
          container_id,
          pallet_id,
          sku,
          qty,
          source_import_line_id,
          pallets(pallet_code),
          import_lines:source_import_line_id(descripcion, tienda)
        `)
        .eq('id', lineId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!data) {
        setError('Línea no encontrada');
        return;
      }

      setLineDetails({
        id: data.id,
        container_id: data.container_id,
        pallet_id: data.pallet_id,
        sku: data.sku,
        qty: data.qty,
        source_import_line_id: data.source_import_line_id,
        pallet_code: (data.pallets as any)?.pallet_code || '—',
        descripcion: (data.import_lines as any)?.descripcion || '—',
        tienda: (data.import_lines as any)?.tienda || '—',
      });
    } catch (err: any) {
      console.error('Error cargando detalles de línea:', err);
      setError('Error al cargar los detalles');
    }
  };

  const handleReverse = async () => {
    if (!lineDetails || !user) return;

    setLoading(true);
    setError('');

    console.log('[DIST_REVERSE] 🔄 Iniciando reversión:', {
      container_line_id: lineDetails.id,
      container_id: lineDetails.container_id,
      pallet_id: lineDetails.pallet_id,
      pallet_code: lineDetails.pallet_code,
      sku: lineDetails.sku,
      tienda: lineDetails.tienda,
      qty: lineDetails.qty,
      import_line_id: lineDetails.source_import_line_id,
      user_id: user.id,
      timestamp: new Date().toISOString()
    });

    try {
      // ✅ VALIDACIÓN 1: Verificar que el contenedor NO esté DISPATCHED
      console.log('[DIST_REVERSE] 📦 Verificando estado del contenedor...');
      const { data: container, error: containerError } = await supabase
        .from('containers')
        .select('status, code')
        .eq('id', lineDetails.container_id)
        .maybeSingle();

      if (containerError) {
        console.error('[DIST_REVERSE] ❌ Error consultando contenedor:', containerError);
        throw containerError;
      }

      if (!container) {
        console.error('[DIST_REVERSE] ❌ Contenedor no encontrado:', lineDetails.container_id);
        throw new Error('Contenedor no encontrado');
      }

      if (container.status === 'DISPATCHED') {
        console.error('[DIST_REVERSE] ❌ BLOQUEADO: Contenedor despachado', {
          container_id: lineDetails.container_id,
          container_code: container.code,
          status: container.status
        });
        throw new Error('No se pueden reversar líneas de contenedores despachados');
      }

      console.log('[DIST_REVERSE] ✅ Contenedor válido para reverso:', {
        container_code: container.code,
        status: container.status
      });

      // ✅ VALIDACIÓN 2: Verificar existencia de inventario del pallet
      console.log('[DIST_REVERSE] 📊 Verificando inventario del pallet...');
      const { data: currentInv, error: invFetchError } = await supabase
        .from('pallet_inventory')
        .select('id, qty_available')
        .eq('pallet_id', lineDetails.pallet_id)
        .eq('sku', lineDetails.sku)
        .maybeSingle();

      if (invFetchError) {
        console.error('[DIST_REVERSE] ❌ Error consultando inventario:', invFetchError);
        throw invFetchError;
      }

      if (!currentInv) {
        console.error('[DIST_REVERSE] ❌ Inventario del pallet no encontrado:', {
          pallet_id: lineDetails.pallet_id,
          sku: lineDetails.sku
        });
        throw new Error('Inventario del pallet no encontrado');
      }

      console.log('[DIST_REVERSE] ✅ Inventario encontrado:', {
        inventory_id: currentInv.id,
        current_qty_available: currentInv.qty_available,
        qty_to_return: lineDetails.qty,
        new_qty_available: currentInv.qty_available + lineDetails.qty
      });

      // ✅ PASO 1: Devolver cantidad al inventario del pallet
      console.log('[DIST_REVERSE] 📦 Devolviendo cantidad al pallet...');
      const newQtyAvailable = currentInv.qty_available + lineDetails.qty;
      const { error: invError } = await supabase
        .from('pallet_inventory')
        .update({ qty_available: newQtyAvailable })
        .eq('id', currentInv.id);

      if (invError) {
        console.error('[DIST_REVERSE] ❌ Error actualizando inventario:', invError);
        throw invError;
      }

      console.log('[DIST_REVERSE] ✅ Inventario actualizado:', {
        inventory_id: currentInv.id,
        old_qty: currentInv.qty_available,
        new_qty: newQtyAvailable
      });

      // ✅ VALIDACIÓN 3: Verificar existencia de línea de importación
      console.log('[DIST_REVERSE] 📋 Verificando línea de importación...');
      const { data: importLine, error: importFetchError } = await supabase
        .from('import_lines')
        .select('id, qty_confirmed, qty_to_send, status')
        .eq('id', lineDetails.source_import_line_id)
        .maybeSingle();

      if (importFetchError) {
        console.error('[DIST_REVERSE] ❌ Error consultando import_lines:', importFetchError);
        throw importFetchError;
      }

      if (!importLine) {
        console.error('[DIST_REVERSE] ❌ Línea de importación no encontrada:', lineDetails.source_import_line_id);
        throw new Error('Línea de importación no encontrada');
      }

      console.log('[DIST_REVERSE] ✅ Import line encontrada:', {
        import_line_id: importLine.id,
        current_qty_confirmed: importLine.qty_confirmed,
        qty_to_send: importLine.qty_to_send,
        current_status: importLine.status
      });

      // ✅ PASO 2: Restar cantidad confirmada y recalcular estado
      const newConfirmed = Math.max(0, importLine.qty_confirmed - lineDetails.qty);
      let newStatus: string;
      
      if (newConfirmed === 0) {
        newStatus = 'PENDING';
      } else if (newConfirmed >= importLine.qty_to_send) {
        newStatus = 'DONE';
      } else {
        newStatus = 'PARTIAL';
      }

      console.log('[DIST_REVERSE] 📋 Calculando nuevo estado de import_lines:', {
        old_confirmed: importLine.qty_confirmed,
        qty_to_reverse: lineDetails.qty,
        new_confirmed: newConfirmed,
        qty_to_send: importLine.qty_to_send,
        old_status: importLine.status,
        new_status: newStatus
      });

      const updatePayload: any = {
        qty_confirmed: newConfirmed,
        status: newStatus,
      };

      // Si el nuevo estado no es DONE, limpiar campos de finalización
      if (newStatus !== 'DONE') {
        updatePayload.done_at = null;
        updatePayload.done_by = null;
        console.log('[DIST_REVERSE] 🔄 Limpiando campos done_at y done_by (status != DONE)');
      }

      const { error: lineError } = await supabase
        .from('import_lines')
        .update(updatePayload)
        .eq('id', lineDetails.source_import_line_id);

      if (lineError) {
        console.error('[DIST_REVERSE] ❌ Error actualizando import_lines:', lineError);
        throw lineError;
      }

      console.log('[DIST_REVERSE] ✅ Import line actualizada:', {
        import_line_id: lineDetails.source_import_line_id,
        new_confirmed: newConfirmed,
        new_status: newStatus
      });

      // ✅ PASO 3: Eliminar la línea del contenedor
      console.log('[DIST_REVERSE] 🗑️ Eliminando línea del contenedor...');
      const { error: deleteError } = await supabase
        .from('container_lines')
        .delete()
        .eq('id', lineDetails.id);

      if (deleteError) {
        console.error('[DIST_REVERSE] ❌ Error eliminando container_line:', deleteError);
        throw deleteError;
      }

      console.log('[DIST_REVERSE] ✅ Container line eliminada:', {
        container_line_id: lineDetails.id
      });

      // ✅ PASO 4: Registrar evento de reversión
      console.log('[DIST_REVERSE] 📝 Registrando evento de reversión...');
      const { error: eventError } = await supabase.from('scan_events').insert({
        pallet_id: lineDetails.pallet_id,
        event_type: 'REVERSE',
        sku: lineDetails.sku,
        tienda: lineDetails.tienda,
        qty: lineDetails.qty,
        user_id: user.id,
        notes: JSON.stringify({
          container_id: lineDetails.container_id,
          container_line_id: lineDetails.id,
          import_line_id: lineDetails.source_import_line_id,
          old_confirmed: importLine.qty_confirmed,
          new_confirmed: newConfirmed,
          old_status: importLine.status,
          new_status: newStatus,
          old_inventory: currentInv.qty_available,
          new_inventory: newQtyAvailable
        }),
      });

      if (eventError) {
        console.warn('[DIST_REVERSE] ⚠️ Error registrando scan_event (no crítico):', eventError);
      } else {
        console.log('[DIST_REVERSE] ✅ Evento registrado en scan_events');
      }

      console.log('[DIST_REVERSE] ✅ REVERSIÓN COMPLETADA EXITOSAMENTE:', {
        container_line_id: lineDetails.id,
        pallet_code: lineDetails.pallet_code,
        sku: lineDetails.sku,
        tienda: lineDetails.tienda,
        qty_reversed: lineDetails.qty,
        inventory_restored: newQtyAvailable,
        import_line_new_status: newStatus,
        import_line_new_confirmed: newConfirmed
      });

      showToast(
        'success',
        'Línea reversada',
        `${lineDetails.qty} uds de ${lineDetails.sku} devueltas al pallet ${lineDetails.pallet_code}`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[DIST_REVERSE] ❌ ERROR EN REVERSIÓN:', {
        error: err,
        message: err instanceof Error ? err.message : 'Error desconocido',
        container_line_id: lineDetails.id,
        pallet_id: lineDetails.pallet_id,
        sku: lineDetails.sku,
        tienda: lineDetails.tienda,
        qty: lineDetails.qty
      });
      setError(err.message || 'Error al reversar la línea');
      showToast('error', 'Error', err.message || 'No se pudo reversar la línea');
    } finally {
      setLoading(false);
    }
  };

  if (!lineDetails) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Reversar Línea</h3>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <i className="ri-alert-line text-amber-600 text-xl mr-3 mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">Confirmar reversión</p>
                <p className="text-sm text-amber-700">
                  Esta acción devolverá la cantidad al pallet de origen y actualizará el estado del pedido.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Pallet:</span>
              <span className="text-sm font-semibold text-gray-900">{lineDetails.pallet_code}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">SKU:</span>
              <span className="text-sm font-semibold text-gray-900">{lineDetails.sku}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Descripción:</span>
              <span className="text-sm text-gray-900">{lineDetails.descripcion}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Tienda:</span>
              <span className="text-sm font-semibold text-gray-900">{lineDetails.tienda}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">Cantidad a reversar:</span>
              <span className="text-lg font-bold text-amber-600">{lineDetails.qty} uds</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleReverse}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line mr-2 animate-spin"></i>
                  Reversando...
                </>
              ) : (
                <>
                  <i className="ri-arrow-go-back-line mr-2"></i>
                  Confirmar Reversión
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}