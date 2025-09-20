export function Button({ className = '', variant, children, ...props }) {
  const v = variant === 'secondary' ? 'secondary' : ''
  return <button className={`btn ${v} ${className}`} {...props}>{children}</button>
}
