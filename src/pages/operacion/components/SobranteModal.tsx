
import { useState, useEffect } from 'react';
import { supabase, Pallet } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/base/Toast';

interface InventoryItem {
  id: string;
  pallet_id: string;
  sku: string;
  qty_initial: number;
  qty_available: number;
}

interface SobranteEntry {
  sku: string;
  qty_available: number;
  qty_sobrante: number;
}

interface Props {
  pallet: Pallet;
  importId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function SobranteModal({ pallet, importId, onClose, onComplete }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<SobranteEntry[]>([]);
  const [containerCode, setContainerCode] = useState('');
  const [step, setStep] = useState<'review' | 'confirm'>('review');

  useEffect(() => {
    loadRemainingInventory();
  }, []);

  const loadRemainingInventory = async () => {
    setLoading(true);
    try {
      const { data: inventory } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', pallet.id)
        .gt('qty_available', 0);

      if (!inventory || inventory.length === 0) {
        showToast('info', 'Sin sobrantes', 'No hay inventario disponible en este pallet');
        onClose();
        return;
      }

      const items: SobranteEntry[] = inventory.map((inv: InventoryItem) => ({
        sku: inv.sku,
        qty_available: inv.qty_available,
        qty_sobrante: inv.qty_available,
      }));

      setEntries(items);
    } catch (err) {
      showToast('error', 'Error', 'No se pudo cargar el inventario restante');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const updateQty = (index: number, value: string) => {
    const qty = parseFloat(value) || 0;
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === index
          ? { ...entry, qty_sobrante: Math.min(Math.max(0, qty), entry.qty_available) }
          : entry
      )
    );
  };

  const totalSobrante = entries.reduce((sum, e) => sum + e.qty_sobrante, 0);
  const hasValidEntries = entries.some((e) => e.qty_sobrante > 0);

  const generateSurplusContainerCode = async (): Promise<string> => {
    const prefix = 'SOB';
    const { data: lastContainer } = await supabase
      .from('containers')
      .select('code')
      .like('code', `${prefix}%`)
      .order('code', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1;
    if (lastContainer?.code) {
      const lastNumber = parseInt(lastContainer.code.substring(3), 10);
      nextNumber = lastNumber + 1;
    }
    return `${prefix}${nextNumber.toString().padStart(8, '0')}`;
  };

  const handleSubmit = async () => {
    if (!user || !hasValidEntries) return;
    setSubmitting(true);

    try {
      const code = await generateSurplusContainerCode();
      setContainerCode(code);

      // Crear contenedor de sobrante
      const { data: newContainer, error: containerError } = await supabase
        .from('containers')
        .insert({
          code,
          import_id: importId,
          tienda: 'SOBRANTE',
          status: 'CLOSED',
          type: 'SOBRANTE',
          created_by: user.id,
          closed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (containerError) throw containerError;

      // Insertar líneas del sobrante y descontar inventario
      for (const entry of entries) {
        if (entry.qty_sobrante <= 0) continue;

        // Insertar línea en contenedor
        const { error: lineError } = await supabase
          .from('container_lines')
          .insert({
            container_id: newContainer.id,
            pallet_id: pallet.id,
            sku: entry.sku,
            qty: entry.qty_sobrante,
            source_import_line_id: null,
          });
        if (lineError) throw lineError;

        // Descontar del inventario del pallet
        const { data: currentInv } = await supabase
          .from('pallet_inventory')
          .select('qty_available')
          .eq('pallet_id', pallet.id)
          .eq('sku', entry.sku)
          .maybeSingle();

        if (currentInv) {
          const newAvailable = Math.max(0, currentInv.qty_available - entry.qty_sobrante);
          await supabase
            .from('pallet_inventory')
            .update({ qty_available: newAvailable })
            .eq('pallet_id', pallet.id)
            .eq('sku', entry.sku);
        }

        // Registrar evento de escaneo
        await supabase.from('scan_events').insert({
          pallet_id: pallet.id,
          event_type: 'ADJUST',
          sku: entry.sku,
          tienda: 'SOBRANTE',
          qty: entry.qty_sobrante,
          notes: `Sobrante reportado en contenedor ${code}`,
          user_id: user.id,
        });
      }

      // Registrar movimiento de distribución para cada SKU sobrante
      for (const entry of entries) {
        if (entry.qty_sobrante <= 0) continue;
        await supabase.from('distribution_moves').insert({
          import_id: importId,
          pallet_id: pallet.id,
          sku: entry.sku,
          tienda: 'SOBRANTE',
          qty: entry.qty_sobrante,
          user_id: user.id,
          source_import_line_id: '00000000-0000-0000-0000-000000000000',
        });
      }

      setStep('confirm');
      showToast('success', 'Sobrante registrado', `Contenedor ${code} creado con ${totalSobrante} unidades`);
    } catch (err) {
      console.error('Error al reportar sobrante:', err);
      showToast('error', 'Error', err instanceof Error ? err.message : 'No se pudo registrar el sobrante');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60]">
      <div className="bg-white w-full md:max-w-lg md:rounded-xl shadow-xl flex flex-col max-h-[90vh] rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <i className="ri-archive-2-line text-white text-lg"></i>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-gray-900">Reportar Sobrante</h2>
              <p className="text-xs text-gray-500 font-mono">{pallet.pallet_code}</p>
            </div>
          </div>
          <button
            onClick={step === 'confirm' ? onComplete : onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="ri-loader-4-line animate-spin text-3xl text-teal-500 mb-3"></i>
              <p className="text-sm text-gray-500">Cargando inventario...</p>
            </div>
          ) : step === 'review' ? (
            <div className="space-y-4">
              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-600 text-lg flex-shrink-0 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Mercadería sobrante detectada</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Estos SKUs tienen inventario disponible después de completar la distribución. 
                    Confirma las cantidades sobrantes para registrarlas en un contenedor de sobrantes.
                  </p>
                </div>
              </div>

              {/* SKU entries */}
              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <div
                    key={entry.sku}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-bold text-gray-900 font-mono">{entry.sku}</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Disponible en pallet: <strong className="text-amber-600">{entry.qty_available}</strong> uds
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Cantidad sobrante
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(index, String(Math.max(0, entry.qty_sobrante - 1)))}
                          className="w-11 h-11 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <i className="ri-subtract-line text-lg"></i>
                        </button>
                        <input
                          type="number"
                          value={entry.qty_sobrante || ''}
                          onChange={(e) => updateQty(index, e.target.value)}
                          className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          min="0"
                          max={entry.qty_available}
                          step="1"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() => updateQty(index, String(Math.min(entry.qty_available, entry.qty_sobrante + 1)))}
                          className="w-11 h-11 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <i className="ri-add-line text-lg"></i>
                        </button>
                      </div>
                      {/* Quick fill button */}
                      <button
                        onClick={() => updateQty(index, String(entry.qty_available))}
                        className="mt-2 w-full py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        Usar todo el disponible ({entry.qty_available})
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sobrante</p>
                    <p className="text-xs text-gray-500 mt-0.5">{entries.filter(e => e.qty_sobrante > 0).length} SKU(s)</p>
                  </div>
                  <span className="text-3xl font-bold text-amber-600">{totalSobrante}</span>
                </div>
              </div>
            </div>
          ) : (
            /* ── Confirmation step ── */
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mb-5">
                <i className="ri-checkbox-circle-line text-4xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sobrante Registrado</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Se creó el contenedor de sobrantes exitosamente
              </p>

              <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Contenedor</span>
                  <span className="text-sm font-bold text-gray-900 font-mono">{containerCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Tipo</span>
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                    SOBRANTE
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total unidades</span>
                  <span className="text-sm font-bold text-amber-600">{totalSobrante}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalle</p>
                  {entries.filter(e => e.qty_sobrante > 0).map((entry) => (
                    <div key={entry.sku} className="flex items-center justify-between py-1.5">
                      <span className="text-sm font-mono text-gray-700">{entry.sku}</span>
                      <span className="text-sm font-semibold text-gray-900">{entry.qty_sobrante} uds</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-100 flex-shrink-0">
          {step === 'review' ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors cursor-pointer text-sm whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasValidEntries || submitting}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {submitting ? (
                  <><i className="ri-loader-4-line animate-spin"></i>Registrando...</>
                ) : (
                  <><i className="ri-archive-2-line"></i>Registrar Sobrante</>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onComplete}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all cursor-pointer text-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ri-check-line text-lg"></i>
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
