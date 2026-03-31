export function posterGradient(title) {
  let h = 0
  const s = String(title || 'x')
  for (let i = 0; i < s.length; i += 1) h = s.charCodeAt(i) + ((h << 5) - h)
  const a = Math.abs(h) % 360
  const b = (a + 48) % 360
  return {
    background: `linear-gradient(155deg, hsl(${a}, 45%, 18%) 0%, hsl(${b}, 40%, 11%) 100%)`,
  }
}
