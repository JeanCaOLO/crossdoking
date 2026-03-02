
import { useState } from 'react';
import { ClosedContainerSummary, ContainerLineDetail } from '../page';

// Mantener export del tipo legacy por compatibilidad (ya no se usa en tabla)
export type { ClosedContainerSummary as ClosedContainerRow };

interface Props {
  rows: ClosedContainerSummary[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onExpandRow: (containerId: string) => Promise<ContainerLineDetail[]>;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CLOSED: { label: 'Cerrado', className: 'bg-amber-100 text-amber-700' },
  DISPATCHED: { label: 'Despachado', className: 'bg-emerald-100 text-emerald-700' },
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ------------------------------------------------------------------ //
//  Subtabla de detalle de líneas                                      //
// ------------------------------------------------------------------ //
function DetailSubTable({ lines }: { lines: ContainerLineDetail[] }) {
  if (lines.length === 0) {
    return (
      <tr>
        <td colSpan={11} className="px-6 py-4 bg-gray-50/80">
          <p className="text-xs text-gray-400 text-center">Sin líneas registradas</p>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={11} className="px-0 py-0 bg-gray-50/60 border-b border-gray-200">
        <div className="px-6 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Detalle de líneas ({lines.length})
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Pallet</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Ubicación</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Barcode</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">SourceImportLineId</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700">
                      {line.pallet_code || '\u2014'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {line.pallet_ubicacion || '\u2014'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium bg-sky-50 text-sky-700">
                        {line.sku}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={line.descripcion || ''}>
                      {line.descripcion || '\u2014'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-500">
                      {line.barcode || '\u2014'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center font-semibold text-teal-600">
                      {line.qty}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-400 text-[10px]">
                      {line.source_import_line_id
                        ? line.source_import_line_id.substring(0, 8) + '…'
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------------ //
//  Componente principal                                               //
// ------------------------------------------------------------------ //
export default function ClosedContainersTable({
  rows,
  loading,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onExpandRow,
}: Props) {
  // expandedRows: null = cerrado, 'loading' = cargando, ContainerLineDetail[] = abierto
  const [expandedRows, setExpandedRows] = useState<Record<string, ContainerLineDetail[] | 'loading'>>({});

  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalCount);

  const handleToggleExpand = async (containerId: string) => {
    // Si ya está expandido, colapsar
    if (expandedRows[containerId] && expandedRows[containerId] !== 'loading') {
      setExpandedRows((prev) => {
        const next = { ...prev };
        delete next[containerId];
        return next;
      });
      return;
    }

    // Si está cargando, ignorar click
    if (expandedRows[containerId] === 'loading') return;

    // Cargar detalle
    setExpandedRows((prev) => ({ ...prev, [containerId]: 'loading' }));
    const lines = await onExpandRow(containerId);
    setExpandedRows((prev) => ({ ...prev, [containerId]: lines }));
  };

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
          <i className="ri-inbox-line text-3xl text-gray-300"></i>
        </div>
        <p className="text-sm text-gray-600 font-medium">No se encontraron contenedores</p>
        <p className="text-xs text-gray-400 mt-1">Ajusta los filtros para ver resultados</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Contenedores Cerrados</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Mostrando {from}&ndash;{to} de {totalCount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Columna acción expand */}
              <th className="px-3 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Container</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tienda</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Creado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cerrado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Despachado</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Líneas</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">SKUs</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Unidades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const sc = statusConfig[row.status] || { label: row.status, className: 'bg-gray-100 text-gray-700' };
              const expandState = expandedRows[row.id];
              const isExpanded = expandState !== undefined && expandState !== 'loading';
              const isLoading = expandState === 'loading';

              return (
                <>
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-gray-50/40' : ''}`}
                  >
                    {/* Botón expand/collapse */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleExpand(row.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                        title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                      >
                        {isLoading ? (
                          <i className="ri-loader-4-line animate-spin text-sm"></i>
                        ) : isExpanded ? (
                          <i className="ri-arrow-up-s-line text-base"></i>
                        ) : (
                          <i className="ri-arrow-down-s-line text-base"></i>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${sc.className}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.tienda || '\u2014'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.type || '\u2014'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDateTime(row.closed_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{formatDateTime(row.dispatched_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-gray-700">{row.lineas}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-gray-700">{row.skus_distintos}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-teal-600">{row.unidades_totales.toLocaleString()}</span>
                    </td>
                  </tr>

                  {/* Fila de detalle expandida */}
                  {isExpanded && (
                    <DetailSubTable key={`detail-${row.id}`} lines={expandState as ContainerLineDetail[]} />
                  )}
                </>
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
                    pageNum === safePage ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
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
