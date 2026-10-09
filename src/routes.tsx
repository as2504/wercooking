import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { CustomerLayout } from '@/layouts/CustomerLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { JobRunner } from '@/components/JobRunner';
import { AppStatus } from '@/components/AppStatus';
import { ListSkeleton } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { NotFound } from '@/features/common/NotFound';
import Home from '@/features/home/Home';
import Welcome from '@/features/onboarding/Welcome';
import { useSession } from '@/store/session';

const DevUI = lazy(() => import('@/features/common/DevUI'));
const Menu = lazy(() => import('@/features/menu/Menu'));
const BoxBuilder = lazy(() => import('@/features/menu/BoxBuilder'));
const Cart = lazy(() => import('@/features/cart/Cart'));
const Checkout = lazy(() => import('@/features/cart/Checkout'));
const Orders = lazy(() => import('@/features/orders/Orders'));
const OrderDetail = lazy(() => import('@/features/orders/OrderDetail'));
const Updates = lazy(() => import('@/features/updates/Updates'));
const Profile = lazy(() => import('@/features/profile/Profile'));
const EditProfile = lazy(() => import('@/features/profile/EditProfile'));
const Notifications = lazy(() => import('@/features/profile/Notifications'));
const DevSettings = lazy(() => import('@/features/profile/DevSettings'));
const Help = lazy(() => import('@/features/profile/InfoPages').then((m) => ({ default: m.Help })));
const Hygiene = lazy(() => import('@/features/profile/InfoPages').then((m) => ({ default: m.Hygiene })));
const Fssai = lazy(() => import('@/features/profile/InfoPages').then((m) => ({ default: m.Fssai })));
const Delivery = lazy(() => import('@/features/profile/InfoPages').then((m) => ({ default: m.Delivery })));
const Pay = lazy(() => import('@/features/payment/Pay'));
const Receipt = lazy(() => import('@/features/payment/Receipt'));
const Wallet = lazy(() => import('@/features/payment/Wallet'));
const NewPlan = lazy(() => import('@/features/subscriptions/NewPlan'));
const PlanDetail = lazy(() => import('@/features/subscriptions/PlanDetail'));
const AdminUnlock = lazy(() => import('@/features/admin/AdminUnlock'));
const Dashboard = lazy(() => import('@/features/admin/Dashboard'));
const OrdersBoard = lazy(() => import('@/features/admin/OrdersBoard'));
const Pickup = lazy(() => import('@/features/admin/Pickup'));
const MenuManager = lazy(() => import('@/features/admin/MenuManager'));
const More = lazy(() => import('@/features/admin/More'));
const PostUpdate = lazy(() => import('@/features/admin/PostUpdate'));
const Subscribers = lazy(() => import('@/features/admin/Subscribers'));
const Reports = lazy(() => import('@/features/admin/Reports'));

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-4 pt-20">
          <ListSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const L = (el: ReactNode) => <Lazy>{el}</Lazy>;

function Root() {
  return (
    <>
      <Toaster />
      <AppStatus />
      <JobRunner />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/welcome', element: <Welcome /> },
      { path: '/dev/ui', element: L(<DevUI />) },
      {
        element: <CustomerLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/menu', element: L(<Menu />) },
          { path: '/menu/box', element: L(<BoxBuilder />) },
          { path: '/cart', element: L(<Cart />) },
          { path: '/checkout', element: L(<Checkout />) },
          { path: '/pay/:purpose/:id', element: L(<Pay />) },
          { path: '/receipt/:paymentId', element: L(<Receipt />) },
          { path: '/orders', element: L(<Orders />) },
          { path: '/orders/:id', element: L(<OrderDetail />) },
          { path: '/plans/new', element: L(<NewPlan />) },
          { path: '/plans/:id', element: L(<PlanDetail />) },
          { path: '/updates', element: L(<Updates />) },
          { path: '/profile', element: L(<Profile />) },
          { path: '/profile/edit', element: L(<EditProfile />) },
          { path: '/wallet', element: L(<Wallet />) },
          { path: '/notifications', element: L(<NotificationsForUser />) },
          { path: '/help', element: L(<Help />) },
          { path: '/hygiene', element: L(<Hygiene />) },
          { path: '/fssai', element: L(<Fssai />) },
          { path: '/delivery', element: L(<Delivery />) },
        ],
      },
      { path: '/settings', element: L(<DevSettings />) },
      { path: '/admin/unlock', element: L(<AdminUnlock />) },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: L(<Dashboard />) },
          { path: 'orders', element: L(<OrdersBoard />) },
          { path: 'pickup', element: L(<Pickup />) },
          { path: 'menu', element: L(<MenuManager />) },
          { path: 'more', element: L(<More />) },
          { path: 'updates/new', element: L(<PostUpdate />) },
          { path: 'subscribers', element: L(<Subscribers />) },
          { path: 'reports', element: L(<Reports />) },
          { path: 'notifications', element: L(<Notifications audience="admin" back="/admin" />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function NotificationsForUser() {
  const user = useSession((s) => s.user);
  return <Notifications audience={user?.id ?? ''} />;
}
