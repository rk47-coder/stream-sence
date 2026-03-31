import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import slugify from '../utils/slugify.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const throttle = rateLimit({
  windowMs: 60_000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again shortly.' },
});

router.post(
  '/register',
  throttle,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
    body('name').optional().trim(),
    body('organizationName').trim().notEmpty().withMessage('Organization name required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, organizationName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    let base = slugify(organizationName);
    if (!base) base = 'org';
    let slug = base;
    let n = 0;
    while (await Tenant.findOne({ slug })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const tenant = await Tenant.create({ name: organizationName, slug });
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      name: name || '',
      role: 'admin',
      tenantId: tenant._id,
    });

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

    const token = signToken({ sub: user._id.toString(), role: user.role, tenantId: user.tenantId.toString() }, secret, expiresIn);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: { id: tenant._id, name: tenant.name, slug: tenant.slug },
    });
  }
);

router.post(
  '/login',
  throttle,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

    const token = signToken({ sub: user._id.toString(), role: user.role, tenantId: user.tenantId.toString() }, secret, expiresIn);

    const tenant = await Tenant.findById(user.tenantId);
    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: tenant ? { id: tenant._id, name: tenant.name, slug: tenant.slug } : null,
    });
  }
);

router.get('/me', authMiddleware(true), async (req, res) => {
  const user = await User.findById(req.user.id);
  const tenant = await Tenant.findById(req.user.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    tenant: tenant ? { id: tenant._id, name: tenant.name, slug: tenant.slug } : null,
  });
});

export default router;
