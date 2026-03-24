import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface DashboardStats {
  activeImports: number;
  doneImports: number;
  totalLines: number;
  pendingLines: number;
  partialLines: number;
  doneLines: number;
  openPallets: number;
  totalPallets: number;
  openContainers: number;
  closedContainers: number;
  dispatchedContainers: number;
  totalEvents: number;
  totalCamiones: number;
  totalSKUs: number;
  totalTiendas: number;
  totalUnits: number;
  totalConfirmed: number;
  totalPending: number;
  progressPercent: number;
}

const defaultStats: DashboardStats = {
  activeImports: 0,
  doneImports: 0,
  totalLines: 0,
  pendingLines: 0,
  partialLines: 0,
  doneLines: 0,
  openPallets: 0,
  totalPallets: 0,
  openContainers: 0,
  closedContainers: 0,
  dispatchedContainers: 0,
  totalEvents: 0,
  totalCamiones: 0,
  totalSKUs: 0,
  totalTiendas: 0,
  totalUnits: 0,
  totalConfirmed: 0,
  totalPending: 0,
  progressPercent: 0,
};

// ─── Paginación universal ─────────────────────────────────────────────────────
// Supabase limita las queries de datos a 1000 filas por defecto.
// Esta función pagina automáticamente hasta traer todos los registros.
async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) {
      console.error('[DASHBOARD] fetchAllPages error:', error);
      break;
    }

    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

