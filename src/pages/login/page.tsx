import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Si ya hay sesión activa, redirigir al dashboard (solo cuando termine de cargar)
  useEffect(() => {
    if (authLoading) {
      console.log('⏳ [LOGIN] AuthContext aún cargando, esperando...');
      return;
    }

    console.log('🔍 [LOGIN] Verificando sesión existente:', {
      hasSession: !!session,
      hasUser: !!user,
    });

    if (session && user) {
      console.log('✅ [LOGIN] Sesión activa detectada, redirigiendo a /dashboard');
      navigate('/dashboard', { replace: true });
    } else {
      console.log('ℹ️ [LOGIN] Sin sesión, mostrando formulario de login');
    }
  }, [session, user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('🔐 [LOGIN] Intentando login con:', email);

    try {
      await signIn(email, password);
      console.log('✅ [LOGIN] Login exitoso, navegando a /dashboard');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('❌ [LOGIN] Error:', err);
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loader mientras AuthContext verifica la sesión inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-5xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4">
            <i className="ri-truck-line text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Crossdocking Almacén</h1>
          <p className="text-gray-600">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ri-mail-line text-gray-400"></i>
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="ri-lock-line text-gray-400"></i>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <i className="ri-error-warning-line text-red-600 text-xl flex-shrink-0 mt-0.5"></i>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error de autenticación</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Iniciando sesión...
              </>
            ) : (
              <>
                <i className="ri-login-box-line"></i>
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>¿Problemas para acceder?</p>
          <p className="mt-1">Contacta al administrador del sistema</p>
        </div>
      </div>
    </div>
  );
}