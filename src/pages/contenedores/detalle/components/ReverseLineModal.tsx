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

    try {
      // 1. Verificar que el contenedor NO esté DISPATCHED
      const { data: container } = await supabase
        .from('containers')
        .select('status')
        .eq('id', lineDetails.container_id)
        .maybeSingle();

      if (!container) {
        throw new Error('Contenedor no encontrado');
      }

      if (container.status === 'DISPATCHED') {
        throw new Error('No se pueden reversar líneas de contenedores despachados');
      }

      // 2. Devolver cantidad al inventario del pallet
      const { data: currentInv } = await supabase
        .from('pallet_inventory')
        .select('qty_available')
        .eq('pallet_id', lineDetails.pallet_id)
        .eq('sku', lineDetails.sku)
        .maybeSingle();

      if (!currentInv) {
        throw new Error('Inventario del pallet no encontrado');
      }

      const { error: invError } = await supabase
        .from('pallet_inventory')
        .update({ qty_available: currentInv.qty_available + lineDetails.qty })
        .eq('pallet_id', lineDetails.pallet_id)
        .eq('sku', lineDetails.sku);

      if (invError) throw invError;

      // 3. Restar cantidad confirmada de la línea de importación
      const { data: importLine } = await supabase
        .from('import_lines')
        .select('qty_confirmed, qty_to_send')
        .eq('id', lineDetails.source_import_line_id)
        .maybeSingle();

      if (!importLine) {
        throw new Error('Línea de importación no encontrada');
      }

      const newConfirmed = Math.max(0, importLine.qty_confirmed - lineDetails.qty);
      const newStatus = newConfirmed === 0 ? 'PENDING' : newConfirmed >= importLine.qty_to_send ? 'DONE' : 'PARTIAL';

      const { error: lineError } = await supabase
        .from('import_lines')
        .update({
          qty_confirmed: newConfirmed,
          status: newStatus,
          ...(newStatus !== 'DONE' ? { done_at: null, done_by: null } : {}),
        })
        .eq('id', lineDetails.source_import_line_id);

      if (lineError) throw lineError;

      // 4. Eliminar la línea del contenedor
      const { error: deleteError } = await supabase
        .from('container_lines')
        .delete()
        .eq('id', lineDetails.id);

      if (deleteError) throw deleteError;

      // 5. Registrar evento de reversión
      await supabase.from('scan_events').insert({
        pallet_id: lineDetails.pallet_id,
        event_type: 'REVERSE',
        sku: lineDetails.sku,
        tienda: lineDetails.tienda,
        qty: lineDetails.qty,
        user_id: user.id,
        notes: `Reversión de línea de contenedor`,
      });

      showToast(
        'success',
        'Línea reversada',
        `${lineDetails.qty} uds de ${lineDetails.sku} devueltas al pallet ${lineDetails.pallet_code}`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error reversando línea:', err);
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
