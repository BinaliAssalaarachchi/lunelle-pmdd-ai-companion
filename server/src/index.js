import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import insightsRouter from './routes/insights.js';
import reportsRouter from './routes/reports.js';
import accountRouter from './routes/account.js';
import coachRouter from './routes/coach.js';
import partnerRouter from './routes/partner.js';
import { errorHandler } from './middleware/errorHandler.js';
import {
  createCorsOriginDelegate,
  describeCorsMode,
  parseAllowedOrigins,
} from './lib/corsConfig.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

app.use(
  cors({
    origin: createCorsOriginDelegate(process.env),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    maxAge: 86400,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    firebaseConfigured: Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY,
    ),
  });
});

app.use('/api/insights', insightsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/account', accountRouter);
app.use('/api/coach', coachRouter);
app.use('/api/partner', partnerRouter);
app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  if (
    process.env.NODE_ENV === 'production' &&
    parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS).length === 0
  ) {
    console.warn(
      'CORS_ALLOWED_ORIGINS is empty in production; browser cross-origin requests will be denied.',
    );
  }
  console.log(
    `Lunelle API listening on 0.0.0.0:${port} (CORS: ${describeCorsMode(process.env)})`,
  );
});
