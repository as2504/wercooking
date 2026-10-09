import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Diet, SpiceLevel } from '@/types/models';
import { useSession, useUser } from '@/store/session';
import { toast } from '@/store/toast';
import { updateProfile } from '@/api/users';
import { formatPhone } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { ChoiceChips, TextArea, TextField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { AREAS } from '@/lib/constants';

export default function EditProfile() {
  const user = useUser();
  const refresh = useSession((s) => s.refresh);
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [area, setArea] = useState(user.area);
  const [diet, setDiet] = useState<Diet>(user.diet);
  const [spice, setSpice] = useState<SpiceLevel>(user.spice);
  const [allergies, setAllergies] = useState(user.allergies);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearErr = (k: string) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[k];
      return next;
    });
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(name.trim())) errs.name = 'Enter your name (letters only, 2–40 characters).';
    if (area.trim().length < 3) errs.area = 'Tell us your PG or office area.';
    if (allergies.length > 120) errs.allergies = 'Keep it under 120 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { name: name.trim(), area: area.trim(), diet, spice, allergies: allergies.trim() });
      await refresh();
      toast.success('Profile saved');
      navigate('/profile');
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Edit profile" back="/profile" />
      <form onSubmit={save} className="space-y-5 px-4 pb-10 pt-4" noValidate>
        <TextField label="Mobile number" value={formatPhone(user.phone)} disabled hint="Verified via OTP. Can't be changed in the demo." />
        <TextField label="Full name" value={name} onChange={(e) => { setName(e.target.value); clearErr("name"); }} error={errors.name} autoComplete="name" />
        <div>
          <TextField label="PG / office area" value={area} onChange={(e) => { setArea(e.target.value); clearErr("area"); }} error={errors.area} />
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {AREAS.map((a) => (
              <button key={a} type="button" onClick={() => { setArea(a); clearErr("area"); }} className={`chip shrink-0 !min-h-[36px] ${area === a ? 'chip-on' : 'chip-off'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <ChoiceChips label="Food preference" value={diet} onChange={(v) => { setDiet(v); clearErr("diet"); }} options={[{ value: 'veg', label: '🟢 Veg' }, { value: 'egg', label: '🥚 Veg + Egg' }]} />
        <ChoiceChips label="Spice level" value={spice} onChange={setSpice} options={[{ value: 'mild', label: '🌶 Mild' }, { value: 'medium', label: '🌶🌶 Medium' }, { value: 'spicy', label: '🌶🌶🌶 Spicy' }]} />
        <TextArea label="Allergies or notes" value={allergies} onChange={(e) => { setAllergies(e.target.value); clearErr("allergies"); }} error={errors.allergies} hint={`${allergies.length}/120`} />
        {errors.form && <p className="text-sm font-medium text-red-700" role="alert">{errors.form}</p>}
        <Button type="submit" size="lg" loading={saving}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
