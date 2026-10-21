import jwt from 'jsonwebtoken';
import store from '../database/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hacktrack_jwt_super_secret_signing_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Authentication token required (Bearer <token>) (FR-4, NFR-7).',
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired authentication session token (NFR-11).',
    });
  }

  const user = store.findUserById(decoded.id);
  if (!user) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'User account associated with this session no longer exists.',
    });
  }

  // Enforce account active status (FR-1, FR-42)
  if (user.isActive === false || user.is_active === 0) {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Your account has been deactivated. Please contact an administrator.',
    });
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        error: 'Unauthorized',
        message: 'Authentication required before checking permissions.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: `Role '${req.user.role}' is not authorized to access this resource (NFR-8). Required: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
