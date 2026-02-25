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

      <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5 mt-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-inbox-line text-xl md:text-2xl text-white"></i>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 font-mono">{code}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">{tienda}</span>
                {camion && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <i className="ri-truck-line"></i>
                    {camion}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${info.bg}`}>
            {info.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Creado</p>
            <p className="text-xs md:text-sm text-gray-800 mt-1">{formatDate(createdAt)}</p>
          </div>
          {closedAt && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Cerrado</p>
              <p className="text-xs md:text-sm text-gray-800 mt-1">{formatDate(closedAt)}</p>
            </div>
          )}
          {createdByEmail && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Creado por</p>
              <p className="text-xs md:text-sm text-gray-800 mt-1">{createdByEmail}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
