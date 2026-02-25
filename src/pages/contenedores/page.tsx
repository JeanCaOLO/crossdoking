
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Container } from '../../lib/supabase';

interface ContainerWithCamion extends Container {
  camion?: string;
}

export default function ContenedoresPage() {
  const [containers, setContainers] = useState<ContainerWithCamion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadContainers = async () => {
    try {
      let query = supabase
        .from('containers')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

      const { data, error } = await query;
      if (error) throw error;

      const containersWithCamion: ContainerWithCamion[] = [];

      for (const container of data || []) {
        try {
          const { data: containerLine } = await supabase
            .from('container_lines')
            .select('source_import_line_id')
            .eq('container_id', container.id)
            .limit(1)
            .maybeSingle();

          let camion = '';
          if (containerLine?.source_import_line_id) {
            const { data: importLine } = await supabase
              .from('import_lines')
              .select('camion')
              .eq('id', containerLine.source_import_line_id)
              .maybeSingle();
            camion = importLine?.camion ?? '';
          }

          containersWithCamion.push({ ...container, camion });
        } catch {
          containersWithCamion.push({ ...container, camion: '' });
        }
      }

      setContainers(containersWithCamion);
    } catch (err) {
      console.error('Error cargando contenedores:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      OPEN: { bg: 'bg-sky-100 text-sky-700', label: 'Abierto' },
      CLOSED: { bg: 'bg-amber-100 text-amber-700', label: 'Cerrado' },
      DISPATCHED: { bg: 'bg-emerald-100 text-emerald-700', label: 'Despachado' },
    };
    const info = map[status] ?? { bg: 'bg-gray-100 text-gray-700', label: status };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${info.bg}`}>
        {info.label}
      </span>
    );
  };

  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'OPEN', label: 'Abiertos' },
    { value: 'CLOSED', label: 'Cerrados' },
    { value: 'DISPATCHED', label: 'Despachados' },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto md:max-w-none">
      <div className="bg-white rounded-xl border border-gray-100">
        {/* Filter tabs - scrollable on mobile */}
        <div className="p-3 md:p-4 border-b border-gray-100 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filter === f.value
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        ) : containers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-inbox-line text-3xl text-gray-300"></i>
            </div>
            <p className="text-sm text-gray-500">No hay contenedores disponibles</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {containers.map((c) => (
              <Link
                key={c.id}
                to={`/contenedores/${c.id}`}
                className="flex items-center gap-3 p-4 md:p-5 hover:bg-gray-50/50 active:bg-gray-100 transition-colors cursor-pointer"
              >
                {/* Icon */}
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  c.type === 'SOBRANTE'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : 'bg-gradient-to-br from-rose-500 to-rose-600'
                }`}>
                  <i className={`${c.type === 'SOBRANTE' ? 'ri-archive-2-line' : 'ri-inbox-line'} text-lg md:text-xl text-white`}></i>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 font-mono">{c.code}</h3>
                    {getStatusBadge(c.status)}
                    {c.type === 'SOBRANTE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                        Sobrante
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-600 font-medium">{c.tienda}</span>
                    {c.camion && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <i className="ri-truck-line"></i>
                        {c.camion}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Arrow */}
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
