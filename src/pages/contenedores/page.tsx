import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, Container } from '../../lib/supabase';
import { printContainerById } from '../../services/printing/containerPrint';

interface ContainerWithCamion extends Container {
  camion?: string;
  pallets?: string[]; // Array de pallet_codes asociados
}

interface ContainerContentRow {
  pallet_code: string;
  sku: string;
  descripcion: string;
  qty: number;
}

const PAGE_SIZE = 10;

/**
 * Normaliza un string para búsqueda:
 * - Trim y uppercase
 * - Genera variantes con O→0 y 0→O para manejar confusiones comunes
 */
const normalize = (s: string | null | undefined): string[] => {
  if (!s) return [''];
  const base = s.trim().toUpperCase();
  
  // Generar variantes: original, con O→0, con 0→O
  const variants = new Set<string>();
  variants.add(base);
  
  // Si contiene O, agregar variante con 0
  if (base.includes('O')) {
    variants.add(base.replace(/O/g, '0'));
  }
  
  // Si contiene 0, agregar variante con O
  if (base.includes('0')) {
    variants.add(base.replace(/0/g, 'O'));
  }
  
  return Array.from(variants);
};

export default function ContenedoresPage() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<ContainerWithCamion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
    loadContainers();
    const interval = setInterval(loadContainers, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadContainers = async () => {
    try {
      let query = supabase
        .from('containers')
        .select(`
          *,
          container_lines(
            pallet_id,
            pallets(pallet_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

      const { data, error } = await query;
      if (error) throw error;

      const containersWithCamion: ContainerWithCamion[] = [];

      for (const container of data || []) {
        try {
          // Extraer pallets únicos
          const palletCodes = new Set<string>();
          if (container.container_lines && Array.isArray(container.container_lines)) {
            container.container_lines.forEach((line: any) => {
              if (line.pallets?.pallet_code) {
                palletCodes.add(line.pallets.pallet_code);
              }
            });
          }

          // Obtener camión de la primera línea
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
            pallets: Array.from(palletCodes)
          });
        } catch {
          containersWithCamion.push({ 
            ...container, 
            camion: '',
            pallets: []
          });
        }
      }

      setContainers(containersWithCamion);
    } catch (err) {
      console.error('Error cargando contenedores:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Filtrar contenedores por búsqueda combinada: container.code + pallet_code */
  const filteredContainers = useMemo(() => {
    if (!searchTerm.trim()) return containers;

    const queryVariants = normalize(searchTerm);
    
    console.log('[SEARCH]', { 
      query: searchTerm, 
      normalized: queryVariants 
    });

    return containers.filter((c) => {
      // Normalizar container.code
      const containerCodeVariants = normalize(c.code);
      
      // Buscar en container.code
      const matchCode = queryVariants.some(qv => 
        containerCodeVariants.some(cv => cv.includes(qv))
      );
      
      // Buscar en pallets asociados
      const matchPallet = c.pallets?.some((pallet) => {
        const palletVariants = normalize(pallet);
        return queryVariants.some(qv => 
          palletVariants.some(pv => pv.includes(qv))
        );
      }) ?? false;

      const match = matchCode || matchPallet;

      // Log para diagnóstico (comentar después de verificar)
      if (match) {
        console.log('[SEARCH] Match:', {
          code: c.code,
          containerCodeVariants,
          pallets: c.pallets,
          matchCode,
          matchPallet
        });
      }

      return match;
    });
  }, [containers, searchTerm]);

  const handleContinueContainer = (e: React.MouseEvent, containerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 Continuar contenedor:', containerId);
    navigate(`/operacion?containerId=${containerId}`);
  };

  /** Reimprimir etiqueta de contenedor CLOSED */
  const handleReprint = async (e: React.MouseEvent, container: ContainerWithCamion) => {
    e.preventDefault();
    e.stopPropagation();

    if (container.status !== 'CLOSED') return;

    setReprintingId(container.id);

    try {
      console.log('🖨️ Reimprimiendo contenedor:', container.code);

      const result = await printContainerById(container.id, container.code, container.tienda);

      if (!result.success) {
        throw new Error(result.error || 'Error al reimprimir');
      }
    } catch (err) {
      console.error('❌ Error reimprimiendo:', err);
      alert('Error al reimprimir la etiqueta del contenedor');
    } finally {
      setReprintingId(null);
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

  const totalPages = Math.max(1, Math.ceil(filteredContainers.length / PAGE_SIZE));
  const paginated = filteredContainers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Resetear página cuando cambia el filtro de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto md:max-w-none">
      <div className="bg-white rounded-xl border border-gray-100">
        {/* Filter tabs */}
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

        {/* Barra de búsqueda tipo blur */}
        <div className="p-3 md:p-4 border-b border-gray-100">
          <div 
            className="relative rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(209, 213, 219, 0.3)'
            }}
          >
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg"></i>
            <input
              type="text"
              placeholder="Buscar por número de pallet…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-full hover:bg-gray-100 transition-colors"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-gray-500 mt-2">
              {filteredContainers.length} contenedor{filteredContainers.length !== 1 ? 'es' : ''} encontrado{filteredContainers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-inbox-line text-3xl text-gray-300"></i>
            </div>
            <p className="text-sm text-gray-500">
              {searchTerm ? 'No se encontraron contenedores con ese pallet' : 'No hay contenedores disponibles'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {paginated.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-4 md:p-5 hover:bg-gray-50/50 transition-colors"
                >
                  <Link
                    to={`/contenedores/${c.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      c.type === 'SOBRANTE'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                        : 'bg-gradient-to-br from-rose-500 to-rose-600'
                    }`}>
                      <i className={`${c.type === 'SOBRANTE' ? 'ri-archive-2-line' : 'ri-inbox-line'} text-lg md:text-xl text-white`}></i>
                    </div>

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
                  </Link>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status === 'OPEN' && (
                      <button
                        onClick={(e) => handleContinueContainer(e, c.id)}
                        className="px-3 py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
                        title="Continuar distribución"
                      >
                        <i className="ri-play-line"></i>
                        <span className="hidden sm:inline">Continuar</span>
                      </button>
                    )}
                    {c.status === 'CLOSED' && (
                      <button
                        onClick={(e) => handleReprint(e, c)}
                        disabled={reprintingId === c.id}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reimprimir etiqueta"
                      >
                        {reprintingId === c.id ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                            <span className="hidden sm:inline">Reimprimiendo…</span>
                          </>
                        ) : (
                          <>
                            <i className="ri-printer-line"></i>
                            <span className="hidden sm:inline">Reimprimir</span>
                          </>
                        )}
                      </button>
                    )}
                    <Link
                      to={`/contenedores/${c.id}`}
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 md:px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredContainers.length)} de {filteredContainers.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line text-lg"></i>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item as number)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            currentPage === item
                              ? 'bg-teal-500 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line text-lg"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}