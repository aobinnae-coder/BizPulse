import express from 'express';
import apiRouter from '../api-router';

const app = express();

// Parse JSON unless it's a Stripe webhook (Stripe needs the raw body)
app.use((req, res, next) => {
  if (req.originalUrl.includes('/webhooks/stripe')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Mount the router on /api so that Serverless function routes respond
app.use('/api', apiRouter);

// Export the Express server for Vercel
export default app;
