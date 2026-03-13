import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface TiendaProgress {
  tienda: string;
  camion: string;
  total: number;
  confirmed: number;
  pending: number;
  percent: number;
}

export function useTiendaProgress(importId: string | null = null) {
  const [data, setData] = useState<TiendaProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 15000);
    return () => clearInterval(interval);
  }, [importId]);

  const fetchProgress = async () => {
    try {
      let targetImportId = importId;

      // Si no hay importId seleccionado, obtener la importación más reciente
      if (!targetImportId) {
        const { data: recentImport } = await supabase
          .from('imports')
          .select('id, status')
          .neq('status', 'CANCELLED')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recentImport) {
          setData([]);
          setLoading(false);
          return;
        }

        targetImportId = recentImport.id;
      }

      // ✅ NUEVA LÓGICA: Obtener líneas con qty_to_send como base
      const { data: lines } = await supabase
        .from('import_lines')
        .select('tienda, camion, qty_to_send, qty_confirmed')
        .eq('import_id', targetImportId)
        .not('tienda', 'is', null);

      if (!lines || lines.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Agrupar por tienda
      const grouped = lines.reduce((acc, line) => {
        const key = line.tienda;
        if (!acc[key]) {
          acc[key] = {
            tienda: line.tienda,
            camion: line.camion || 'Sin asignar',
            total: 0,
            confirmed: 0,
          };
        }
        // ✅ Base = qty_to_send (cantidad solicitada)
        acc[key].total += line.qty_to_send || 0;
        acc[key].confirmed += line.qty_confirmed || 0;
        return acc;
      }, {} as Record<string, { tienda: string; camion: string; total: number; confirmed: number }>);

      // Convertir a array y calcular porcentajes
      const result: TiendaProgress[] = Object.values(grouped)
        .map((g) => {
          const pending = Math.max(0, g.total - g.confirmed);
          const percent = g.total > 0 ? Math.round((g.confirmed / g.total) * 100) : 0;
          
          // 🔍 Log por tienda
          console.log('[DASHBOARD_METRICS] Tienda:', {
            tienda: g.tienda,
            total_qty_to_send: g.total,
            total_qty_confirmed: g.confirmed,
            pending,
            percent,
          });
          
          return {
            tienda: g.tienda,
            camion: g.camion,
            total: g.total,
            confirmed: g.confirmed,
            pending,
            percent,
          };
        })
        .sort((a, b) => b.percent - a.percent);

      setData(result);
    } catch (error) {
      console.error('Error cargando progreso por tienda:', error);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading };
}