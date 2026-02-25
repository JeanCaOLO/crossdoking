import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    console.log('🚪 [TOPBAR] Iniciando cierre de sesión...');
    setIsLoggingOut(true);
    
    try {
      await signOut();
      console.log('✅ [TOPBAR] Sesión cerrada, navegando a /login');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('❌ [TOPBAR] Error al cerrar sesión:', error);
      // Incluso si hay error, intentar navegar a login
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Sistema de Crossdocking</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.full_name || 'Usuario'}</p>
                <p className="text-xs text-gray-500">{user?.role || 'OPERADOR'}</p>
              </div>
              <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                <i className="ri-user-line text-white text-lg"></i>
              </div>
              <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}></i>
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
                    <span className="inline-block mt-2 px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded">
                      {user?.role}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
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