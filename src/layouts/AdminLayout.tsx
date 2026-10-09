import { Navigate, Outlet } from 'react-router-dom';
import { BottomNav, type NavItem } from '@/components/BottomNav';
import { isAdminUnlocked } from '@/api/session';
import { NotificationWatcher } from '@/components/NotificationWatcher';

const items: NavItem[] = [
  { to: '/admin', label: 'Today', icon: 'chart', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'board' },
  { to: '/admin/pickup', label: 'Pickup', icon: 'scan' },
  { to: '/admin/menu', label: 'Menu', icon: 'utensils' },
  { to: '/admin/more', label: 'More', icon: 'settings' },
];

export function AdminLayout() {
  if (!isAdminUnlocked()) return <Navigate to="/admin/unlock" replace />;
  return (
    <div className="mx-auto min-h-[100dvh] max-w-screen-md pb-24 [&_.max-w-screen-sm]:max-w-screen-md">
      <div className="bg-ink px-4 py-1.5 text-center text-xs font-semibold text-white">
        🧑‍🍳 Kitchen Admin mode
      </div>
      <NotificationWatcher audience="admin" />
      <Outlet />
      <BottomNav items={items} label="Kitchen admin" />
    </div>
  );
}
