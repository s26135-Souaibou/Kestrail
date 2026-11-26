import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Load Firebase projectId from firebase-applet-config.json for verifyIdToken (no IAM needed)
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
if (fs.existsSync(configPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
    if (raw.projectId && raw.projectId !== 'remixed-project-id') {
      firebaseProjectId = raw.projectId;
    }
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

if (firebaseProjectId) {
  const adminApp = getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId });
  void adminApp;
}

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email?: string;
    emailVerified: boolean;
    provider?: string;
  };
}

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!firebaseProjectId) {
    res.status(503).json({
      error: 'Firebase project is not configured on the server.',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer authorization token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 8192) {
    res.status(401).json({ error: 'Invalid authorization token format.' });
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      provider: decoded.firebase?.sign_in_provider,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

const mcpToolsSchema = [
  {
    name: 'get_tasks',
    description: 'Retrieve tasks within the authorized user company scope and role permissions.',
    requiresConfirmation: false,
    requiredPermission: 'viewAllTasks (or assignee/visitor scope)',
    inputSchema: {
      companyId: 'string',
      status: 'optional enum(To Do, In Progress, Under Review, Blocked, Completed, Cancelled)',
      priority: 'optional enum(Low, Medium, High, Urgent)',
      assigneeId: 'optional string',
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task inside a specific company and optional project/department.',
    requiresConfirmation: false,
    requiredPermission: 'createTasks',
    inputSchema: {
      companyId: 'string',
      title: 'string (1..200)',
      description: 'optional string',
      priority: 'enum(Low, Medium, High, Urgent)',
      departmentId: 'optional string',
      assigneeId: 'optional string',
      deadline: 'optional ISO date string',
    },
  },
  {
    name: 'update_task_status',
    description: 'Transition task status while respecting terminal state locks and audit logs.',
    requiresConfirmation: false,
    requiredPermission: 'editTasks or task assignee',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      status: 'enum(To Do, In Progress, Under Review, Blocked, Completed, Cancelled)',
    },
  },
  {
    name: 'assign_task',
    description: 'Assign or reassign a task to an active company member.',
    requiresConfirmation: false,
    requiredPermission: 'assignTasks',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      assigneeId: 'string',
    },
  },
  {
    name: 'change_priority',
    description: 'Update task priority level.',
    requiresConfirmation: false,
    requiredPermission: 'editTasks',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      priority: 'enum(Low, Medium, High, Urgent)',
    },
  },
  {
    name: 'create_subtask',
    description: 'Create a scheduled subtask under an existing parent task.',
    requiresConfirmation: false,
    requiredPermission: 'createTasks',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      title: 'string (1..200)',
      assigneeId: 'optional string',
      deadline: 'optional ISO date string',
    },
  },
  {
    name: 'set_deadline',
    description: 'Update task start date or deadline.',
    requiresConfirmation: false,
    requiredPermission: 'editTasks',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      deadline: 'ISO date string',
    },
  },
  {
    name: 'add_comment',
    description: 'Post a comment or @mention reply on a task.',
    requiresConfirmation: false,
    requiredPermission: 'commentOnTasks',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      body: 'string (1..2000)',
    },
  },
  {
    name: 'generate_report',
    description: 'Create a task completion report with results and observations.',
    requiresConfirmation: true,
    requiredPermission: 'createReports',
    inputSchema: {
      companyId: 'string',
      taskId: 'string',
      title: 'string (1..200)',
      results: 'string (1..4000)',
      observations: 'optional string',
    },
  },
];

