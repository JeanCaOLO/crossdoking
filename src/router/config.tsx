
import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import { useAuth, UserRole } from '../contexts/AuthContext';

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

function WithLayout({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  return (
    <AppLayout>
      <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
    </AppLayout>
  );
}

function RootRedirect() {
  const { session, user, loading } = useAuth();

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

  if (!session || !user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/dashboard" replace />;
    case 'OPERATOR':
      return <Navigate to="/operacion" replace />;
    case 'VISUALIZADOR':
      return <Navigate to="/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/dashboard',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'VISUALIZADOR']}>
        <DashboardPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas',
    element: (
      <WithLayout allowedRoles={['ADMIN']}>
        <CargasPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas/nueva',
    element: (
      <WithLayout allowedRoles={['ADMIN']}>
        <NuevaCargaPage />
      </WithLayout>
    ),
  },
  {
    path: '/cargas/:id',
    element: (
      <WithLayout allowedRoles={['ADMIN']}>
        <DetalleCargaPage />
      </WithLayout>
    ),
  },
  {
    path: '/operacion',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'OPERATOR']}>
        <OperacionPage />
      </WithLayout>
    ),
  },
  {
    path: '/operacion/reportes',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'OPERATOR']}>
        <ReportesPage />
      </WithLayout>
    ),
  },
  {
    path: '/reportes',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'VISUALIZADOR']}>
        <ReportesMovimientosPage />
      </WithLayout>
    ),
  },
  {
    path: '/contenedores',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'OPERATOR']}>
        <ContenedoresPage />
      </WithLayout>
    ),
  },
  {
    path: '/contenedores/:id',
    element: (
      <WithLayout allowedRoles={['ADMIN', 'OPERATOR']}>
        <ContenedorDetallePage />
      </WithLayout>
    ),
  },
];

export default routes;
