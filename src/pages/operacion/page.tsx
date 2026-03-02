
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, Pallet, PalletInventory, ImportLine } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/base/Toast';
import DistribucionModal from './components/DistribucionModal';

export default function OperacionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Continue mode state
  const continueContainerId = searchParams.get('containerId');
  const continueMode = !!continueContainerId;
  const [targetContainer, setTargetContainer] = useState<any>(null);

  const [palletInput, setPalletInput] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [palletInventory, setPalletInventory] = useState<PalletInventory[]>([]);
  const [pendingLines, setPendingLines] = useState<ImportLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDistribucion, setShowDistribucion] = useState(false);
  const palletInputRef = useRef<HTMLInputElement>(null);

  // Store filter state
  const [selectedStore, setSelectedStore] = useState<string>('ALL');

  // Ref para evitar re-inicializar la tienda cuando ya fue seteada para este pallet
  const didInitStoreRef = useRef<string | null>(null);

  // Pagination & search states
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [searchSku, setSearchSku] = useState('');
  const [minAvailable, setMinAvailable] = useState('');
  const [debouncedSearchSku, setDebouncedSearchSku] = useState('');
  const [debouncedMinAvailable, setDebouncedMinAvailable] = useState('');

  const pageSize = 10;
  const totalPages = Math.ceil(inventoryTotal / pageSize);

  // ── Memoized: tiendas únicas del pallet cargado ──
  const storesAvailable = useMemo(() => {
    if (pendingLines.length === 0) return [];
    const unique = Array.from(
      new Set(pendingLines.map((l) => String(l.tienda)).filter(Boolean))
    ).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    console.log('[StoreFilter] storesAvailable detectadas:', unique);
    return unique;
  }, [pendingLines]);

  // ── Memoized: líneas filtradas por tienda seleccionada ──
  const filteredPendingLines = useMemo(() => {
    const result = selectedStore === 'ALL'
      ? pendingLines
      : pendingLines.filter((l) => String(l.tienda) === selectedStore);
    console.log('[StoreFilter] selectedStore:', selectedStore, '| filteredPendingLines:', result.length);
    return result;
  }, [pendingLines, selectedStore]);

  // ── Inicializar tienda seleccionada SOLO cuando cambia el pallet ──
  // Usa didInitStoreRef para no resetear si el usuario ya eligió una tienda
  useEffect(() => {
    const palletId = selectedPallet?.id ?? null;

    // Si no hay pallet, limpiar
    if (!palletId) {
      didInitStoreRef.current = null;
      return;
    }

    // Si ya inicializamos para este palletId, no volver a setear
    if (didInitStoreRef.current === String(palletId)) return;

    // Marcar como inicializado para este pallet
    didInitStoreRef.current = String(palletId);

    if (continueMode && targetContainer?.tienda) {
      setSelectedStore(String(targetContainer.tienda));
      console.log('[StoreFilter] CONTINUE_MODE → tienda preseleccionada:', targetContainer.tienda);
    } else {
      setSelectedStore('ALL');
    }
  }, [selectedPallet?.id, continueMode, targetContainer?.tienda]);

  useEffect(() => {
    if (continueMode && continueContainerId) {
      loadTargetContainer();
    }
  }, [continueMode, continueContainerId]);

  const loadTargetContainer = async () => {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('id', continueContainerId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        showToast('error', 'Error', 'Contenedor no encontrado');
        navigate('/operacion');
        return;
      }

      setTargetContainer(data);
      console.log('[CONTINUE_MODE] Contenedor objetivo cargado:', {
        containerId: data.id,
        code: data.code,
        tienda: data.tienda,
        status: data.status
      });
    } catch (err) {
      console.error('[CONTINUE_MODE] Error al cargar contenedor:', err);
      showToast('error', 'Error', 'No se pudo cargar el contenedor');
      navigate('/operacion');
    }
  };

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

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchSku(searchSku);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchSku]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMinAvailable(minAvailable);
    }, 400);
    return () => clearTimeout(timer);
  }, [minAvailable]);

  // Reset page when filters change
  useEffect(() => {
    if (selectedPallet) {
      setInventoryPage(1);
    }
  }, [debouncedSearchSku, debouncedMinAvailable]);

  // Load paginated inventory when pallet is selected or filters/page change
  useEffect(() => {
    if (selectedPallet) {
      loadPaginatedInventory();
    }
  }, [selectedPallet, inventoryPage, debouncedSearchSku, debouncedMinAvailable]);

  const loadPaginatedInventory = async () => {
    if (!selectedPallet) return;

    setInventoryLoading(true);
    try {
      const from = (inventoryPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('pallet_inventory')
        .select('*', { count: 'exact' })
        .eq('pallet_id', selectedPallet.id)
        .gt('qty_available', 0);

      if (debouncedSearchSku.trim()) {
        query = query.ilike('sku', `%${debouncedSearchSku.trim()}%`);
      }

      if (debouncedMinAvailable.trim()) {
        const minVal = parseFloat(debouncedMinAvailable);
        if (!isNaN(minVal) && minVal >= 0) {
          query = query.gte('qty_available', minVal);
        }
      }

      const { data, count, error } = await query
        .order('sku', { ascending: true })
        .range(from, to);

      if (error) throw error;

      setPalletInventory(data ?? []);
      setInventoryTotal(count ?? 0);
    } catch (error: any) {
      showToast('error', 'Error', 'No se pudo cargar el inventario');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handlePalletSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = palletInput.trim(); // ✅ trim explícito
    if (!code) return;

    setLoading(true);
    try {
      // ── LOCK CHECK ──────────────────────────────────────────────────────────
      // Usamos auth_id (UUID de Supabase Auth) porque locked_by guarda auth.uid()
      const currentAuthId = user?.auth_id;
      const currentRole = user?.role;

      console.log('[LOCK_CHECK] Iniciando check | user_auth_id:', currentAuthId, '| role:', currentRole, '| pallet_code:', code);

      let pallet: any = null;
      let palletQueryError: any = null;
      let queryStatus: any = null;

      try {
        const result = await supabase
          .from('pallets')
          .select('*')
          .eq('pallet_code', code) // ✅ usando pallet_code
          .maybeSingle(); // ✅ maybeSingle() en lugar de single()

        pallet = result.data;
        palletQueryError = result.error;
        queryStatus = result.status;

        // ✅ Log completo del resultado Supabase
        console.log('[LOCK_CHECK] Supabase response:', {
          data: result.data,
          error: result.error,
          status: result.status,
          statusText: result.statusText
        });
      } catch (queryErr: any) {
        palletQueryError = queryErr;
        console.error('[LOCK_CHECK] Exception en query:', queryErr);
      }

      // ✅ Caso B: error de query (403/401/permission) → NO es "pallet en uso"
      if (palletQueryError) {
        const errCode = palletQueryError?.code ?? palletQueryError?.status ?? queryStatus ?? 'UNKNOWN';
        const errMsg = palletQueryError?.message ?? palletQueryError?.hint ?? 'Sin detalles';
        
        console.warn('[LOCK_CHECK] ERROR en query | code:', errCode, '| message:', errMsg, '| full_error:', palletQueryError);

        // Errores de permisos/RLS
        if (errCode === '401' || errCode === '403' || errCode === 'PGRST301' || errCode === 'PGRST116' || errCode === 42501) {
          console.error('[LOCK_CHECK] blocked_by_RLS | user_auth_id:', currentAuthId, '| role:', currentRole);
          showToast('error', 'Sin permisos', 'No tienes permisos para acceder a este pallet');
        } else {
          showToast('error', 'Error al leer pallet', 'No se pudo procesar el código');
        }
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      // ✅ Caso: pallet no encontrado (data == null)
      if (!pallet) {
        console.log('[LOCK_CHECK] Resultado: pallet no encontrado | code:', code, '| query_status:', queryStatus);
        showToast('error', 'Pallet no encontrado', 'El código no corresponde a ningún pallet registrado');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      if (pallet.status === 'BLOCKED') {
        console.log('[LOCK_CHECK] Resultado: BLOCKED | pallet_code:', code);
        showToast('warning', 'Pallet bloqueado', 'Este pallet está bloqueado y no puede ser utilizado');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      // ── TTL: lock fantasma (más de 10 minutos sin actividad) ────────────────
      const LOCK_TTL_MINUTES = 10;
      const isLockExpired = (() => {
        if (!pallet.locked_at) return false;
        const lockedAt = new Date(pallet.locked_at).getTime();
        const now = Date.now();
        const diffMinutes = (now - lockedAt) / 1000 / 60;
        return diffMinutes > LOCK_TTL_MINUTES;
      })();

      if (isLockExpired && pallet.locked_by) {
        console.log('[LOCK_CHECK] Lock expirado (TTL > 10min) → liberando automáticamente | locked_by:', pallet.locked_by);
        await supabase
          .from('pallets')
          .update({ locked_by: null, locked_at: null })
          .eq('id', pallet.id);
        pallet.locked_by = null;
        pallet.locked_at = null;
      }

      // ✅ Caso A: pallet realmente bloqueado por OTRO usuario (lock válido)
      // Comparar con auth_id (no con user.id que es el UUID interno de la tabla users)
      if (pallet.locked_by && pallet.locked_by !== currentAuthId) {
        console.warn('[LOCK_CHECK] Resultado: LOCKED | locked_by:', pallet.locked_by, '| current_auth_id:', currentAuthId);
        showToast('warning', 'Pallet en uso', 'Este pallet está siendo usado por otro usuario');
        setPalletInput('');
        palletInputRef.current?.focus();
        return;
      }

      console.log('[LOCK_CHECK] Resultado: FREE | pallet_code:', code, '| pallet_id:', pallet.id);

      // ── Adquirir lock usando auth_id ─────────────────────────────────────────
      await supabase
        .from('pallets')
        .update({ locked_by: currentAuthId, locked_at: new Date().toISOString() })
        .eq('id', pallet.id);

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'SCAN_PALLET',
        raw_code: code,
        user_id: user?.id,
      });

      let linesToLoad: ImportLine[] = [];
      if (continueMode && targetContainer) {
        console.log('[CONTINUE_MODE] 🔄 Cargando líneas FILTRADAS por tienda objetivo:', targetContainer.tienda);

        const { data: lines } = await supabase
          .from('import_lines')
          .select('*')
          .eq('import_id', targetContainer.import_id)
          .eq('tienda', targetContainer.tienda)
          .eq('pallet_code', pallet.pallet_code) // ✅ usando pallet_code
          .in('status', ['PENDING', 'PARTIAL']);

        linesToLoad = lines ?? [];
        console.log('[CONTINUE_MODE] ✅ Líneas pendientes (solo tienda', targetContainer.tienda + '):', linesToLoad.length);

        if (linesToLoad.length === 0) {
          showToast('warning', 'Sin ítems para esta tienda', `Este pallet no tiene productos pendientes para ${targetContainer.tienda}`);
        }
      } else {
        const { data: lines } = await supabase
          .from('import_lines')
          .select('*')
          .eq('pallet_code', pallet.pallet_code) // ✅ usando pallet_code
          .in('status', ['PENDING', 'PARTIAL']);

        linesToLoad = lines ?? [];
      }

      // Resetear la ref ANTES de setear el pallet para que el useEffect de init
      // detecte el cambio de palletId y aplique la tienda correcta
      didInitStoreRef.current = null;

      setSelectedPallet(pallet);
      setPendingLines(linesToLoad);
      setPalletInput('');
      setSearchSku('');
      setMinAvailable('');
      setInventoryPage(1);

      // En modo continuar, abrir modal automáticamente
      if (continueMode && targetContainer) {
        setTimeout(() => setShowDistribucion(true), 300);
      }
    } catch (error: any) {
      console.error('[LOCK_CHECK] Exception general:', error);
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

      didInitStoreRef.current = null;
      setSelectedPallet(null);
      setPalletInventory([]);
      setPendingLines([]);
      setSearchSku('');
      setMinAvailable('');
      setInventoryPage(1);
      setInventoryTotal(0);
      setSelectedStore('ALL');

      if (continueMode) {
        navigate('/contenedores');
      }
    } catch (error: any) {
      showToast('error', 'Error', 'No se pudo liberar el pallet');
    }
  };

  const refreshData = async () => {
    if (!selectedPallet) return;
    try {
      if (continueMode && targetContainer) {
        const { data: lines } = await supabase
          .from('import_lines')
          .select('*')
          .eq('import_id', targetContainer.import_id)
          .eq('tienda', targetContainer.tienda)
          .eq('pallet_code', selectedPallet.pallet_code)
          .in('status', ['PENDING', 'PARTIAL']);

        setPendingLines(lines ?? []);
      } else {
        const { data: lines } = await supabase
          .from('import_lines')
          .select('*')
          .eq('pallet_code', selectedPallet.pallet_code)
          .in('status', ['PENDING', 'PARTIAL']);

        setPendingLines(lines ?? []);
      }

      await loadPaginatedInventory();
    } catch (error: any) {
      showToast('error', 'Error', 'No se pudo actualizar la información del pallet');
    }
  };

  const handlePrevPage = () => {
    if (inventoryPage > 1) setInventoryPage(inventoryPage - 1);
  };

  const handleNextPage = () => {
    if (inventoryPage < totalPages) setInventoryPage(inventoryPage + 1);
  };

  // Store button counts
  const getStoreCount = (store: string) => {
    const lines = store === 'ALL' ? pendingLines : pendingLines.filter((l) => String(l.tienda) === store);
    const pending = lines.filter((l) => (l.qty_to_send - l.qty_confirmed) > 0).length;
    return { pending, total: lines.length };
  };

  // ── Handler del botón Iniciar Distribución ──
  const handleStartDistribucion = () => {
    console.log('[StartDistribucion] click | selectedStore=', selectedStore, '| filteredLines=', filteredPendingLines.length, '| inventoryTotal=', inventoryTotal);
    if (!selectedPallet) {
      console.warn('[StartDistribucion] No hay pallet seleccionado');
      return;
    }
    console.log('[StartDistribucion] opening modal ok');
    setShowDistribucion(true);
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
          <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5">
            {/* Pallet header */}
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

            {/* ── Store filter grid ── */}
            {storesAvailable.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Filtrar por Tienda
                  </span>
                  {continueMode && targetContainer?.tienda && (
                    <span className="text-xs text-teal-600 font-medium">
                      Continuar: solo tienda {targetContainer.tienda}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!continueMode && (
                    <button
                      onClick={() => setSelectedStore('ALL')}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                        selectedStore === 'ALL'
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-600'
                      }`}
                    >
                      Todas
                      <span className={`ml-1 text-xs ${selectedStore === 'ALL' ? 'text-teal-100' : 'text-gray-400'}`}>
                        ({getStoreCount('ALL').pending}/{getStoreCount('ALL').total})
                      </span>
                    </button>
                  )}
                  {storesAvailable.map((store) => {
                    const { pending, total } = getStoreCount(store);
                    const isActive = selectedStore === store;
                    const isLocked = continueMode;
                    return (
                      <button
                        key={store}
                        onClick={() => { if (!isLocked) setSelectedStore(store); }}
                        disabled={isLocked && !isActive}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap border ${
                          isActive
                            ? 'bg-teal-600 text-white border-teal-600'
                            : isLocked
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-600 cursor-pointer'
                        }`}
                      >
                        Tienda {store}
                        <span className={`ml-1 text-xs ${isActive ? 'text-teal-100' : 'text-gray-400'}`}>
                          ({pending}/{total})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Botón Iniciar Distribución — ARRIBA de las listas ── */}
            <div className="mb-4">
              <button
                onClick={handleStartDistribucion}
                disabled={inventoryTotal === 0}
                className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="ri-box-3-line text-lg"></i>
                Iniciar Distribución
                {selectedStore !== 'ALL' && (
                  <span className="text-sm font-normal text-teal-100">— Tienda {selectedStore}</span>
                )}
              </button>
            </div>

            {/* ── Listas: Inventario + Pedidos ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Inventory with pagination & search */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Inventario Disponible
                </h3>

                {/* Search & Filter Bar */}
                <div className="space-y-2 mb-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <i className="ri-search-line text-gray-400 text-sm"></i>
                    </div>
                    <input
                      type="text"
                      value={searchSku}
                      onChange={(e) => setSearchSku(e.target.value)}
                      placeholder="Buscar por SKU..."
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <i className="ri-filter-line text-gray-400 text-sm"></i>
                    </div>
                    <input
                      type="number"
                      value={minAvailable}
                      onChange={(e) => setMinAvailable(e.target.value)}
                      placeholder="Inventario mínimo..."
                      min="0"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs text-gray-900 placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Inventory List */}
                <div className="space-y-2 mb-3">
                  {inventoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <i className="ri-loader-4-line animate-spin text-2xl text-teal-600"></i>
                    </div>
                  ) : palletInventory.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="ri-inbox-line text-3xl text-gray-300 mb-2"></i>
                      <p className="text-sm text-gray-400">
                        {searchSku || minAvailable ? 'No se encontraron resultados' : 'Sin inventario disponible'}
                      </p>
                    </div>
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

                {/* Pagination Controls */}
                {!inventoryLoading && inventoryTotal > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      onClick={handlePrevPage}
                      disabled={inventoryPage === 1}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <i className="ri-arrow-left-s-line"></i>
                      Anterior
                    </button>
                    <span className="text-xs text-gray-500 font-medium">
                      Página {inventoryPage} de {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={inventoryPage === totalPages}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Siguiente
                      <i className="ri-arrow-right-s-line"></i>
                    </button>
                  </div>
                )}
              </div>

              {/* Pending orders — filtered by selectedStore */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Pedidos Pendientes
                  {selectedStore !== 'ALL' && (
                    <span className="ml-1 normal-case font-normal text-teal-600">· Tienda {selectedStore}</span>
                  )}
                </h3>
                <div className="space-y-2">
                  {filteredPendingLines.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Sin pedidos pendientes</p>
                  ) : (
                    filteredPendingLines.map((line) => (
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
          </div>
        </div>
      )}

      {showDistribucion && selectedPallet && (
        <DistribucionModal
          pallet={selectedPallet}
          inventory={palletInventory}
          pendingLines={filteredPendingLines}
          continueMode={continueMode}
          targetContainer={targetContainer}
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
