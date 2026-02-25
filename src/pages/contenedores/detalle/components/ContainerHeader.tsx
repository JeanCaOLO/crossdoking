
import { Link } from 'react-router-dom';

interface ContainerHeaderProps {
  code: string;
  tienda: string;
  camion?: string;
  status: string;
  createdAt: string;
  closedAt?: string | null;
  createdByEmail?: string;
}

const statusMap: Record<string, { bg: string; label: string }> = {
  OPEN: { bg: 'bg-sky-100 text-sky-700', label: 'Abierto' },
  CLOSED: { bg: 'bg-amber-100 text-amber-700', label: 'Cerrado' },
  DISPATCHED: { bg: 'bg-emerald-100 text-emerald-700', label: 'Despachado' },
};

function formatDate(dateStr: string) {
  // Guard against invalid dates
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no válida';
  }
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ContainerHeader({
  code,
  tienda,
  camion,
  status,
  createdAt,
  closedAt,
  createdByEmail,
}: ContainerHeaderProps) {
  const info = statusMap[status] ?? { bg: 'bg-gray-100 text-gray-700', label: status };

  return (
    <div>
      <Link
        to="/contenedores"
        className="text-teal-600 hover:text-teal-700 text-sm font-medium mb-3 inline-flex items-center cursor-pointer"
      >
        <i className="ri-arrow-left-line mr-1"></i>
        Volver a Contenedores
      </Link>

      <div className="bg-white rounded-xl border border-gray-100 p-5 mt-2">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center">
              <i className="ri-inbox-line text-2xl text-white"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{code}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Tienda: <strong className="text-gray-700">{tienda}</strong>
                {camion && (
                  <>
                    {' '}
                    &middot;{' '}
                    <span className="inline-flex items-center text-amber-600 font-medium">
                      <i className="ri-truck-line mr-1"></i>
                      {camion}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${info.bg}`}>
            {info.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Creado</p>
            <p className="text-sm text-gray-800 mt-1">{formatDate(createdAt)}</p>
          </div>
          {closedAt && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Cerrado</p>
              <p className="text-sm text-gray-800 mt-1">{formatDate(closedAt)}</p>
            </div>
          )}
          {createdByEmail && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Creado por</p>
              <p className="text-sm text-gray-800 mt-1">{createdByEmail}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
