const ORDER = { viewer: 0, editor: 1, admin: 2 };

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/** Minimum role level (admin > editor > viewer) */
export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (ORDER[req.user.role] < ORDER[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
