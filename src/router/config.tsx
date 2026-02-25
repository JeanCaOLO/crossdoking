import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';

const DashboardPage = lazy(() => import('../pages/dashboard/page'));
const LoginPage = lazy(() => import('../pages/login/page'));
const CargasPage = lazy(() => import('../pages/cargas/page'));
const NuevaCargaPage = lazy(() => import('../pages/cargas/nueva/page'));
const DetalleCargaPage = lazy(() => import('../pages/cargas/detalle/page'));
const OperacionPage = lazy(() => import('../pages/operacion/page'));
const ReportesPage = lazy(() => import('../pages/operacion/reportes/page'));
const ReportesMovimientosPage = lazy(() => import('../pages/reportes/page'));
const ContenedoresPage = lazy(() => import('../pages/contenedores/page'));
const ContenedorDetallePage = lazy(() => import('../pages/contenedores/detalle/page'));

function WithLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <ProtectedRoute>{children}</ProtectedRoute>
    </AppLayout>
  );
}

// Componente para manejar la ruta raíz con redirect condicional
function RootRedirect() {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }
  
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}

// Importar useAuth
import { useAuth } from '../contexts/AuthContext';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: (
      <WithLayout>
        <DashboardPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas',
    element: (
      <WithLayout>
        <CargasPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas/nueva',
    element: (
      <WithLayout>
        <NuevaCargaPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas/:id',
    element: (
      <WithLayout>
        <DetalleCargaPage />
      </WithLayout>
    ),
  },
  {
    path: '/operacion',
    element: (
      <WithLayout>
        <OperacionPage />
      </WithLayout>
    ),
  },
  {
    path: '/operacion/reportes',
    element: (
      <WithLayout>
        <ReportesPage />
      </WithLayout>
    ),
  },
  {
    path: '/reportes',
    element: (
      <WithLayout>
        <ReportesMovimientosPage />
      </WithLayout>
    ),
  },
  {
    path: '/contenedores',
    element: (
      <WithLayout>
        <ContenedoresPage />
      </WithLayout>
    ),
  },
  {
    path: '/contenedores/:id',
    element: (
      <WithLayout>
        <ContenedorDetallePage />
      </WithLayout>
    ),
  },
];

export default routes;
