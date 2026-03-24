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

// Pagina automáticamente para superar el límite de 1000 filas de Supabase
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
      console.error('[TIENDA_PROGRESS] fetchAllPages error:', error);
      break;
    }

    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

export function useTiendaProgress(importId: string | null = null) {
  const [data, setData] = useState<TiendaProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  const fetchProgress = async () => {
    try {
      let targetImportIds: string[] = [];

      if (importId) {
        targetImportIds = [importId];
      } else {
        // "Todas las cargas" → todos los imports no cancelados
        const { data: allImports } = await supabase
          .from('imports')
          .select('id')
          .neq('status', 'CANCELLED');

        targetImportIds = (allImports ?? []).map((r) => r.id);

        if (targetImportIds.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }
      }

      // Traer TODAS las líneas con paginación — evita el corte de 1000 filas
      const lines = await fetchAllPages<{
        tienda: string;
        camion: string;
        qty_to_send: number;
        qty_confirmed: number;
      }>((from, to) =>
        supabase
          .from('import_lines')
          .select('tienda, camion, qty_to_send, qty_confirmed')
          .in('import_id', targetImportIds)
          .not('tienda', 'is', null)
          .range(from, to)
      );

      if (lines.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Agrupar por tienda
      const grouped = lines.reduce(
        (acc, line) => {
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
        },
        {} as Record<string, { tienda: string; camion: string; total: number; confirmed: number }>
      );

      const result: TiendaProgress[] = Object.values(grouped)
        .map((g) => {
          const pending = Math.max(0, g.total - g.confirmed);
          const percent = g.total > 0 ? Math.round((g.confirmed / g.total) * 100) : 0;

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
