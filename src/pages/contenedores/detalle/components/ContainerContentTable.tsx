
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-inbox-line text-3xl text-gray-400"></i>
        </div>
        <p className="text-sm text-gray-600">No hay líneas en este contenedor</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Contenido del Contenedor</h3>
        <p className="text-sm text-gray-600 mt-1">{rows.length} líneas registradas</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Pallet
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Ubicación
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Código de Barra
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cantidad
              </th>
              {canReverse && (
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mr-3">
                      <i className="ri-stack-line text-white text-sm"></i>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{row.pallet_code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.ubicacion || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-sky-100 text-sky-700">
                    {row.sku}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{row.descripcion || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.barcode || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-semibold text-teal-600">{row.qty}</span>
                </td>
                {canReverse && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onReverse?.(row.id)}
                      className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors whitespace-nowrap cursor-pointer"
                      title="Reversar esta línea"
                    >
                      <i className="ri-arrow-go-back-line mr-1.5"></i>
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
