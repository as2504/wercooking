import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAdminUnlocked, unlockAdmin } from '@/api/session';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';

export default function AdminUnlock() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (isAdminUnlocked()) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return setError('Enter the 4-digit PIN.');
    setBusy(true);
    try {
      await unlockAdmin(pin);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Kitchen Admin" back />
      <form onSubmit={submit} className="space-y-5 px-4 pt-8" noValidate>
        <p className="text-6xl" aria-hidden="true">🧑‍🍳</p>
        <p className="text-ink-soft">Kitchen staff only. Manage orders, the menu, kitchen updates and pickups.</p>
        <TextField
          label="Admin PIN"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          error={error}
          hint="Demo PIN: 1234"
          autoFocus
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
        <Button type="submit" size="lg" loading={busy}>
          Unlock
        </Button>
      </form>
    </div>
  );
}
