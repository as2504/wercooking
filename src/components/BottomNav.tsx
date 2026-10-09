import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './ui/Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
}

export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav aria-label={label} className="safe-bottom fixed inset-x-0 bottom-0 z-30 print:hidden border-t border-line bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-screen-sm">
        {items.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-brand-700' : 'text-ink-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-brand-100' : ''}`}>
                    <Icon name={it.icon} className="h-[22px] w-[22px]" />
                  </span>
                  {it.label}
                  {!!it.badge && (
                    <span className="absolute right-[calc(50%-22px)] top-1.5 min-w-[18px] rounded-full bg-brand-600 px-1 text-center text-[10px] leading-[18px] text-white">
                      {it.badge > 9 ? '9+' : it.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
