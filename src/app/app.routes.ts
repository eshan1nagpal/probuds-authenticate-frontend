import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'account' },
  { path: 'login', title: 'Sign in | e-Compliance',
    loadComponent: () => import('./feature/auth/login').then(module => module.Login) },
  { path: 'password/change', title: 'Change password | e-Compliance',
    loadComponent: () => import('./feature/auth/change-password').then(module => module.ChangePassword) },
  { path: 'forgot-password', title: 'Forgot password | e-Compliance',
    loadComponent: () => import('./feature/auth/forgot-password').then(module => module.ForgotPassword) },
  { path: 'password/reset', title: 'Reset password | e-Compliance',
    loadComponent: () => import('./feature/auth/reset-password').then(module => module.ResetPassword) },
  { path: 'account', title: 'My account | e-Compliance', canActivate: [authGuard],
    loadComponent: () => import('./feature/home/account').then(module => module.Account) },
  { path: 'admin', title: 'Admin Task | e-Compliance', canActivate: [adminGuard], canActivateChild: [adminGuard],
    loadComponent: () => import('./feature/admin/admin').then(module => module.Admin), children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'users', loadComponent: () => import('./feature/admin/users').then(module => module.Users) },
      { path: 'users/new', loadComponent: () => import('./feature/admin/user-form').then(module => module.UserForm) },
      { path: 'users/:id/edit', loadComponent: () => import('./feature/admin/user-form').then(module => module.UserForm) },
      { path: 'users/:id/roles', loadComponent: () => import('./feature/admin/user-roles').then(module => module.UserRoles) },
      { path: 'login-history', loadComponent: () => import('./feature/admin/login-history').then(module => module.LoginHistory) },
    ] },
  { path: '**', redirectTo: 'login' },
];
