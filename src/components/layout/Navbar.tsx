import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', roles: ['ADMIN', 'VISUALIZADOR'] },
    { path: '/cargas', label: 'Cargas', icon: 'ri-file-list-3-line', roles: ['ADMIN'] },
    { path: '/operacion', label: 'Operación', icon: 'ri-qr-scan-2-line', roles: ['ADMIN', 'OPERATOR'] },
    { path: '/contenedores', label: 'Contenedores', icon: 'ri-inbox-line', roles: ['ADMIN', 'OPERATOR'] },
    { path: '/reportes', label: 'Reportes', icon: 'ri-bar-chart-box-line', roles: ['ADMIN', 'VISUALIZADOR'] },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Filtrar ítems según el rol del usuario
  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                <i className="ri-qr-scan-2-line text-xl text-white"></i>
              </div>
              <span className="text-lg font-bold text-gray-900">Crossdocking</span>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <i className={`${item.icon} mr-2`}></i>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <div className="flex items-center justify-end space-x-2">
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                  user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                  user?.role === 'OPERATOR' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {user?.role === 'ADMIN' ? 'Administrador' :
                   user?.role === 'OPERATOR' ? 'Operador' :
                   'Visualizador'}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <i className="ri-logout-box-r-line mr-2"></i>
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
