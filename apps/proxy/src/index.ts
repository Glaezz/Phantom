import { Hono } from 'hono';
import { logRequest } from './util/log';
import { cors } from './middleware/cors';
import { config } from './middleware/config';
import { onError } from './middleware/errors';
import { rateLimit } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { analyzeRoute } from './routes/analyze';
import { cacheLookupRoute } from './routes/cacheLookup';
import { checkRoute } from './routes/check';
import { healthRoute } from './routes/health';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.onError(onError);

app.use('*', requestId());
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
});
app.use('*', config());

app.use('/api/*', cors());

app.route('/health', healthRoute);

app.use('/api/cache/lookup', rateLimit('analyze'));
app.use('/api/analyze', rateLimit('analyze'));
app.use('/api/check', rateLimit('check'));

app.route('/api/cache/lookup', cacheLookupRoute);
app.route('/api/analyze', analyzeRoute);
app.route('/api/check', checkRoute);

app.notFound((c) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Request-Id', c.get('requestId') ?? '');
  logRequest({
    requestId: c.get('requestId') ?? '',
    route: 'not_found',
    status: 404,
    latencyMs: performance.now() - (c.get('startedAt') ?? performance.now()),
  });
  return c.json({ error: { code: 'not_found', message: 'Rute tidak ditemukan.' } }, 404);
});

export default app;
