# Flower School E-commerce Backend - AI Coding Guide

## Architecture Overview

This is a TypeScript Express.js backend for an e-commerce flower shop with integrated course enrollment. Key architectural decisions:

- **Dual Storage Pattern**: `storage.ts` (interface) → `database-storage.ts` (implementation) provides clean abstraction
- **Service Layer**: Background scheduler, notifications, message queue, and email service in `/services`  
- **Schema-First**: Drizzle ORM with Zod validation in `/shared/schema.ts`
- **Template System**: SMS/WhatsApp templates in `/templates` for consistent messaging
- **Full-Stack Dev**: Integrated Vite dev server (`vite-dev-server.ts`) serves frontend during development

## Essential File Structure

```
├── index.ts              # Express app setup, middleware, logging
├── routes.ts              # All API endpoints (6500+ lines)
├── config.ts              # Environment config with hardcoded fallbacks
├── storage.ts             # Storage interface definition  
├── database-storage.ts    # PostgreSQL implementation
├── db.ts                  # Raw PostgreSQL connection pool
├── services/
│   ├── background-scheduler.ts  # Auto order progression (30min intervals)
│   ├── notification-service.ts  # Twilio SMS/WhatsApp integration
│   ├── message-queue.ts         # Retry logic for failed messages
│   └── email-service.ts         # SendGrid order confirmations
├── templates/
│   ├── sms-templates.ts         # SMS notification templates
│   └── whatsapp-templates.ts    # WhatsApp notification templates
└── shared/schema.ts       # Drizzle tables + Zod schemas
```

## Development Workflows

**Local Development**:
```bash
npm run dev              # tsx watch mode
npm run backend         # alias for dev
```

**Production Deployment**:
```bash
npm run build           # TypeScript compilation
npm run deploy          # Build + PM2 start
npm run restart         # PM2 restart existing process
npm run stop            # PM2 stop process
npm run status          # PM2 process status
npm run logs            # View PM2 logs
```

**Docker Development**:
```bash
docker-compose up -d    # Start PostgreSQL + backend
docker-compose logs -f  # Follow container logs
```

**Database**: Uses PostgreSQL via connection pool (`db.ts`). No migration system - modify `schema.ts` directly.

## Key Patterns & Conventions

### 1. Session Management (In-Memory)
```typescript
// routes.ts line ~295
const sessions: Map<string, { userId: string; expires: number }> = new Map();
```
- Token-based auth via cookies
- No Redis/external session store
- Manual cleanup of expired sessions

### 2. Order Status Progression (Background Jobs)
```typescript
// services/background-scheduler.ts
const statusProgressions: OrderStatusProgression[] = [
  { currentStatus: "pending", nextStatus: "confirmed", progressionTime: 60 },
  // Auto-advances every 30 minutes
];
```

### 3. Notification Pattern
```typescript
// All order updates trigger SMS + WhatsApp via templates
const result = await notificationService.sendOrderConfirmation(order);
```

### 4. Message Queue (Retry Logic)
```typescript
// services/message-queue.ts - Auto-retries failed messages
const retryDelays = [30000, 60000, 300000]; // 30s, 1m, 5m
queue.enqueue(phone, message, 'whatsapp');
```

### 5. Error Handling Convention
```typescript
// Consistent across routes.ts
try {
  // operation
} catch (error) {
  console.error("Context:", error);
  res.status(500).json({ error: "Descriptive message" });
}
```

### 6. Category System (Hardcoded)
```typescript
// routes.ts line ~15: Master category data for filtering
const allCategories = [
  { id: "occasion", groups: [{ title: "Celebration Flowers", items: [...] }] }
];
```

## Integration Points

### Twilio (SMS/WhatsApp)
- Config: `config.ts` twilio section
- Service: `services/notification-service.ts`  
- Templates: `/templates/*.ts` files
- Used for: OTP, order confirmations, status updates

### SendGrid (Email)
- Config: `config.sendgrid` in `config.ts`
- Service: `services/email-service.ts`
- Used for: Order confirmations, receipts
- Templates: HTML email templates with order details

### Razorpay Payments
- Config: `config.razorpay` with live keys
- Integration: Payment processing in routes.ts
- No webhook handling implemented

### File Uploads
- Uses both `express-fileupload` and `multer`
- 50MB limit configured in `index.ts`
- No cloud storage - likely local/filesystem

## Database Specifics

### Schema Pattern
```typescript
// shared/schema.ts - Drizzle + Zod integration
export const users = pgTable("users", { ... });
export const insertUserSchema = createInsertSchema(users);
```

### Connection
```typescript
// db.ts - Raw PostgreSQL pool
export const db = new Pool({ connectionString: config.database.url });
```

### Storage Interface
```typescript
// Always use storage.ts methods, not direct database calls
const user = await storage.getUser(id);
const orders = await storage.getUserOrders(userId);
```

## Testing & Debugging

- **No test framework configured** - add Jest/Vitest if needed
- **Logging**: Request timing middleware in `index.ts`
- **PM2**: Production process management with `ecosystem.config.json`
- **Docker**: Multi-stage build with PostgreSQL service

## Common Anti-Patterns to Avoid

1. **Don't bypass storage layer**: Use `storage.*` methods, not direct `db.query()`
2. **Don't hardcode secrets**: Already has fallbacks in `config.ts` but use env vars in production  
3. **Don't modify routes.ts structure**: 6500+ lines - consider splitting by feature
4. **Don't ignore background scheduler**: Orders auto-progress - account for this in status logic

## Key APIs by Domain

**Auth**: `/api/auth/*` - signup, signin, OTP verification, password reset
**Products**: `/api/products/*` - search, categories, stock status
**Orders**: Order placement, status tracking, cancellation
**Profile**: User management, address updates
**Courses**: Event enrollment system

When adding features, follow the established patterns: storage interface → database implementation → route handler → error handling → optional notifications.