export function useDashboardStats(refreshInterval = 10000, importId: string | null = null) {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      // ─── Resolver qué import IDs usar ──────────────────────────────
      let activeImportIds: string[] | null = null;

      if (!importId) {
        const { data: importsData } = await supabase
          .from('imports')
          .select('id')
          .neq('status', 'CANCELLED');

        activeImportIds = (importsData ?? []).map((r) => r.id);

        if (activeImportIds.length === 0) {
          setStats(defaultStats);
          setLoading(false);
          return;
        }
      }

      // ─── Helper: aplicar filtro import_id ──────────────────────────
      const applyImportFilter = (q: ReturnType<typeof supabase.from>) => {
        if (importId) return (q as any).eq('import_id', importId);
        return (q as any).in('import_id', activeImportIds!);
      };

      // ─── Fetches paralelos de conteos (server-side, sin límite) ────
      const [
        activeImportsCount,
        doneImportsCount,
        totalLines,
        pendingLines,
        partialLines,
        doneLines,
      ] = await Promise.all([
        (() => {
          const q = supabase.from('imports').select('id', { count: 'exact', head: true }).in('status', ['DRAFT', 'IN_PROGRESS']);
          if (importId) return (q as any).eq('id', importId);
          if (activeImportIds) return (q as any).in('id', activeImportIds);
          return q;
        })(),
        (() => {
          const q = supabase.from('imports').select('id', { count: 'exact', head: true }).eq('status', 'DONE');
          if (importId) return (q as any).eq('id', importId);
          if (activeImportIds) return (q as any).in('id', activeImportIds);
          return q;
        })(),
        (() => {
          const q = supabase.from('import_lines').select('id', { count: 'exact', head: true });
          return applyImportFilter(q);
        })(),
        (() => {
          const q = supabase.from('import_lines').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');
          return applyImportFilter(q);
        })(),
        (() => {
          const q = supabase.from('import_lines').select('id', { count: 'exact', head: true }).eq('status', 'PARTIAL');
          return applyImportFilter(q);
        })(),
        (() => {
          const q = supabase.from('import_lines').select('id', { count: 'exact', head: true }).eq('status', 'DONE');
          return applyImportFilter(q);
        })(),
      ]);

      // ─── Traer TODAS las líneas con paginación ─────────────────────
      // qty_to_send y qty_confirmed — crítico: paginar para no perder filas
      const qtyLines = await fetchAllPages<{ qty_to_send: number; qty_confirmed: number }>(
        (from, to) => {
          const q = supabase
            .from('import_lines')
            .select('qty_to_send, qty_confirmed')
            .range(from, to);
          if (importId) return (q as any).eq('import_id', importId);
          return (q as any).in('import_id', activeImportIds!);
        }
      );

      // pallet_codes únicos con paginación
      const palletLinesRaw = await fetchAllPages<{ pallet_code: string }>(
        (from, to) => {
          const q = supabase.from('import_lines').select('pallet_code').range(from, to);
          if (importId) return (q as any).eq('import_id', importId);
          return (q as any).in('import_id', activeImportIds!);
        }
      );
      const uniquePalletCodes = [...new Set(palletLinesRaw.map((l) => l.pallet_code).filter(Boolean))];

      // tiendas únicas con paginación
      const tiendaLinesRaw = await fetchAllPages<{ tienda: string }>(
        (from, to) => {
          const q = supabase.from('import_lines').select('tienda').range(from, to);
          if (importId) return (q as any).eq('import_id', importId);
          return (q as any).in('import_id', activeImportIds!);
        }
      );
      const uniqueTiendaList = [...new Set(tiendaLinesRaw.map((l) => l.tienda).filter(Boolean))];

      // SKUs únicos con paginación
      const skuLinesRaw = await fetchAllPages<{ sku: string }>(
        (from, to) => {
          const q = supabase.from('import_lines').select('sku').range(from, to);
          if (importId) return (q as any).eq('import_id', importId);
          return (q as any).in('import_id', activeImportIds!);
        }
      );
      const uniqueSkuList = [...new Set(skuLinesRaw.map((l) => l.sku).filter(Boolean))];

      // camiones únicos con paginación
      const camionLinesRaw = await fetchAllPages<{ camion: string }>(
        (from, to) => {
          const q = supabase.from('import_lines').select('camion').range(from, to);
          if (importId) return (q as any).eq('import_id', importId);
          return (q as any).in('import_id', activeImportIds!);
        }
      );
      const uniqueCamionList = [...new Set(camionLinesRaw.map((l) => l.camion).filter(Boolean))];

      // ─── Conteos de pallets y contenedores (server-side count) ─────
      const [openPallets, totalPallets, openContainers, closedContainers, dispatchedContainers] =
        await Promise.all([
          uniquePalletCodes.length > 0
            ? supabase.from('pallets').select('id', { count: 'exact', head: true }).in('pallet_code', uniquePalletCodes).eq('status', 'OPEN')
            : Promise.resolve({ count: 0 }),
          uniquePalletCodes.length > 0
            ? supabase.from('pallets').select('id', { count: 'exact', head: true }).in('pallet_code', uniquePalletCodes)
            : Promise.resolve({ count: 0 }),
          uniqueTiendaList.length > 0
            ? supabase.from('containers').select('id', { count: 'exact', head: true }).in('tienda', uniqueTiendaList).eq('status', 'OPEN')
            : Promise.resolve({ count: 0 }),
          uniqueTiendaList.length > 0
            ? supabase.from('containers').select('id', { count: 'exact', head: true }).in('tienda', uniqueTiendaList).eq('status', 'CLOSED')
            : Promise.resolve({ count: 0 }),
          uniqueTiendaList.length > 0
            ? supabase.from('containers').select('id', { count: 'exact', head: true }).in('tienda', uniqueTiendaList).eq('status', 'DISPATCHED')
            : Promise.resolve({ count: 0 }),
        ]);

      // ─── Total eventos ──────────────────────────────────────────────
      let totalEventsCount = 0;
      if (uniquePalletCodes.length > 0) {
        const { data: pallets } = await supabase
          .from('pallets')
          .select('id')
          .in('pallet_code', uniquePalletCodes);

        if (pallets && pallets.length > 0) {
          const palletIds = pallets.map((p) => p.id);
          const { count } = await supabase
            .from('scan_events')
            .select('id', { count: 'exact', head: true })
            .in('pallet_id', palletIds);
          totalEventsCount = count ?? 0;
        }
      }

      // ─── Calcular métricas de unidades ─────────────────────────────
      const totalUnits = qtyLines.reduce((sum, l) => sum + (l.qty_to_send || 0), 0);
      const totalConfirmed = qtyLines.reduce((sum, l) => sum + (l.qty_confirmed || 0), 0);
      const totalPending = Math.max(0, totalUnits - totalConfirmed);
      const progressPercent = totalUnits > 0 ? Math.round((totalConfirmed / totalUnits) * 100) : 0;

      console.log('[DASHBOARD_METRICS]', {
        import_id: importId || 'Todas las cargas',
        active_import_ids_count: activeImportIds ? activeImportIds.length : 1,
        total_rows_fetched: qtyLines.length,
        total_qty_to_send: totalUnits,
        total_qty_confirmed: totalConfirmed,
        total_pending: totalPending,
        progress_percent: progressPercent,
      });

      setStats({
        activeImports: activeImportsCount?.count ?? 0,
        doneImports: doneImportsCount?.count ?? 0,
        totalLines: totalLines?.count ?? 0,
        pendingLines: pendingLines?.count ?? 0,
        partialLines: partialLines?.count ?? 0,
        doneLines: doneLines?.count ?? 0,
        openPallets: openPallets?.count ?? 0,
        totalPallets: totalPallets?.count ?? 0,
        openContainers: openContainers?.count ?? 0,
        closedContainers: closedContainers?.count ?? 0,
        dispatchedContainers: dispatchedContainers?.count ?? 0,
        totalEvents: totalEventsCount,
        totalCamiones: uniqueCamionList.length,
        totalSKUs: uniqueSkuList.length,
        totalTiendas: uniqueTiendaList.length,
        totalUnits,
        totalConfirmed,
        totalPending,
        progressPercent,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, refreshInterval]);

  return { stats, loading, lastUpdated, refresh: fetchStats };
}
