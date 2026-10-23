import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/api.routes.js';
import { notFound } from './middlewares/not-found.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createAuthSecurity } from './utilities/auth-security.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { createFavoriteRouter } from './routes/favorite.routes.js';
import { createPublicReviewRouter, createReviewRouter } from './routes/review.routes.js';
import { createPantryRouter } from './routes/pantry.routes.js';

export const app = express();

app.disable('x-powered-by');
// Apply to successful responses and early CORS/parser errors alike. Frontend
// document CSP and HTTPS/HSTS belong to the host serving the React application.
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
// Include early CORS/body/configuration errors in the auth cache policy.
app.use(['/api/auth', '/api/admin', '/api/favorites', '/api/pantry', '/api/reviews', '/api/recipes/:id/reviews'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.clientOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('Nguồn yêu cầu không được phép truy cập.');
    error.status = 403;
    return callback(error);
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api/recipes', createPublicReviewRouter());
let authRoutes;
// Missing auth secrets must not take the public recipe API offline.
app.use('/api', (req, res, next) => {
  if (!/^\/(auth|admin|favorites|pantry|reviews)(\/|$)/u.test(req.path)
      && !/^\/recipes\/[^/]+\/reviews(?:\/mine)?\/?$/u.test(req.path)) return next();
  res.set('Cache-Control', 'no-store');
  if (!authRoutes) {
    try {
      const security = createAuthSecurity();
      const router = express.Router();
      router.use('/auth', createAuthRouter({ security }));
      router.use('/admin', createAdminRouter({ security }));
      router.use('/favorites', createFavoriteRouter({ security }));
      router.use('/pantry', createPantryRouter({ security }));
      router.use(createReviewRouter({ security }));
      authRoutes = router;
    } catch {
      return res.status(503).json({ message: 'Xác thực chưa được cấu hình. Vui lòng liên hệ quản trị viên.' });
    }
  }
  return authRoutes(req, res, next);
});
app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);
