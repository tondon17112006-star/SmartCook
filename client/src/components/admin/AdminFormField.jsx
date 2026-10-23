export default function AdminFormField({ label, name, error, as: Tag = 'input', children, ...props }) {
  const id = `admin-${name}`
  return <div><label htmlFor={id} className="mb-2 block text-sm font-semibold text-dark-green">{label}{props.required && <span aria-hidden="true"> *</span>}</label><Tag id={id} name={name} className="field" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} {...props}>{children}</Tag>{error && <p id={`${id}-error`} className="mt-2 text-sm text-red-800">{error}</p>}</div>
}
