import { randomUUID } from "crypto";
import { DatabaseStorage } from "./database-storage.js";
export class MemStorage {
    constructor() {
        this.users = new Map();
        this.products = new Map();
        this.courses = new Map();
        this.orders = new Map();
        this.enrollments = new Map();
        this.testimonials = new Map();
        this.blogPosts = new Map();
        this.coupons = new Map();
        this.addresses = new Map();
        this.deliveryOptions = new Map();
        this.carts = new Map();
        this.favorites = new Map();
        this.impacts = new Map();
        // Simple in-memory storage for landing contacts (dev/test)
        this.landingContacts = [];
        // In-memory event pricing
        this.eventPricing = {
            weekdays_morning: { label: 'Weekdays 10:00 AM – 3:00 PM', price: '25000' },
            weekdays_evening: { label: 'Weekdays 5:00 PM – 11:00 PM', price: '30000' },
            weekends_morning: { label: 'Weekends 10:00 AM – 3:00 PM', price: '30000' },
            weekends_evening: { label: 'Weekends 5:00 PM – 12:00 AM', price: '35000' }
        };
        this.initializeData();
    }
    // Impact methods for in-memory storage (useful for dev/test without DB)
    async getImpacts() {
        return Array.from(this.impacts.values()).map(i => ({ id: i.id, title: i.title, value: i.value, created_at: i.createdAt.toISOString() }));
    }
    async createImpact(impact) {
        const id = randomUUID();
        const now = new Date();
        const item = { id, title: impact.title, value: impact.value, createdAt: now };
        this.impacts.set(id, item);
        return { id, title: item.title, value: item.value, created_at: now.toISOString() };
    }
    async addLandingContact(contact) {
        const id = randomUUID();
        const now = new Date();
        const record = { id, name: contact.name, email: contact.email, phone: contact.phone, city: contact.city, address: contact.address, createdAt: now };
        this.landingContacts.push(record);
        return { success: true, contact: { ...record, created_at: now.toISOString() } };
    }
    async getAllLandingContacts() {
        // Return a shallow copy with ISO string dates to match DB shape
        return this.landingContacts.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, created_at: r.createdAt.toISOString() }));
    }
    async getEventPricing() {
        return this.eventPricing;
    }
    async updateEventPricing(pricing) {
        this.eventPricing = { ...this.eventPricing, ...pricing };
        return this.eventPricing;
    }
    async updateImpact(id, impact) {
        const existing = this.impacts.get(id);
        if (!existing)
            throw new Error('Impact not found');
        const updated = { ...existing, title: impact.title, value: impact.value };
        this.impacts.set(id, updated);
        return { id: updated.id, title: updated.title, value: updated.value, created_at: updated.createdAt.toISOString() };
    }
    async deleteImpact(id) {
        this.impacts.delete(id);
    }
    initializeData() {
        // Initialize products
        const sampleProducts = [
            {
                id: "1",
                name: "Premium Red Roses",
                description: "12 fresh red roses with premium wrapping",
                price: "1299.00",
                originalPrice: "1299.00",
                discountPercentage: 0,
                discountAmount: "0.00",
                category: "roses",
                image: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                imagefirst: "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
                imagesecond: "",
                imagethirder: "",
                imagefoure: "",
                imagefive: "",
                stockQuantity: 25,
                inStock: true,
                featured: true,
                isBestSeller: false,
                isCustom: false,
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
                image: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                imagefirst: "",
                imagesecond: "",
                imagethirder: "",
                imagefoure: "",
                imagefive: "",
                stockQuantity: 15,
                inStock: true,
                featured: true,
                isBestSeller: false,
                isCustom: false,
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
                image: "https://images.unsplash.com/photo-1606800052052-a08af7148866?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                imagefirst: "",
                imagesecond: "",
                imagethirder: "",
                imagefoure: "",
                imagefive: "",
                stockQuantity: 8,
                inStock: true,
                featured: true,
                isBestSeller: false,
                isCustom: false,
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
                image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                imagefirst: "",
                imagesecond: "",
                imagethirder: "",
                imagefoure: "",
                imagefive: "",
                stockQuantity: 20,
                inStock: true,
                featured: true,
                isBestSeller: false,
                isCustom: false,
                colour: "",
                discountsOffers: false,
                createdAt: new Date(),
            },
        ];
        sampleProducts.forEach(product => this.products.set(product.id, product));
        // Initialize courses
        const sampleCourses = [
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
        const sampleTestimonials = [
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
        const sampleBlogPosts = [
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
        const sampleCoupons = [
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
        const sampleDeliveryOptions = [
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
    async getUser(id) {
        return this.users.get(id);
    }
    async getUserByUsername(username) {
        // Note: username field no longer exists, this method kept for interface compatibility
        return undefined;
    }
    async getUserByEmail(email, password) {
        console.log('Searching for user by email:', email);
        return Array.from(this.users.values()).find(user => user.email === email && user.password === password);
    }
    async getUserByPhone(phone) {
        return Array.from(this.users.values()).find(user => user.phone === phone);
    }
    async updateUser(id, updates) {
        const user = this.users.get(id);
        if (!user) {
            throw new Error("User not found");
        }
        const updatedUser = { ...user, ...updates };
        this.users.set(id, updatedUser);
        return updatedUser;
    }
    async updateUserProfile(id, profile) {
        const user = this.users.get(id);
        if (!user) {
            throw new Error("User not found");
        }
        const updatedUser = { ...user, ...profile, updatedAt: new Date() };
        this.users.set(id, updatedUser);
        return updatedUser;
    }
    async deleteUser(id) {
        const user = this.users.get(id);
        if (!user) {
            throw new Error("User not found");
        }
        this.users.delete(id);
    }
    async createUser(insertUser) {
        const id = randomUUID();
        const now = new Date();
        const user = {
            id,
            email: insertUser.email,
            password: insertUser.password,
            firstName: insertUser.firstName ?? "",
            lastName: insertUser.lastName ?? "",
            phone: insertUser.phone ?? "",
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
    async getAllProducts() {
        return Array.from(this.products.values());
    }
    async getFeaturedProducts() {
        return Array.from(this.products.values()).filter(product => product.featured);
    }
    async getProductsByCategory(category) {
        if (category === "all")
            return this.getAllProducts();
        return Array.from(this.products.values()).filter(product => product.category === category);
    }
    async getProductsByCategoryAndSubcategory(category, subcategory, searchKeyword) {
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
        }
        else if (category && category !== "all") {
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
            results = results.filter(product => product.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                product.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                product.category.toLowerCase().includes(searchKeyword.toLowerCase()));
        }
        return results;
    }
    async getProduct(id) {
        return this.products.get(id);
    }
    async createProduct(insertProduct) {
        const id = randomUUID();
        // Normalize pricing: compute discountAmount and final price if discountPercentage provided
        const parsedPrice = insertProduct.price ? Number(insertProduct.price) : 0;
        const parsedOriginal = insertProduct.originalPrice ? Number(insertProduct.originalPrice) : parsedPrice;
        const parsedPct = typeof insertProduct.discountPercentage === 'number' ? insertProduct.discountPercentage : 0;
        const discountAmountNum = +(parsedOriginal * (parsedPct / 100));
        const finalPriceNum = +(parsedOriginal - discountAmountNum);
        const product = {
            id,
            name: insertProduct.name,
            description: insertProduct.description,
            price: finalPriceNum.toFixed(2),
            // Provide sensible defaults for optional/DB fields so Product matches the inferred schema
            originalPrice: parsedOriginal.toFixed(2),
            discountPercentage: parsedPct ?? 0,
            discountAmount: discountAmountNum.toFixed(2),
            category: insertProduct.category,
            image: insertProduct.image,
            imagefirst: insertProduct.imagefirst ?? insertProduct.image,
            imagesecond: insertProduct.imagesecond ?? "",
            imagethirder: insertProduct.imagethirder ?? "",
            imagefoure: insertProduct.imagefoure ?? "",
            imagefive: insertProduct.imagefive ?? "",
            stockQuantity: insertProduct.stockQuantity ?? 0,
            inStock: insertProduct.inStock ?? true,
            featured: insertProduct.featured ?? false,
            isBestSeller: insertProduct.isBestSeller ?? false,
            isCustom: insertProduct.isCustom ?? false,
            colour: insertProduct.colour ?? "",
            discountsOffers: insertProduct.discountsOffers ?? false,
            createdAt: new Date()
        };
        this.products.set(id, product);
        return product;
    }
    // Inventory Management
    async updateProductStock(productId, quantityChange) {
        const product = this.products.get(productId);
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        const newStockQuantity = product.stockQuantity + quantityChange;
        // For stock decrements, check availability first
        if (quantityChange < 0 && product.stockQuantity < Math.abs(quantityChange)) {
            throw new Error(`Insufficient stock for ${product.name}. Required: ${Math.abs(quantityChange)}, Available: ${product.stockQuantity}`);
        }
        const updatedProduct = {
            ...product,
            stockQuantity: newStockQuantity,
            inStock: newStockQuantity > 0
        };
        this.products.set(productId, updatedProduct);
        return updatedProduct;
    }
    async checkProductAvailability(productId, requiredQuantity) {
        const product = this.products.get(productId);
        if (!product) {
            return { available: false, currentStock: 0 };
        }
        return {
            available: product.stockQuantity >= requiredQuantity,
            currentStock: product.stockQuantity
        };
    }
    async validateStockAvailability(items) {
        const errors = [];
        const stockValidation = [];
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
    async decrementProductsStock(items) {
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
    async getAllCourses() {
        return Array.from(this.courses.values());
    }
    async getCourse(id) {
        return this.courses.get(id);
    }
    async createCourse(insertCourse) {
        const id = randomUUID();
        const course = {
            id,
            title: insertCourse.title,
            description: insertCourse.description,
            price: insertCourse.price,
            duration: insertCourse.duration,
            sessions: insertCourse.sessions,
            features: insertCourse.features,
            popular: insertCourse.popular ?? false,
            nextBatch: insertCourse.nextBatch ?? "",
            createdAt: new Date()
        };
        this.courses.set(id, course);
        return course;
    }
    async getAllOrders() {
        return Array.from(this.orders.values());
    }
    async getOrder(id) {
        return this.orders.get(id);
    }
    async getOrderByNumber(orderNumber) {
        return Array.from(this.orders.values()).find(order => order.orderNumber === orderNumber);
    }
    async getUserOrders(userId) {
        return Array.from(this.orders.values()).filter(order => order.userId === userId);
    }
    async createOrder(insertOrder) {
        const id = randomUUID();
        const orderNumber = await this.generateOrderNumber();
        const now = new Date();
        const order = {
            id,
            orderNumber,
            status: "pending",
            statusUpdatedAt: now,
            pointsAwarded: false,
            paymentStatus: "pending",
            createdAt: now,
            updatedAt: now,
            userId: insertOrder.userId ?? "",
            customerName: insertOrder.customerName,
            email: insertOrder.email,
            phone: insertOrder.phone,
            occasion: insertOrder.occasion ?? "",
            requirements: insertOrder.requirements ?? "",
            items: insertOrder.items,
            subtotal: insertOrder.subtotal,
            paymentMethod: insertOrder.paymentMethod,
            total: insertOrder.total,
            deliveryAddress: insertOrder.deliveryAddress ?? "",
            deliveryDate: insertOrder.deliveryDate ? new Date(insertOrder.deliveryDate) : null,
            estimatedDeliveryDate: insertOrder.estimatedDeliveryDate ? new Date(insertOrder.estimatedDeliveryDate) : null,
            paymentTransactionId: insertOrder.paymentTransactionId ?? null,
            couponCode: insertOrder.couponCode ?? null,
            shippingAddressId: insertOrder.shippingAddressId ?? null,
            deliveryOptionId: insertOrder.deliveryOptionId ?? null,
            deliveryCharge: insertOrder.deliveryCharge ?? "0.00",
            discountAmount: insertOrder.discountAmount ?? "0.00",
            paymentCharges: insertOrder.paymentCharges ?? "0.00"
        };
        this.orders.set(id, order);
        return order;
    }
    async updateOrderStatus(id, status) {
        const order = this.orders.get(id);
        if (!order) {
            throw new Error("Order not found");
        }
        const updatedOrder = { ...order, status, updatedAt: new Date() };
        this.orders.set(id, updatedOrder);
        return updatedOrder;
    }
    async updateOrderPaymentStatus(id, paymentStatus, transactionId) {
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
    async generateOrderNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const existingOrders = Array.from(this.orders.values());
        const todaysOrders = existingOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate.toDateString() === now.toDateString();
        });
        const nextNumber = String(todaysOrders.length + 1).padStart(4, '0');
        return `ORD-${year}${month}-${nextNumber}`;
    }
    async validateCartItems(items) {
        const errors = [];
        const validatedItems = [];
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
    async calculateOrderPricing(subtotal, deliveryOptionId, couponCode, paymentMethod) {
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
                }
                else if (coupon.type === "fixed") {
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
    async validateAndProcessOrder(orderData) {
        const errors = [];
        // Validate cart items
        const cartItems = orderData.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
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
        const calculatedPricing = await this.calculateOrderPricing(orderData.subtotal, orderData.deliveryOptionId, orderData.couponCode, orderData.paymentMethod);
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
        const validatedOrder = {
            userId: orderData.userId,
            customerName: orderData.customerName,
            email: orderData.email,
            phone: orderData.phone,
            occasion: orderData.occasion,
            requirements: orderData.requirements,
            items: cartValidation.validatedItems,
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
    async getAllEnrollments() {
        return Array.from(this.enrollments.values());
    }
    async getEnrollment(id) {
        return this.enrollments.get(id);
    }
    async createEnrollment(insertEnrollment) {
        // Validate the course exists first
        const course = await this.getCourse(insertEnrollment.courseId);
        if (!course) {
            throw new Error("Course not found");
        }
        const id = randomUUID();
        const now = new Date();
        const enrollment = {
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
    async getAllTestimonials() {
        return Array.from(this.testimonials.values());
    }
    async getTestimonialsByType(type) {
        return Array.from(this.testimonials.values()).filter(testimonial => testimonial.type === type);
    }
    async createTestimonial(insertTestimonial) {
        const id = randomUUID();
        const testimonial = {
            id,
            name: insertTestimonial.name,
            location: insertTestimonial.location,
            rating: insertTestimonial.rating,
            comment: insertTestimonial.comment,
            type: insertTestimonial.type,
            image: insertTestimonial.image ?? "",
            createdAt: new Date()
        };
        this.testimonials.set(id, testimonial);
        return testimonial;
    }
    async getAllBlogPosts() {
        return Array.from(this.blogPosts.values()).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    async getBlogPost(id) {
        return this.blogPosts.get(id);
    }
    async createBlogPost(insertBlogPost) {
        const id = randomUUID();
        const post = {
            id,
            title: insertBlogPost.title,
            excerpt: insertBlogPost.excerpt,
            content: insertBlogPost.content,
            category: insertBlogPost.category,
            image: insertBlogPost.image,
            publishedAt: new Date(),
            createdAt: new Date()
        };
        this.blogPosts.set(id, post);
        return post;
    }
    // Cart Operations (MemStorage implementation - not used in production)
    async getUserCart(userId) {
        const userCarts = [];
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
    async addToCart(userId, productId, quantity) {
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
            const existingCart = this.carts.get(existingCartKey);
            const updatedCart = {
                ...existingCart,
                quantity: existingCart.quantity + quantity,
                updatedAt: new Date()
            };
            this.carts.set(existingCartKey, updatedCart);
            return updatedCart;
        }
        else {
            // Add new item to cart
            const id = randomUUID();
            const newCart = {
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
    async updateCartItemQuantity(userId, productId, quantity) {
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
    async removeFromCart(userId, productId) {
        for (const [key, cart] of this.carts.entries()) {
            if (cart.userId === userId && cart.productId === productId) {
                this.carts.delete(key);
                return;
            }
        }
    }
    async clearUserCart(userId) {
        const keysToDelete = [];
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
    async getUserFavorites(userId) {
        const userFavorites = Array.from(this.favorites.values()).filter(fav => fav.userId === userId);
        const result = [];
        for (const favorite of userFavorites) {
            const product = await this.getProduct(favorite.productId);
            if (product) {
                result.push({ ...favorite, product });
            }
        }
        return result;
    }
    async addToFavorites(userId, productId) {
        const id = randomUUID();
        const favorite = {
            id,
            userId,
            productId,
            createdAt: new Date(),
        };
        this.favorites.set(id, favorite);
        return favorite;
    }
    async removeFromFavorites(userId, productId) {
        const favoriteEntries = Array.from(this.favorites.entries());
        for (const [id, favorite] of favoriteEntries) {
            if (favorite.userId === userId && favorite.productId === productId) {
                this.favorites.delete(id);
                break;
            }
        }
    }
    async isProductFavorited(userId, productId) {
        return Array.from(this.favorites.values()).some(fav => fav.userId === userId && fav.productId === productId);
    }
    // Coupon Operations
    async getCouponByCode(code) {
        return Array.from(this.coupons.values()).find(coupon => coupon.code === code.toUpperCase());
    }
    async getAllCoupons() {
        return Array.from(this.coupons.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    async createCoupon(insertCoupon) {
        const id = randomUUID();
        const coupon = {
            id,
            code: insertCoupon.code.toUpperCase(),
            type: insertCoupon.type,
            value: insertCoupon.value,
            timesUsed: 0,
            startsAt: insertCoupon.startsAt ?? new Date(),
            expiresAt: insertCoupon.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            minOrderAmount: insertCoupon.minOrderAmount ?? "0",
            maxDiscount: insertCoupon.maxDiscount ?? "",
            usageLimit: insertCoupon.usageLimit ?? 1000,
            description: insertCoupon.description ?? "",
            isActive: insertCoupon.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.coupons.set(id, coupon);
        return coupon;
    }
    async updateCoupon(id, updates) {
        const coupon = this.coupons.get(id);
        if (!coupon) {
            throw new Error("Coupon not found");
        }
        const updatedCoupon = { ...coupon, ...updates, updatedAt: new Date() };
        this.coupons.set(id, updatedCoupon);
        return updatedCoupon;
    }
    async incrementCouponUsage(code) {
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
    async deleteCoupon(id) {
        const coupon = this.coupons.get(id);
        if (!coupon) {
            throw new Error("Coupon not found");
        }
        this.coupons.delete(id);
    }
    // Address Management Methods
    async getUserAddresses(userId) {
        return Array.from(this.addresses.values())
            .filter(address => address.userId === userId)
            .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)); // Default address first
    }
    async getAddress(id) {
        return this.addresses.get(id);
    }
    async createAddress(address) {
        const newAddress = {
            id: randomUUID(),
            userId: address.userId,
            fullName: address.fullName,
            email: address.email ?? "",
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2 ?? "",
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country ?? "",
            addressType: address.addressType ?? "home",
            landmark: address.landmark ?? "",
            isDefault: address.isDefault ?? false,
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
    async updateAddress(id, updates) {
        const existingAddress = this.addresses.get(id);
        if (!existingAddress) {
            throw new Error("Address not found");
        }
        const updatedAddress = {
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
    async deleteAddress(id) {
        const address = this.addresses.get(id);
        if (!address) {
            throw new Error("Address not found");
        }
        this.addresses.delete(id);
    }
    async setDefaultAddress(userId, addressId) {
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
    async getAllDeliveryOptions() {
        return Array.from(this.deliveryOptions.values())
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    async getActiveDeliveryOptions() {
        return Array.from(this.deliveryOptions.values())
            .filter(option => option.isActive)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    async getDeliveryOption(id) {
        return this.deliveryOptions.get(id);
    }
    async createDeliveryOption(deliveryOption) {
        const newDeliveryOption = {
            id: randomUUID(),
            name: deliveryOption.name,
            description: deliveryOption.description,
            estimatedDays: deliveryOption.estimatedDays,
            price: deliveryOption.price ?? "0.00",
            isActive: deliveryOption.isActive ?? true,
            sortOrder: deliveryOption.sortOrder ?? 0,
            createdAt: new Date(),
        };
        this.deliveryOptions.set(newDeliveryOption.id, newDeliveryOption);
        return newDeliveryOption;
    }
    // Transactional order processing methods (MemStorage - simplified implementation)
    async createOrderWithTransaction(validatedOrder, couponCode, userId) {
        try {
            // 1. Create the order with proper stock decrement
            const orderItems = validatedOrder.items;
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
        }
        catch (error) {
            console.error("[MEMSTORAGE TRANSACTION ERROR] Order creation failed:", error);
            // In a real system, this would roll back all changes
            // For MemStorage, we rely on the atomic stock validation
            throw error;
        }
    }
    async processOrderPlacement(orderData, userId) {
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
                ...validation.validatedOrder,
                userId: userId || null
            };
            const createdOrder = await this.createOrderWithTransaction(validatedOrderWithUserId, orderData.couponCode, userId);
            return {
                isValid: true,
                order: createdOrder,
                calculatedPricing: validation.calculatedPricing
            };
        }
        catch (error) {
            console.error("[MEMSTORAGE ORDER PROCESSING ERROR]:", error);
            return {
                isValid: false,
                errors: ["Failed to process order placement"]
            };
        }
    }
    // Order cancellation and tracking methods
    async cancelOrder(orderId, userId) {
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
        const updatedOrder = {
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
    async getOrderStatusHistory(orderId) {
        // For MemStorage (development), return empty array
        // This will be properly implemented in DatabaseStorage
        return [];
    }
    async addOrderStatusHistory(orderId, status, note) {
        // For MemStorage (development), this is a no-op
        // This will be properly implemented in DatabaseStorage
        console.log(`[ORDER STATUS] ${orderId}: ${status} - ${note || ''}`);
    }
    async awardUserPoints(userId, points) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error("User not found");
        }
        const updatedUser = {
            ...user,
            points: (user.points || 0) + points,
            updatedAt: new Date()
        };
        this.users.set(userId, updatedUser);
        console.log(`[POINTS] Awarded ${points} points to user ${userId}. Total: ${updatedUser.points}`);
    }
    async listAdvancableOrders(cutoffDate, statuses) {
        return Array.from(this.orders.values()).filter(order => order.status && statuses.includes(order.status) &&
            order.statusUpdatedAt &&
            order.statusUpdatedAt <= cutoffDate);
    }
    async advanceOrderStatus(orderId, nextStatus) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error("Order not found");
        }
        const now = new Date();
        const updatedOrder = {
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
    async updateOrderAddress(orderId, deliveryAddress, deliveryPhone) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error("Order not found");
        }
        const updatedOrder = {
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
