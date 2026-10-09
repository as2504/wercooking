import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { BottomNav, type NavItem } from '@/components/BottomNav';
import { NotificationWatcher } from '@/components/NotificationWatcher';
import { useSession } from '@/store/session';

const HIDE_NAV = [/^\/checkout/, /^\/pay\//, /^\/cart/, /^\/menu\/box/, /^\/plans\/new/];

export function CustomerLayout() {
  const user = useSession((s) => s.user);
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/welcome" replace />;

  const items: NavItem[] = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/menu', label: 'Menu', icon: 'utensils' },
    { to: '/orders', label: 'Orders', icon: 'receipt' },
    { to: '/updates', label: 'Kitchen', icon: 'leaf' },
    { to: '/profile', label: 'Profile', icon: 'user' },
  ];
  const hideNav = HIDE_NAV.some((r) => r.test(pathname));

  return (
    <div className={`mx-auto min-h-[100dvh] max-w-screen-sm ${hideNav ? '' : 'pb-24'}`}>
      <NotificationWatcher audience={user.id} />
      <Outlet />
      {!hideNav && <BottomNav items={items} label="Main" />}
    </div>
  );
}
