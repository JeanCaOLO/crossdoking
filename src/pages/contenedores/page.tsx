
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

  // Carga los contenedores y los refresca cada 15 s.
  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, 15000);
    return () => clearInterval(interval);
    // Sólo se vuelve a ejecutar cuando cambia el filtro.
  }, [filter]);

  const loadContainers = async () => {
    try {
      // Construimos la consulta de forma segura.
      let query = supabase
        .from('containers')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Obtener el camión de cada contenedor desde import_lines
      const containersWithCamion: ContainerWithCamion[] = [];

      // Ejecutamos las consultas de forma secuencial pero manejamos cualquier error individual
      for (const container of data || []) {
        try {
          // Obtener una línea del contenedor para extraer el camión
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

          containersWithCamion.push({
            ...container,
            camion,
          });
        } catch (innerErr) {
          console.error(
            `Error obteniendo el camión para el contenedor ${container.id}:`,
            innerErr
          );
          containersWithCamion.push({
            ...container,
            camion: '',
          });
        }
      }

      setContainers(containersWithCamion);
    } catch (err) {
      console.error('Error cargando contenedores:', err);
      // En caso de error mantenemos el estado anterior pero indicamos que la carga terminó
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<
      string,
      { bg: string; label: string }
    > = {
      OPEN: { bg: 'bg-sky-100 text-sky-700', label: 'Abierto' },
      CLOSED: { bg: 'bg-amber-100 text-amber-700', label: 'Cerrado' },
      DISPATCHED: { bg: 'bg-emerald-100 text-emerald-700', label: 'Despachado' },
    };
    const info = map[status] ?? {
      bg: 'bg-gray-100 text-gray-700',
      label: status,
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-medium ${info.bg}`}
      >
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
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
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
            <p className="text-sm text-gray-500">
              No hay contenedores disponibles
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {containers.map((c) => (
              <Link
                key={c.id}
                to={`/contenedores/${c.id}`}
                className="block p-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center">
                      <i className="ri-inbox-line text-xl text-white"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {c.code}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tienda:{' '}
                        <strong>{c.tienda}</strong>
                        {c.camion && (
                          <>
                            {' '}
                            &middot;{' '}
                            <span className="inline-flex items-center text-amber-600">
                              <i className="ri-truck-line mr-1"></i>
                              {c.camion}
                            </span>
                          </>
                        )}
                        {' '}
                        &middot;{' '}
                        {new Date(c.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {getStatusBadge(c.status)}
                    {c.dispatched_at && (
                      <span className="text-[11px] text-gray-400">
                        Despachado:{' '}
                        {new Date(c.dispatched_at).toLocaleDateString(
                          'es-ES'
                        )}
                      </span>
                    )}
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
