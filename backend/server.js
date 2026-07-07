import express from "express";
import cors from "cors";
import helmet from 'helmet'
import cookieParser from "cookie-parser";
import "dotenv/config";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateOrigin } from './src/middleware/validateOrigin';
import { setupWebSocket, shutdownWebSocket } from './ws/websocket';
import { checkPoolHealth } from './src/lib/healthCheckPool'
import { connectRedis, disconnectRedis } from './redis/redisClient'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use(
  helmet({
    // USE CASE 1: Stop XSS and code injection by whitelisting trusted asset origins
    contentSecurityPolicy: {
      useDefaults: true, // Start with standard secure defaults
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://your-s3-bucket.s3.amazonaws.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        upgradeInsecureRequests: [], // Automatically upgrades HTTP asset links to HTTPS
      },
    },

    // USE CASE 2: Force modern browsers to only use HTTPS connections
    strictTransportSecurity: {
      maxAge: 31536000,           // 1 year in seconds
      includeSubDomains: true,    // Protect all subdomains
      preload: true,              // Ask browsers to bake your domain into their HTTPS-only list
    },

    // USE CASE 3: Mitigate Clickjacking by blocking other sites from putting your app in an iframe
    frameguard: {
      action: "deny",             // Use "sameorigin" if you must iframe your own app internally
    },

    // USE CASE 4: Prevent MIME-sniffing exploits (stops execution of scripts disguised as images/text)
    noSniff: true,

    // USE CASE 5: Hide server infrastructure data from network scanners (Security through obscurity)
    hidePoweredBy: true,

    // USE CASE 6: Protect data privacy by scrubbing sensitive routing paths when users click outbound links
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },

    // USE CASE 7: Disable buggy legacy browser XSS filters that can be weaponized
    xXssProtection: true,

    // USE CASE 8: Force Internet Explorer 8+ to save downloads locally instead of executing them inline
    xDownloadOptions: true,

    // USE CASE 9: Mitigate Spectre hardware vulnerabilities by isolating your window's browsing context
    crossOriginOpenerPolicy: {
      policy: "same-origin",
    },

    // USE CASE 10: Control who can load your API's static assets (images/videos)
    // Set to "cross-origin" so your separate frontend domain can load images hosted by this API
    crossOriginResourcePolicy: {
      policy: "cross-origin", 
    },

    // USE CASE 11: Prevent loading cross-origin assets unless they explicitly grant permission via CORS/CORP
    crossOriginEmbedderPolicy: {
      policy: "require-corp",
    },

    // USE CASE 12: Stop browsers from silently pre-resolving DNS coordinates for external links on your site
    dnsPrefetchControl: {
      allow: false,
    },

    // USE CASE 13: Block outdated Flash and PDF web plugins from loading data cross-domain
    permittedCrossDomainPolicies: {
      permittedPolicies: "none",
    },
  })
);

const PORT = process.env.PORT || 3000;

// Trust proxy so req.ip reflects client IPs when behind a reverse proxy/load balancer
app.set('trust proxy', true);

// Validate and determine CORS origin. In production, CORS_ORIGIN must be a valid non-wildcard URL.
const corsOrigin = (() => {
  if (process.env.NODE_ENV === 'production') {
    const v = process.env.CORS_ORIGIN;
    if (!v) throw new Error('CRITICAL: CORS_ORIGIN must be set in production');
    try {
      const parsed = new URL(v);
      if (parsed.hostname === '*' || v.trim() === '*') throw new Error('CORS_ORIGIN wildcard is not allowed in production');
      return v;
    } catch (err) {
      throw new Error('CRITICAL: CORS_ORIGIN must be a valid absolute URL in production');
    }
  }
  return 'http://localhost:5173';
})();

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount Origin/Referer validation for state-changing endpoints to mitigate CSRF.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return validateOrigin(req, res, next);
  }
  return next();
});

// Health check endpoint - expose for monitoring systems
app.get('/health/db', async (req, res) => {
  const health = await checkPoolHealth();
  res.status(health.healthy ? 200 : 503).json({
    ...health,
    pool: {
      total: pool.totalCount,     // Total connections in pool
      idle: pool.idleCount,       // Available connections
      waiting: pool.waitingCount, // Queries waiting for a connection
    },
  });
});

// 6. THE METRICS ENDPOINT: Prometheus requests this route to scrape data
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

import AuthRouter from "./src/routes/auth";
import ChatRouter from "./src/chat/chat";
import UserRouter from "./src/routes/users";
import FriendRouter from "./src/routes/userAddFriend";
import NotificationRouter from "./src/routes/userNotification";
import AnonymousChatRouter from "./src/routes/anonymousChat";

app.use("/api/auth", AuthRouter);
console.log('[server] Auth routes mounted at /api/auth');
app.use("/api/chats", ChatRouter);
console.log('[server] Chat routes mounted at /api/chats');
app.use("/api/users", UserRouter);
console.log('[server] User routes mounted at /api/users');
app.use("/api/friends", FriendRouter);
console.log('[server] Friend routes mounted at /api/friends');
app.use("/api/notifications", NotificationRouter);
console.log('[server] Notification routes mounted at /api/notifications');
app.use("/api/anonymousChats", AnonymousChatRouter);
console.log('[server] AnonymousChat routes mounted at /api/anonymousChats');

app.get("/api/health", (req, res) => {
  console.log(`[server] Health check from ${req.ip}`);
  res.json({ message: "Server is running" });
});

// In production, serve the Vite build as static files
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`[server] Serving static files from ${distPath}`);
  // SPA fallback — any non-API request serves index.html
  app.get('*path', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[server] No dist/ found — API only mode (run "npm run build" in root for full stack)');
}

console.log('[server.js] about to start the server');

(async () => {
  await connectRedis();
  setupWebSocket();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`[server] CORS origin: ${corsOrigin}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
})();

// Graceful shutdown
import { shutdownDb } from './src/lib/connectionPoolClient';
const shutdown = async () => {
  console.log('Shutting down server...');
  shutdownWebSocket();
  try {
    await shutdownDb();
    await disconnectRedis();
  } catch (e) {
    console.error('Error during shutdown:', e);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await shutdown();
});
process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await shutdown();
});