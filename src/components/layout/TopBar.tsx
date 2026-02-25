
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface TopBarProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
}

export default function TopBar({ onMenuClick, isMobile = false }: TopBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              onClick={onMenuClick}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-menu-line text-xl"></i>
            </button>
          )}
          <h2 className="text-base md:text-xl font-semibold text-gray-900 truncate">
            {isMobile ? 'Crossdocking' : 'Sistema de Crossdocking'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-600 rounded-full flex items-center justify-center">
                <i className="ri-user-line text-white text-base md:text-lg"></i>
              </div>
              {!isMobile && (
                <>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500">{user?.role || 'OPERADOR'}</p>
                  </div>
                  <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}></i>
                </>
              )}
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded">
                      {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600 disabled:opacity-50 cursor-pointer"
                  >
                    <i className={`${isLoggingOut ? 'ri-loader-4-line animate-spin' : 'ri-logout-box-line'} text-lg`}></i>
                    <span className="text-sm font-medium">
                      {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
