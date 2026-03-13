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

export function useDashboardStats(refreshInterval = 10000, importId: string | null = null) {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      // Si hay un importId seleccionado, filtrar por esa carga
      const importFilter = importId ? { import_id: importId } : {};

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
        // Imports activos
        importId
          ? supabase
              .from('imports')
              .select('id', { count: 'exact', head: true })
              .eq('id', importId)
              .in('status', ['DRAFT', 'IN_PROGRESS'])
          : supabase
              .from('imports')
              .select('id', { count: 'exact', head: true })
              .in('status', ['DRAFT', 'IN_PROGRESS']),
        
        // Imports completados
        importId
          ? supabase
              .from('imports')
              .select('id', { count: 'exact', head: true })
              .eq('id', importId)
              .eq('status', 'DONE')
          : supabase
              .from('imports')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'DONE'),
        
        // Total de líneas
        importId
          ? supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('import_id', importId)
          : supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true }),
        
        // Líneas pendientes
        importId
          ? supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('import_id', importId)
              .eq('status', 'PENDING')
          : supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'PENDING'),
        
        // Líneas parciales
        importId
          ? supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('import_id', importId)
              .eq('status', 'PARTIAL')
          : supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'PARTIAL'),
        
        // Líneas completadas
        importId
          ? supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('import_id', importId)
              .eq('status', 'DONE')
          : supabase
              .from('import_lines')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'DONE'),
        
        // Pallets abiertos (filtrar por pallet_codes de la carga si aplica)
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('pallet_code')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const palletCodes = [...new Set(lines.map(l => l.pallet_code).filter(Boolean))];
              
              return supabase
                .from('pallets')
                .select('id', { count: 'exact', head: true })
                .in('pallet_code', palletCodes)
                .eq('status', 'OPEN');
            })()
          : supabase
              .from('pallets')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'OPEN'),
        
        // Total pallets
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('pallet_code')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const palletCodes = [...new Set(lines.map(l => l.pallet_code).filter(Boolean))];
              
              return supabase
                .from('pallets')
                .select('id', { count: 'exact', head: true })
                .in('pallet_code', palletCodes);
            })()
          : supabase.from('pallets').select('id', { count: 'exact', head: true }),
        
        // Contenedores abiertos (filtrar por tiendas de la carga si aplica)
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('tienda')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const tiendas = [...new Set(lines.map(l => l.tienda).filter(Boolean))];
              
              return supabase
                .from('containers')
                .select('id', { count: 'exact', head: true })
                .in('tienda', tiendas)
                .eq('status', 'OPEN');
            })()
          : supabase
              .from('containers')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'OPEN'),
        
        // Contenedores cerrados
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('tienda')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const tiendas = [...new Set(lines.map(l => l.tienda).filter(Boolean))];
              
              return supabase
                .from('containers')
                .select('id', { count: 'exact', head: true })
                .in('tienda', tiendas)
                .eq('status', 'CLOSED');
            })()
          : supabase
              .from('containers')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'CLOSED'),
        
        // Contenedores despachados
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('tienda')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const tiendas = [...new Set(lines.map(l => l.tienda).filter(Boolean))];
              
              return supabase
                .from('containers')
                .select('id', { count: 'exact', head: true })
                .in('tienda', tiendas)
                .eq('status', 'DISPATCHED');
            })()
          : supabase
              .from('containers')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'DISPATCHED'),
        
        // Total eventos (filtrar por pallets de la carga si aplica)
        importId
          ? (async () => {
              const { data: lines } = await supabase
                .from('import_lines')
                .select('pallet_code')
                .eq('import_id', importId);
              
              if (!lines || lines.length === 0) return { count: 0 };
              
              const palletCodes = [...new Set(lines.map(l => l.pallet_code).filter(Boolean))];
              
              const { data: pallets } = await supabase
                .from('pallets')
                .select('id')
                .in('pallet_code', palletCodes);
              
              if (!pallets || pallets.length === 0) return { count: 0 };
              
              const palletIds = pallets.map(p => p.id);
              
              return supabase
                .from('scan_events')
                .select('id', { count: 'exact', head: true })
                .in('pallet_id', palletIds);
            })()
          : supabase
              .from('scan_events')
              .select('id', { count: 'exact', head: true }),
        
        // SKUs únicos
        importId
          ? supabase
              .from('import_lines')
              .select('sku')
              .eq('import_id', importId)
          : supabase
              .from('import_lines')
              .select('sku'),
        
        // Tiendas únicas
        importId
          ? supabase
              .from('import_lines')
              .select('tienda')
              .eq('import_id', importId)
          : supabase
              .from('import_lines')
              .select('tienda'),
        
        // Camiones únicos
        importId
          ? supabase
              .from('import_lines')
              .select('camion')
              .eq('import_id', importId)
          : supabase
              .from('import_lines')
              .select('camion'),
        
        // Total unidades - NUEVA LÓGICA: usar qty_to_send como base
        importId
          ? supabase
              .from('import_lines')
              .select('qty_to_send, qty_confirmed')
              .eq('import_id', importId)
          : supabase
              .from('import_lines')
              .select('qty_to_send, qty_confirmed'),
      ]);

      const tl = totalLines?.count ?? 0;
      const dl = doneLines?.count ?? 0;

      // Calcular SKUs únicos
      const skuSet = new Set(uniqueSKUs?.data?.map(item => item.sku).filter(Boolean) ?? []);
      
      // Calcular tiendas únicas
      const tiendaSet = new Set(uniqueTiendas?.data?.map(item => item.tienda).filter(Boolean) ?? []);
      
      // Calcular camiones únicos
      const camionSet = new Set(uniqueCamiones?.data?.map(item => item.camion).filter(Boolean) ?? []);

      // ✅ NUEVA LÓGICA: Base = qty_to_send (cantidad solicitada)
      const totalUnits = totalUnitsData?.data?.reduce((sum, line) => sum + (line.qty_to_send || 0), 0) ?? 0;
      const totalConfirmed = totalUnitsData?.data?.reduce((sum, line) => sum + (line.qty_confirmed || 0), 0) ?? 0;
      const totalPending = Math.max(0, totalUnits - totalConfirmed);
      
      // ✅ Progreso basado en qty_to_send
      const progressPercent = totalUnits > 0 ? Math.round((totalConfirmed / totalUnits) * 100) : 0;

      // 🔍 Logs de validación
      console.log('[DASHBOARD_METRICS]', {
        import_id: importId || 'Todas las cargas',
        total_qty_to_send: totalUnits,
        total_qty_confirmed: totalConfirmed,
        total_pending: totalPending,
        progress_percent: progressPercent,
      });

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