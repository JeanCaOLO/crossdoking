
import { Link } from 'react-router-dom';

const actions = [
  {
    title: 'Importar Excel',
    desc: 'Cargar nuevo archivo de pedidos',
    icon: 'ri-file-excel-2-line',
    link: '/cargas/nueva',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  {
    title: 'Escanear Pallet',
    desc: 'Iniciar distribución de mercadería',
    icon: 'ri-qr-scan-2-line',
    link: '/operacion',
    gradient: 'from-teal-500 to-cyan-600',
  },
  {
    title: 'Ver Cargas',
    desc: 'Consultar importaciones activas',
    icon: 'ri-file-list-3-line',
    link: '/cargas',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Contenedores',
    desc: 'Gestionar despachos',
    icon: 'ri-inbox-line',
    link: '/contenedores',
    gradient: 'from-rose-500 to-rose-600',
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Acciones Rápidas
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            to={action.link}
            className="border border-gray-100 rounded-lg p-3 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div
              className={`w-9 h-9 bg-gradient-to-br ${action.gradient} rounded-lg flex items-center justify-center mb-2`}
            >
              <i className={`${action.icon} text-lg text-white`}></i>
            </div>
            <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700 transition-colors leading-tight">
              {action.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
              {action.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
