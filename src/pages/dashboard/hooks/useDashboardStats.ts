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

export function useDashboardStats(refreshInterval = 10000) {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      const [
        activeImports,
        doneImports,
        totalLines,
        pendingLines,
        partialLines,
        doneLines,
        openPallets,
        totalPallets,
        openContainers,
        closedContainers,
        dispatchedContainers,
        totalEvents,
        uniqueSKUs,
        uniqueTiendas,
        uniqueCamiones,
        totalUnitsData,
      ] = await Promise.all([
        supabase
          .from('imports')
          .select('id', { count: 'exact', head: true })
          .in('status', ['DRAFT', 'IN_PROGRESS']),
        supabase
          .from('imports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'DONE'),
        supabase
          .from('import_lines')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('import_lines')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
        supabase
          .from('import_lines')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PARTIAL'),
        supabase
          .from('import_lines')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'DONE'),
        supabase
          .from('pallets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'OPEN'),
        supabase.from('pallets').select('id', { count: 'exact', head: true }),
        supabase
          .from('containers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'OPEN'),
        supabase
          .from('containers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'CLOSED'),
        supabase
          .from('containers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'DISPATCHED'),
        supabase
          .from('scan_events')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('import_lines')
          .select('sku'),
        supabase
          .from('import_lines')
          .select('tienda'),
        supabase
          .from('import_lines')
          .select('camion'),
        supabase
          .from('import_lines')
          .select('qty_ordered, qty_confirmed'),
      ]);

      const tl = totalLines?.count ?? 0;
      const dl = doneLines?.count ?? 0;
      const progress = tl > 0 ? Math.round((dl / tl) * 100) : 0;

      // Calcular SKUs únicos
      const skuSet = new Set(uniqueSKUs?.data?.map(item => item.sku).filter(Boolean) ?? []);
      
      // Calcular tiendas únicas
      const tiendaSet = new Set(uniqueTiendas?.data?.map(item => item.tienda).filter(Boolean) ?? []);
      
      // Calcular camiones únicos
      const camionSet = new Set(uniqueCamiones?.data?.map(item => item.camion).filter(Boolean) ?? []);

      // Calcular totales de unidades
      const totalUnits = totalUnitsData?.data?.reduce((sum, line) => sum + (line.qty_ordered || 0), 0) ?? 0;
      const totalConfirmed = totalUnitsData?.data?.reduce((sum, line) => sum + (line.qty_confirmed || 0), 0) ?? 0;
      const totalPending = totalUnits - totalConfirmed;

      setStats({
        activeImports: activeImports?.count ?? 0,
        doneImports: doneImports?.count ?? 0,
        totalLines: tl,
        pendingLines: pendingLines?.count ?? 0,
        partialLines: partialLines?.count ?? 0,
        doneLines: dl,
        openPallets: openPallets?.count ?? 0,
        totalPallets: totalPallets?.count ?? 0,
        openContainers: openContainers?.count ?? 0,
        closedContainers: closedContainers?.count ?? 0,
        dispatchedContainers: dispatchedContainers?.count ?? 0,
        totalEvents: totalEvents?.count ?? 0,
        totalCamiones: camionSet.size,
        totalSKUs: skuSet.size,
        totalTiendas: tiendaSet.size,
        totalUnits,
        totalConfirmed,
        totalPending,
        progressPercent: progress,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, refreshInterval]);

  return { stats, loading, lastUpdated, refresh: fetchStats };
}
