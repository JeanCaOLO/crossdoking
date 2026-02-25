import { useState, useRef, useEffect } from 'react';
import { supabase, Pallet, PalletInventory, ImportLine } from '../../../lib/supabase';
import { getOrCreateOpenContainer, isContainerEditable } from '../../../lib/containerService';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/base/Toast';
import QRScanner from '../../../components/scanner/QRScanner';
import TiendaChangePopup from './TiendaChangePopup';

interface Props {
  pallet: Pallet;
  inventory: PalletInventory[];
  pendingLines: ImportLine[];
  onClose: () => void;
  onComplete: () => void;
}

interface TiendaProgress {
  tienda: string;
  camion: string;
  qty_to_send: number;
  qty_confirmed: number;
  pending: number;
  status: 'PENDING' | 'PARTIAL' | 'DONE';
  importLineId: string;
}

export default function DistribucionModal({ pallet, inventory, pendingLines, onClose, onComplete }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<'scan' | 'confirm'>('scan');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedLine, setSelectedLine] = useState<ImportLine | null>(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedTiendaToClose, setSelectedTiendaToClose] = useState('');
  const [closingInProgress, setClosingInProgress] = useState(false);
  const [availableTiendas, setAvailableTiendas] = useState<string[]>([]);

  // Estado para selección manual de tienda
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [manualStoreSelection, setManualStoreSelection] = useState(false);

  // Estado para progreso del SKU y tiendas
  const [skuProgress, setSkuProgress] = useState<{ total: number; confirmed: number; percentage: number } | null>(null);
  const [tiendasProgress, setTiendasProgress] = useState<TiendaProgress[]>([]);
  // Cache de líneas completas para selección rápida
  const [skuLinesCache, setSkuLinesCache] = useState<ImportLine[]>([]);

  // Estado para popup de cambio de tienda
  const [tiendaChange, setTiendaChange] = useState<{ prev: string; next: string; sku: string } | null>(null);
  const previousTiendaRef = useRef<string | null>(null);

  // Verificar si el usuario está cargado
  const hasUser = !authLoading && user !== null;

  // Calcular progreso del SKU y tiendas cuando cambia selectedSku o selectedStore
  useEffect(() => {
    if (selectedSku && step === 'confirm') {
      loadSkuProgress();
    } else {
      setSkuProgress(null);
      setTiendasProgress([]);
      setSkuLinesCache([]);
    }
  }, [selectedSku, step]);

  const loadSkuProgress = async () => {
    try {
      const { data: lines } = await supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', pallet.pallet_code)
        .eq('sku', selectedSku)
        .order('tienda', { ascending: true });

      if (!lines || lines.length === 0) return;

      // Guardar cache de líneas
      setSkuLinesCache(lines);

      const total = lines.reduce((sum, l) => sum + l.qty_to_send, 0);
      const confirmed = lines.reduce((sum, l) => sum + l.qty_confirmed, 0);
      const percentage = total > 0 ? Math.round((confirmed / total) * 100) : 0;

      setSkuProgress({ total, confirmed, percentage });

      const tiendas: TiendaProgress[] = lines.map((line) => ({
        tienda: line.tienda,
        camion: line.camion || '',
        qty_to_send: line.qty_to_send,
        qty_confirmed: line.qty_confirmed,
        pending: line.qty_to_send - line.qty_confirmed,
        status: line.status,
        importLineId: line.id,
      }));

      setTiendasProgress(tiendas);
    } catch (err) {
      console.error('Error cargando progreso del SKU:', err);
    }
  };

  /**
   * Obtiene la siguiente línea pendiente para un SKU
   */
  const getNextPendingLine = async (sku: string): Promise<ImportLine | null> => {
    try {
      const { data: lines } = await supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', pallet.pallet_code)
        .eq('sku', sku)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('tienda', { ascending: true });

      if (!lines || lines.length === 0) return null;
      
      const nextLine = lines.find((l) => l.qty_confirmed < l.qty_to_send);
      return nextLine || null;
    } catch (err) {
      console.error('Error buscando siguiente línea:', err);
      return null;
    }
  };

  /**
   * Selecciona una tienda de la tabla manualmente
   */
  const handleStoreClick = (tienda: TiendaProgress) => {
    if (tienda.pending <= 0) {
      showToast('warning', 'Tienda completa', `${tienda.tienda} ya tiene todas las unidades confirmadas`);
      return;
    }

    // Buscar la línea correspondiente en el cache
    const line = skuLinesCache.find((l) => l.tienda === tienda.tienda);
    if (!line) return;

    const prevStore = selectedStore;
    setSelectedStore(tienda.tienda);
    setSelectedLine(line);
    setManualStoreSelection(true);
    setQuantity('');
    setError('');

    if (prevStore && prevStore !== tienda.tienda) {
      showToast('info', 'Tienda cambiada', `Ahora distribuyendo a ${tienda.tienda}`);
    }
  };

  /**
   * Volver al modo automático
   */
  const handleBackToAuto = async () => {
    setManualStoreSelection(false);
    const nextLine = await getNextPendingLine(selectedSku);
    if (nextLine) {
      setSelectedLine(nextLine);
      setSelectedStore(nextLine.tienda);
      setQuantity('');
      setError('');
      showToast('info', 'Modo automático', `Tienda activa: ${nextLine.tienda}`);
    }
  };

  const handleSkuScan = async (code: string) => {
    setShowScanner(false);
    setError('');

    let resolvedSku = code;
    let inv = inventory.find((i) => i.sku === code);

    if (!inv) {
      const { data: lineByBarcode } = await supabase
        .from('import_lines')
        .select('sku')
        .eq('barcode', code)
        .eq('pallet_code', pallet.pallet_code)
        .limit(1)
        .maybeSingle();

      if (lineByBarcode) {
        resolvedSku = lineByBarcode.sku;
        inv = inventory.find((i) => i.sku === resolvedSku);
      }
    }

    if (!inv) {
      setError('SKU/Código de barra no encontrado en este pallet');
      return;
    }

    const { data: currentInv } = await supabase
      .from('pallet_inventory')
      .select('*')
      .eq('id', inv.id)
      .maybeSingle();

    if (!currentInv || currentInv.qty_available <= 0) {
      setError('No hay cantidad disponible para este SKU en el pallet');
      return;
    }

    // Obtener todas las líneas pendientes para este SKU
    const { data: allLines } = await supabase
      .from('import_lines')
      .select('*')
      .eq('pallet_code', pallet.pallet_code)
      .eq('sku', resolvedSku)
      .in('status', ['PENDING', 'PARTIAL'])
      .order('tienda', { ascending: true });

    if (!allLines || allLines.length === 0) {
      setError('No hay pedidos pendientes para este SKU');
      return;
    }

    // Seleccionar la primera línea con pendiente > 0 (modo automático por defecto)
    const defaultLine = allLines.find((l) => l.qty_confirmed < l.qty_to_send);
    if (!defaultLine) {
      setError('No hay pedidos pendientes para este SKU');
      return;
    }

    // Guardar cache
    setSkuLinesCache(allLines);

    if (hasUser) {
      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'SCAN_SKU',
        raw_code: code,
        sku: resolvedSku,
        tienda: defaultLine.tienda,
        user_id: user.id,
      });
    }

    // Inicializar en modo automático
    previousTiendaRef.current = defaultLine.tienda;
    setSelectedSku(resolvedSku);
    setSelectedLine(defaultLine);
    setSelectedStore(defaultLine.tienda);
    setManualStoreSelection(false);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    console.log('🔵 handleConfirm iniciado');

    if (!hasUser) {
      console.log('❌ Usuario no disponible');
      setError('Sesión no cargada. Por favor, vuelve a iniciar sesión.');
      showToast('error', 'Error de sesión', 'Tu sesión no está cargada correctamente. Vuelve a iniciar sesión.');
      return;
    }

    if (!selectedLine || !quantity) {
      console.log('❌ Validación inicial fallida');
      return;
    }

    const qty = parseFloat(quantity);
    if (qty <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    const pending = selectedLine.qty_to_send - selectedLine.qty_confirmed;
    if (pending <= 0) {
      setError('Esta línea ya está completa');
      return;
    }

    const { data: currentInv } = await supabase
      .from('pallet_inventory')
      .select('*')
      .eq('pallet_id', pallet.id)
      .eq('sku', selectedSku)
      .maybeSingle();

    if (!currentInv || qty > currentInv.qty_available) {
      setError('Cantidad mayor al disponible en pallet');
      return;
    }

    if (qty > pending) {
      setError('Cantidad mayor al pendiente del pedido');
      return;
    }

    try {
      const containerId = await getOrCreateOpenContainer(
        selectedLine.import_id,
        selectedLine.tienda,
        user!.id
      );

      const editable = await isContainerEditable(containerId);
      if (!editable) {
        setError('El contenedor de esta tienda ya está cerrado');
        return;
      }

      const { error: invError } = await supabase
        .from('pallet_inventory')
        .update({ qty_available: currentInv.qty_available - qty })
        .eq('id', currentInv.id);

      if (invError) throw invError;

      const newConfirmed = selectedLine.qty_confirmed + qty;
      const newStatus = newConfirmed >= selectedLine.qty_to_send ? 'DONE' : 'PARTIAL';

      const { error: lineError } = await supabase
        .from('import_lines')
        .update({
          qty_confirmed: newConfirmed,
          status: newStatus,
          ...(newStatus === 'DONE' ? { done_at: new Date().toISOString(), done_by: user!.id } : {}),
        })
        .eq('id', selectedLine.id);

      if (lineError) throw lineError;

      const { error: containerLineError } = await supabase.from('container_lines').insert({
        container_id: containerId,
        pallet_id: pallet.id,
        sku: selectedSku,
        qty,
        source_import_line_id: selectedLine.id,
      });

      if (containerLineError) throw containerLineError;

      const { error: moveError } = await supabase.from('distribution_moves').insert({
        import_id: selectedLine.import_id,
        pallet_id: pallet.id,
        sku: selectedSku,
        tienda: selectedLine.tienda,
        qty,
        user_id: user!.id,
        source_import_line_id: selectedLine.id,
      });

      if (moveError) throw moveError;

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'CONFIRM_QTY',
        sku: selectedSku,
        tienda: selectedLine.tienda,
        qty,
        user_id: user!.id,
      });

      showToast('success', 'Cantidad confirmada', `${qty} uds de ${selectedSku} → ${selectedLine.tienda}`);

      // Recargar progreso del SKU
      await loadSkuProgress();

      // Lógica de auto-advance
      const currentStorePending = newConfirmed >= selectedLine.qty_to_send ? 0 : selectedLine.qty_to_send - newConfirmed;

      // Si es selección manual y la tienda aún tiene pendiente, mantenerla
      if (manualStoreSelection && currentStorePending > 0) {
        // Actualizar selectedLine con los nuevos valores
        setSelectedLine({
          ...selectedLine,
          qty_confirmed: newConfirmed,
          status: newStatus as any,
        });
        setQuantity('');
        setError('');
        return;
      }

      // Si la tienda se completó o es modo automático, buscar siguiente
      const nextLine = await getNextPendingLine(selectedSku);

      const { data: updatedInv } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', pallet.id)
        .eq('sku', selectedSku)
        .maybeSingle();

      const hasInventory = updatedInv && updatedInv.qty_available > 0;

      if (nextLine && hasInventory) {
        // Detectar cambio de tienda
        const prevTienda = previousTiendaRef.current;
        if (prevTienda && prevTienda !== nextLine.tienda) {
          setTiendaChange({
            prev: prevTienda,
            next: nextLine.tienda,
            sku: selectedSku,
          });
        }
        
        previousTiendaRef.current = nextLine.tienda;
        setSelectedLine(nextLine);
        setSelectedStore(nextLine.tienda);
        setManualStoreSelection(false);
        setQuantity('');
        setError('');
      } else {
        // No quedan tiendas pendientes para este SKU → volver a scan
        setStep('scan');
        setSelectedSku('');
        setSelectedLine(null);
        setSelectedStore('');
        setManualStoreSelection(false);
        setQuantity('');
        setError('');
        previousTiendaRef.current = null;

        const { data: allInv } = await supabase
          .from('pallet_inventory')
          .select('*')
          .eq('pallet_id', pallet.id)
          .gt('qty_available', 0);

        if (!allInv || allInv.length === 0) {
          showToast('info', 'Pallet agotado', 'Todo el inventario de este pallet ha sido distribuido');
          onComplete();
        }
      }
    } catch (err) {
      console.error('❌ Error en handleConfirm:', err);
      setError(`Error al confirmar cantidad: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  const handleOpenCloseModal = async () => {
    if (!hasUser) {
      showToast('error', 'Error de sesión', 'Tu sesión no está cargada. Vuelve a iniciar sesión.');
      return;
    }

    const importId = pendingLines[0]?.import_id;
    if (!importId) {
      showToast('error', 'Error', 'No se encontró el ID de importación');
      return;
    }

    const { data: openContainers } = await supabase
      .from('containers')
      .select('tienda')
      .eq('import_id', importId)
      .eq('status', 'OPEN');

    if (!openContainers || openContainers.length === 0) {
      showToast('warning', 'Sin contenedores', 'No hay contenedores abiertos para cerrar');
      return;
    }

    const tiendas = [...new Set(openContainers.map((c) => c.tienda))];
    setAvailableTiendas(tiendas);

    if (tiendas.length === 1) {
      setSelectedTiendaToClose(tiendas[0]);
    }
    setShowCloseModal(true);
  };

  const handleCerrarDistribucion = async () => {
    if (!hasUser) {
      showToast('error', 'Error de sesión', 'Tu sesión no está cargada. Vuelve a iniciar sesión.');
      return;
    }

    if (!selectedTiendaToClose) {
      setError('Debes seleccionar una tienda');
      return;
    }

    setClosingInProgress(true);

    try {
      const importId = pendingLines[0]?.import_id;
      if (!importId) {
        throw new Error('No se encontró el ID de importación');
      }

      const { data: openContainer } = await supabase
        .from('containers')
        .select('id, code')
        .eq('import_id', importId)
        .eq('tienda', selectedTiendaToClose)
        .eq('status', 'OPEN')
        .maybeSingle();

      if (!openContainer) {
        showToast('error', 'Sin contenedor', 'No hay contenedor abierto para esta tienda');
        setShowCloseModal(false);
        setSelectedTiendaToClose('');
        return;
      }

      const { count } = await supabase
        .from('container_lines')
        .select('id', { count: 'exact' })
        .eq('container_id', openContainer.id);

      if (!count || count === 0) {
        showToast('warning', 'Contenedor vacío', 'Confirma cantidades antes de cerrar el contenedor');
        setShowCloseModal(false);
        setSelectedTiendaToClose('');
        return;
      }

      const { error: updateError } = await supabase
        .from('containers')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
        })
        .eq('id', openContainer.id);

      if (updateError) throw updateError;

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'CLOSE',
        tienda: selectedTiendaToClose,
        notes: `Contenedor ${openContainer.code} cerrado con ${count} líneas`,
        user_id: user!.id,
      });

      showToast(
        'success',
        `Contenedor ${openContainer.code} cerrado`,
        `Tienda: ${selectedTiendaToClose} · ${count} líneas registradas`,
        6000
      );

      setShowCloseModal(false);
      setSelectedTiendaToClose('');
      onComplete();
    } catch (err) {
      console.error('Error cerrando distribución:', err);
      showToast('error', 'Error al cerrar', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setClosingInProgress(false);
    }
  };

  const loadAvailableTiendas = async () => {
    const importId = pendingLines[0]?.import_id;
    if (!importId) return;

    const { data: openContainers } = await supabase
      .from('containers')
      .select('tienda')
      .eq('import_id', importId)
      .eq('status', 'OPEN');

    if (openContainers) {
      const tiendas = [...new Set(openContainers.map((c) => c.tienda))];
      setAvailableTiendas(tiendas);
      if (tiendas.length === 1) {
        setSelectedTiendaToClose(tiendas[0]);
      }
    }
  };

  const currentPending = selectedLine ? selectedLine.qty_to_send - selectedLine.qty_confirmed : 0;
  const isConfirmDisabled = !hasUser || !quantity || parseFloat(quantity) <= 0 || currentPending <= 0;
  const isCloseDisabled = !hasUser;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Distribución - {pallet.pallet_code}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Mensaje de error de sesión */}
            {!hasUser && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <i className="ri-error-warning-line text-red-600 text-xl mr-3 mt-0.5"></i>
                  <div>
                    <p className="text-sm font-medium text-red-900 mb-1">Sesión no cargada</p>
                    <p className="text-sm text-red-700">
                      {authLoading 
                        ? 'Cargando tu sesión...' 
                        : 'Tu sesión no está disponible. Por favor, vuelve a iniciar sesión para continuar.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 'scan' ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <i className="ri-barcode-line text-4xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Escanear SKU / Código de Barra</h3>
                <p className="text-gray-600 mb-8">Escanea el código del producto o su código de barras</p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => setShowScanner(true)}
                  disabled={!hasUser}
                  className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-700 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-camera-line mr-2"></i>
                  Escanear SKU / Código de Barra
                </button>
              </div>
            ) : (
              <div>
                {/* Progreso del SKU */}
                {skuProgress && (
                  <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{selectedSku}</h3>
                        <p className="text-sm text-gray-600">Progreso total del SKU</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-teal-600">{skuProgress.percentage}%</div>
                        <div className="text-xs text-gray-500">
                          {skuProgress.confirmed} / {skuProgress.total} uds
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-cyan-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${skuProgress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Información de tienda activa */}
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Tienda Activa:</span>
                      <span className="text-lg font-bold text-sky-600">{selectedStore}</span>
                      {selectedLine?.camion && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full inline-flex items-center">
                          <i className="ri-truck-line mr-1"></i>
                          {selectedLine.camion}
                        </span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        manualStoreSelection
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {manualStoreSelection ? (
                        <>
                          <i className="ri-hand-coin-line mr-1"></i>
                          Manual
                        </>
                      ) : (
                        <>
                          <i className="ri-robot-line mr-1"></i>
                          Automática
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Pendiente:</span>
                    <span className={`text-lg font-bold ${currentPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {currentPending} uds
                    </span>
                  </div>
                  {manualStoreSelection && (
                    <button
                      onClick={handleBackToAuto}
                      className="mt-3 w-full px-3 py-2 bg-white border border-sky-200 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-50 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <i className="ri-robot-line"></i>
                      Volver a modo automático
                    </button>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                    {error}
                  </div>
                )}

                {currentPending <= 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm mb-6">
                    <i className="ri-checkbox-circle-line mr-2"></i>
                    Esta tienda ya está completa
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad a confirmar</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    disabled={currentPending <= 0 || !hasUser}
                  />
                </div>

                {/* Lista de tiendas con progreso - CLICKEABLE */}
                {tiendasProgress.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">Distribución por Tienda</h4>
                      <p className="text-xs text-gray-500">Haz clic en una tienda para seleccionarla</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Tienda</th>
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Camión</th>
                              <th className="px-4 py-3 text-center font-semibold text-gray-700">Requerido</th>
                              <th className="px-4 py-3 text-center font-semibold text-gray-700">Confirmado</th>
                              <th className="px-4 py-3 text-center font-semibold text-gray-700">Pendiente</th>
                              <th className="px-4 py-3 text-center font-semibold text-gray-700">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {tiendasProgress.map((tienda) => {
                              const isActive = tienda.tienda === selectedStore;
                              const isClickable = tienda.pending > 0;

                              return (
                                <tr
                                  key={tienda.tienda}
                                  onClick={() => handleStoreClick(tienda)}
                                  className={`transition-colors ${
                                    isActive
                                      ? 'bg-sky-50 ring-2 ring-inset ring-sky-400'
                                      : isClickable
                                      ? 'bg-white hover:bg-teal-50 cursor-pointer'
                                      : 'bg-gray-50/50 opacity-60 cursor-not-allowed'
                                  }`}
                                  title={
                                    isActive
                                      ? 'Tienda activa'
                                      : isClickable
                                      ? `Seleccionar ${tienda.tienda}`
                                      : 'Tienda ya completa'
                                  }
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center">
                                      {isActive ? (
                                        <i className="ri-checkbox-circle-fill text-sky-600 mr-2 text-base"></i>
                                      ) : isClickable ? (
                                        <i className="ri-radio-button-line text-gray-300 mr-2 text-base"></i>
                                      ) : (
                                        <i className="ri-checkbox-circle-fill text-emerald-400 mr-2 text-base"></i>
                                      )}
                                      <span className={`font-medium ${isActive ? 'text-sky-700' : 'text-gray-900'}`}>
                                        {tienda.tienda}
                                      </span>
                                      {isActive && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-600 text-white uppercase tracking-wide">
                                          Activa
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {tienda.camion ? (
                                      <span className="inline-flex items-center text-xs font-medium text-amber-700">
                                        <i className="ri-truck-line mr-1"></i>
                                        {tienda.camion}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-700">{tienda.qty_to_send}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="font-semibold text-teal-600">{tienda.qty_confirmed}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`font-semibold ${
                                        tienda.pending > 0 ? 'text-amber-600' : 'text-emerald-600'
                                      }`}
                                    >
                                      {tienda.pending}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                        tienda.status === 'DONE'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : tienda.status === 'PARTIAL'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}
                                    >
                                      {tienda.status === 'DONE' && <i className="ri-checkbox-circle-fill mr-1"></i>}
                                      {tienda.status === 'PARTIAL' && <i className="ri-time-line mr-1"></i>}
                                      {tienda.status === 'PENDING' && <i className="ri-hourglass-line mr-1"></i>}
                                      {tienda.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      setStep('scan');
                      setSelectedSku('');
                      setSelectedLine(null);
                      setSelectedStore('');
                      setManualStoreSelection(false);
                      setQuantity('');
                      setError('');
                      previousTiendaRef.current = null;
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirmDisabled}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handleOpenCloseModal}
                disabled={isCloseDisabled}
                className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg font-medium hover:from-rose-600 hover:to-rose-700 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-inbox-line mr-2"></i>
                Cerrar Distribución (Generar Licencia)
              </button>
            </div>
          </div>
        </div>

        {showScanner && <QRScanner onScan={handleSkuScan} onClose={() => setShowScanner(false)} />}
      </div>

      {/* Modal de cierre de distribución */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Cerrar Distribución</h3>
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setSelectedTiendaToClose('');
                  }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  disabled={closingInProgress}
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
                    <p className="text-sm font-medium text-amber-900 mb-1">Importante</p>
                    <p className="text-sm text-amber-700">
                      Al cerrar la distribución, el contenedor cambiará a estado CLOSED y no se podrán agregar más líneas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona la tienda</label>
                <select
                  value={selectedTiendaToClose}
                  onChange={(e) => setSelectedTiendaToClose(e.target.value)}
                  onFocus={loadAvailableTiendas}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm cursor-pointer"
                  disabled={closingInProgress}
                >
                  <option value="">-- Seleccionar tienda --</option>
                  {availableTiendas.map((tienda) => (
                    <option key={tienda} value={tienda}>
                      {tienda}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setSelectedTiendaToClose('');
                  }}
                  disabled={closingInProgress}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCerrarDistribucion}
                  disabled={!selectedTiendaToClose || closingInProgress}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg font-medium hover:from-rose-600 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {closingInProgress ? (
                    <>
                      <i className="ri-loader-4-line mr-2 animate-spin"></i>
                      Cerrando...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line mr-2"></i>
                      Confirmar Cierre
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup informativo de cambio de tienda */}
      {tiendaChange && (
        <TiendaChangePopup
          previousTienda={tiendaChange.prev}
          newTienda={tiendaChange.next}
          sku={tiendaChange.sku}
          onClose={() => setTiendaChange(null)}
        />
      )}
    </>
  );
}
