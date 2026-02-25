
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/base/Toast';
import MovimientosFilters, { FilterValues } from './components/MovimientosFilters';
import MovimientosStats from './components/MovimientosStats';
import MovimientosTable, { ScanEventRow } from './components/MovimientosTable';

const PAGE_SIZE = 25;

export default function ReportesMovimientosPage() {
  const { showToast } = useToast();
  const [imports, setImports] = useState<{ id: string; file_name: string }[]>([]);
  const [rows, setRows] = useState<ScanEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<FilterValues>({
    importId: 'all',
    eventType: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    confirmaciones: 0,
    reversiones: 0,
    unidades: 0,
  });

  /* -------------------------------------------------------------------------- */
  /*                                   Effects                                 */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    loadImports();
  }, []);

  useEffect(() => {
    loadMovimientos();
    loadStats();
  }, [page, filters]);

  /* -------------------------------------------------------------------------- */
  /*                               Data Loaders                                 */
  /* -------------------------------------------------------------------------- */
  const loadImports = async () => {
    try {
      const { data } = await supabase
        .from('imports')
        .select('id, file_name')
        .order('created_at', { ascending: false });
      setImports(data || []);
    } catch (err) {
      console.error('Error cargando imports:', err);
    }
  };

  const buildBaseQuery = useCallback(
    (selectStr: string, forCount = false) => {
      let query = supabase
        .from('scan_events')
        .select(
          selectStr,
          forCount ? { count: 'exact', head: true } : undefined
        );

      if (filters.eventType !== 'all') {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      if (filters.searchTerm) {
        const term = filters.searchTerm.trim();
        query = query.or(
          `sku.ilike.%${term}%,tienda.ilike.%${term}%,notes.ilike.%${term}%,raw_code.ilike.%${term}%`
        );
      }

      return query;
    },
    [filters]
  );

  const loadStats = async () => {
    try {
      // Total
      const totalQuery = buildBaseQuery('id', true);
      const { count: totalAll } = await totalQuery;

      // Confirmaciones
      const confQuery = buildBaseQuery('id', true).eq(
        'event_type',
        'CONFIRM_QTY'
      );
      const { count: totalConf } = await confQuery;

      // Reversiones
      const revQuery = buildBaseQuery('id', true).eq('event_type', 'REVERSE');
      const { count: totalRev } = await revQuery;

      // Unidades: sum qty de CONFIRM_QTY y REVERSE
      const { data: qtyData } = await buildBaseQuery('qty').in(
        'event_type',
        ['CONFIRM_QTY', 'REVERSE']
      );
      const totalUnidades = (qtyData || []).reduce(
        (sum: number, r: any) => sum + (Number(r.qty) || 0),
        0
      );

      setStats({
        total: totalAll || 0,
        confirmaciones: totalConf || 0,
        reversiones: totalRev || 0,
        unidades: totalUnidades,
      });
    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  };

  const loadMovimientos = async () => {
    setLoading(true);
    try {
      // Count
      const countQuery = buildBaseQuery('id', true);
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Data
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await buildBaseQuery(
        'id, pallet_id, event_type, raw_code, sku, tienda, qty, notes, user_id, created_at, pallets(pallet_code), users:user_id(full_name, email)'
      )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mapped: ScanEventRow[] = (data || []).map((row: any) => ({
        id: row.id,
        event_type: row.event_type,
        sku: row.sku,
        tienda: row.tienda,
        qty: row.qty,
        notes: row.notes,
        created_at: row.created_at,
        pallet_code: row.pallets?.pallet_code || '',
        user_name: row.users?.full_name || row.users?.email || '',
      }));

      setRows(mapped);
    } catch (err: any) {
      console.error('Error cargando movimientos:', err);
      showToast('error', 'Error', 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                 Handlers                                   */
  /* -------------------------------------------------------------------------- */
  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const exportCSV = () => {
    try {
      let csv =
        'Fecha,Tipo,Pallet,SKU,Tienda,Cantidad,Usuario,Notas\n';
      rows.forEach((r) => {
        const fecha = new Date(r.created_at).toLocaleString('es-ES');
        const notas = (r.notes || '').replace(/"/g, '""');
        csv += `"${fecha}","${r.event_type}","${r.pallet_code}","${r.sku || ''}","${r.tienda ||
          ''}",${r.qty || 0},"${r.user_name}","${notas}"\n`;
      });

      const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `movimientos_${new Date()
        .toISOString()
        .split('T')[0]}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', 'Exportado', 'Archivo CSV descargado');
    } catch (err) {
      console.error('Error exportando CSV:', err);
      showToast('error', 'Error', 'No se pudo exportar');
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Reportes de Movimientos
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Historial completo de escaneos, confirmaciones y reversiones
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
        >
          <i className="ri-download-line mr-2"></i>
          Exportar CSV
        </button>
      </div>

      <MovimientosStats
        totalMovimientos={stats.total}
        totalConfirmaciones={stats.confirmaciones}
        totalReversiones={stats.reversiones}
        totalUnidades={stats.unidades}
      />

      <MovimientosFilters imports={imports} onFilterChange={handleFilterChange} />

      <MovimientosTable
        rows={rows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
