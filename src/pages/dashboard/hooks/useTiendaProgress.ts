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

export function useTiendaProgress() {
  const [data, setData] = useState<TiendaProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchProgress = async () => {
    try {
      // Obtener la importación más reciente (cualquier estado excepto CANCELLED)
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

      // Obtener líneas agrupadas por tienda
      const { data: lines } = await supabase
        .from('import_lines')
        .select('tienda, camion, qty_to_send, qty_confirmed')
        .eq('import_id', recentImport.id)
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
        acc[key].total += line.qty_to_send || 0;
        acc[key].confirmed += line.qty_confirmed || 0;
        return acc;
      }, {} as Record<string, { tienda: string; camion: string; total: number; confirmed: number }>);

      // Convertir a array y calcular porcentajes
      const result: TiendaProgress[] = Object.values(grouped)
        .map((g) => ({
          tienda: g.tienda,
          camion: g.camion,
          total: g.total,
          confirmed: g.confirmed,
          pending: g.total - g.confirmed,
          percent: g.total > 0 ? Math.round((g.confirmed / g.total) * 100) : 0,
        }))
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
