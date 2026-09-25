import { type InputHTMLAttributes, forwardRef } from 'react';
import { Input } from '@docly/ui';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// Label + input + inline validation error, shared by every auth form field so
// error styling/placement can't drift between login and register.
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({ label, error, id, ...props }, ref) => {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <Input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
});

FormField.displayName = 'FormField';
