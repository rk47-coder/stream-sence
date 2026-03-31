import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { User, ROLES } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole, requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware(true));

/** Editors need viewer list to share videos; admins see everyone in the tenant */
router.get('/', requireMinRole('editor'), async (req, res) => {
  const q = { tenantId: req.user.tenantId };
  if (req.user.role === 'editor') q.role = 'viewer';
  const users = await User.find(q).select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users });
});

router.post(
  '/',
  requireRole('admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').optional().trim(),
    body('role').isIn(['editor', 'viewer']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, role } = req.body;
    if (role === 'admin') {
      return res.status(400).json({ error: 'Cannot promote to admin via this endpoint' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      name: name || '',
      role,
      tenantId: req.user.tenantId,
    });

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  }
);

router.patch(
  '/:id/role',
  requireRole('admin'),
  [param('id').isMongoId(), body('role').isIn(ROLES)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const target = await User.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target._id.toString() === req.user.id && req.body.role !== target.role) {
      return res.status(400).json({ error: 'Cannot change your own role here' });
    }

    target.role = req.body.role;
    await target.save();
    res.json({
      user: {
        id: target._id,
        email: target.email,
        name: target.name,
        role: target.role,
        tenantId: target.tenantId,
      },
    });
  }
);

export default router;
