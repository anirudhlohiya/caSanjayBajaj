import { Routes } from '@angular/router';
import {
  authGuard,
  permissionGuard,
  superAdminGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      {
        path: 'clients',
        canActivate: [permissionGuard('view_clients')],
        loadComponent: () => import('./features/clients/clients-list').then((m) => m.ClientsList),
      },
      {
        path: 'clients/:id',
        canActivate: [permissionGuard('view_clients')],
        loadComponent: () => import('./features/clients/client-detail').then((m) => m.ClientDetail),
      },
      {
        path: 'documents',
        canActivate: [permissionGuard('view_documents')],
        loadComponent: () => import('./features/documents/documents').then((m) => m.Documents),
      },
      {
        path: 'reports',
        canActivate: [permissionGuard('upload_reports')],
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'reminders',
        canActivate: [permissionGuard('send_reminders')],
        loadComponent: () => import('./features/reminders/reminders').then((m) => m.Reminders),
      },
      {
        path: 'staff',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./features/staff/staff').then((m) => m.Staff),
      },
      {
        path: 'website',
        canActivate: [permissionGuard('manage_website')],
        loadComponent: () => import('./features/website/website').then((m) => m.Website),
      },
      {
        path: 'audit',
        canActivate: [permissionGuard('view_audit_logs')],
        loadComponent: () => import('./features/audit/audit').then((m) => m.Audit),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard('manage_settings')],
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];