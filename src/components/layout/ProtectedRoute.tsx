
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth();
  const location = useLocation();

  if (location.pathname === '/login') return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <i className="ri-error-warning-line text-5xl text-red-600 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error de perfil</h2>
          <p className="text-gray-600 mb-4">
            No se pudo cargar tu perfil. Por favor, cierra sesión e intenta nuevamente.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Ir a login
          </button>
        </div>
      </div>
    );
  }

  if (!user.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <i className="ri-lock-line text-5xl text-orange-600 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cuenta inactiva</h2>
          <p className="text-gray-600">
            Tu cuenta ha sido desactivada. Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirigir a la ruta principal según el rol
    const defaultRoute: Record<UserRole, string> = {
      ADMIN: '/dashboard',
      OPERATOR: '/operacion',
      VISUALIZADOR: '/dashboard',
    };
    return <Navigate to={defaultRoute[user.role] ?? '/login'} replace />;
  }

  return <>{children}</>;
}
