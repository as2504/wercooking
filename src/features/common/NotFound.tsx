import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';

export function NotFound() {
  return (
    <div className="mx-auto max-w-screen-sm pt-16">
      <EmptyState emoji="🥄" title="Page not found" body="This page isn't on today's menu." action={<ButtonLink to="/">Go home</ButtonLink>} />
    </div>
  );
}