const mcpExecuteBodySchema = z.object({
  companyId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  confirmed: z.boolean().optional(),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'kestrel-workspace',
      firebaseConfigured: Boolean(firebaseProjectId),
      mcpIntegrationConfigured: Boolean(process.env.MCP_OAUTH_CLIENT_ID),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/auth/session', requireFirebaseAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      authenticated: true,
      user: req.authUser,
    });
  });

  app.get('/api/docs', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Kestrel Workspace API & Future ChatGPT MCP Gateway',
        version: '1.0.0',
        description:
          'Multi-company task management platform API. All authenticated endpoints require a verified Firebase ID Token in Authorization: Bearer <token>.',
      },
      security: {
        authentication: 'Firebase Auth ID Token (Google OAuth & Email/Password)',
        authorization: 'Server-validated company membership + configurable RBAC role policies',
        tenantIsolation: 'Strict /companies/{companyId}/* path scoping enforced in Firestore Security Rules',
        auditLogging: 'Append-only /companies/{companyId}/auditLogs',
      },
      endpoints: [
        { method: 'GET', path: '/api/health', auth: 'none', description: 'Service and integration readiness status.' },
        { method: 'GET', path: '/api/auth/session', auth: 'Bearer Firebase ID Token', description: 'Server-side token verification and identity claims.' },
        { method: 'GET', path: '/api/docs', auth: 'none', description: 'API and architecture documentation JSON.' },
        { method: 'GET', path: '/api/mcp/manifest', auth: 'none', description: 'Prepared MCP tool manifest and OAuth configuration requirements for future ChatGPT app integration.' },
        { method: 'POST', path: '/api/mcp/tools/:toolName', auth: 'Bearer OAuth/Firebase ID Token', description: 'Prepared MCP tool execution gateway (returns 501 until MCP OAuth client & server-side credentials are configured).' },
      ],
    });
  });

  app.get('/api/mcp/manifest', (_req, res) => {
    const mcpConfigured = Boolean(process.env.MCP_OAUTH_CLIENT_ID);
    res.json({
      protocol: 'Model Context Protocol (MCP) / ChatGPT Apps',
      configured: mcpConfigured,
      status: mcpConfigured ? 'configured' : 'unconfigured',
      oauthRequirements: {
        flow: 'OAuth 2.1 with PKCE',
        tokenValidation: 'Server-side Firebase ID Token / OAuth JWT verification per request',
        requiredEnvVars: ['MCP_OAUTH_CLIENT_ID', 'MCP_OAUTH_CLIENT_SECRET', 'MCP_ALLOWED_REDIRECT_URI'],
        securityRules: [
          'ChatGPT acts strictly within the authenticated user permissions.',
          'Every tool call validates active company membership on the server.',
          'Revoked tokens or revoked company integration configs are rejected.',
          'All MCP actions write immutable records to /companies/{companyId}/auditLogs with source: api_mcp.',
          'Destructive or report-publishing operations require explicit user confirmation.',
        ],
      },
      tools: mcpToolsSchema,
    });
  });

  app.post('/api/mcp/tools/:toolName', requireFirebaseAuth, (req: AuthenticatedRequest, res) => {
    const { toolName } = req.params;
    const tool = mcpToolsSchema.find((t) => t.name === toolName);
    if (!tool) {
      res.status(404).json({ error: `Unknown MCP tool: ${toolName}` });
      return;
    }

    const parsed = mcpExecuteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid tool request payload.', issues: parsed.error.issues });
      return;
    }

    if (!req.authUser?.emailVerified) {
      res.status(403).json({ error: 'Verified email is required before executing workspace tools.' });
      return;
    }

    if (tool.requiresConfirmation && !parsed.data.confirmed) {
      res.status(409).json({
        error: 'Explicit user confirmation is required before executing this action.',
        requiresConfirmation: true,
        tool: tool.name,
      });
      return;
    }

    if (!process.env.MCP_OAUTH_CLIENT_ID) {
      res.status(501).json({
        configured: false,
        error:
          'ChatGPT MCP integration is prepared at the architecture level but not yet configured in this environment. Set MCP_OAUTH_CLIENT_ID, MCP_OAUTH_CLIENT_SECRET, and user-owned Firebase Admin IAM credentials before enabling live MCP execution.',
        tool: tool.name,
        verifiedCallerUid: req.authUser.uid,
      });
      return;
    }

    res.status(501).json({
      configured: false,
      error: 'Live server-side Firestore execution requires upgrading from Starter Tier to a user-owned GCP project with IAM permissions.',
    });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kestrel Workspace server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
