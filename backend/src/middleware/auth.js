import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

export function authMiddleware(required = true) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    let token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    // <video src> can't send Bearer; stream route accepts ?token= (treat like a secret URL).
    if (!token && req.method === 'GET') {
      const pathOnly = req.originalUrl.split('?')[0];
      if (pathOnly.endsWith('/stream') && typeof req.query.token === 'string') {
        token = req.query.token;
      }
    }

    if (!token) {
      if (required) return res.status(401).json({ error: 'Authentication required' });
      req.user = null;
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');
      const decoded = verifyToken(token, secret);
      const user = await User.findById(decoded.sub);
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId.toString(),
      };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
