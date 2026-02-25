
import { useState } from 'react';

export interface ContainerContentRow {
  id: string;
  pallet_code: string;
  ubicacion: string;
  sku: string;
  descripcion: string;
  barcode: string;
  qty: number;
  camion?: string;
}

interface Props {
  rows: ContainerContentRow[];
  containerStatus: string;
  onReverse?: (lineId: string) => void;
}

export default function ContainerContentTable({ rows, containerStatus, onReverse }: Props) {
  const canReverse = containerStatus !== 'DISPATCHED';

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <i className="ri-inbox-line text-3xl text-gray-300"></i>
        </div>
        <p className="text-sm text-gray-500">No hay líneas en este contenedor</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100">
        <h3 className="text-base md:text-lg font-bold text-gray-900">Contenido del Contenedor</h3>
        <p className="text-xs text-gray-500 mt-0.5">{rows.length} líneas registradas</p>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-stack-line text-white text-sm"></i>
                </div>
                <span className="text-sm font-bold text-gray-900 font-mono truncate">{row.pallet_code}</span>
              </div>
              <span className="text-xl font-bold text-teal-600 flex-shrink-0">{row.qty}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-100 text-sky-700 font-mono">
                {row.sku}
              </span>
              {row.ubicacion && (
                <span className="text-xs text-gray-500">
                  <i className="ri-map-pin-line mr-0.5"></i>{row.ubicacion}
                </span>
              )}
            </div>

            {row.descripcion && (
              <p className="text-xs text-gray-600 leading-snug">{row.descripcion}</p>
            )}

            {row.barcode && (
              <p className="text-xs text-gray-400 font-mono">{row.barcode}</p>
            )}

            {canReverse && (
              <button
                onClick={() => onReverse?.(row.id)}
                className="w-full mt-1 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="ri-arrow-go-back-line"></i>
                Reversar línea
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pallet</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ubicación</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código de Barra</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Cantidad</th>
              {canReverse && (
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                      <i className="ri-stack-line text-white text-sm"></i>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 font-mono">{row.pallet_code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.ubicacion || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-700 font-mono">
                    {row.sku}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{row.descripcion || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{row.barcode || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-bold text-teal-600">{row.qty}</span>
                </td>
                {canReverse && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onReverse?.(row.id)}
                      className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer gap-1.5"
                    >
                      <i className="ri-arrow-go-back-line"></i>
                      Reversar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
