import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldWrapProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, error, hint, children }: FieldWrapProps) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode; prefix?: string };

export function TextField({ label, error, hint, prefix, className = '', ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) =>
        prefix ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-ink-muted">{prefix}</span>
            <input id={id} aria-invalid={invalid} aria-describedby={describedBy} className={`input pl-14 ${invalid ? 'input-error' : ''} ${className}`} {...rest} />
          </div>
        ) : (
          <input id={id} aria-invalid={invalid} aria-describedby={describedBy} className={`input ${invalid ? 'input-error' : ''} ${className}`} {...rest} />
        )
      }
    </Field>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | null; hint?: ReactNode };

export function TextArea({ label, error, hint, className = '', ...rest }: AreaProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-invalid={invalid} aria-describedby={describedBy} className={`input min-h-[88px] resize-none ${invalid ? 'input-error' : ''} ${className}`} {...rest} />
      )}
    </Field>
  );
}

/** Single-choice chips (radio group). */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  error?: string | null;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`chip ${value === o.value ? 'chip-on' : 'chip-off'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
