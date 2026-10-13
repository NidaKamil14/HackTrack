import React, { createContext, useContext, useId } from 'react';
import { cn } from './cn';

const control =
  // 16px text on small screens stops iOS Safari from zooming on focus.
  'block w-full rounded-lg border border-line bg-sunken text-sm text-fg shadow-sm max-sm:text-base ' +
  'placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-line-strong ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/30 ' +
  'disabled:cursor-not-allowed disabled:bg-raised disabled:text-fg-subtle ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/30';

// Field wires label, hint and error to its control via ids.
const FieldContext = createContext(null);

function useFieldProps(props) {
  const field = useContext(FieldContext);
  if (!field) return props;
  const describedBy = [field.hintId, field.errorId, props['aria-describedby']].filter(Boolean).join(' ');
  return {
    id: field.id,
    'aria-invalid': field.invalid || undefined,
    'aria-describedby': describedBy || undefined,
    required: field.required,
    ...props,
  };
}

export function Field({ label, hint, error, required, className, children, id: idProp }) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldContext.Provider value={{ id, hintId, errorId, invalid: Boolean(error), required }}>
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <Label htmlFor={id}>
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </Label>
        )}
        {children}
        {hint && !error && <p id={hintId} className="text-xs text-fg-subtle">{hint}</p>}
        {error && <p id={errorId} className="text-xs font-medium text-danger">{error}</p>}
      </div>
    </FieldContext.Provider>
  );
}

export function Label({ className, ...props }) {
  return <label className={cn('block text-sm font-medium text-fg', className)} {...props} />;
}

export function Input({ className, ...props }) {
  return <input data-ui="" className={cn(control, 'h-9 px-3 max-sm:h-10 touch:h-10', className)} {...useFieldProps(props)} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return (
    <textarea
      data-ui=""
      rows={rows}
      className={cn(control, 'min-h-[5rem] px-3 py-2 leading-relaxed', className)}
      {...useFieldProps(props)}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        data-ui=""
        className={cn(control, 'h-9 appearance-none pl-3 pr-9 max-sm:h-10 touch:h-10', className)}
        {...useFieldProps(props)}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
