import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/base/Toast';
import * as XLSX from 'xlsx';
import ClosedContainersFilters, { CCFilterValues } from './components/ClosedContainersFilters';
import ClosedContainersTable, { ClosedContainerRow } from './components/ClosedContainersTable';

const PAGE_SIZE = 25;

// ✅ Helper: agrupa líneas por pallet_id + ubicacion + sku + barcode, sumando qty
function groupLines(lines: ContainerLineDetail[]): ContainerLineDetail[] {
  const map = new Map<string, ContainerLineDetail>();

  for (const line of lines) {
    const key = `${line.pallet_id ?? line.pallet_code ?? ''}__${line.pallet_ubicacion ?? ''}__${line.sku}__${line.barcode ?? ''}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, { ...existing, qty: existing.qty + line.qty });
    } else {
      map.set(key, { ...line });
    }
  }

  return Array.from(map.values());
}

// ✅ Nuevo tipo: resumen de contenedor con métricas agregadas
export interface ClosedContainerSummary {
  id: string;
  code: string;
  status: string;
  tienda: string;
  type: string;
  created_at: string;
  closed_at: string | null;
  dispatched_at: string | null;
  lineas: number;           // count de líneas
  skus_distintos: number;   // count distinct sku
  unidades_totales: number; // sum qty
}

// ✅ Nuevo tipo: detalle de línea con JOINs completos
export interface ContainerLineDetail {
  id: string;
  sku: string;
  qty: number;
  pallet_id: string | null;
  pallet_code: string | null;
  pallet_ubicacion: string | null;
  descripcion: string | null;
  barcode: string | null;
  source_import_line_id: string | null;
}

export default function ContenedoresCerradosPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ClosedContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [filters, setFilters] = useState<CCFilterValues>({
    status: 'all',
    tienda: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  /* ------------------------------------------------------------------ */
  /*  Load distinct tiendas for dropdown                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('containers')
          .select('tienda')
          .in('status', ['CLOSED', 'DISPATCHED'])
          .not('tienda', 'is', null);

        if (data) {
          const unique = [...new Set(data.map((r: any) => String(r.tienda)).filter(Boolean))];
          unique.sort((a, b) => {
            const na = parseInt(a, 10);
            const nb = parseInt(b, 10);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          });
          setTiendas(unique);
        }
      } catch (err) {
        console.error('[CC] Error loading tiendas:', err);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Load data: query containers con métricas agregadas                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    loadData();
  }, [page, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      // ✅ PASO 1: Obtener IDs de contenedores filtrados y paginados
      let baseQuery = supabase
        .from('containers')
        .select('id, code, status, tienda, type, created_at, closed_at, dispatched_at', { count: 'exact' });

      // Aplicar filtros
      if (filters.status === 'all') {
        baseQuery = baseQuery.in('status', ['CLOSED', 'DISPATCHED']);
      } else {
        baseQuery = baseQuery.eq('status', filters.status);
      }

      if (filters.tienda !== 'all') {
        baseQuery = baseQuery.eq('tienda', filters.tienda);
      }

      if (filters.dateFrom) {
        baseQuery = baseQuery.gte('closed_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        baseQuery = baseQuery.lte('closed_at', `${filters.dateTo}T23:59:59`);
      }

      if (filters.searchTerm) {
        const term = filters.searchTerm.trim();
        baseQuery = baseQuery.ilike('code', `%${term}%`);
      }

      // Orden y paginación
      baseQuery = baseQuery
        .order('closed_at', { ascending: false, nullsFirst: false })
        .order('code', { ascending: true });

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      baseQuery = baseQuery.range(from, to);

      const { data: containers, error: containerError, count } = await baseQuery;
      if (containerError) throw containerError;

      setTotalCount(count || 0);

      if (!containers || containers.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // ✅ PASO 2: Obtener métricas agregadas para estos contenedores
      const containerIds = containers.map((c: any) => c.id);

      const { data: linesData, error: linesError } = await supabase
        .from('container_lines')
        .select('container_id, sku, qty')
        .in('container_id', containerIds);

      if (linesError) throw linesError;

      // Agrupar métricas por container_id
      const metricsMap = new Map<string, { lineas: number; skus: Set<string>; unidades: number }>();

      (linesData || []).forEach((line: any) => {
        const cid = line.container_id;
        if (!metricsMap.has(cid)) {
          metricsMap.set(cid, { lineas: 0, skus: new Set(), unidades: 0 });
        }
        const m = metricsMap.get(cid)!;
        m.lineas += 1;
        m.skus.add(line.sku);
        m.unidades += Number(line.qty) || 0;
      });

      // ✅ PASO 3: Mapear a ClosedContainerSummary
      const mapped: ClosedContainerSummary[] = containers.map((c: any) => {
        const metrics = metricsMap.get(c.id) || { lineas: 0, skus: new Set(), unidades: 0 };
        return {
          id: c.id,
          code: c.code,
          status: c.status,
          tienda: c.tienda,
          type: c.type,
          created_at: c.created_at,
          closed_at: c.closed_at,
          dispatched_at: c.dispatched_at,
          lineas: metrics.lineas,
          skus_distintos: metrics.skus.size,
          unidades_totales: metrics.unidades,
        };
      });

      setRows(mapped);
    } catch (err: any) {
      console.error('[CC] Error loading data:', err);
      showToast('error', 'Error', 'No se pudieron cargar los contenedores cerrados');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  ✅ Función lazy para cargar detalle de líneas de un contenedor    */
  /* ------------------------------------------------------------------ */
  const loadContainerDetail = async (containerId: string): Promise<ContainerLineDetail[]> => {
    try {
      const { data, error } = await supabase
        .from('container_lines')
        .select(`
          id,
          sku,
          qty,
          pallet_id,
          source_import_line_id,
          pallets (
            pallet_code,
            ubicacion
          ),
          import_lines (
            descripcion,
            barcode
          )
        `)
        .eq('container_id', containerId)
        .order('sku', { ascending: true });

      if (error) throw error;

      const raw: ContainerLineDetail[] = (data || []).map((line: any) => ({
        id: line.id,
        sku: line.sku,
        qty: Number(line.qty) || 0,
        pallet_id: line.pallet_id || null,
        pallet_code: line.pallets?.pallet_code || null,
        pallet_ubicacion: line.pallets?.ubicacion || null,
        descripcion: line.import_lines?.descripcion || null,
        barcode: line.import_lines?.barcode || null,
        source_import_line_id: line.source_import_line_id || null,
      }));

      // ✅ Agrupar duplicados sumando qty
      return groupLines(raw);
    } catch (err) {
      console.error('[CC] Error loading container detail:', err);
      showToast('error', 'Error', 'No se pudo cargar el detalle del contenedor');
      return [];
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Export ALL filtered data to .xlsx                                  */
  /* ------------------------------------------------------------------ */
  const handleExportXlsx = async () => {
    setExporting(true);
    try {
      // ✅ Fetch todos los contenedores filtrados (sin paginación)
      let exportQuery = supabase
        .from('containers')
        .select('id, code, status, tienda, type, created_at, closed_at, dispatched_at');

      if (filters.status === 'all') {
        exportQuery = exportQuery.in('status', ['CLOSED', 'DISPATCHED']);
      } else {
        exportQuery = exportQuery.eq('status', filters.status);
      }
      if (filters.tienda !== 'all') {
        exportQuery = exportQuery.eq('tienda', filters.tienda);
      }
      if (filters.dateFrom) {
        exportQuery = exportQuery.gte('closed_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        exportQuery = exportQuery.lte('closed_at', `${filters.dateTo}T23:59:59`);
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.trim();
        exportQuery = exportQuery.ilike('code', `%${term}%`);
      }

      exportQuery = exportQuery
        .order('closed_at', { ascending: false, nullsFirst: false })
        .order('code', { ascending: true });

      // Fetch en lotes de 1000
      let allContainers: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let batchQuery = supabase
          .from('containers')
          .select('id, code, status, tienda, type, created_at, closed_at, dispatched_at')
          .range(offset, offset + batchSize - 1);

        if (filters.status === 'all') {
          batchQuery = batchQuery.in('status', ['CLOSED', 'DISPATCHED']);
        } else {
          batchQuery = batchQuery.eq('status', filters.status);
        }
        if (filters.tienda !== 'all') {
          batchQuery = batchQuery.eq('tienda', filters.tienda);
        }
        if (filters.dateFrom) {
          batchQuery = batchQuery.gte('closed_at', `${filters.dateFrom}T00:00:00`);
        }
        if (filters.dateTo) {
          batchQuery = batchQuery.lte('closed_at', `${filters.dateTo}T23:59:59`);
        }
        if (filters.searchTerm) {
          const term = filters.searchTerm.trim();
          batchQuery = batchQuery.ilike('code', `%${term}%`);
        }

        batchQuery = batchQuery
          .order('closed_at', { ascending: false, nullsFirst: false })
          .order('code', { ascending: true });

        const { data: batch, error } = await batchQuery;
        if (error) throw error;

        allContainers = allContainers.concat(batch || []);
        if (!batch || batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      if (allContainers.length === 0) {
        showToast('info', 'Sin datos', 'No hay contenedores para exportar');
        setExporting(false);
        return;
      }

      // ✅ Obtener todas las líneas de estos contenedores
      const containerIds = allContainers.map((c) => c.id);
      const { data: allLines, error: linesError } = await supabase
        .from('container_lines')
        .select(`
          container_id,
          sku,
          qty,
          pallet_id,
          source_import_line_id,
          pallets (
            pallet_code,
            ubicacion
          ),
          import_lines (
            descripcion,
            barcode
          )
        `)
        .in('container_id', containerIds)
        .order('container_id', { ascending: true })
        .order('sku', { ascending: true });

      if (linesError) throw linesError;

      // Agrupar métricas por container_id
      const metricsMap = new Map<string, { lineas: number; skus: Set<string>; unidades: number }>();
      (allLines || []).forEach((line: any) => {
        const cid = line.container_id;
        if (!metricsMap.has(cid)) {
          metricsMap.set(cid, { lineas: 0, skus: new Set(), unidades: 0 });
        }
        const m = metricsMap.get(cid)!;
        m.lineas += 1;
        m.skus.add(line.sku);
        m.unidades += Number(line.qty) || 0;
      });

      // ✅ Sheet 1: Resumen (1 fila por contenedor)
      const resumenRows = allContainers.map((c: any) => {
        const metrics = metricsMap.get(c.id) || { lineas: 0, skus: new Set(), unidades: 0 };
        return {
          Container: c.code,
          Estado: c.status,
          Tienda: c.tienda,
          Tipo: c.type,
          Creado: c.created_at ? new Date(c.created_at).toLocaleString('es-ES') : '',
          Cerrado: c.closed_at ? new Date(c.closed_at).toLocaleString('es-ES') : '',
          Despachado: c.dispatched_at ? new Date(c.dispatched_at).toLocaleString('es-ES') : '',
          Líneas: metrics.lineas,
          SKUs: metrics.skus.size,
          Unidades: metrics.unidades,
        };
      });

      // ✅ Sheet 2: Detalle (1 fila por línea, agrupada)
      const containerMap = new Map(allContainers.map((c) => [c.id, c]));

      // Agrupar líneas por contenedor, luego aplicar groupLines
      const linesByContainer = new Map<string, any[]>();
      for (const line of (allLines || [])) {
        const cid = line.container_id;
        if (!linesByContainer.has(cid)) linesByContainer.set(cid, []);
        linesByContainer.get(cid)!.push(line);
      }

      const detalleRows: any[] = [];
      for (const [cid, rawLines] of linesByContainer.entries()) {
        const container = containerMap.get(cid);

        // Mapear a ContainerLineDetail para poder agrupar
        const mapped: ContainerLineDetail[] = rawLines.map((line: any) => ({
          id: line.id,
          sku: line.sku,
          qty: Number(line.qty) || 0,
          pallet_id: line.pallet_id || null,
          pallet_code: line.pallets?.pallet_code || null,
          pallet_ubicacion: line.pallets?.ubicacion || null,
          descripcion: line.import_lines?.descripcion || null,
          barcode: line.import_lines?.barcode || null,
          source_import_line_id: line.source_import_line_id || null,
        }));

        const grouped = groupLines(mapped);

        for (const line of grouped) {
          detalleRows.push({
            Container: container?.code || '',
            Tienda: container?.tienda || '',
            Estado: container?.status || '',
            Cerrado: container?.closed_at ? new Date(container.closed_at).toLocaleString('es-ES') : '',
            Pallet: line.pallet_code || '—',
            Ubicación: line.pallet_ubicacion || '—',
            SKU: line.sku,
            Descripción: line.descripcion || '—',
            Barcode: line.barcode || '—',
            Cantidad: line.qty,
            SourceImportLineId: line.source_import_line_id || '',
          });
        }
      }

      // ✅ Crear workbook con 2 sheets
      const wb = XLSX.utils.book_new();

      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      const colWidthsResumen = Object.keys(resumenRows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...resumenRows.map((r: any) => String(r[key] ?? '').length),
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      wsResumen['!cols'] = colWidthsResumen;
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      const wsDetalle = XLSX.utils.json_to_sheet(detalleRows);
      const colWidthsDetalle = Object.keys(detalleRows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...detalleRows.slice(0, 100).map((r: any) => String(r[key] ?? '').length),
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      wsDetalle['!cols'] = colWidthsDetalle;
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');

      XLSX.writeFile(wb, `contenedores_cerrados_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('success', 'Exportado', `${resumenRows.length} contenedores, ${detalleRows.length} líneas descargadas`);
    } catch (err) {
      console.error('[CC] Export error:', err);
      showToast('error', 'Error', 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                          */
  /* ------------------------------------------------------------------ */
  const handleFilterChange = (newFilters: CCFilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contenedores Cerrados</h2>
          <p className="text-sm text-gray-500 mt-1">
            Contenedores cerrados y despachados con métricas agregadas
          </p>
        </div>
        <button
          onClick={handleExportXlsx}
          disabled={totalCount === 0 || exporting}
          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
        >
          {exporting ? (
            <>
              <i className="ri-loader-4-line animate-spin mr-2"></i>
              Exportando...
            </>
          ) : (
            <>
              <i className="ri-file-excel-2-line mr-2"></i>
              Descargar .xlsx
            </>
          )}
        </button>
      </div>

      <ClosedContainersFilters tiendas={tiendas} onFilterChange={handleFilterChange} />

      <ClosedContainersTable
        rows={rows}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        totalPages={totalPages}
        onPageChange={setPage}
        onExpandRow={loadContainerDetail}
      />
    </div>
  );
}
