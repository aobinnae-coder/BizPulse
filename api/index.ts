import express from 'express';
import apiRouter from '../api-router';

const app = express();
app.use(express.json());

// Mount the router on /api so that Serverless function routes respond
app.use('/api', apiRouter);

// Export the Express server for Vercel
export default app;
