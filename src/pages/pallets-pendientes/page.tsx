import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/base/Toast';
import * as XLSX from 'xlsx';

interface PendingItem {
  line_id: string;
  import_id: string;
  import_name: string;
  pallet_code: string;
  sku: string;
  descripcion: string;
  tienda: string;
  qty_to_send: number;
  qty_confirmed: number;
  qty_pending: number;
  percentage_pending: number;
}

interface Import {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

export default function PalletsPendientesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Data states
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [imports, setImports] = useState<Import[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showSurplusModal, setShowSurplusModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [sendingToSurplus, setSendingToSurplus] = useState(false);

  // Filter states
  const [selectedImportId, setSelectedImportId] = useState<string>('');
  const [searchSku, setSearchSku] = useState('');
  const [searchPallet, setSearchPallet] = useState('');
  const [percentageRange, setPercentageRange] = useState<string>('all');
  const [minPending, setMinPending] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Debounced search
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
  const [debouncedSearchSku, setDebouncedSearchSku] = useState('');
  const [debouncedSearchPallet, setDebouncedSearchPallet] = useState('');

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchSku(searchSku);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchSku]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchPallet(searchPallet);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchPallet]);

  // Load imports
  useEffect(() => {
    loadImports();
  }, []);

  // Load pending items when filters change
  useEffect(() => {
    setCurrentPage(1);
    loadPendingItems();
  }, [
    selectedImportId,
    debouncedSearchSku,
    debouncedSearchPallet,
    percentageRange,
    minPending,
    debouncedGlobalSearch,
  ]);

  const loadImports = async () => {
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('id, file_name, status, created_at')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImports(data || []);
    } catch (err) {
      console.error('[PALLETS_PENDIENTES] Error cargando imports:', err);
      showToast('error', 'Error', 'No se pudieron cargar las cargas');
    }
  };

  const loadPendingItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('import_lines')
        .select('id, import_id, pallet_code, sku, descripcion, tienda, qty_to_send, qty_confirmed, sent_to_surplus')
        .in('status', ['PENDING', 'PARTIAL'])
        .or('sent_to_surplus.is.null,sent_to_surplus.eq.false');

      // Filter by import
      if (selectedImportId) {
        query = query.eq('import_id', selectedImportId);
      }

      // Filter by SKU
      if (debouncedSearchSku.trim()) {
        query = query.ilike('sku', `%${debouncedSearchSku.trim()}%`);
      }

      // Filter by pallet
      if (debouncedSearchPallet.trim()) {
        query = query.ilike('pallet_code', `%${debouncedSearchPallet.trim()}%`);
      }

      const { data: lines, error } = await query;

      if (error) throw error;

      // Calculate pending and filter
      let items: PendingItem[] = (lines || [])
        .map((line) => {
          const qtyPending = (line.qty_to_send || 0) - (line.qty_confirmed || 0);
          const percentagePending =
            line.qty_to_send > 0 ? Math.round((qtyPending / line.qty_to_send) * 100) : 0;

          return {
            line_id: line.id,
            import_id: line.import_id,
            import_name: '',
            pallet_code: line.pallet_code,
            sku: line.sku,
            descripcion: line.descripcion || '',
            tienda: line.tienda || 'Sin asignar',
            qty_to_send: line.qty_to_send || 0,
            qty_confirmed: line.qty_confirmed || 0,
            qty_pending: qtyPending,
            percentage_pending: percentagePending,
          };
        })
        .filter((item) => item.qty_pending > 0);

      // Filter by min pending
      if (minPending.trim()) {
        const minVal = parseFloat(minPending);
        if (!isNaN(minVal) && minVal >= 0) {
          items = items.filter((item) => item.qty_pending >= minVal);
        }
      }

      // Filter by percentage range
      if (percentageRange !== 'all') {
        items = items.filter((item) => {
          const p = item.percentage_pending;
          switch (percentageRange) {
            case '0-25':
              return p >= 0 && p <= 25;
            case '25-50':
              return p > 25 && p <= 50;
            case '50-75':
              return p > 50 && p <= 75;
            case '75-100':
              return p > 75 && p <= 100;
            default:
              return true;
          }
        });
      }

      // Map import names
      const importMap = new Map(imports.map((imp) => [imp.id, imp.file_name]));
      items = items.map((item) => ({
        ...item,
        import_name: importMap.get(item.import_id) || 'Sin nombre',
      }));

      // Global search filter
      if (debouncedGlobalSearch.trim()) {
        const searchLower = debouncedGlobalSearch.toLowerCase();
        items = items.filter(
          (item) =>
            item.sku.toLowerCase().includes(searchLower) ||
            item.descripcion.toLowerCase().includes(searchLower) ||
            item.pallet_code.toLowerCase().includes(searchLower) ||
            item.import_name.toLowerCase().includes(searchLower) ||
            item.tienda.toLowerCase().includes(searchLower)
        );
      }

      // Sort by import_name, pallet_code, sku
      items.sort((a, b) => {
        if (a.import_name !== b.import_name) return a.import_name.localeCompare(b.import_name);
        if (a.pallet_code !== b.pallet_code) return a.pallet_code.localeCompare(b.pallet_code);
        return a.sku.localeCompare(b.sku);
      });

      setPendingItems(items);
    } catch (err) {
      console.error('[PALLETS_PENDIENTES] Error cargando pendientes:', err);
      showToast('error', 'Error', 'No se pudieron cargar los pallets pendientes');
    } finally {
      setLoading(false);
    }
  };

  // Handle send to surplus
  const handleOpenSurplusModal = (item: PendingItem) => {
    setSelectedItem(item);
    setShowSurplusModal(true);
  };

  const handleConfirmSurplus = async () => {
    if (!selectedItem || !user) return;

    setSendingToSurplus(true);
    try {
      const { error } = await supabase
        .from('import_lines')
        .update({
          sent_to_surplus: true,
          sent_to_surplus_at: new Date().toISOString(),
          sent_to_surplus_by: user.id,
        })
        .eq('id', selectedItem.line_id);

      if (error) throw error;

      console.log(
        `[SURPLUS_MARK] Line ${selectedItem.line_id} | SKU: ${selectedItem.sku} | Tienda: ${selectedItem.tienda} | Pallet: ${selectedItem.pallet_code} | Qty: ${selectedItem.qty_pending} | User: ${user.id}`
      );

      showToast('success', 'Enviado a sobrante', `SKU ${selectedItem.sku} marcado como sobrante`);
      setShowSurplusModal(false);
      setSelectedItem(null);
      loadPendingItems();
    } catch (err) {
      console.error('[PALLETS_PENDIENTES] Error enviando a sobrante:', err);
      showToast('error', 'Error', 'No se pudo marcar como sobrante');
    } finally {
      setSendingToSurplus(false);
    }
  };

  // Stats calculations
  const stats = useMemo(() => {
    const uniquePallets = new Set(pendingItems.map((item) => item.pallet_code)).size;
    const uniqueSkus = new Set(pendingItems.map((item) => item.sku)).size;
    const totalPending = pendingItems.reduce((sum, item) => sum + item.qty_pending, 0);

    return {
      pallets: uniquePallets,
      skus: uniqueSkus,
      units: totalPending,
    };
  }, [pendingItems]);

  // Pagination
  const totalPages = Math.ceil(pendingItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return pendingItems.slice(start, end);
  }, [pendingItems, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportData = pendingItems.map((item) => ({
        'Nombre de carga': item.import_name,
        SKU: item.sku,
        Descripción: item.descripcion,
        'Tienda destino': item.tienda,
        'Cantidad pendiente': item.qty_pending,
        'Porcentaje pendiente': `${item.percentage_pending}%`,
        'Pallet padre': item.pallet_code,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pallets Pendientes');

      // Auto-width columns
      const maxWidth = 50;
      const colWidths = [
        { wch: Math.min(maxWidth, Math.max(15, ...exportData.map((d) => d['Nombre de carga'].length))) },
        { wch: Math.min(maxWidth, Math.max(10, ...exportData.map((d) => d.SKU.length))) },
        { wch: Math.min(maxWidth, Math.max(15, ...exportData.map((d) => d.Descripción.length))) },
        { wch: Math.min(maxWidth, Math.max(12, ...exportData.map((d) => d['Tienda destino'].length))) },
        { wch: 18 },
        { wch: 18 },
        { wch: Math.min(maxWidth, Math.max(12, ...exportData.map((d) => d['Pallet padre'].length))) },
      ];
      ws['!cols'] = colWidths;

      const fileName = `pallets_pendientes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showToast('success', 'Exportado', `Archivo ${fileName} descargado`);
    } catch (err) {
      console.error('[PALLETS_PENDIENTES] Error exportando:', err);
      showToast('error', 'Error', 'No se pudo exportar el archivo');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-gray-900">Control de Pallets Pendientes</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">
            SKUs que aún no han sido completamente distribuidos
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={pendingItems.length === 0}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
        >
          <i className="ri-file-excel-2-line text-lg"></i>
          Descargar .xlsx
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Pallets con pendientes
              </p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.pallets}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <i className="ri-stack-line text-2xl text-white"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">SKUs pendientes</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.skus}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <i className="ri-barcode-line text-2xl text-white"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Unidades pendientes
              </p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.units.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
              <i className="ri-inbox-line text-2xl text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <i className="ri-filter-3-line text-teal-600"></i>
          Filtros
        </h3>

        {/* Global search */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="ri-search-line text-gray-400"></i>
            </div>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Buscar por SKU, descripción, pallet, tienda o carga..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>
        </div>

        {/* Specific filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Import filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Carga</label>
            <select
              value={selectedImportId}
              onChange={(e) => setSelectedImportId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm cursor-pointer bg-white"
            >
              <option value="">Todas las cargas</option>
              {imports.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.file_name}
                </option>
              ))}
            </select>
          </div>

          {/* SKU filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">SKU</label>
            <input
              type="text"
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              placeholder="Buscar SKU..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>

          {/* Pallet filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Pallet Padre</label>
            <input
              type="text"
              value={searchPallet}
              onChange={(e) => setSearchPallet(e.target.value)}
              placeholder="Buscar pallet..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>

          {/* Percentage range filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">% Pendiente</label>
            <select
              value={percentageRange}
              onChange={(e) => setPercentageRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm cursor-pointer bg-white"
            >
              <option value="all">Todos</option>
              <option value="0-25">0–25%</option>
              <option value="25-50">25–50%</option>
              <option value="50-75">50–75%</option>
              <option value="75-100">75–100%</option>
            </select>
          </div>

          {/* Min pending filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cantidad mínima</label>
            <input
              type="number"
              value={minPending}
              onChange={(e) => setMinPending(e.target.value)}
              placeholder="Mínimo..."
              min="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>
        </div>

        {/* Clear filters */}
        {(selectedImportId ||
          searchSku ||
          searchPallet ||
          percentageRange !== 'all' ||
          minPending ||
          globalSearch) && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Mostrando {pendingItems.length} resultado{pendingItems.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => {
                setSelectedImportId('');
                setSearchSku('');
                setSearchPallet('');
                setPercentageRange('all');
                setMinPending('');
                setGlobalSearch('');
              }}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <i className="ri-loader-4-line animate-spin text-3xl text-teal-600"></i>
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="text-center py-12">
            <i className="ri-checkbox-circle-line text-5xl text-emerald-400 mb-3"></i>
            <p className="text-sm text-gray-500">No hay pallets con pendientes</p>
            <p className="text-xs text-gray-400 mt-1">Todos los SKUs han sido completamente distribuidos</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Nombre de carga
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tienda destino
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cantidad pendiente
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      % Pendiente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Pallet padre
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.import_name}</td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{item.sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          <i className="ri-store-2-line text-teal-600"></i>
                          {item.tienda}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          {item.qty_pending} uds
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-orange-600 h-full rounded-full transition-all"
                              style={{ width: `${item.percentage_pending}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 min-w-[3rem] text-right">
                            {item.percentage_pending}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.pallet_code}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenSurplusModal(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap"
                          title="Marcar como sobrante"
                        >
                          <i className="ri-inbox-unarchive-line"></i>
                          Mandar a sobrante
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Mostrando {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, pendingItems.length)} de {pendingItems.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                    Anterior
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Siguiente
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Surplus Confirmation Modal */}
      {showSurplusModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-inbox-unarchive-line text-2xl text-rose-600"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Mandar a sobrante</h3>
                <p className="text-sm text-gray-600">
                  ¿Deseas marcar esta línea como sobrante? Ya no aparecerá como pendiente de distribución.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SKU:</span>
                <span className="font-mono font-semibold text-gray-900">{selectedItem.sku}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tienda:</span>
                <span className="font-semibold text-gray-900">{selectedItem.tienda}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pallet:</span>
                <span className="font-mono text-gray-900">{selectedItem.pallet_code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cantidad pendiente:</span>
                <span className="font-bold text-rose-600">{selectedItem.qty_pending} uds</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSurplusModal(false);
                  setSelectedItem(null);
                }}
                disabled={sendingToSurplus}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSurplus}
                disabled={sendingToSurplus}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg text-sm font-semibold hover:from-rose-600 hover:to-pink-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                {sendingToSurplus ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Procesando...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line"></i>
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}