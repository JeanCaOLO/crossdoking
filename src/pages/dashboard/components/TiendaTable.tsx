import { TiendaProgress } from '../hooks/useTiendaProgress';

interface Props {
  data: TiendaProgress[];
  loading: boolean;
}

export default function TiendaTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Progreso por Tienda</h3>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Progreso por Tienda</h3>

      {data.length === 0 ? (
        <div className="text-center py-8">
          <i className="ri-store-2-line text-3xl text-gray-300 mb-2"></i>
          <p className="text-sm text-gray-400">Sin datos de tiendas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((t) => (
            <div key={t.tienda} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2 truncate max-w-[60%]">
                  <span className="text-sm font-medium text-gray-700 truncate">{t.tienda}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <i className="ri-truck-line mr-1"></i>
                    {t.camion}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">
                    {t.confirmed}/{t.total}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      t.percent === 100
                        ? 'text-emerald-600'
                        : t.percent > 50
                        ? 'text-amber-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {t.percent}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    t.percent === 100
                      ? 'bg-emerald-500'
                      : t.percent > 50
                      ? 'bg-amber-400'
                      : 'bg-teal-400'
                  }`}
                  style={{ width: `${t.percent}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
