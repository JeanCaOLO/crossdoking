
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'ri-dashboard-line', roles: ['ADMIN', 'VISUALIZADOR'] },
  { path: '/cargas', label: 'Cargas', icon: 'ri-file-list-3-line', roles: ['ADMIN'] },
  { path: '/cargas/nueva', label: 'Nueva Carga', icon: 'ri-file-excel-2-line', roles: ['ADMIN'] },
  { path: '/operacion', label: 'Operación', icon: 'ri-qr-scan-2-line', roles: ['ADMIN', 'OPERATOR'] },
  { path: '/contenedores', label: 'Contenedores', icon: 'ri-inbox-line', roles: ['ADMIN', 'OPERATOR'] },
  { path: '/reportes', label: 'Reportes', icon: 'ri-bar-chart-box-line', roles: ['ADMIN', 'VISUALIZADOR'] },
];

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ADMIN: { label: 'Administrador', className: 'bg-teal-100 text-teal-700' },
    OPERATOR: { label: 'Operador', className: 'bg-amber-100 text-amber-700' },
    VISUALIZADOR: { label: 'Visualizador', className: 'bg-gray-100 text-gray-700' },
  };
  const { label, className } = config[role] ?? { label: role, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}

export default function Sidebar({ isMobile = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/cargas/nueva') return location.pathname === '/cargas/nueva';
    if (path === '/cargas')
      return (
        location.pathname === '/cargas' ||
        (location.pathname.startsWith('/cargas/') && location.pathname !== '/cargas/nueva')
      );
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const UserFooter = () =>
    user ? (
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center min-w-[36px]">
            <i className="ri-user-line text-gray-600"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
            <RoleBadge role={user.role} />
          </div>
        </div>
      </div>
    ) : null;

  if (isMobile) {
    return (
      <aside
        className={`fixed top-0 left-0 h-screen w-[260px] bg-white border-r border-gray-200 z-40 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
          <Link to="/" className="flex items-center space-x-3" onClick={handleNavClick}>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <i className="ri-qr-scan-2-line text-lg text-white"></i>
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900 block leading-tight">Crossdocking</span>
              <span className="text-[10px] text-gray-400 block leading-tight">Almacén</span>
            </div>
          </Link>
          <button
            onClick={onMobileClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center min-w-[20px]">
                  <i className={`${item.icon} text-lg ${active ? 'text-teal-600' : ''}`}></i>
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <UserFooter />
      </aside>
    );
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-white border-r border-gray-200 z-40 flex flex-col">
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        <Link to="/" className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 min-w-[40px] bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <i className="ri-qr-scan-2-line text-xl text-white"></i>
          </div>
          <div className="whitespace-nowrap">
            <span className="text-base font-bold text-gray-900 leading-tight block">Crossdocking</span>
            <span className="text-[11px] text-gray-400 leading-tight block">Almacén</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                active ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center min-w-[20px]">
                <i className={`${item.icon} text-lg ${active ? 'text-teal-600' : ''}`}></i>
              </div>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <UserFooter />
    </aside>
  );
}
