export function Switch({ checked, onCheckedChange, id, ...props }) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )
}
