# Flower School E-commerce Backend — AI Coding Agent Guide

## Architecture Overview

This backend is a TypeScript Express.js monolith for a flower shop with course enrollment. Key architectural decisions:

- **Storage Abstraction**: Use `storage.ts` (interface) and `database-storage.ts` (PostgreSQL implementation) for all data access. Never call the database directly—always use the storage layer.
- **Service Layer**: All background jobs, notifications, message queue, and email logic live in `/services`. E.g., `background-scheduler.ts` auto-progresses orders every 30 minutes.
- **Schema-First**: Database tables and Zod validation are defined in `/shared/schema.ts` using Drizzle ORM. No migration system—edit `schema.ts` directly for schema changes.
- **Notification Templates**: SMS/WhatsApp templates are in `/templates` for consistent messaging.
- **Integrated Dev Server**: `vite-dev-server.ts` serves the frontend during development.

## Essential File Structure

```
index.ts                # Express app, middleware, logging
routes.ts               # All API endpoints (very large, ~6500+ lines)
config.ts               # Env config, hardcoded fallbacks
storage.ts              # Storage interface
database-storage.ts     # PostgreSQL implementation
db.ts                   # Raw PostgreSQL pool
services/               # Background jobs, notifications, email, queue
templates/              # SMS/WhatsApp templates
shared/schema.ts        # Drizzle tables + Zod schemas
```

## Developer Workflows

- **Local Dev**: `npm run dev` (tsx watch mode), `npm run backend` (alias)
- **Production**: `npm run logs` (PM2 logs)
- **Docker**: `docker-compose up -d` (Postgres + backend), `docker-compose logs -f`
- **Schema Changes**: Edit `shared/schema.ts` directly, then restart backend

## Project-Specific Patterns & Conventions

- **Session Management**: In-memory sessions in `routes.ts` (no Redis/external store). Manual cleanup of expired sessions.
- **Order Status**: Orders auto-progress via background scheduler (`services/background-scheduler.ts`).
- **Notifications**: Use try/catch for all notification logic. Templates in `/templates`.
- **Category System**: Hardcoded master category data in `routes.ts` (see line ~15).
- **File Uploads**: Uses both `express-fileupload` and `multer` (50MB limit in `index.ts`). No cloud storage—local only.
- **API Structure**: All endpoints in `routes.ts`. Do not split unless refactoring entire feature.

## Integration Points

- **SendGrid**: Email confirmations via `services/email-service.ts` (config in `config.ts`).
- **Twilio**: SMS/WhatsApp via `services/notification-service.ts` (templates in `/templates`).
- **Razorpay**: Payment processing in `routes.ts` (config in `config.ts`).

## Database Usage

- **Drizzle ORM**: Tables and Zod schemas in `shared/schema.ts`.
- **Connection**: Raw pool in `db.ts`.
- **Access**: Always use `storage.ts` methods (e.g., `storage.getUser(id)`, `storage.getUserOrders(userId)`).

## Debugging & Testing

- **No test framework**: Add Jest/Vitest if needed.
- **Logging**: Request timing middleware in `index.ts`.
- **PM2**: Production process manager (`ecosystem.config.json`).
- **Docker**: Multi-stage build, Postgres service.

## Anti-Patterns to Avoid

1. **Never bypass storage layer**: Use `storage.*`, not `db.query()`.
2. **Don't hardcode secrets**: Use env vars (see `config.ts`).
3. **Don't split routes.ts**: Only refactor by feature, not piecemeal.
4. **Don't ignore background scheduler**: Orders auto-progress—account for this in status logic.

## Key APIs

- **Auth**: `/api/auth/*` (signup, signin, OTP, password reset)
- **Products**: `/api/products/*` (search, categories, stock)
- **Orders**: Placement, status, cancellation
- **Profile**: User management, address
- **Courses**: Event enrollment

## Example Patterns

**Session Management**
```typescript
const sessions: Map<string, { userId: string; expires: number }> = new Map();
```

**Storage Usage**
```typescript
const user = await storage.getUser(id);
const orders = await storage.getUserOrders(userId);
```

**Category System**
```typescript
const allCategories = [
  { id: "occasion", groups: [{ title: "Celebration Flowers", items: [...] }] }
];
```

---
If any section is unclear or missing, please provide feedback to iterate and improve these instructions.