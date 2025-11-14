import { type User, type InsertUser, type Product, type InsertProduct, type Course, type InsertCourse, type Order, type InsertOrder, type Enrollment, type InsertEnrollment, type Testimonial, type InsertTestimonial, type BlogPost, type InsertBlogPost, type Cart, type InsertCart, type Favorite, type InsertFavorite, type Coupon, type InsertCoupon, type Address, type InsertAddress, type DeliveryOption, type InsertDeliveryOption, type OrderPlacement, type OrderStatusHistory, type InsertOrderStatusHistory } from "./shared/schema.js";
import { randomUUID } from "crypto";
import { DatabaseStorage } from "./database-storage.js";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string,password: string): Promise<User | undefined>;
  getUserByEmailOnly(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  // Check if any user has this exact password (used for login heuristics)
  passwordExists(password: string): Promise<boolean>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserProfile(id: string, profile: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  // Products
  getAllProducts(): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  getProductsByCategoryAndSubcategory(category: string, subcategory?: string, searchKeyword?: string): Promise<Product[]>;
  getProductsByMainCategory(mainCategory: string): Promise<Product[]>;
  getProductsBySubcategory(subcategory: string): Promise<Product[]>;
  getProductsByNameSearch(searchTerm: string): Promise<Product[]>;
  getProductsByMainCategoryAndSubcategory(mainCategory: string, subcategory: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Inventory Management
  updateProductStock(productId: string, quantityChange: number): Promise<Product>;
  checkProductAvailability(productId: string, requiredQuantity: number): Promise<{ available: boolean; currentStock: number }>;
  validateStockAvailability(items: Array<{ productId: string; quantity: number }>): Promise<{
    isValid: boolean;
    errors?: string[];
    stockValidation?: Array<{ productId: string; productName: string; requiredQuantity: number; availableStock: number; sufficient: boolean }>;
  }>;
  decrementProductsStock(items: Array<{ productId: string; quantity: number }>): Promise<void>;
  
  // Courses
  getAllCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  
  // Orders
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getUserOrders(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentStatus(id: string, paymentStatus: string, transactionId?: string): Promise<Order>;
  
  // Order cancellation and tracking
  cancelOrder(orderId: string, userId: string): Promise<Order>;
  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]>;
  addOrderStatusHistory(orderId: string, status: string, note?: string): Promise<void>;
  
  // Points system
  awardUserPoints(userId: string, points: number): Promise<void>;
  
  // Order progression for background jobs
  listAdvancableOrders(cutoffDate: Date, statuses: string[]): Promise<Order[]>;
  advanceOrderStatus(orderId: string, nextStatus: string): Promise<Order>;
  
  // Order address updates
  updateOrderAddress(orderId: string, deliveryAddress: string, deliveryPhone?: string): Promise<Order>;
  
  // Enhanced order processing methods
  generateOrderNumber(): Promise<string>;
  validateAndProcessOrder(orderData: OrderPlacement): Promise<{
    isValid: boolean;
    errors?: string[];
    validatedOrder?: InsertOrder;
    calculatedPricing?: {
      subtotal: number;
      deliveryCharge: number;
      discountAmount: number;
      paymentCharges: number;
      total: number;
    };
  }>;
  validateCartItems(items: Array<{ productId: string; quantity: number; unitPrice: number }>): Promise<{
    isValid: boolean;
    errors?: string[];
    validatedItems?: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
  }>;
  calculateOrderPricing(subtotal: number, deliveryOptionId: string, couponCode?: string, paymentMethod?: string): Promise<{
    deliveryCharge: number;
    discountAmount: number;
    paymentCharges: number;
    total: number;
  }>;
  
  // Favorites
  getUserFavorites(userId: string): Promise<(Favorite & { product: Product })[]>;
  addToFavorites(userId: string, productId: string): Promise<Favorite>;
  removeFromFavorites(userId: string, productId: string): Promise<void>;
  isProductFavorited(userId: string, productId: string): Promise<boolean>;
  
  // Enrollments
  getAllEnrollments(): Promise<Enrollment[]>;
  getEnrollment(id: string): Promise<Enrollment | undefined>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  
  // Testimonials
  getAllTestimonials(): Promise<Testimonial[]>;
  getTestimonialsByType(type: string): Promise<Testimonial[]>;
  createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial>;
  
  // Blog Posts
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  
  // Cart Operations
  getUserCart(userId: string): Promise<(Cart & { product: Product })[]>;
  addToCart(userId: string, productId: string, quantity: number): Promise<Cart>;
  updateCartItemQuantity(userId: string, productId: string, quantity: number): Promise<Cart>;
  removeFromCart(userId: string, productId: string): Promise<void>;
  clearUserCart(userId: string): Promise<void>;
  
  // Coupon Operations
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  getAllCoupons(): Promise<Coupon[]>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon>;
  incrementCouponUsage(code: string): Promise<Coupon>;
  deleteCoupon(id: string): Promise<void>;
  
  // Address Operations
  getUserAddresses(userId: string): Promise<Address[]>;
  getAddress(id: string): Promise<Address | undefined>;
  createAddress(address: InsertAddress): Promise<Address>;
  updateAddress(id: string, updates: Partial<Address>): Promise<Address>;
  deleteAddress(id: string): Promise<void>;
  setDefaultAddress(userId: string, addressId: string): Promise<void>;
  
  // Delivery Options
  getAllDeliveryOptions(): Promise<DeliveryOption[]>;
  getActiveDeliveryOptions(): Promise<DeliveryOption[]>;
  getDeliveryOption(id: string): Promise<DeliveryOption | undefined>;
  createDeliveryOption(deliveryOption: InsertDeliveryOption): Promise<DeliveryOption>;

  // Impacts (key/value)
  getImpacts(): Promise<any[]>;
  createImpact(impact: { title: string; value: string }): Promise<any>;
  updateImpact(id: string, impact: { title: string; value: string }): Promise<any>;
  deleteImpact(id: string): Promise<void>;

  // Landing/contact subscriptions
  addLandingContact(contact: { name: string; email: string; phone: string; city?: string; address?: string }): Promise<any>;
  getAllLandingContacts(): Promise<any[]>;
  // Event pricing (admin configurable)
  getEventPricing(): Promise<any>;
  updateEventPricing(pricing: any): Promise<any>;
  
  // Transactional order processing methods
  createOrderWithTransaction(validatedOrder: InsertOrder, couponCode?: string, userId?: string): Promise<Order>;
  processOrderPlacement(orderData: OrderPlacement, userId?: string): Promise<{
    isValid: boolean;
    errors?: string[];
    order?: Order;
    calculatedPricing?: {
      subtotal: number;
      deliveryCharge: number;
      discountAmount: number;
      paymentCharges: number;
      total: number;
    };
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private products: Map<string, Product> = new Map();
  private courses: Map<string, Course> = new Map();
  private orders: Map<string, Order> = new Map();
  private enrollments: Map<string, Enrollment> = new Map();
  private testimonials: Map<string, Testimonial> = new Map();
  private blogPosts: Map<string, BlogPost> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private addresses: Map<string, Address> = new Map();
  private deliveryOptions: Map<string, DeliveryOption> = new Map();
  private carts: Map<string, Cart> = new Map();
  private favorites: Map<string, Favorite> = new Map();
  private impacts: Map<string, { id: string; title: string; value: string; createdAt: Date }> = new Map();

  constructor() {
    this.initializeData();
  }

  // Impact methods for in-memory storage (useful for dev/test without DB)
  async getImpacts(): Promise<any[]> {
    return Array.from(this.impacts.values()).map(i => ({ id: i.id, title: i.title, value: i.value, created_at: i.createdAt.toISOString() }));
  }

  async createImpact(impact: { title: string; value: string }): Promise<any> {
    const id = randomUUID();
    const now = new Date();
    const item = { id, title: impact.title, value: impact.value, createdAt: now };
    this.impacts.set(id, item);
    return { id, title: item.title, value: item.value, created_at: now.toISOString() };
  }

  // Simple in-memory storage for landing contacts (dev/test)
  private landingContacts: Array<{ id: string; name: string; email: string; phone: string; city?: string; address?: string; createdAt: Date }> = [];

  // In-memory event pricing
  private eventPricing: any = {
    weekdays_morning: { label: 'Weekdays 10:00 AM – 3:00 PM', price: '25000' },
    weekdays_evening: { label: 'Weekdays 5:00 PM – 11:00 PM', price: '30000' },
    weekends_morning: { label: 'Weekends 10:00 AM – 3:00 PM', price: '30000' },
    weekends_evening: { label: 'Weekends 5:00 PM – 12:00 AM', price: '35000' }
  };

  async addLandingContact(contact: { name: string; email: string; phone: string; city?: string; address?: string }): Promise<any> {
    const id = randomUUID();
    const now = new Date();
    const record = { id, name: contact.name, email: contact.email, phone: contact.phone, city: contact.city, address: contact.address, createdAt: now };
    this.landingContacts.push(record);
    return { success: true, contact: { ...record, created_at: now.toISOString() } };
  }

  async getAllLandingContacts(): Promise<any[]> {
    // Return a shallow copy with ISO string dates to match DB shape
    return this.landingContacts.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, created_at: r.createdAt.toISOString() }));
  }

  async getEventPricing(): Promise<any> {
    return this.eventPricing;
  }

  async updateEventPricing(pricing: any): Promise<any> {
    this.eventPricing = { ...this.eventPricing, ...pricing };
    return this.eventPricing;
  }

  async updateImpact(id: string, impact: { title: string; value: string }): Promise<any> {
    const existing = this.impacts.get(id);
    if (!existing) throw new Error('Impact not found');
    const updated = { ...existing, title: impact.title, value: impact.value };
    this.impacts.set(id, updated);
    return { id: updated.id, title: updated.title, value: updated.value, created_at: updated.createdAt.toISOString() };
  }

  async deleteImpact(id: string): Promise<void> {
    this.impacts.delete(id);
  }

  private initializeData() {
    // Initialize products
    const sampleProducts: Product[] = [
        {
          id: "1",
          name: "Premium Red Roses",
          description: "12 fresh red roses with premium wrapping",
          price: "1299.00",
          originalPrice: "1299.00",
          discountPercentage: 0,
          discountAmount: "0.00",
          category: "roses",
          subcategory: "roses",
          image: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
          imagefirst: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
          imagesecond: "",
          imagethirder: "",
          imagefoure: "",
          imagefive: "",
          stockQuantity: 25,
          inStock: true,
          featured: true,
          isbestseller: false,
          iscustom: false,
          colour: "",
          discountsOffers: false,
          createdAt: new Date(),
        },
      {
        id: "2",
        name: "White Orchid Elegance",
        description: "Pristine white orchids in ceramic pot",
        price: "2499.00",
        originalPrice: "2499.00",
        discountPercentage: 0,
        discountAmount: "0.00",
        category: "orchids",
        subcategory: "orchids",
        image: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        imagefirst: "",
        imagesecond: "",
        imagethirder: "",
        imagefoure: "",
        imagefive: "",
        stockQuantity: 15,
        inStock: true,
        featured: true,
        isbestseller: false,
        iscustom: false,
        colour: "",
        discountsOffers: false,
        createdAt: new Date(),
      },
      {
        id: "3",
        name: "Bridal Bliss Bouquet",
        description: "Mixed roses and lilies for your special day",
        price: "3999.00",
        originalPrice: "3999.00",
        discountPercentage: 0,
        discountAmount: "0.00",
        category: "wedding",
        subcategory: "wedding",
        image: "https://images.unsplash.com/photo-1606800052052-a08af7148866?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        imagefirst: "",
        imagesecond: "",
        imagethirder: "",
        imagefoure: "",
        imagefive: "",
        stockQuantity: 8,
        inStock: true,
        featured: true,
        isbestseller: false,
        iscustom: false,
        colour: "",
        discountsOffers: false,
        createdAt: new Date(),
      },
      {
        id: "4",
        name: "Seasonal Surprise",
        description: "Sunflowers and seasonal mix bouquet",
        price: "899.00",
        originalPrice: "899.00",
        discountPercentage: 0,
        discountAmount: "0.00",
        category: "seasonal",
        subcategory: "seasonal",
        image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        imagefirst: "",
        imagesecond: "",
        imagethirder: "",
        imagefoure: "",
        imagefive: "",
        stockQuantity: 20,
        inStock: true,
        featured: true,
        isbestseller: false,
        iscustom: false,
        colour: "",
        discountsOffers: false,
        createdAt: new Date(),
      },
      {
        id: "5",
        name: "Mixed Roses",
        description: "Beautiful mixed variety roses in vibrant colors",
        price: "1599.00",
        originalPrice: "1599.00",
        discountPercentage: 0,
        discountAmount: "0.00",
        category: "roses",
        subcategory: "roses",
        image: "https://images.unsplash.com/photo-1560717845-968823efbee1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        imagefirst: "",
        imagesecond: "",
        imagethirder: "",
        imagefoure: "",
        imagefive: "",
        stockQuantity: 15,
        inStock: true,
        featured: true,
        isbestseller: true,
        iscustom: false,
        colour: "",
        discountsOffers: false,
        createdAt: new Date(),
      },
    ];

    sampleProducts.forEach(product => this.products.set(product.id, product));

    // Initialize courses
    const sampleCourses: Course[] = [
      {
        id: "1",
        title: "Floral Design Basics",
        description: "Perfect for beginners to learn fundamental techniques",
        price: "8999.00",
        duration: "4 weeks",
        sessions: 16,
        features: ["Color theory & composition", "Basic arrangement techniques", "Flower care & preservation", "5 take-home arrangements"],
        popular: false,
        nextBatch: "March 15, 2024",
        createdAt: new Date(),
      },
      {
        id: "2",
        title: "Professional Bouquet Making",
        description: "Advanced techniques for commercial arrangements",
        price: "15999.00",
        duration: "8 weeks",
        sessions: 32,
        features: ["Wedding & event designs", "Business setup guidance", "Advanced wrapping techniques", "10 professional arrangements"],
        popular: true,
        nextBatch: "March 20, 2024",
        createdAt: new Date(),
      },
      {
        id: "3",
        title: "Garden Design & Care",
        description: "Learn indoor & outdoor gardening essentials",
        price: "12999.00",
        duration: "6 weeks",
        sessions: 24,
        features: ["Plant selection & care", "Garden layout design", "Seasonal maintenance", "Indoor plant mastery"],
        popular: false,
        nextBatch: "March 25, 2024",
        createdAt: new Date(),
      },
    ];

    sampleCourses.forEach(course => this.courses.set(course.id, course));

    // Initialize testimonials
    const sampleTestimonials: Testimonial[] = [
      {
        id: "1",
        name: "Priya Sharma",
        location: "Bengaluru",
        rating: 5,
        comment: "Absolutely stunning arrangements! The roses I ordered for my anniversary were fresh and beautifully wrapped. The delivery was prompt and the flowers lasted for over a week.",
        type: "shop",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150",
        createdAt: new Date(),
      },
      {
        id: "2",
        name: "Rajesh Kumar",
        location: "Course Graduate",
        rating: 5,
        comment: "The Professional Bouquet Making course transformed my passion into a career! The instructors are amazing and the hands-on practice sessions were invaluable. Now I run my own floral business.",
        type: "school",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150",
        createdAt: new Date(),
      },
      {
        id: "3",
        name: "Ananya Reddy",
        location: "Bride",
        rating: 5,
        comment: "Bouquet Bar made our wedding absolutely magical! From bridal bouquets to venue decorations, everything was perfect. The team understood our vision and executed it flawlessly.",
        type: "shop",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150",
        createdAt: new Date(),
      },
    ];

    sampleTestimonials.forEach(testimonial => this.testimonials.set(testimonial.id, testimonial));

    // Initialize blog posts
    const sampleBlogPosts: BlogPost[] = [
      {
        id: "1",
        title: "How to Keep Flowers Fresh for Longer",
        excerpt: "Learn professional techniques to extend the life of your beautiful arrangements with these simple care tips.",
        content: "Detailed care instructions...",
        category: "CARE TIPS",
        image: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        publishedAt: new Date("2024-03-10"),
        createdAt: new Date(),
      },
      {
        id: "2",
        title: "Top 10 Floral Design Trends for 2024",
        excerpt: "Discover the latest trends shaping the floral industry this year, from minimalist designs to bold color combinations.",
        content: "Trend analysis content...",
        category: "TRENDS",
        image: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        publishedAt: new Date("2024-03-08"),
        createdAt: new Date(),
      },
      {
        id: "3",
        title: "Wedding Flowers: A Complete Planning Guide",
        excerpt: "Everything you need to know about choosing perfect flowers for your special day, from bouquets to venue decorations.",
        content: "Wedding planning guide content...",
        category: "WEDDING GUIDE",
        image: "https://images.unsplash.com/photo-1606800052052-a08af7148866?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        publishedAt: new Date("2024-03-05"),
        createdAt: new Date(),
      },
    ];

    sampleBlogPosts.forEach(post => this.blogPosts.set(post.id, post));

    // Initialize sample coupons
    const sampleCoupons: Coupon[] = [
      {
        id: "1",
        code: "WELCOME10",
        type: "percentage",
        value: "10.00",
        isActive: true,
        startsAt: new Date("2024-01-01"),
        expiresAt: new Date("2025-12-31"),
        minOrderAmount: "500.00",
        maxDiscount: "200.00",
        usageLimit: 1000,
        timesUsed: 45,
        description: "Welcome discount for new customers",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        code: "FLAT500",
        type: "fixed",
        value: "500.00",
        isActive: true,
        startsAt: new Date("2024-01-01"),
        expiresAt: new Date("2025-12-31"),
        minOrderAmount: "2000.00",
        maxDiscount: null,
        usageLimit: 500,
        timesUsed: 23,
        description: "Flat ₹500 off on orders above ₹2000",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "3",
        code: "VALENTINE25",
        type: "percentage",
        value: "25.00",
        isActive: true,
        startsAt: new Date("2024-02-10"),
        expiresAt: new Date("2024-02-20"),
        minOrderAmount: "1000.00",
        maxDiscount: "1000.00",
        usageLimit: 200,
        timesUsed: 87,
        description: "Valentine's Day special - 25% off",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "4",
        code: "SPRING25",
        type: "percentage",
        value: "25.00",
        isActive: true,
        startsAt: new Date("2025-01-01"),
        expiresAt: new Date("2025-12-31"),
        minOrderAmount: "800.00",
        maxDiscount: "500.00",
        usageLimit: 300,
        timesUsed: 12,
        description: "Spring season special - 25% off",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "5",
        code: "EXPIRED",
        type: "percentage",
        value: "50.00",
        isActive: true,
        startsAt: new Date("2023-01-01"),
        expiresAt: new Date("2023-12-31"),
        minOrderAmount: "100.00",
        maxDiscount: null,
        usageLimit: 100,
        timesUsed: 100,
        description: "Expired test coupon",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    sampleCoupons.forEach(coupon => this.coupons.set(coupon.id, coupon));

    // Initialize delivery options
    const sampleDeliveryOptions: DeliveryOption[] = [
      {
        id: "1",
        name: "Standard Delivery",
        description: "Free delivery within 3-5 business days",
        estimatedDays: "3-5 business days",
        price: "0.00",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
      },
      {
        id: "2",
        name: "Express Delivery",
        description: "Fast delivery within 1-2 business days",
        estimatedDays: "1-2 business days",
        price: "99.00",
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
      },
      {
        id: "3",
        name: "Same Day Delivery",
        description: "Get your flowers delivered the same day (within city limits)",
        estimatedDays: "Same day",
        price: "199.00",
        isActive: true,
        sortOrder: 3,
        createdAt: new Date(),
      },
    ];

    sampleDeliveryOptions.forEach(option => this.deliveryOptions.set(option.id, option));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: username field no longer exists, this method kept for interface compatibility
    return undefined;
  }

  async getUserByEmail(email: string,password: string): Promise<User | undefined> {
    console.log('Searching for user by email:', email);
    return Array.from(this.users.values()).find(user => user.email === email && user.password === password);
  }

  async getUserByEmailOnly(email: string): Promise<User | undefined> {
    console.log('Searching for user by email only:', email);
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.phone === phone);
  }

  async passwordExists(password: string): Promise<boolean> {
    if (!password) return false;
    return Array.from(this.users.values()).some(user => user.password === password);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserProfile(id: string, profile: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = { ...user, ...profile, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error("User not found");
    }
    this.users.delete(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      id, 
      email: insertUser.email as string,
      password: insertUser.password as string,
      firstName: (insertUser.firstName as string) ?? "",
      lastName: (insertUser.lastName as string) ?? "",
      phone: (insertUser.phone as string) ?? "",
      userType: "",
      profileImageUrl: "",
      defaultAddress: "",
      deliveryAddress: "",
      country: "",
      state: "",
      points: 0,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getFeaturedProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => product.featured);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    if (category === "all") return this.getAllProducts();
    return Array.from(this.products.values()).filter(product => product.category === category);
  }

  async getProductsByCategoryAndSubcategory(category: string, subcategory?: string, searchKeyword?: string): Promise<Product[]> {
    let results = Array.from(this.products.values());

    // If we have a subcategory, prioritize filtering by subcategory
    // This handles cases like clicking "Mixed Flowers" which should find products with category "Roses, Mixed Flowers"
    if (subcategory) {
      results = results.filter(product => {
        const subcategoryLower = subcategory.toLowerCase();
        const productCategoryLower = product.category.toLowerCase();
        
        // Check if subcategory matches exactly or is contained in comma-separated categories
        return product.name.toLowerCase().includes(subcategoryLower) ||
               product.description.toLowerCase().includes(subcategoryLower) ||
               productCategoryLower === subcategoryLower ||
               productCategoryLower.includes(subcategoryLower) ||
               productCategoryLower.split(',').some(cat => cat.trim() === subcategoryLower);
      });
    } else if (category && category !== "all") {
      // Only filter by main category if no subcategory is provided
      results = results.filter(product => {
        const categoryLower = category.toLowerCase();
        const productCategoryLower = product.category.toLowerCase();
        
        return productCategoryLower.includes(categoryLower) ||
               productCategoryLower.split(',').some(cat => cat.trim().includes(categoryLower));
      });
    }

    // Filter by search keyword if provided
    if (searchKeyword) {
      results = results.filter(product => 
        product.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        product.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        product.category.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    return results;
  }

  async getProductsByMainCategory(mainCategory: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => 
      (product as any).main_category === mainCategory
    );
  }

  async getProductsBySubcategory(subcategory: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => 
      (product as any).subcategory === subcategory
    );
  }

  async getProductsByNameSearch(searchTerm: string): Promise<Product[]> {
    const searchLower = searchTerm.toLowerCase();
    return Array.from(this.products.values()).filter(product => 
      product.name.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower) ||
      (product as any).subcategory?.toLowerCase().includes(searchLower) ||
      (product as any).main_category?.toLowerCase().includes(searchLower)
    );
  }

  async getProductsByMainCategoryAndSubcategory(mainCategory: string, subcategory: string): Promise<Product[]> {
    const mainCategoryLower = mainCategory.toLowerCase();
    const subcategoryLower = subcategory.toLowerCase();
    return Array.from(this.products.values()).filter(product => {
      const productMainCategory = (product as any).main_category;
      const productSubcategory = (product as any).subcategory;
      
      // Handle both string and array formats
      const matchesMainCategory = Array.isArray(productMainCategory) 
        ? productMainCategory.some(cat => cat.toLowerCase().includes(mainCategoryLower))
        : productMainCategory?.toLowerCase().includes(mainCategoryLower);
        
      const matchesSubcategory = Array.isArray(productSubcategory)
        ? productSubcategory.some(cat => cat.toLowerCase().includes(subcategoryLower))
        : productSubcategory?.toLowerCase().includes(subcategoryLower);
        
      return matchesMainCategory && matchesSubcategory;
    });
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    // Normalize pricing: compute discountAmount and final price if discountPercentage provided
    const parsedPrice = insertProduct.price ? Number(insertProduct.price) : 0;
    const parsedOriginal = insertProduct.originalPrice ? Number(insertProduct.originalPrice) : parsedPrice;
    const parsedPct = typeof insertProduct.discountPercentage === 'number' ? insertProduct.discountPercentage : 0;
    const discountAmountNum = +(parsedOriginal * (parsedPct / 100));
    const finalPriceNum = +(parsedOriginal - discountAmountNum);

    const product: Product = { 
      id, 
      name: insertProduct.name as string,
      description: insertProduct.description as string,
      price: finalPriceNum.toFixed(2),
      // Provide sensible defaults for optional/DB fields so Product matches the inferred schema
      originalPrice: parsedOriginal.toFixed(2),
      discountPercentage: parsedPct ?? 0,
      discountAmount: discountAmountNum.toFixed(2),
      category: insertProduct.category as string,
      subcategory: (insertProduct as any).subcategory as string ?? insertProduct.category as string,
      image: insertProduct.image as string,
      imagefirst: (insertProduct.imagefirst as string) ?? insertProduct.image as string,
      imagesecond: (insertProduct.imagesecond as string) ?? "",
      imagethirder: (insertProduct.imagethirder as string) ?? "",
      imagefoure: (insertProduct.imagefoure as string) ?? "",
      imagefive: (insertProduct.imagefive as string) ?? "",
      stockQuantity: (insertProduct.stockQuantity as number) ?? 0,
      inStock: (insertProduct.inStock as boolean) ?? true,
      featured: (insertProduct.featured as boolean) ?? false,
      isbestseller: (insertProduct.isbestseller as boolean) ?? false,
      iscustom: (insertProduct.iscustom as boolean) ?? false,
      colour: (insertProduct.colour as string) ?? "",
      discountsOffers: (insertProduct.discountsOffers as boolean) ?? false,
      createdAt: new Date()
    };
    this.products.set(id, product);
    return product;
  }

  // Inventory Management
  async updateProductStock(productId: string, quantityChange: number): Promise<Product> {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const newStockQuantity = product.stockQuantity + quantityChange;
    
    // For stock decrements, check availability first
    if (quantityChange < 0 && product.stockQuantity < Math.abs(quantityChange)) {
      throw new Error(`Insufficient stock for ${product.name}. Required: ${Math.abs(quantityChange)}, Available: ${product.stockQuantity}`);
    }

    const updatedProduct: Product = {
      ...product,
      stockQuantity: newStockQuantity,
      inStock: newStockQuantity > 0
    };

    this.products.set(productId, updatedProduct);
    return updatedProduct;
  }

  async checkProductAvailability(productId: string, requiredQuantity: number): Promise<{ available: boolean; currentStock: number }> {
    const product = this.products.get(productId);
    if (!product) {
      return { available: false, currentStock: 0 };
    }
    return {
      available: product.stockQuantity >= requiredQuantity,
      currentStock: product.stockQuantity
    };
  }

  async validateStockAvailability(items: Array<{ productId: string; quantity: number }>): Promise<{
    isValid: boolean;
    errors?: string[];
    stockValidation?: Array<{ productId: string; productName: string; requiredQuantity: number; availableStock: number; sufficient: boolean }>;
  }> {
    const errors: string[] = [];
    const stockValidation: Array<{ productId: string; productName: string; requiredQuantity: number; availableStock: number; sufficient: boolean }> = [];

    for (const item of items) {
      const product = this.products.get(item.productId);
      
      if (!product) {
        errors.push(`Product ${item.productId} not found`);
        continue;
      }

      const sufficient = product.stockQuantity >= item.quantity;
      stockValidation.push({
        productId: item.productId,
        productName: product.name,
        requiredQuantity: item.quantity,
        availableStock: product.stockQuantity,
        sufficient
      });

      if (!sufficient) {
        errors.push(`Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.stockQuantity}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      stockValidation
    };
  }

  async decrementProductsStock(items: Array<{ productId: string; quantity: number }>): Promise<void> {
    // In MemStorage, we validate all items first to ensure atomicity
    for (const item of items) {
      const product = this.products.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.stockQuantity}`);
      }
    }

    // If all validations pass, apply all decrements
    for (const item of items) {
      await this.updateProductStock(item.productId, -item.quantity);
    }
  }

  async getAllCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = { 
      id, 
      title: insertCourse.title as string,
      description: insertCourse.description as string,
      price: insertCourse.price as string,
      duration: insertCourse.duration as string,
      sessions: insertCourse.sessions as number,
      features: insertCourse.features,
      popular: (insertCourse.popular as boolean) ?? false,
      nextBatch: (insertCourse.nextBatch as string) ?? "",
      createdAt: new Date()
    };
    this.courses.set(id, course);
    return course;
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(order => order.orderNumber === orderNumber);
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const orderNumber = await this.generateOrderNumber();
    const now = new Date();
    const order: Order = { 
      id,
      orderNumber,
      status: "pending", 
      statusUpdatedAt: now,
      pointsAwarded: false,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
      userId: insertOrder.userId ?? "",
      customerName: insertOrder.customerName as string,
      email: insertOrder.email as string,
      phone: insertOrder.phone as string,
      occasion: insertOrder.occasion ?? "",
      requirements: insertOrder.requirements ?? "",
      items: insertOrder.items,
      subtotal: insertOrder.subtotal as string,
      paymentMethod: insertOrder.paymentMethod as string,
      total: insertOrder.total as string,
      deliveryAddress: insertOrder.deliveryAddress ?? "",
      deliveryDate: insertOrder.deliveryDate ? new Date(insertOrder.deliveryDate as string | number | Date) : null,
      estimatedDeliveryDate: insertOrder.estimatedDeliveryDate ? new Date(insertOrder.estimatedDeliveryDate as string | number | Date) : null,
      paymentTransactionId: insertOrder.paymentTransactionId ?? null,
      couponCode: insertOrder.couponCode ?? null,
      shippingAddressId: insertOrder.shippingAddressId ?? null,
      deliveryOptionId: insertOrder.deliveryOptionId ?? null,
      deliveryCharge: (insertOrder.deliveryCharge as string) ?? "0.00",
      discountAmount: (insertOrder.discountAmount as string) ?? "0.00",
      paymentCharges: (insertOrder.paymentCharges as string) ?? "0.00"
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error("Order not found");
    }
    const updatedOrder = { ...order, status, updatedAt: new Date() };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async updateOrderPaymentStatus(id: string, paymentStatus: string, transactionId?: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error("Order not found");
    }
    const updatedOrder = { 
      ...order, 
      paymentStatus, 
      paymentTransactionId: transactionId || order.paymentTransactionId,
      updatedAt: new Date() 
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const existingOrders = Array.from(this.orders.values());
    const todaysOrders = existingOrders.filter(order => {
      const orderDate = new Date(order.createdAt!);
      return orderDate.toDateString() === now.toDateString();
    });
    const nextNumber = String(todaysOrders.length + 1).padStart(4, '0');
    return `ORD-${year}${month}-${nextNumber}`;
  }

  async validateCartItems(items: Array<{ productId: string; quantity: number; unitPrice: number }>): Promise<{
    isValid: boolean;
    errors?: string[];
    validatedItems?: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
  }> {
    const errors: string[] = [];
    const validatedItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

    for (const item of items) {
      const product = this.products.get(item.productId);
      if (!product) {
        errors.push(`Product with ID ${item.productId} not found`);
        continue;
      }

      if (!product.inStock) {
        errors.push(`Product ${product.name} is out of stock`);
        continue;
      }

      const currentPrice = parseFloat(product.price);
      if (Math.abs(currentPrice - item.unitPrice) > 0.01) {
        errors.push(`Price mismatch for ${product.name}. Current price: ${currentPrice}, provided: ${item.unitPrice}`);
        continue;
      }

      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for ${product.name}`);
        continue;
      }

      validatedItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      validatedItems: errors.length === 0 ? validatedItems : undefined
    };
  }

  async calculateOrderPricing(subtotal: number, deliveryOptionId: string, couponCode?: string, paymentMethod?: string): Promise<{
    deliveryCharge: number;
    discountAmount: number;
    paymentCharges: number;
    total: number;
  }> {
    // Get delivery charge
    const deliveryOption = this.deliveryOptions.get(deliveryOptionId);
    const deliveryCharge = deliveryOption ? parseFloat(deliveryOption.price) : 0;

    // Calculate discount
    let discountAmount = 0;
    if (couponCode) {
      const coupon = Array.from(this.coupons.values()).find(c => c.code === couponCode && c.isActive);
      if (coupon) {
        if (coupon.type === "percentage") {
          discountAmount = (subtotal * parseFloat(coupon.value)) / 100;
          if (coupon.maxDiscount) {
            discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
          }
        } else if (coupon.type === "fixed") {
          discountAmount = parseFloat(coupon.value);
        }
      }
    }

    // Calculate payment charges
    let paymentCharges = 0;
    if (paymentMethod === "Card" || paymentMethod === "Online" || paymentMethod === "UPI") {
      paymentCharges = Math.max((subtotal + deliveryCharge - discountAmount) * 0.02, 5); // 2% or minimum ₹5
    }

    const total = subtotal + deliveryCharge - discountAmount + paymentCharges;

    return {
      deliveryCharge,
      discountAmount,
      paymentCharges,
      total
    };
  }

  async validateAndProcessOrder(orderData: OrderPlacement): Promise<{
    isValid: boolean;
    errors?: string[];
    validatedOrder?: InsertOrder;
    calculatedPricing?: {
      subtotal: number;
      deliveryCharge: number;
      discountAmount: number;
      paymentCharges: number;
      total: number;
    };
  }> {
    const errors: string[] = [];

    // Validate cart items
    const cartItems = orderData.items.map(item => ({
      productId: item.productId as string,
      quantity: item.quantity as number,
      unitPrice: item.unitPrice as number
    }));
    const cartValidation = await this.validateCartItems(cartItems);
    if (!cartValidation.isValid) {
      errors.push(...(cartValidation.errors || []));
    }

    // Validate delivery option
    const deliveryOption = this.deliveryOptions.get(orderData.deliveryOptionId);
    if (!deliveryOption) {
      errors.push("Invalid delivery option");
    }

    // Validate address if user is authenticated
    if (orderData.userId && orderData.shippingAddressId) {
      const address = this.addresses.get(orderData.shippingAddressId);
      if (!address || address.userId !== orderData.userId) {
        errors.push("Invalid shipping address");
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Calculate server-side pricing
    const calculatedPricing = await this.calculateOrderPricing(
      orderData.subtotal,
      orderData.deliveryOptionId,
      orderData.couponCode,
      orderData.paymentMethod
    );

    // Debug logging for pricing validation
    console.log("[ORDER VALIDATION] Pricing comparison:");
    console.log("- Subtotal:", orderData.subtotal, "vs calculated:", orderData.subtotal);
    console.log("- Delivery charge:", orderData.deliveryCharge, "vs calculated:", calculatedPricing.deliveryCharge);
    console.log("- Discount amount:", orderData.discountAmount, "vs calculated:", calculatedPricing.discountAmount);
    console.log("- Payment charges:", orderData.paymentCharges || 0, "vs calculated:", calculatedPricing.paymentCharges);
    console.log("- Total:", orderData.total, "vs calculated:", calculatedPricing.total);
    console.log("- Payment method:", orderData.paymentMethod);

    // Validate pricing
    const pricingTolerance = 0.01;
    if (Math.abs(calculatedPricing.deliveryCharge - orderData.deliveryCharge) > pricingTolerance) {
      errors.push("Delivery charge mismatch");
    }
    if (Math.abs(calculatedPricing.discountAmount - orderData.discountAmount) > pricingTolerance) {
      errors.push("Discount amount mismatch");
    }
    if (Math.abs(calculatedPricing.total - orderData.total) > pricingTolerance) {
      errors.push("Total amount mismatch");
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Create validated order object
    const validatedOrder: InsertOrder = {
      userId: orderData.userId,
      customerName: orderData.customerName,
      email: orderData.email,
      phone: orderData.phone,
      occasion: orderData.occasion,
      requirements: orderData.requirements,
      items: cartValidation.validatedItems!,
      subtotal: orderData.subtotal.toString(),
      deliveryOptionId: orderData.deliveryOptionId,
      deliveryCharge: calculatedPricing.deliveryCharge.toString(),
      couponCode: orderData.couponCode,
      discountAmount: calculatedPricing.discountAmount.toString(),
      paymentMethod: orderData.paymentMethod,
      paymentCharges: calculatedPricing.paymentCharges.toString(),
      total: calculatedPricing.total.toString(),
      shippingAddressId: orderData.shippingAddressId,
      deliveryAddress: orderData.deliveryAddress,
      deliveryDate: orderData.deliveryDate ? new Date(orderData.deliveryDate) : undefined,
      estimatedDeliveryDate: deliveryOption ? 
        new Date(Date.now() + parseInt(deliveryOption.estimatedDays.split('-')[0]) * 24 * 60 * 60 * 1000) : 
        undefined
    };

    return {
      isValid: true,
      validatedOrder,
      calculatedPricing: {
        subtotal: orderData.subtotal,
        ...calculatedPricing
      }
    };
  }

  async getAllEnrollments(): Promise<Enrollment[]> {
    return Array.from(this.enrollments.values());
  }

  async getEnrollment(id: string): Promise<Enrollment | undefined> {
    return this.enrollments.get(id);
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    // Validate the course exists first
    const course = await this.getCourse(insertEnrollment.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const id = randomUUID();
    const now = new Date();
    
    const enrollment: Enrollment = { 
      ...insertEnrollment, 
      id,
      status: "pending",
      fullName: insertEnrollment.fullName,
      email: insertEnrollment.email,
      phone: insertEnrollment.phone,
      courseId: insertEnrollment.courseId,
      batch: insertEnrollment.batch ?? null,
      questions: insertEnrollment.questions ?? null,
      createdAt: now
    };
    
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  async getAllTestimonials(): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values());
  }

  async getTestimonialsByType(type: string): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values()).filter(testimonial => testimonial.type === type);
  }

  async createTestimonial(insertTestimonial: InsertTestimonial): Promise<Testimonial> {
    const id = randomUUID();
    const testimonial: Testimonial = { 
      id, 
      name: insertTestimonial.name as string,
      location: insertTestimonial.location as string,
      rating: insertTestimonial.rating as number,
      comment: insertTestimonial.comment as string,
      type: insertTestimonial.type as string,
      image: (insertTestimonial.image as string) ?? "",
      createdAt: new Date()
    };
    this.testimonials.set(id, testimonial);
    return testimonial;
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return Array.from(this.blogPosts.values()).sort((a, b) => 
      new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
    );
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    return this.blogPosts.get(id);
  }

  async createBlogPost(insertBlogPost: InsertBlogPost): Promise<BlogPost> {
    const id = randomUUID();
    const post: BlogPost = { 
      id, 
      title: insertBlogPost.title as string,
      excerpt: insertBlogPost.excerpt as string,
      content: insertBlogPost.content as string,
      category: insertBlogPost.category as string,
      image: insertBlogPost.image as string,
      publishedAt: new Date(), 
      createdAt: new Date() 
    };
    this.blogPosts.set(id, post);
    return post;
  }

  // Cart Operations (MemStorage implementation - not used in production)
  async getUserCart(userId: string): Promise<(Cart & { product: Product })[]> {
    const userCarts: (Cart & { product: Product })[] = [];
    
    for (const cart of this.carts.values()) {
      if (cart.userId === userId) {
        const product = this.products.get(cart.productId);
        if (product) {
          userCarts.push({ ...cart, product });
        }
      }
    }
    
    return userCarts;
  }

  async addToCart(userId: string, productId: string, quantity: number): Promise<Cart> {
    // Check if item already exists in cart
    let existingCartKey = null;
    for (const [key, cart] of this.carts.entries()) {
      if (cart.userId === userId && cart.productId === productId) {
        existingCartKey = key;
        break;
      }
    }
    
    if (existingCartKey) {
      // Update quantity if item exists
      const existingCart = this.carts.get(existingCartKey)!;
      const updatedCart = {
        ...existingCart,
        quantity: existingCart.quantity + quantity,
        updatedAt: new Date()
      };
      this.carts.set(existingCartKey, updatedCart);
      return updatedCart;
    } else {
      // Add new item to cart
      const id = randomUUID();
      const newCart: Cart = {
        id,
        userId,
        productId,
        quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.carts.set(id, newCart);
      return newCart;
    }
  }

  async updateCartItemQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
    for (const [key, cart] of this.carts.entries()) {
      if (cart.userId === userId && cart.productId === productId) {
        const updatedCart = {
          ...cart,
          quantity,
          updatedAt: new Date()
        };
        this.carts.set(key, updatedCart);
        return updatedCart;
      }
    }
    throw new Error(`Cart item not found for user ${userId} and product ${productId}`);
  }

  async removeFromCart(userId: string, productId: string): Promise<void> {
    for (const [key, cart] of this.carts.entries()) {
      if (cart.userId === userId && cart.productId === productId) {
        this.carts.delete(key);
        return;
      }
    }
  }

  async clearUserCart(userId: string): Promise<void> {
    const keysToDelete: string[] = [];
    for (const [key, cart] of this.carts.entries()) {
      if (cart.userId === userId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.carts.delete(key));
  }

  // Additional Orders methods - implementation provided below in main methods section

  // Favorites methods (MemStorage implementation - minimal for development)
  // Note: favorites Map is already declared at the top of the class

  async getUserFavorites(userId: string): Promise<(Favorite & { product: Product })[]> {
    const userFavorites = Array.from(this.favorites.values()).filter(fav => fav.userId === userId);
    const result: (Favorite & { product: Product })[] = [];
    
    for (const favorite of userFavorites) {
      const product = await this.getProduct(favorite.productId);
      if (product) {
        result.push({ ...favorite, product });
      }
    }
    
    return result;
  }

  async addToFavorites(userId: string, productId: string): Promise<Favorite> {
    const id = randomUUID();
    const favorite: Favorite = {
      id,
      userId,
      productId,
      createdAt: new Date(),
    };
    this.favorites.set(id, favorite);
    return favorite;
  }

  async removeFromFavorites(userId: string, productId: string): Promise<void> {
    const favoriteEntries = Array.from(this.favorites.entries());
    for (const [id, favorite] of favoriteEntries) {
      if (favorite.userId === userId && favorite.productId === productId) {
        this.favorites.delete(id);
        break;
      }
    }
  }

  async isProductFavorited(userId: string, productId: string): Promise<boolean> {
    return Array.from(this.favorites.values()).some(
      fav => fav.userId === userId && fav.productId === productId
    );
  }

  // Coupon Operations
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    return Array.from(this.coupons.values()).find(coupon => coupon.code === code.toUpperCase());
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return Array.from(this.coupons.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async createCoupon(insertCoupon: InsertCoupon): Promise<Coupon> {
    const id = randomUUID();
    const coupon: Coupon = {
      id,
      code: (insertCoupon.code as string).toUpperCase(),
      type: insertCoupon.type as string,
      value: insertCoupon.value as string,
      timesUsed: 0,
      startsAt: (insertCoupon.startsAt as Date) ?? new Date(),
      expiresAt: (insertCoupon.expiresAt as Date) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      minOrderAmount: (insertCoupon.minOrderAmount as string) ?? "0",
      maxDiscount: (insertCoupon.maxDiscount as string) ?? "",
      usageLimit: (insertCoupon.usageLimit as number) ?? 1000,
      description: (insertCoupon.description as string) ?? "",
      isActive: (insertCoupon.isActive as boolean) ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.coupons.set(id, coupon);
    return coupon;
  }

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise<Coupon> {
    const coupon = this.coupons.get(id);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    const updatedCoupon = { ...coupon, ...updates, updatedAt: new Date() };
    this.coupons.set(id, updatedCoupon);
    return updatedCoupon;
  }

  async incrementCouponUsage(code: string): Promise<Coupon> {
    const coupon = await this.getCouponByCode(code);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    const updatedCoupon = {
      ...coupon,
      timesUsed: (coupon.timesUsed ?? 0) + 1,
      updatedAt: new Date(),
    };
    this.coupons.set(coupon.id, updatedCoupon);
    return updatedCoupon;
  }

  async deleteCoupon(id: string): Promise<void> {
    const coupon = this.coupons.get(id);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    this.coupons.delete(id);
  }

  // Address Management Methods
  async getUserAddresses(userId: string): Promise<Address[]> {
    return Array.from(this.addresses.values())
      .filter(address => address.userId === userId)
      .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)); // Default address first
  }

  async getAddress(id: string): Promise<Address | undefined> {
    return this.addresses.get(id);
  }

  async createAddress(address: InsertAddress): Promise<Address> {
    const newAddress: Address = {
      id: randomUUID(),
      userId: address.userId as string,
      fullName: address.fullName as string,
      email: (address.email as string) ?? "",
      phone: address.phone as string,
      addressLine1: address.addressLine1 as string,
      addressLine2: (address.addressLine2 as string) ?? "",
      city: address.city as string,
      state: address.state as string,
      postalCode: address.postalCode as string,
      country: (address.country as string) ?? "",
      addressType: (address.addressType as string) ?? "home",
      landmark: (address.landmark as string) ?? "",
      isDefault: (address.isDefault as boolean) ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // If this is marked as default, remove default from other addresses
    if (newAddress.isDefault) {
      await this.setDefaultAddress(address.userId, newAddress.id);
    }
    
    this.addresses.set(newAddress.id, newAddress);
    return newAddress;
  }

  async updateAddress(id: string, updates: Partial<Address>): Promise<Address> {
    const existingAddress = this.addresses.get(id);
    if (!existingAddress) {
      throw new Error("Address not found");
    }

    const updatedAddress: Address = {
      ...existingAddress,
      ...updates,
      updatedAt: new Date(),
    };

    // If this is being set as default, remove default from other addresses
    if (updates.isDefault && existingAddress.userId) {
      await this.setDefaultAddress(existingAddress.userId, id);
    }

    this.addresses.set(id, updatedAddress);
    return updatedAddress;
  }

  async deleteAddress(id: string): Promise<void> {
    const address = this.addresses.get(id);
    if (!address) {
      throw new Error("Address not found");
    }
    this.addresses.delete(id);
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    // Remove default from all user's addresses
    for (const [id, address] of this.addresses.entries()) {
      if (address.userId === userId && address.isDefault) {
        const updated = { ...address, isDefault: false, updatedAt: new Date() };
        this.addresses.set(id, updated);
      }
    }

    // Set the new default address
    const targetAddress = this.addresses.get(addressId);
    if (targetAddress && targetAddress.userId === userId) {
      const updated = { ...targetAddress, isDefault: true, updatedAt: new Date() };
      this.addresses.set(addressId, updated);
    }
  }

  // Delivery Options Methods
  async getAllDeliveryOptions(): Promise<DeliveryOption[]> {
    return Array.from(this.deliveryOptions.values())
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getActiveDeliveryOptions(): Promise<DeliveryOption[]> {
    return Array.from(this.deliveryOptions.values())
      .filter(option => option.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getDeliveryOption(id: string): Promise<DeliveryOption | undefined> {
    return this.deliveryOptions.get(id);
  }

  async createDeliveryOption(deliveryOption: InsertDeliveryOption): Promise<DeliveryOption> {
    const newDeliveryOption: DeliveryOption = {
      id: randomUUID(),
      name: deliveryOption.name as string,
      description: deliveryOption.description as string,
      estimatedDays: deliveryOption.estimatedDays as string,
      price: (deliveryOption.price as string) ?? "0.00",
      isActive: (deliveryOption.isActive as boolean) ?? true,
      sortOrder: (deliveryOption.sortOrder as number) ?? 0,
      createdAt: new Date(),
    };
    
    this.deliveryOptions.set(newDeliveryOption.id, newDeliveryOption);
    return newDeliveryOption;
  }

  // Transactional order processing methods (MemStorage - simplified implementation)
  async createOrderWithTransaction(
    validatedOrder: InsertOrder, 
    couponCode?: string, 
    userId?: string
  ): Promise<Order> {
    try {
      // 1. Create the order with proper stock decrement
      const orderItems = validatedOrder.items as Array<{ productId: string; quantity: number }>;
      
      // 2. Decrement product stock atomically
      await this.decrementProductsStock(orderItems);
      
      // 3. Create the order after successful stock decrement
      const createdOrder = await this.createOrder(validatedOrder);

      // 4. Increment coupon usage if coupon was applied
      if (couponCode) {
        await this.incrementCouponUsage(couponCode);
      }

      // 5. Clear user cart if this was an authenticated user
      if (userId) {
        await this.clearUserCart(userId);
      }

      return createdOrder;
    } catch (error) {
      console.error("[MEMSTORAGE TRANSACTION ERROR] Order creation failed:", error);
      // In a real system, this would roll back all changes
      // For MemStorage, we rely on the atomic stock validation
      throw error;
    }
  }

  async processOrderPlacement(orderData: OrderPlacement, userId?: string): Promise<{
    isValid: boolean;
    errors?: string[];
    order?: Order;
    calculatedPricing?: {
      subtotal: number;
      deliveryCharge: number;
      discountAmount: number;
      paymentCharges: number;
      total: number;
    };
  }> {
    try {
      // First validate the order
      const validation = await this.validateAndProcessOrder(orderData);
      if (!validation.isValid) {
        return {
          isValid: false,
          errors: validation.errors
        };
      }

      // If validation passes, create order with transaction
      // Override the userId in validatedOrder with the authenticated user's ID
      const validatedOrderWithUserId = {
        ...validation.validatedOrder!,
        userId: userId || null
      };
      
      const createdOrder = await this.createOrderWithTransaction(
        validatedOrderWithUserId,
        orderData.couponCode,
        userId
      );

      return {
        isValid: true,
        order: createdOrder,
        calculatedPricing: validation.calculatedPricing
      };
    } catch (error) {
      console.error("[MEMSTORAGE ORDER PROCESSING ERROR]:", error);
      return {
        isValid: false,
        errors: ["Failed to process order placement"]
      };
    }
  }

  // Order cancellation and tracking methods
  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (order.userId !== userId) {
      throw new Error("Unauthorized to cancel this order");
    }
    if (!order.status || !["pending", "confirmed", "processing"].includes(order.status)) {
      throw new Error("Order cannot be cancelled in current status");
    }

    // Update order status
    const updatedOrder: Order = {
      ...order,
      status: "cancelled",
      statusUpdatedAt: new Date(),
      updatedAt: new Date()
    };
    this.orders.set(orderId, updatedOrder);

    // Add status history entry
    await this.addOrderStatusHistory(orderId, "cancelled", "Order cancelled by customer");

    // TODO: Restore product stock (will be implemented when needed)
    
    return updatedOrder;
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    // For MemStorage (development), return empty array
    // This will be properly implemented in DatabaseStorage
    return [];
  }

  async addOrderStatusHistory(orderId: string, status: string, note?: string): Promise<void> {
    // For MemStorage (development), this is a no-op
    // This will be properly implemented in DatabaseStorage
    console.log(`[ORDER STATUS] ${orderId}: ${status} - ${note || ''}`);
  }

  async awardUserPoints(userId: string, points: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser: User = {
      ...user,
      points: (user.points || 0) + points,
      updatedAt: new Date()
    };
    this.users.set(userId, updatedUser);
    console.log(`[POINTS] Awarded ${points} points to user ${userId}. Total: ${updatedUser.points}`);
  }

  async listAdvancableOrders(cutoffDate: Date, statuses: string[]): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => 
      order.status && statuses.includes(order.status) && 
      order.statusUpdatedAt && 
      order.statusUpdatedAt <= cutoffDate
    );
  }

  async advanceOrderStatus(orderId: string, nextStatus: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const now = new Date();
    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
      statusUpdatedAt: now,
      updatedAt: now
    };

    // Award points when order reaches processing status
    if (nextStatus === "processing" && !order.pointsAwarded && order.userId) {
      await this.awardUserPoints(order.userId, 50);
      updatedOrder.pointsAwarded = true;
    }

    this.orders.set(orderId, updatedOrder);
    await this.addOrderStatusHistory(orderId, nextStatus, "Status automatically updated");
    
    return updatedOrder;
  }

  async updateOrderAddress(orderId: string, deliveryAddress: string, deliveryPhone?: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const updatedOrder: Order = {
      ...order,
      deliveryAddress,
      phone: deliveryPhone || order.phone,
      updatedAt: new Date()
    };

    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }
}

// DatabaseStorage is already imported at the top
export const storage = new DatabaseStorage();

// If using MemStorage for tests/dev, implement the impact methods
/*
  MemStorage implementations (if MemStorage is used) should include:
    async getImpacts(): Promise<any[]>;
    async createImpact(impact: { title: string; value: string }): Promise<any>;
    async deleteImpact(id: string): Promise<void>;
*/

