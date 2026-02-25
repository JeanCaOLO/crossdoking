
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Pallet, PalletInventory, ImportLine } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/base/Toast';
import DistribucionModal from './components/DistribucionModal';

export default function OperacionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [palletInput, setPalletInput] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [palletInventory, setPalletInventory] = useState<PalletInventory[]>([]);
  const [pendingLines, setPendingLines] = useState<ImportLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDistribucion, setShowDistribucion] = useState(false);
  const palletInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the pallet input on mount
  useEffect(() => {
    palletInputRef.current?.focus();
  }, []);

  // Re-focus after closing modal
  useEffect(() => {
    if (!showDistribucion && !selectedPallet) {
      setTimeout(() => palletInputRef.current?.focus(), 100);
    }
  }, [showDistribucion, selectedPallet]);

  const handlePalletSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = palletInput.trim();
    if (!code) return;

    setLoading(true);
    try {
      const { data: pallet, error: palletError } = await supabase
        .from('pallets')
        .select('*')
        .eq('pallet_code', code)
        .maybeSingle();

      if (palletError) throw palletError;

      if (!pallet) {
        showToast('error', 'Pallet no encontrado', 'El código no corresponde a ningún pallet registrado');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      if (pallet.status === 'BLOCKED') {
        showToast('warning', 'Pallet bloqueado', 'Este pallet está bloqueado y no puede ser utilizado');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      if (pallet.locked_by && pallet.locked_by !== user?.id) {
        showToast('warning', 'Pallet en uso', 'Este pallet está siendo usado por otro usuario');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      await supabase
        .from('pallets')
        .update({ locked_by: user?.id, locked_at: new Date().toISOString() })
        .eq('id', pallet.id);

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'SCAN_PALLET',
        raw_code: code,
        user_id: user?.id,
      });

      const { data: inventory } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', pallet.id)
        .gt('qty_available', 0);

      const { data: lines } = await supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', pallet.pallet_code)
        .in('status', ['PENDING', 'PARTIAL']);

      setSelectedPallet(pallet);
      setPalletInventory(inventory ?? []);
      setPendingLines(lines ?? []);
      setPalletInput('');
    } catch (error: any) {
      showToast('error', 'Error al leer pallet', 'No se pudo procesar el código');
      setPalletInput('');
      palletInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedPallet) return;
    try {
      await supabase
        .from('pallets')
        .update({ locked_by: null, locked_at: null })
        .eq('id', selectedPallet.id);

      await supabase.from('scan_events').insert({
        pallet_id: selectedPallet.id,
        event_type: 'UNLOCK',
        user_id: user?.id,
      });

      setSelectedPallet(null);
      setPalletInventory([]);
      setPendingLines([]);
    } catch (error: any) {
      showToast('error', 'Error', 'No se pudo liberar el pallet');
    }
  };

  const refreshData = async () => {
    if (!selectedPallet) return;
    try {
      const { data: inventory } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', selectedPallet.id)
        .gt('qty_available', 0);

      const { data: lines } = await supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', selectedPallet.pallet_code)
        .in('status', ['PENDING', 'PARTIAL']);

      setPalletInventory(inventory ?? []);
      setPendingLines(lines ?? []);
    } catch (error: any) {
      showToast('error', 'Error', 'No se pudo actualizar la información del pallet');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto md:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-gray-900">Operación</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Escanea pallets y distribuye productos</p>
        </div>
        <Link
          to="/operacion/reportes"
          className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
        >
          <i className="ri-file-chart-line"></i>
          <span className="hidden sm:inline">Ver Reportes</span>
          <span className="sm:hidden">Reportes</span>
        </Link>
      </div>

      {!selectedPallet ? (
        /* ── Pallet scan screen ── */
        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-12">
          <div className="max-w-sm mx-auto text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <i className="ri-qr-scan-2-line text-3xl md:text-4xl text-white"></i>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">Leer Pallet</h2>
            <p className="text-sm text-gray-500 mb-6">
              Escanea el código del pallet con el handheld o ingrésalo manualmente
            </p>

            <form onSubmit={handlePalletSubmit} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <i className="ri-barcode-line text-gray-400 text-lg"></i>
                </div>
                <input
                  ref={palletInputRef}
                  type="text"
                  value={palletInput}
                  onChange={(e) => setPalletInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePalletSubmit();
                  }}
                  placeholder="Código de pallet..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full pl-10 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-mono tracking-wider text-gray-900 placeholder-gray-400 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !palletInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg"></i>
                    Buscando...
                  </>
                ) : (
                  <>
                    <i className="ri-search-line text-lg"></i>
                    Buscar Pallet
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-4">
              <i className="ri-information-line mr-1"></i>
              El handheld enviará el código automáticamente al presionar Enter
            </p>
          </div>
        </div>
      ) : (
        /* ── Pallet loaded screen ── */
        <div className="space-y-4">
          {/* Pallet info card */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                  <i className="ri-stack-line text-white text-lg"></i>
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-gray-900">{selectedPallet.pallet_code}</h2>
                  <p className="text-xs text-gray-500">Ubicación: {selectedPallet.ubicacion}</p>
                </div>
              </div>
              <button
                onClick={handleUnlock}
                className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
              >
                <i className="ri-lock-unlock-line"></i>
                <span className="hidden sm:inline">Liberar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Inventory */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Inventario Disponible
                </h3>
                <div className="space-y-2">
                  {palletInventory.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Sin inventario disponible</p>
                  ) : (
                    palletInventory.map((inv) => (
                      <div key={inv.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-gray-900 font-mono">{inv.sku}</span>
                          <p className="text-xs text-gray-400 mt-0.5">Inicial: {inv.qty_initial}</p>
                        </div>
                        <span className="text-xl font-bold text-teal-600">{inv.qty_available}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pending orders */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Pedidos Pendientes
                </h3>
                <div className="space-y-2">
                  {pendingLines.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Sin pedidos pendientes</p>
                  ) : (
                    pendingLines.map((line) => (
                      <div key={line.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-900 font-mono">{line.sku}</span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {line.camion && (
                              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <i className="ri-truck-line"></i>
                                {line.camion}
                              </span>
                            )}
                            <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                              {line.tienda}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Pendiente: <strong>{line.qty_to_send - line.qty_confirmed}</strong> / {line.qty_to_send}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowDistribucion(true)}
                disabled={palletInventory.length === 0 || pendingLines.length === 0}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="ri-box-3-line text-lg"></i>
                Iniciar Distribución
              </button>
            </div>
          </div>
        </div>
      )}

      {showDistribucion && selectedPallet && (
        <DistribucionModal
          pallet={selectedPallet}
          inventory={palletInventory}
          pendingLines={pendingLines}
          onClose={() => {
            setShowDistribucion(false);
            refreshData();
          }}
          onComplete={() => {
            setShowDistribucion(false);
            handleUnlock();
          }}
        />
      )}
    </div>
  );
}
