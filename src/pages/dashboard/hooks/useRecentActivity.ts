import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  time: string;
  icon: string;
  color: string;
}

export function useRecentActivity() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchActivities = async () => {
    try {
      const { data: events, error } = await supabase
        .from('scan_events')
        .select('id, event_type, raw_code, sku, tienda, qty, notes, created_at, pallet_id')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      if (events && events.length > 0) {
        // Obtener información de camión para eventos que tienen pallet_id
        const palletIds = events
          .filter((e) => e.pallet_id)
          .map((e) => e.pallet_id as string);

        let camionMap: Record<string, string> = {};

        if (palletIds.length > 0) {
          // Obtener camiones desde import_lines a través de pallet_code
          const { data: pallets } = await supabase
            .from('pallets')
            .select('id, pallet_code')
            .in('id', palletIds);

          if (pallets && pallets.length > 0) {
            const palletCodes = pallets.map((p) => p.pallet_code);

            const { data: importLines } = await supabase
              .from('import_lines')
              .select('pallet_code, camion')
              .in('pallet_code', palletCodes);

            if (importLines) {
              // Crear mapa de pallet_code -> camion
              const codeToTruck: Record<string, string> = {};
              importLines.forEach((line) => {
                if (line.camion && !codeToTruck[line.pallet_code]) {
                  codeToTruck[line.pallet_code] = line.camion;
                }
              });

              // Crear mapa de pallet_id -> camion
              pallets.forEach((pallet) => {
                if (codeToTruck[pallet.pallet_code]) {
                  camionMap[pallet.id] = codeToTruck[pallet.pallet_code];
                }
              });
            }
          }
        }

        const mapped: RecentActivity[] = events.map((e) => {
          const camion = e.pallet_id ? camionMap[e.pallet_id] || '' : '';
          const camionText = camion ? ` [${camion}]` : '';
          
          const typeMap: Record<
            string,
            { desc: string; icon: string; color: string }
          > = {
            SCAN_PALLET: {
              desc: `Pallet escaneado: ${e.raw_code || 'N/A'}`,
              icon: 'ri-qr-scan-2-line',
              color: 'bg-teal-100 text-teal-700',
            },
            SCAN_SKU: {
              desc: `SKU escaneado: ${e.sku || e.raw_code || 'N/A'} → ${
                e.tienda || ''
              }${camionText}`,
              icon: 'ri-barcode-line',
              color: 'bg-sky-100 text-sky-700',
            },
            CONFIRM_QTY: {
              desc: `Confirmado: ${e.qty} uds de ${
                e.sku || 'N/A'
              } → ${e.tienda || ''}${camionText}`,
              icon: 'ri-check-double-line',
              color: 'bg-emerald-100 text-emerald-700',
            },
            CLOSE: {
              desc:
                e.notes ||
                `Distribución cerrada para ${e.tienda || 'N/A'}${camionText}`,
              icon: 'ri-inbox-archive-line',
              color: 'bg-amber-100 text-amber-700',
            },
            UNLOCK: {
              desc: 'Pallet liberado',
              icon: 'ri-lock-unlock-line',
              color: 'bg-gray-100 text-gray-700',
            },
            ADJUST: {
              desc: `Ajuste: ${e.notes || 'N/A'}`,
              icon: 'ri-edit-line',
              color: 'bg-rose-100 text-rose-700',
            },
            REVERSE: {
              desc: `Reversión: ${e.qty} uds de ${e.sku || 'N/A'} → ${e.tienda || ''}${camionText}`,
              icon: 'ri-arrow-go-back-line',
              color: 'bg-rose-100 text-rose-700',
            },
          };

          const info =
            typeMap[e.event_type] || {
              desc: e.event_type,
              icon: 'ri-information-line',
              color: 'bg-gray-100 text-gray-700',
            };

          const timeAgo = getTimeAgo(new Date(e.created_at));

          return {
            id: e.id,
            type: e.event_type,
            description: info.desc,
            time: timeAgo,
            icon: info.icon,
            color: info.color,
          };
        });

        setActivities(mapped);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error cargando actividad:', error);
    } finally {
      setLoading(false);
    }
  };

  return { activities, loading };
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Hace un momento';
  if (diffInSeconds < 3600)
    return `Hace ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400)
    return `Hace ${Math.floor(diffInSeconds / 3600)} h`;
  return `Hace ${Math.floor(diffInSeconds / 86400)} d`;
}
