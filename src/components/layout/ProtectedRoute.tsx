import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'OPERADOR')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);

  // Log del estado actual
  useEffect(() => {
    console.log('🛡️ [PROTECTED] Verificando acceso:', {
      path: location.pathname,
      loading,
      hasSession: !!session,
      hasUser: !!user,
      userRole: user?.role,
      hasRedirected: hasRedirectedRef.current,
    });
  }, [location.pathname, loading, session, user]);

  // Guard anti-loop: si ya estamos en /login, no redirigir
  if (location.pathname === '/login') {
    console.log('⏭️ [PROTECTED] Ya en /login, no redirigir');
    return <>{children}</>;
  }

  // Mostrar loader mientras se verifica la sesión
  if (loading) {
    console.log('⏳ [PROTECTED] Cargando sesión...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Si no hay sesión, redirigir a login (solo una vez)
  if (!session) {
    if (!hasRedirectedRef.current) {
      console.log('🚫 [PROTECTED] Sin sesión, redirigiendo a /login');
      hasRedirectedRef.current = true;
    }
    return <Navigate to="/login" replace />;
  }

  // Si no hay perfil de usuario cargado
  if (!user) {
    console.error('❌ [PROTECTED] Sesión existe pero perfil no cargado');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <i className="ri-error-warning-line text-5xl text-red-600 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error de perfil</h2>
          <p className="text-gray-600 mb-4">
            No se pudo cargar tu perfil de usuario. Por favor, cierra sesión e intenta nuevamente.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Ir a login
          </button>
        </div>
      </div>
    );
  }

  // Verificar si el usuario está activo
  if (!user.active) {
    console.error('❌ [PROTECTED] Usuario inactivo');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <i className="ri-lock-line text-5xl text-orange-600 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cuenta inactiva</h2>
          <p className="text-gray-600">
            Tu cuenta ha sido desactivada. Contacta al administrador para más información.
          </p>
        </div>
      </div>
    );
  }

  // Verificar roles permitidos
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.error('❌ [PROTECTED] Rol no permitido:', user.role, 'Permitidos:', allowedRoles);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <i className="ri-shield-cross-line text-5xl text-red-600 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h2>
          <p className="text-gray-600">
            No tienes permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  console.log('✅ [PROTECTED] Acceso permitido');
  return <>{children}</>;
}
