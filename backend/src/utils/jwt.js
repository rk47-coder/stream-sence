import jwt from 'jsonwebtoken';

export function signToken(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}
