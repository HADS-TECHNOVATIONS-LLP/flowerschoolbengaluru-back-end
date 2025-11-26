import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  password: text("password").notNull(),
  userType: varchar("user_type"),
  profileImageUrl: varchar("profile_image_url"),
  defaultAddress: text("default_address"),
  deliveryAddress: text("delivery_address"),
  country: varchar("country"),
  state: varchar("state"),
  points: integer("points").default(0),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // This becomes the selling price
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }), // Original price before discount
  discountPercentage: integer("discount_percentage"), // Discount percentage (0-100)
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }), // Actual discount amount in currency
  category: text("category").notNull(),
  subcategory: text("subcategory"), // Subcategory field for products
  image: text("image").notNull(),
  imagefirst: text("imagefirst"),
  imagesecond: text("imagesecond"), 
  imagethirder: text("imagethirder"),
  imagefoure: text("imagefoure"),
  imagefive: text("imagefive"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  inStock: boolean("in_stock").default(true),
  featured: boolean("featured").default(false),
  isbestseller: boolean("isbestseller").default(false),
  iscustom: boolean("iscustom").default(false),
  colour: text("colour"),
  discountsOffers: boolean("discounts_offers").default(false),
  filter: text("filter"), // Add filter field for normalized filter array (as JSON string)
  createdAt: timestamp("created_at").defaultNow(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: text("duration").notNull(),
  sessions: integer("sessions").notNull(),
  features: jsonb("features").notNull(),
  popular: boolean("popular").default(false),
  nextBatch: text("next_batch"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(), // Human-readable order number like ORD-2024-001234
  userId: varchar("user_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  occasion: text("occasion"),
  requirements: text("requirements"),
  status: text("status").default("pending"), // pending, confirmed, processing, shipped, delivered, cancelled
  statusUpdatedAt: timestamp("status_updated_at").defaultNow(),
  pointsAwarded: boolean("points_awarded").default(false),
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryOptionId: varchar("delivery_option_id").references(() => deliveryOptions.id),
  delivery_option: varchar("delivery_option"), // Added for custom delivery option name
  distance: decimal("distance", { precision: 10, scale: 2 }).default("0"), // Added for delivery distance
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull().default("0"),
  couponCode: varchar("coupon_code"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").notNull(), // COD, Online, UPI, Card
  paymentCharges: decimal("payment_charges", { precision: 10, scale: 2 }).default("0"),
  paymentStatus: text("payment_status").default("pending"), // pending, completed, failed, refunded
  paymentTransactionId: varchar("payment_transaction_id"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddressId: varchar("shipping_address_id").references(() => addresses.id),
  deliveryAddress: text("delivery_address"), // Fallback for guest users or address changes
  deliveryDate: timestamp("delivery_date"),
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  status: text("status").notNull(), // pending, confirmed, processing, shipped, delivered, cancelled
  note: text("note"), // Optional note about the status change
  changedAt: timestamp("changed_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserProduct: unique().on(table.userId, table.productId),
}));

export const enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  courseId: varchar("course_id").notNull().references(() => courses.id),
  batch: text("batch"),
  questions: text("questions"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  type: text("type").notNull(), // "shop" or "school"
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  image: text("image").notNull(),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fullName: varchar("full_name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  landmark: text("landmark"),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  postalCode: varchar("postal_code").notNull(),
  country: varchar("country").notNull().default("India"),
  addressType: varchar("address_type").notNull().default("Home"), // Home, Office, Other
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const deliveryOptions = pgTable("delivery_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Standard, Express, Same Day
  description: text("description").notNull(),
  estimatedDays: varchar("estimated_days").notNull(), // "3-5 business days", "1-2 business days", "Same day"
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(), // Coupon code (should be uppercase)
  type: varchar("type").notNull(), // 'percentage' or 'fixed'
  value: decimal("value", { precision: 10, scale: 2 }).notNull(), // Discount value
  isActive: boolean("is_active").default(true),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }), // For percentage caps
  usageLimit: integer("usage_limit"), // Max number of times coupon can be used
  timesUsed: integer("times_used").default(0), // Current usage count
  description: text("description"), // Optional description for the coupon
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  password: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  phone: true,
  defaultAddress: true,
  deliveryAddress: true,
  country: true,
  state: true,
  profileImageUrl: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true, // Generated by server
  status: true, // Set by server to "pending"
  // paymentStatus intentionally allowed in insert payload so callers can provide an initial status
  createdAt: true,
  updatedAt: true,
});

// Order placement validation schema for the API endpoint
export const orderPlacementSchema = z.object({
  // Customer information (required for guest checkout)
  customerName: z.string().min(1, "Customer name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().regex(/^(\+91|91)?[6-9]\d{9}$/, "Valid Indian phone number is required").transform((val) => {
    // Normalize to +91XXXXXXXXXX format
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
      return `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    }
    return val.startsWith('+') ? val : `+91${digitsOnly}`;
  }),
  
  // Order details
  occasion: z.string().optional(),
  requirements: z.string().optional(),
  
  // Cart items with validation
  items: z.array(z.object({
    productId: z.string().min(1, "Product ID is required"),
    productName: z.string().min(1, "Product name is required"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unitPrice: z.number().positive("Unit price must be positive"),
    totalPrice: z.number().positive("Total price must be positive"),
  })).min(1, "Order must contain at least one item"),
  
  // Pricing breakdown (will be validated server-side)
  subtotal: z.number().positive("Subtotal must be positive"),
  
  // Delivery information
  deliveryOptionId: z.string().min(1, "Delivery option is required"),
  delivery_option: z.string().default(''),
  distance: z.number().default(0),
  deliveryCharge: z.number().min(0, "Delivery charge cannot be negative"),
  deliveryDate: z.string().datetime().optional(),
  
  // Payment information
  paymentMethod: z.enum(["COD", "Online", "UPI", "Card"], { 
    errorMap: () => ({ message: "Payment method must be COD, Online, UPI, or Card" })
  }),
  paymentCharges: z.number().min(0, "Payment charges cannot be negative").default(0),
  // Optional: if payment was completed via gateway before creating the order
  paymentTransactionId: z.string().optional(),
  paymentStatus: z.enum(["pending", "completed", "failed", "refunded"]).optional(),
  
  // Address information
  shippingAddressId: z.string().optional(), // For authenticated users
  deliveryAddress: z.string().optional(), // For guest users or custom address
  
  // Coupon information
    code: z.string().optional(),
  coupon_id: z.string().optional(),
  coupon_type: z.string().optional(),
  coupon_value: z.number().optional(),
  coupon_description: z.string().optional(),
  discount_amount: z.number().min(0, "Discount amount cannot be negative").default(0),
  final_amount: z.number().optional(),
  // Final total
  total: z.number().positive("Total must be positive"),
  
  // User information (optional for guest checkout)
  userId: z.string().optional(),
}).refine(data => {
  // Either authenticated user with address ID or guest with delivery address
  return (data.userId && data.shippingAddressId) || data.deliveryAddress;
}, {
  message: "Either shipping address ID (for users) or delivery address (for guests) is required",
  path: ["shippingAddress"]
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({
  id: true,
  createdAt: true,
});

export const insertCartSchema = createInsertSchema(carts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertAddressSchema = createInsertSchema(addresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryOptionSchema = createInsertSchema(deliveryOptions).omit({
  id: true,
  createdAt: true,
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  timesUsed: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({
  id: true,
  changedAt: true,
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  cartSubtotal: z.number().positive("Cart subtotal must be positive"),
  userId: z.string().optional(),
});

// Address validation schema with enhanced validation
export const addressValidationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().regex(/^(\+91|91)?[6-9]\d{9}$/, "Please enter a valid Indian mobile number").transform((val) => {
    // Normalize to +91XXXXXXXXXX format
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
      return `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    }
    return val.startsWith('+') ? val : `+91${digitsOnly}`;
  }),
  email: z.string().email("Please enter a valid email address").optional(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().regex(/^\d{6}$/, "Please enter a valid 6-digit postal code"),
  country: z.string().min(1, "Country is required").default("India"),
  addressType: z.enum(["Home", "Office", "Other"]).default("Home"),
  isDefault: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof carts.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect & { code?: string; couponCode?: string };
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;
export type InsertDeliveryOption = z.infer<typeof insertDeliveryOptionSchema>;
export type DeliveryOption = typeof deliveryOptions.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type ValidateCoupon = z.infer<typeof validateCouponSchema>;
export type AddressValidation = z.infer<typeof addressValidationSchema>;
export type OrderPlacement = z.infer<typeof orderPlacementSchema> & { code?: string; couponCode?: string };

// Event types
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  event_type: varchar("event_type", { length: 50 }).notNull(),
  event_date: text("event_date").notNull(), // Using text to store date
  event_time: text("event_time"), // Using text to store time
  duration: text("duration"), // Using text to store interval
  instructor: text("instructor"),
  spots_left: integer("spots_left"),
  image: text("image"),
  booking_available: boolean("booking_available").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0.00"),
});

export const events_enrollments = pgTable("events_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  event_id: varchar("event_id").notNull().references(() => events.id),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: varchar("phone").notNull(),
  payment_status: varchar("payment_status").notNull().default("pending"),
  payment_amount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull(),
  transaction_id: text("transaction_id"),
  enrolled_at: timestamp("enrolled_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export type Event = typeof events.$inferSelect;
export type EventEnrollment = typeof events_enrollments.$inferSelect;

// Event validation schemas
export const insertEventSchema = createInsertSchema(events);
export const updateEventSchema = insertEventSchema.partial();
export const validateEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  event_type: z.string().min(1, "Event type is required"),
  event_date: z.string().min(1, "Event date is required"),
  event_time: z.string().optional(),
  duration: z.string().optional(),
  instructor: z.string().optional(),
  spots_left: z.number().int().min(0).optional(),
  image: z.string().optional(),
  booking_available: z.boolean().optional(),
  amount: z.number().min(0).optional()
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type ValidateEvent = z.infer<typeof validateEventSchema>;

// Notification types for SMS and WhatsApp messaging
export interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  phone: string;
  total: string;
  estimatedDeliveryDate?: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  deliveryAddress: string;
  paymentMethod: string;
  paymentStatus: string;
}
