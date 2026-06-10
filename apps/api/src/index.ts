import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import dashboardRoutes from './routes/dashboard.routes';
import transactionRoutes from './routes/transaction.routes';
import customerRoutes from './routes/customer.routes';
import debtRoutes from './routes/debt.routes';
import reportRoutes from './routes/report.routes';

const app: Application = express();

// Middleware
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
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

app.listen(env.port, () => {
  console.log(`✅ Server running on port ${env.port}`);
});

export default app;
