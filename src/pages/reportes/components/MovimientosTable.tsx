import React from 'react';

interface ScanEventRow {
  id: string;
  event_type: string;
  sku: string | null;
  tienda: string | null;
  camion: string | null;
  qty: number | null;
  notes: string | null;
  created_at: string;
  pallet_code: string;
  user_name: string;
}

interface Props {
  rows: ScanEventRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const eventTypeConfig: Record<
  string,
  { label: string; bg: string; icon: string }
> = {
  SCAN_PALLET: {
    label: 'Escaneo Pallet',
    bg: 'bg-sky-100 text-sky-700',
    icon: 'ri-qr-scan-2-line',
  },
  SCAN_SKU: {
    label: 'Escaneo SKU',
    bg: 'bg-indigo-100 text-indigo-700',
    icon: 'ri-barcode-line',
  },
  CONFIRM_QTY: {
    label: 'Confirmación',
    bg: 'bg-emerald-100 text-emerald-700',
    icon: 'ri-checkbox-circle-line',
  },
  REVERSE: {
    label: 'Reversión',
    bg: 'bg-amber-100 text-amber-700',
    icon: 'ri-arrow-go-back-line',
  },
  CLOSE: {
    label: 'Cierre',
    bg: 'bg-rose-100 text-rose-700',
    icon: 'ri-lock-line',
  },
  UNLOCK: {
    label: 'Desbloqueo',
    bg: 'bg-cyan-100 text-cyan-700',
    icon: 'ri-lock-unlock-line',
  },
  ADJUST: {
    label: 'Ajuste',
    bg: 'bg-orange-100 text-orange-700',
    icon: 'ri-settings-3-line',
  },
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export type { ScanEventRow };

export default function MovimientosTable({
  rows,
  loading,
  page,
  totalPages,
  onPageChange,
}: Props) {
  // Guard against invalid pagination values
  const safePage = Math.max(1, Math.min(page, totalPages));

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-file-list-3-line text-3xl text-gray-300"></i>
        </div>
        <p className="text-sm text-gray-600 font-medium">
          No se encontraron movimientos
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Ajusta los filtros para ver resultados
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Historial de Movimientos
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Página {safePage} de {totalPages}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Fecha / Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Pallet
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tienda
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Camión
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Cantidad
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Notas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const config =
                eventTypeConfig[row.event_type] || {
                  label: row.event_type,
                  bg: 'bg-gray-100 text-gray-700',
                  icon: 'ri-question-line',
                };

              return (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg}`}
                    >
                      <i className={`${config.icon} mr-1.5`}></i>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.pallet_code || '\u2014'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.sku ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700">
                        {row.sku}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">\u2014</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {row.tienda || '\u2014'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {row.camion ? (
                      <span className="inline-flex items-center text-xs font-medium text-amber-700">
                        <i className="ri-truck-line mr-1"></i>
                        {row.camion}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">\u2014</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {row.qty !== null && row.qty !== undefined ? (
                      <span
                        className={`text-sm font-semibold ${
                          row.event_type === 'REVERSE'
                            ? 'text-amber-600'
                            : 'text-teal-600'
                        }`}
                      >
                        {row.event_type === 'REVERSE' ? '-' : '+'}
                        {row.qty}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">\u2014</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                    {row.user_name || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                    {row.notes || '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-s-line mr-1"></i>
            Anterior
          </button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safePage <= 4) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safePage - 3 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    pageNum === safePage
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            Siguiente
            <i className="ri-arrow-right-s-line ml-1"></i>
          </button>
        </div>
      )}
    </div>
  );
}
