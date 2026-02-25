
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' },
  { path: '/cargas', label: 'Cargas', icon: 'ri-file-list-3-line' },
  { path: '/cargas/nueva', label: 'Nueva Carga', icon: 'ri-file-excel-2-line' },
  { path: '/operacion', label: 'Operación', icon: 'ri-qr-scan-2-line' },
  { path: '/contenedores', label: 'Contenedores', icon: 'ri-inbox-line' },
  { path: '/reportes', label: 'Reportes', icon: 'ri-bar-chart-box-line' },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Removed TypeScript type annotation to keep the file valid JavaScript/JSX
  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/cargas/nueva') return location.pathname === '/cargas/nueva';
    if (path === '/cargas')
      return (
        location.pathname === '/cargas' ||
        (location.pathname.startsWith('/cargas/') && location.pathname !== '/cargas/nueva')
      );
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-40 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        <Link to="/dashboard" className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 min-w-[40px] bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <i className="ri-qr-scan-2-line text-xl text-white"></i>
          </div>
          {!collapsed && (
            <div className="whitespace-nowrap">
              <span className="text-base font-bold text-gray-900 leading-tight block">Crossdocking</span>
              <span className="text-[11px] text-gray-400 leading-tight block">Almacén</span>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center min-w-[20px]">
                <i className={`${item.icon} text-lg ${active ? 'text-teal-600' : ''}`}></i>
              </div>
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-lg`}></i>
          </div>
          {!collapsed && <span className="ml-3 whitespace-nowrap">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
