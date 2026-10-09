import { useState, type FormEvent } from 'react';
import type { FreshnessTag } from '@/types/models';
import { toast } from '@/store/toast';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useCatalog } from '@/hooks/useCatalog';
import { useNow } from '@/hooks/useNow';
import { deleteUpdate, listUpdates, postUpdate } from '@/api/kitchenUpdates';
import { KitchenUpdateCard } from '@/components/KitchenUpdateCard';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SectionTitle } from '@/components/ui/Misc';
import { ListSkeleton, QueryView } from '@/components/ui/States';

const FRESHNESS: FreshnessTag[] = ['Farm fresh today', 'Bought this morning', 'Seasonal pick', 'Locally sourced'];
const COMMON_VEG = ['Onion', 'Tomato', 'Potato', 'Coriander', 'Green chilli', 'Methi', 'Bhindi', 'Cabbage', 'Cauliflower', 'Carrot', 'Peas', 'Capsicum', 'Paneer', 'Spinach'];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** Downscales a photo to max 1024 px and re-encodes as JPEG so it fits comfortably in IndexedDB. */
async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Couldn’t read that image. Try a JPG or PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PostUpdate() {
  const now = useNow(60_000);
  const catalog = useCatalog();
  const updates = useLiveQuery(listUpdates, ['kitchenUpdates']);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [oil, setOil] = useState('');
  const [veg, setVeg] = useState<string[]>([]);
  const [vegInput, setVegInput] = useState('');
  const [fresh, setFresh] = useState<FreshnessTag>('Farm fresh today');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErrors((e) => ({ ...e, photo: 'Please choose an image file.' }));
    if (file.size > MAX_PHOTO_BYTES) return setErrors((e) => ({ ...e, photo: 'That photo is over 15 MB.' }));
    setProcessing(true);
    try {
      setPhoto(await compressPhoto(file));
      setErrors((e) => ({ ...e, photo: '' }));
    } catch (err) {
      setErrors((e) => ({ ...e, photo: (err as Error).message }));
    } finally {
      setProcessing(false);
    }
  };

  const addVeg = (v: string) => {
    const t = v.trim().replace(/\s+/g, ' ');
    if (!t || veg.some((x) => x.toLowerCase() === t.toLowerCase()) || veg.length >= 12) return;
    setVeg([...veg, t[0].toUpperCase() + t.slice(1)]);
    setVegInput('');
    setErrors((e) => ({ ...e, veg: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!photo) errs.photo = 'Add a photo of today’s cooking.';
    if (note.trim().length < 10) errs.note = 'Write a short note (at least 10 characters).';
    if (!oil.trim()) errs.oil = 'Mention the oil and roughly how much.';
    if (veg.length === 0) errs.veg = 'Add at least one vegetable.';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      await postUpdate({ photo: photo!, note, oilUsed: oil, vegetables: veg, freshness: fresh, author: catalog.data?.settings.cookName ?? 'Tai' });
      toast.success('Kitchen update posted', 'Customers can see it on Home and in the Kitchen tab.');
      setPhoto(null);
      setNote('');
      setOil('');
      setVeg([]);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-10">
      <PageHeader title="Post kitchen update" subtitle="Proof, not promise" back="/admin/more" />
      <form onSubmit={submit} className="space-y-5 px-4 pt-4" noValidate>
        <div>
          <p className="label">Photo</p>
          {photo ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={photo} alt="Preview of the kitchen photo to post" className="aspect-[4/3] w-full object-cover" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-white text-sm font-semibold ${errors.photo ? 'border-red-400' : 'border-brand-300'} text-brand-700`}>
                <Icon name="camera" className="h-7 w-7" />
                {processing ? 'Processing…' : 'Take photo'}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
              <label className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-white text-sm font-semibold ${errors.photo ? 'border-red-400' : 'border-line'} text-ink-soft`}>
                <Icon name="image" className="h-7 w-7" />
                From gallery
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
          {errors.photo && <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{errors.photo}</p>}
          <p className="mt-1 text-xs text-ink-muted">Stored only on this device in the prototype.</p>
        </div>

        <TextArea label="Note for customers" value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} error={errors.note} placeholder="e.g. Fresh methi from Akurdi mandi today. Dal slow-cooked since 7 AM." hint={`${note.length}/280`} />
        <TextField label="Oil used" value={oil} onChange={(e) => setOil(e.target.value)} error={errors.oil} placeholder="e.g. Cold-pressed groundnut oil · 900 ml for ~55 meals" />

        <div>
          <label htmlFor="veg" className="label">Vegetables used today</label>
          <div className="flex gap-2">
            <input
              id="veg"
              className={`input flex-1 ${errors.veg ? 'input-error' : ''}`}
              value={vegInput}
              onChange={(e) => setVegInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addVeg(vegInput);
                }
              }}
              placeholder="Type and press Enter"
            />
            <Button variant="secondary" onClick={() => addVeg(vegInput)}>Add</Button>
          </div>
          {veg.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Added vegetables">
              {veg.map((v) => (
                <li key={v}>
                  <button type="button" className="chip chip-on !min-h-[36px]" onClick={() => setVeg(veg.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                    {v} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {COMMON_VEG.filter((v) => !veg.includes(v)).map((v) => (
              <button key={v} type="button" className="chip chip-off !min-h-[36px] shrink-0" onClick={() => addVeg(v)}>
                + {v}
              </button>
            ))}
          </div>
          {errors.veg && <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">{errors.veg}</p>}
        </div>

        <fieldset>
          <legend className="label">Freshness tag</legend>
          <div className="flex flex-wrap gap-2">
            {FRESHNESS.map((f) => (
              <button key={f} type="button" aria-pressed={fresh === f} onClick={() => setFresh(f)} className={`chip ${fresh === f ? 'chip-on' : 'chip-off'}`}>
                🌿 {f}
              </button>
            ))}
          </div>
        </fieldset>
        {errors.form && <p className="text-sm font-medium text-red-700" role="alert">{errors.form}</p>}
        <Button type="submit" size="lg" loading={busy}>
          Post update
        </Button>
      </form>

      <div className="px-4">
        <SectionTitle>Recent posts</SectionTitle>
        <QueryView q={updates} skeleton={<ListSkeleton count={2} />}>
          {(list) => (
            <div className="space-y-3">
              {list.slice(0, 5).map((u) => (
                <div key={u.id} className="relative">
                  <KitchenUpdateCard update={u} nowMs={now} compact />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 !bg-white/90"
                    onClick={async () => {
                      await deleteUpdate(u.id);
                      toast.info('Update deleted');
                    }}
                    aria-label="Delete this update"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </QueryView>
      </div>
    </div>
  );
}
