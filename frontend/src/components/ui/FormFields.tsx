import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface BaseFieldProps {
  label: string;
  id: string;
}

interface InputFieldProps
  extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {}
interface SelectFieldProps
  extends BaseFieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  options: Array<{ label: string; value: string }>;
}
interface TextAreaFieldProps
  extends
    BaseFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {}

const baseClassName =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:ring-cyan-900/40";

export function InputField({
  label,
  id,
  className,
  ...props
}: InputFieldProps) {
  return (
    <label
      htmlFor={id}
      className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
    >
      {label}
      <input
        id={id}
        className={`${baseClassName} ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  id,
  options,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <label
      htmlFor={id}
      className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
    >
      {label}
      <select
        id={id}
        className={`${baseClassName} ${className ?? ""}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  id,
  className,
  ...props
}: TextAreaFieldProps) {
  return (
    <label
      htmlFor={id}
      className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
    >
      {label}
      <textarea
        id={id}
        className={`${baseClassName} min-h-28 ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}
