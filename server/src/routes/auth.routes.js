import { Router } from 'express';
import { publicUser } from '../services/auth.service.js';

export function createAuthRouter({ security }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/csrf', security.issueCsrf);
  router.post('/register', security.csrfProtection, security.rateLimiter.middleware('register'), async (req, res) => {
    const user = await security.service.register(req.body);
    res.status(201).json({ data: user });
  });
  router.post('/login', security.csrfProtection, security.rateLimiter.middleware('login'), async (req, res) => {
    const user = await security.service.login(req.body);
    security.establishSession(req, res, user);
    res.json({ data: user });
  });
  // Idempotent logout still requires Origin + CSRF, including pre-auth state.
  router.post('/logout', security.csrfProtection, (req, res) => {
    security.endSession(req, res);
    res.json({ message: 'Đã đăng xuất thành công.' });
  });
  router.get('/me', security.authenticateJWT, (req, res) => res.json({ data: publicUser(req.user) }));
  router.patch('/profile', security.csrfProtection, security.authenticateJWT, async (req, res) => {
    const user = await security.service.updateProfile(req.user.userId, req.body);
    res.json({ data: user });
  });
  return router;
}
