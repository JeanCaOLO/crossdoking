
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Pallet, PalletInventory, ImportLine } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/base/Toast';
import DistribucionModal from './components/DistribucionModal';
import QRScanner from '../../components/scanner/QRScanner';

export default function OperacionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [palletInventory, setPalletInventory] = useState<PalletInventory[]>([]);
  const [pendingLines, setPendingLines] = useState<ImportLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDistribucion, setShowDistribucion] = useState(false);

  const handleScan = async (code: string) => {
    setLoading(true);
    setShowScanner(false);

    try {
      const { data: pallet, error: palletError } = await supabase
        .from('pallets')
        .select('*')
        .eq('pallet_code', code)
        .maybeSingle();

      if (palletError) throw palletError;

      if (!pallet) {
        showToast(
          'error',
          'Pallet no encontrado',
          'El código escaneado no corresponde a ningún pallet registrado'
        );
        return;
      }

      if (pallet.status === 'BLOCKED') {
        showToast('warning', 'Pallet bloqueado', 'Este pallet está bloqueado y no puede ser utilizado');
        return;
      }

      if (pallet.locked_by && pallet.locked_by !== user?.id) {
        showToast('warning', 'Pallet en uso', 'Este pallet está siendo usado por otro usuario');
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
    } catch (error: any) {
      console.error('Error escaneando pallet:', error);
      showToast('error', 'Error al escanear', 'No se pudo procesar el código escaneado');
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
      console.error('Error desbloqueando pallet:', error);
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
      console.error('Error refrescando datos del pallet:', error);
      showToast('error', 'Error', 'No se pudo actualizar la información del pallet');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operación de Distribución</h2>
          <p className="text-sm text-gray-500 mt-1">
            Escanea pallets y distribuye productos a tiendas
          </p>
        </div>
        <Link
          to="/operacion/reportes"
          className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center"
        >
          <i className="ri-file-chart-line mr-2"></i>
          Ver Reportes
        </Link>
      </div>

      {!selectedPallet ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="ri-qr-scan-2-line text-4xl text-white"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Escanear Pallet</h2>
          <p className="text-sm text-gray-500 mb-8">
            Escanea el código QR del pallet para iniciar la distribución
          </p>
          <button
            onClick={() => setShowScanner(true)}
            className="px-8 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-700 transition-all text-sm whitespace-nowrap cursor-pointer"
          >
            <i className="ri-camera-line mr-2"></i>
            Activar Cámara
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPallet.pallet_code}</h2>
                <p className="text-sm text-gray-500">Ubicación: {selectedPallet.ubicacion}</p>
              </div>
              <button
                onClick={handleUnlock}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-lock-unlock-line mr-2"></i>
                Liberar Pallet
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Inventario Disponible
                </h3>
                <div className="space-y-2">
                  {palletInventory.map((inv) => (
                    <div key={inv.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{inv.sku}</span>
                        <span className="text-base font-bold text-teal-600">
                          {inv.qty_available}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Inicial: {inv.qty_initial}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Pedidos Pendientes
                </h3>
                <div className="space-y-2">
                  {pendingLines.map((line) => (
                    <div key={line.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{line.sku}</span>
                        <div className="flex items-center gap-2">
                          {line.camion && (
                            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center">
                              <i className="ri-truck-line mr-1"></i>
                              {line.camion}
                            </span>
                          )}
                          <span className="text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                            {line.tienda}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Pendiente: {line.qty_to_send - line.qty_confirmed} / {line.qty_to_send}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setShowDistribucion(true)}
                disabled={palletInventory.length === 0 || pendingLines.length === 0}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap cursor-pointer"
              >
                <i className="ri-box-3-line mr-2"></i>
                Iniciar Distribución
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
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
