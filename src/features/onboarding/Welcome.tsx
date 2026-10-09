import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Diet, SpiceLevel } from '@/types/models';
import { createProfile, isValidIndianMobile, requestOtp, verifyOtp } from '@/api/session';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/Button';
import { ChoiceChips, TextArea, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { SimulationBadge } from '@/components/ui/Misc';
import { formatPhone } from '@/lib/format';
import { AREAS } from '@/lib/constants';

type Step = 'intro' | 'phone' | 'otp' | 'profile';


export default function Welcome() {
  const user = useSession((s) => s.user);
  const [step, setStep] = useState<Step>('intro');
  const [phone, setPhone] = useState('');
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-screen-sm flex-col">
      {step === 'intro' && <Intro onStart={() => setStep('phone')} />}
      {step === 'phone' && <PhoneStep phone={phone} setPhone={setPhone} onBack={() => setStep('intro')} onSent={() => setStep('otp')} />}
      {step === 'otp' && <OtpStep phone={phone} onBack={() => setStep('phone')} onNewUser={() => setStep('profile')} />}
      {step === 'profile' && <ProfileStep phone={phone} />}
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-brand-600 to-brand-800 text-white">
      <div className="safe-top flex flex-1 flex-col justify-center px-6 py-10">
        <img src="/favicon.svg" alt="" className="h-20 w-20 rounded-3xl shadow-xl" />
        <h1 className="mt-6 text-4xl font-bold leading-tight">
          Ghar jaisa khana.
          <br />
          Every single day.
        </h1>
        <p className="mt-3 max-w-sm text-brand-100">
          Home-style thalis and healthy breakfasts, cooked by Tai in Akurdi. Pre-book, pick up, done.
        </p>
        <ul className="mt-8 space-y-3 text-sm">
          {[
            ['🧾', 'Proof, not promise: see when your meal was cooked & packed'],
            ['🥗', 'Complete meals: sabji, dal, roti, rice, salad'],
            ['📅', 'Prepaid weekly & monthly plans. Skip anytime before cutoff'],
          ].map(([e, t]) => (
            <li key={t} className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden="true">{e}</span>
              <span className="pt-1.5">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="safe-bottom px-6 pb-6">
        <Button size="lg" variant="secondary" className="!border-0 !text-brand-800" onClick={onStart}>
          Get started
        </Button>
        <p className="mt-3 text-center text-xs text-brand-100">Pickup only · Delivery coming soon</p>
      </div>
    </div>
  );
}

function StepShell({ title, subtitle, onBack, children }: { title: string; subtitle?: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="safe-top flex flex-1 flex-col px-5 pb-6">
      <div className="flex min-h-[60px] items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" aria-label="Go back">
            <Icon name="back" className="h-5 w-5" />
          </button>
        ) : (
          <span />
        )}
        <SimulationBadge />
      </div>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function PhoneStep({ phone, setPhone, onBack, onSent }: { phone: string; setPhone: (p: string) => void; onBack: () => void; onSent: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidIndianMobile(phone)) return setError('Enter a valid 10-digit mobile number starting with 6–9.');
    setLoading(true);
    try {
      await requestOtp(phone);
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <StepShell title="Your mobile number" subtitle="We'll send a one-time code to verify it." onBack={onBack}>
      <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
        <TextField
          label="Mobile number"
          prefix="+91"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98XXXXXXXX"
          maxLength={10}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
            setError(null);
          }}
          error={error}
          autoFocus
        />
        <div className="flex-1" />
        <Button type="submit" size="lg" loading={loading} disabled={phone.length !== 10}>
          Send code
        </Button>
      </form>
    </StepShell>
  );
}

function OtpStep({ phone, onBack, onNewUser }: { phone: string; onBack: () => void; onNewUser: () => void }) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();

  useEffect(() => {
    refs.current[0]?.focus();
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const code = otp.join('');
  const verify = async (value = code) => {
    if (value.length !== 4) return setError('Enter all 4 digits.');
    setLoading(true);
    setError(null);
    try {
      const existing = await verifyOtp(phone, value);
      if (existing) {
        await refresh();
        navigate('/', { replace: true });
      } else onNewUser();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const digitsIn = v.replace(/\D/g, '');
    if (digitsIn.length > 1) {
      // paste
      const next = digitsIn.slice(0, 4).split('');
      while (next.length < 4) next.push('');
      setOtp(next);
      refs.current[Math.min(3, digitsIn.length)]?.focus();
      if (digitsIn.length >= 4) void verify(next.join(''));
      return;
    }
    const next = [...otp];
    next[i] = digitsIn;
    setOtp(next);
    setError(null);
    if (digitsIn && i < 3) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(''));
  };

  return (
    <StepShell title="Enter the code" subtitle={`Sent to ${formatPhone(phone)}`} onBack={onBack}>
      <div className="rounded-xl border border-dashed border-amber-400 bg-turmeric-100 px-4 py-3 text-sm text-amber-900" role="note">
        <strong>Demo hint:</strong> no SMS is sent. Any 4 digits will work, e.g. <span className="font-mono font-bold">1234</span>.
      </div>
      <fieldset className="mt-6">
        <legend className="label">4-digit code</legend>
        <div className="flex gap-3">
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${i + 1}`}
              className={`input h-16 w-16 text-center text-2xl font-bold ${error ? 'input-error' : ''}`}
              maxLength={4}
            />
          ))}
        </div>
        {error && (
          <p className="mt-2 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <button type="button" className="mt-4 self-start text-sm font-semibold text-brand-700 disabled:text-ink-muted" disabled={resendIn > 0} onClick={() => setResendIn(30)}>
        {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
      </button>
      <div className="flex-1" />
      <Button size="lg" loading={loading} onClick={() => verify()} disabled={code.length !== 4}>
        Verify
      </Button>
    </StepShell>
  );
}

function ProfileStep({ phone }: { phone: string }) {
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [diet, setDiet] = useState<Diet | null>(null);
  const [spice, setSpice] = useState<SpiceLevel | null>('medium');
  const [allergies, setAllergies] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearErr = (k: string) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[k];
      return next;
    });
  const [loading, setLoading] = useState(false);
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(name.trim())) errs.name = 'Enter your name (letters only, 2–40 characters).';
    if (area.trim().length < 3) errs.area = 'Tell us your PG or office area.';
    if (!diet) errs.diet = 'Choose your food preference.';
    if (!spice) errs.spice = 'Choose a spice level.';
    if (allergies.length > 120) errs.allergies = 'Keep it under 120 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await createProfile({ phone, name, area, diet: diet!, spice: spice!, allergies });
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: (err as Error).message });
      setLoading(false);
    }
  };

  return (
    <StepShell title="About you" subtitle="Helps Tai cook the way you like.">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5" noValidate>
        <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); clearErr("name"); }} error={errors.name} placeholder="e.g. Rahul Patil" />
        <div>
          <TextField label="PG / office area" value={area} onChange={(e) => { setArea(e.target.value); clearErr("area"); }} error={errors.area} placeholder="e.g. Akurdi Station Road" />
          <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {AREAS.map((a) => (
              <button key={a} type="button" onClick={() => { setArea(a); clearErr("area"); }} className={`chip shrink-0 !min-h-[36px] ${area === a ? 'chip-on' : 'chip-off'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <ChoiceChips label="Food preference" value={diet} onChange={(v) => { setDiet(v); clearErr("diet"); }} error={errors.diet} options={[{ value: 'veg', label: '🟢 Veg' }, { value: 'egg', label: '🥚 Veg + Egg' }]} />
        <ChoiceChips label="Spice level" value={spice} onChange={setSpice} error={errors.spice} options={[{ value: 'mild', label: '🌶 Mild' }, { value: 'medium', label: '🌶🌶 Medium' }, { value: 'spicy', label: '🌶🌶🌶 Spicy' }]} />
        <TextArea label="Allergies or notes (optional)" value={allergies} onChange={(e) => { setAllergies(e.target.value); clearErr("allergies"); }} error={errors.allergies} placeholder="e.g. peanuts, no garlic" hint={`${allergies.length}/120`} />
        {errors.form && <p className="text-sm font-medium text-red-700" role="alert">{errors.form}</p>}
        <div className="flex-1" />
        <Button type="submit" size="lg" loading={loading}>
          Start ordering
        </Button>
      </form>
    </StepShell>
  );
}
