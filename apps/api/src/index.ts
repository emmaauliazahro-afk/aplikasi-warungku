import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from './middleware/error';
import { requestId } from './middleware/request-id';
import { originCheck } from './middleware/origin-check';
import { globalLimiter } from './middleware/rate-limit';
import prisma from './lib/prisma';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import dashboardRoutes from './routes/dashboard.routes';
import transactionRoutes from './routes/transaction.routes';
import customerRoutes from './routes/customer.routes';
import debtRoutes from './routes/debt.routes';
import reportRoutes from './routes/report.routes';

const app: Application = express();

// Trust the first proxy when behind a reverse proxy (nginx, compose) so that
// `req.ip` and the rate-limiter's IP key reflect the real client.
if (env.isProduction || env.webOrigins.some((origin) => origin.startsWith('https://'))) {
  app.set('trust proxy', 1);
}

// Middleware order matters:
// 1. request-id for correlation in logs
// 2. helmet for security headers (incl. CSP)
// 3. cors with explicit origin
// 4. global rate limiter
// 5. body parsers (bounded) + cookie parser
app.use(requestId);
app.use(
  helmet({
    // API serves JSON only, so a strict default-src of 'none' is appropriate.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use(
  cors({
    origin: env.webOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(globalLimiter);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Liveness — process is up.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Readiness — DB is reachable. K8s/load balancers should poll this.
app.get(
  '/api/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', message: 'API ready' });
  })
);

// Routes (CSRF / Origin check applies to state-changing methods only)
app.use('/api/auth', authRoutes);
app.use(originCheck);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/reports', reportRoutes);

// 404 + error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Only start server when running locally (not on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`✅ Server running on port ${env.port}`);
  });
}

// Export for Vercel serverless
export default app;
