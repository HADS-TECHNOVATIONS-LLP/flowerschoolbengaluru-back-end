


import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { getAllCustomRequests } from "./database-storage.js";
import { db } from "./db.js";
import { insertOrderSchema, insertEnrollmentSchema, insertUserSchema, updateUserProfileSchema, validateCouponSchema, insertAddressSchema, addressValidationSchema, orderPlacementSchema, validateEventSchema } from "./shared/schema.js";
import { custom, z } from "zod";
import bcrypt from "bcryptjs";
import twilio from "twilio";
import { notificationService } from "./services/notification-service.js";
import { emailService } from "./services/email-service.js";
import { Console } from "console";
import Razorpay from "razorpay";
import crypto from "crypto";
import sgMail from '@sendgrid/mail';
import { config } from './config.js';

// Simple in-memory session storage
const sessions: Map<string, { userId: string; expires: number }> = new Map();

// Simple in-memory OTP storage
const otpStorage: Map<string, { otp: string; expires: number; verified: boolean }> = new Map();

// Initialize SendGrid
sgMail.setApiKey(config.sendgrid.apiKey);

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

// Initialize Twilio client for Verify service
const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
);

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send OTP via Twilio Verify
const sendVerificationCode = async (phone: string) => {
  try {
    console.log(`[VERIFY DEBUG] Attempting to send verification code:`);
    console.log(`[VERIFY DEBUG] TO: ${phone}`);
    console.log(`[VERIFY DEBUG] Service SID: ${config.twilio.verifyServiceSid}`);

    const verification = await twilioClient.verify.v2.services(config.twilio.verifyServiceSid)
      .verifications
      .create({
        to: phone,
        channel: 'sms'
      });

    console.log(`[VERIFY SUCCESS] Verification sent successfully to ${phone}, Status: ${verification.status}`);
    return true;
  } catch (error) {
    console.error("Verification sending error:", error);
    return false;
  }
};

// Helper function to verify OTP
const verifyCode = async (phone: string, code: string) => {
  try {
    console.log(`[VERIFY DEBUG] Attempting to verify code:`);
    console.log(`[VERIFY DEBUG] Phone: ${phone}, Code: ${code}`);

    const verificationCheck = await twilioClient.verify.v2.services(config.twilio.verifyServiceSid)
      .verificationChecks
      .create({
        to: phone,
        code: code
      });

    console.log(`[VERIFY SUCCESS] Verification status: ${verificationCheck.status}`);
    return verificationCheck.status === 'approved';
  } catch (error) {
    console.error("Verification check error:", error);
    return false;
  }
};

// Helper function to send email (mock implementation)
const sendEmail = async (email: string, subject: string, message: string) => {
  // For testing purposes, we'll log the email and always return success
  // In production, you would integrate with an email service like SendGrid, AWS SES, etc.
  console.log(`[EMAIL SENT] To: ${email}`);
  console.log(`[EMAIL SENT] Subject: ${subject}`);
  console.log(`[EMAIL SENT] Message: ${message}`);
  console.log('--- EMAIL SENT SUCCESSFULLY ---');
  return true;
};

// Helper function to generate session token
const generateSessionToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Helper function to clean expired sessions
const cleanExpiredSessions = () => {
  const now = Date.now();
  sessions.forEach((session, token) => {
    if (session.expires < now) {
      sessions.delete(token);
    }
  });
};

// Helper: calculate discount amount and final price
const calculateDiscount = (originalPrice: number, discountPercentage?: number) => {
  const pct = typeof discountPercentage === 'number' && !isNaN(discountPercentage) ? Math.max(0, Math.min(100, discountPercentage)) : 0;
  const discountAmount = +(originalPrice * (pct / 100));
  const finalPrice = +(originalPrice - discountAmount);
  // Round to 2 decimals for currency
  return { discountAmount: Number(discountAmount.toFixed(2)), finalPrice: Number(finalPrice.toFixed(2)), discountPercentage: pct };
};

// Middleware to get user from session
const getUserFromSession = async (req: any): Promise<any | null> => {
  cleanExpiredSessions();
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;
  console.log("[SESSION] Retrieved session token:", sessionToken);
  if (!sessionToken) return null;

  const session = sessions.get(sessionToken);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionToken);
    return null;
  }
  return await storage.getUser(session.userId);
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure global middleware for JSON parsing with increased limit
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  // Coupon validation endpoint
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const validationData = validateCouponSchema.parse(req.body);
      const { code, cartSubtotal, userId } = validationData;

      // Normalize coupon code to uppercase for case-insensitive matching
      const normalizedCode = code.trim().toUpperCase();

      console.log(`[COUPON] Validating coupon: ${normalizedCode} for cart subtotal: ${cartSubtotal}`);

      // Find the coupon
      const coupon = await storage.getCouponByCode(normalizedCode);
      if (!coupon) {
        return res.status(404).json({
          valid: false,
          error: "Invalid coupon code"
        });
      }

      console.log(`[COUPON] Found coupon: ${JSON.stringify(coupon)}`);

      // Check if coupon is active
      if (!coupon.isActive) {
        return res.status(400).json({
          valid: false,
          error: "This coupon is no longer active"
        });
      }

      // Check date validity
      const now = new Date();
      if (coupon.startsAt && new Date(coupon.startsAt) > now) {
        return res.status(400).json({
          valid: false,
          error: "This coupon is not yet valid"
        });
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        return res.status(400).json({
          valid: false,
          error: "This coupon has expired"
        });
      }

      // Check usage limit
      if (coupon.usageLimit !== null && (coupon.timesUsed ?? 0) >= coupon.usageLimit) {
        return res.status(400).json({
          valid: false,
          error: "This coupon has reached its usage limit"
        });
      }

      // Check minimum order amount
      const minOrderAmount = parseFloat(coupon.minOrderAmount || "0");
      if (cartSubtotal < minOrderAmount) {
        return res.status(400).json({
          valid: false,
          error: `Minimum order amount of ₹${minOrderAmount.toLocaleString('en-IN')} is required for this coupon`
        });
      }

      // Calculate discount
      let discountAmount = 0;
      const couponValue = parseFloat(coupon.value);

      if (coupon.type === "fixed") {
        discountAmount = couponValue;
      } else if (coupon.type === "percentage") {
        discountAmount = (cartSubtotal * couponValue) / 100;

        // Apply maximum discount cap if specified
        if (coupon.maxDiscount) {
          const maxDiscount = parseFloat(coupon.maxDiscount);
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      }

      // Ensure discount doesn't exceed cart subtotal
      discountAmount = Math.min(discountAmount, cartSubtotal);

      console.log(`[COUPON] Valid coupon applied. Discount: ${discountAmount}`);

      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: couponValue,
          description: coupon.description
        },
        discountAmount,
        finalAmount: cartSubtotal - discountAmount
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          valid: false,
          error: "Invalid request data",
          details: error.errors
        });
      }
      console.error("Coupon validation error:", error);
      res.status(500).json({
        valid: false,
        error: "Failed to validate coupon"
      });
    }
  });

  // Authentication Routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUserByEmail = await storage.getUserByEmailOnly(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({
          status: 'error',
          message: "Registration failed",
          error: "Email already registered",
          details: "Please use a different email address or try logging in"
        });
      }
      console.log('Signup attempt for email:', userData.email);
      const existingUserByPhone = userData.phone ? await storage.getUserByPhone(userData.phone) : null;
      if (existingUserByPhone) {
        return res.status(400).json({
          status: 'error',
          message: "Registration failed",
          error: "Phone number already registered",
          details: "Please use a different phone number or try logging in"
        });
      }
      try {
        const user = await storage.createUser({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          password: userData.password,
        });

        // Return success response without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json({
          status: 'success',
          message: "User created successfully",
          user: userWithoutPassword
        });
      } catch (dbError) {
        console.error("Database error during user creation:", dbError);
        return res.status(500).json({
          status: 'error',
          message: "Failed to create user",
          error: "Database error",
          details: dbError instanceof Error ? dbError.message : "Error creating user in database"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: "Invalid user data",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      console.error("Signup error:", error);

      const errorMessage = (error instanceof Error) ? error.message : String(error);

      // Database connection errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection')) {
        return res.status(503).json({
          status: 'error',
          message: "Service temporarily unavailable",
          error: "Database connection error",
          details: "Please try again in a few minutes"
        });
      }

      // SQL or database constraint errors
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        return res.status(409).json({
          status: 'error',
          message: "Registration failed",
          error: "Account already exists",
          details: "An account with this email or phone number is already registered"
        });
      }

      // Data validation errors
      if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return res.status(400).json({
          status: 'error',
          message: "Invalid user data",
          error: "Validation failed",
          details: errorMessage
        });
      }

      // Password hashing errors
      if (errorMessage.includes('bcrypt') || errorMessage.includes('hash')) {
        return res.status(500).json({
          status: 'error',
          message: "Registration failed",
          error: "Password processing error",
          details: "Error securing your password. Please try again"
        });
      }

      // Default error response for unexpected errors
      res.status(500).json({
        status: 'error',
        message: "Failed to create user",
        error: "Internal server error",
        details: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) {
      return res.status(400).json({ 
        status: 'error',
        message: "Email is required",
        error: "Missing email address",
        details: "Please enter your email address to sign in"
      });
    }
    if (!password) {
      return res.status(400).json({ 
        status: 'error',
        message: "Password is required",
        error: "Missing password",
        details: "Please enter your password to sign in"
      });
    }

      // Find user by email first
      const userByEmail = await storage.getUserByEmailOnly(email);
      if (!userByEmail) {
        // Email not found — return minimal message for frontend
        return res.status(401).json({ message: 'Email incorrect' });
      }

      // Verify password (storage currently stores plain password)
      // If your storage uses hashing, replace with bcrypt.compare
      const storedPassword = (userByEmail as any).password;
      if (storedPassword !== password) {
        // Password mismatch — return minimal message for frontend
        return res.status(401).json({ message: 'Incorrect password' });
      }

      // At this point email and password match; use this user
      const user = userByEmail;

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      sessions.set(sessionToken, { userId: user.id, expires: expiresAt });

      // Set cookie
      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: false, // set to true in production with HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

  // Return user without password
  const { password: _, ...userWithoutPassword } = user as any;
  res.json({ status: 'success', user: userWithoutPassword, message: "Signed in successfully", sessionToken });
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  // Credential check endpoint used by client to decide whether to show create-account modal
  app.post("/api/auth/credential-check", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      // If neither provided, return bad request
      if (!email && !password) {
        return res.status(400).json({ message: 'Email or password required' });
      }

      const emailExists = !!(email && await storage.getUserByEmailOnly(email));
      // Check whether any account uses this password (storage may be plain-text in this app)
      const passwordMatchesAny = !!(password && await storage.passwordExists(password));

      return res.json({ emailExists, passwordMatchesAny });
    } catch (error) {
      console.error('Credential check error:', error);
      return res.status(500).json({ message: 'Failed to check credentials' });
    }
  });

  app.get("/api/auth/user", async (req, res) => {
    try {
      console.log("Getting user from session", req.cookies);
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/signout", async (req, res) => {
    try {
      const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;
      if (sessionToken) {
        sessions.delete(sessionToken);
      }
      res.clearCookie('sessionToken');
      res.json({ message: "Signed out successfully" });
    } catch (error) {
      console.error("Signout error:", error);
      res.status(500).json({ message: "Failed to sign out" });
    }
  });

  // Forgot Password - Send OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { contact, contactType } = req.body;
      if (!contact || !contactType) {
        return res.status(400).json({ message: "Contact and contact type are required" });
      }

      // Check if user exists
      let user;
      if (contactType === "email") {
        user = await storage.getUserByEmailOnly(contact);
      } else {
        user = await storage.getUserByPhone(contact);
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

      // Store OTP
      otpStorage.set(contact, {
        otp,
        expires: expiresAt,
        verified: false
      });

      // Send OTP
      let sent = false;
      if (contactType === "email") {
        sent = await sendEmail(
          contact,
          "Password Reset - Bouquet Bar",
          `Your verification code is: ${otp}. This code will expire in 10 minutes.`
        );
      } else {
        // Format phone number for SMS using Twilio Verify
        const formattedPhone = contact.startsWith('+') ? contact : `+91${contact}`;
        sent = await sendVerificationCode(formattedPhone);
        // Don't store OTP for phone since Twilio Verify handles it
        if (sent) {
          otpStorage.delete(contact); // Remove from local storage since Twilio handles it
        }
      }

      if (!sent) {
        return res.status(500).json({ message: `Failed to send OTP via ${contactType}` });
      }

      res.json({ message: `OTP sent to your ${contactType}` });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { contact, otp, contactType } = req.body;

      if (!contact || !otp || !contactType) {
        return res.status(400).json({ message: "Contact, OTP, and contact type are required" });
      }

      let isValid = false;

      if (contactType === "email") {
        // Use local OTP storage for email
        const storedOtp = otpStorage.get(contact);
        if (!storedOtp) {
          return res.status(400).json({ message: "No OTP found for this contact" });
        }

        if (storedOtp.expires < Date.now()) {
          otpStorage.delete(contact);
          return res.status(400).json({ message: "OTP has expired" });
        }

        if (storedOtp.otp !== otp) {
          return res.status(400).json({ message: "Invalid OTP" });
        }

        // Mark OTP as verified
        storedOtp.verified = true;
        otpStorage.set(contact, storedOtp);
        isValid = true;
      } else {
        // Use Twilio Verify for phone numbers
        const cleanPhone = contact.replace(/\s+/g, ''); // Remove spaces for consistent formatting
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;
        console.log(`[VERIFY DEBUG] Clean phone: "${cleanPhone}", Formatted: "${formattedPhone}"`);
        isValid = await verifyCode(formattedPhone, otp);

        if (isValid) {
          // Store verification status for password reset using clean phone number
          otpStorage.set(cleanPhone, {
            otp: otp,
            expires: Date.now() + (10 * 60 * 1000), // 10 minutes
            verified: true
          });
        }
      }

      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Reset Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { contact, otp, newPassword, contactType } = req.body;

      if (!contact || !otp || !newPassword || !contactType) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Normalize phone number for OTP lookup
      const lookupKey = contactType === "phone" ? contact.replace(/\s+/g, '') : contact;
      const storedOtp = otpStorage.get(lookupKey);
      console.log(`[RESET DEBUG] Looking up OTP with key: "${lookupKey}" (original: "${contact}")`);
      if (!storedOtp || !storedOtp.verified) {
        return res.status(400).json({ message: "OTP not verified" });
      }

      if (storedOtp.expires < Date.now()) {
        otpStorage.delete(lookupKey);
        return res.status(400).json({ message: "OTP has expired" });
      }

      // Find user
      let user;
      if (contactType === "email") {
        user = await storage.getUserByEmailOnly(contact);
      } else {
        // Normalize phone number by removing spaces and formatting consistently
        const cleanPhone = contact.replace(/\s+/g, ''); // Remove all spaces
        console.log(`[RESET DEBUG] Looking for user with phone: "${cleanPhone}" (original: "${contact}")`);
        user = await storage.getUserByPhone(cleanPhone);
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update password
      await storage.updateUser(user.id, { password: newPassword });

      // Clean up OTP
      otpStorage.delete(lookupKey);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Profile Management
  app.get("/api/profile", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Return user profile without password
      const { password: _, ...userProfile } = user;
      res.json(userProfile);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      // Validate profile data
      const profileData = updateUserProfileSchema.parse(req.body);
      // Update user profile
      console.log("Updating profile for user:", req.body);
      const updatedUser = await storage.updateUserProfile(req.body.id, req.body);
      // Return updated profile without password
      const { password: _, ...userProfile } = updatedUser;
      res.json({ user: userProfile, message: "Profile updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.delete("/api/profile", async (req, res) => {
    try {
      console.log('=== DELETE PROFILE REQUEST ===');

      const user = await getUserFromSession(req);
      if (!user) {
        console.log('User not authenticated');
        return res.status(401).json({
          success: false,
          message: "Not authenticated"
        });
      }

      console.log('Deleting account for user:', user.id);

      // Delete user account with all related data
      await storage.deleteUser(user.id);

      // Clear session after successful deletion
      const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;
      if (sessionToken) {
        sessions.delete(sessionToken);
        console.log('Session cleared for token:', sessionToken.substring(0, 10) + '...');
      }

      // Clear cookie with proper options
      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      console.log('Account deleted successfully for user:', user.id);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully"
      });

    } catch (error) {
      console.error("Delete profile error:", error);

      // Return specific error message for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      res.status(500).json({
        success: false,
        message: "Failed to delete account",
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  // Change Password
  app.put("/api/profile/change-password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      // Validate new password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Hash new password
      const hashedPassword = newPassword; // await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUser(req.body.userId, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  
   app.get("/api/products", async (req, res) => {
    try {
      const { category, subcategory, search, minPrice, maxPrice, inStock, featured, bestSeller } = req.query;

      // If category, subcategory, or search is specified, use enhanced filtering
      if (category || subcategory || search) {
        const products = await storage.getProductsByCategoryAndSubcategory(
          category?.toString() || '',
          subcategory?.toString(),
          search?.toString()
        );
        
        // Apply additional filters if provided
        let filteredProducts = products;
        
        // Filter by price range
        if (minPrice || maxPrice) {
          filteredProducts = filteredProducts.filter(product => {
            const price = parseFloat(product.price);
            const min = minPrice ? parseFloat(minPrice.toString()) : 0;
            const max = maxPrice ? parseFloat(maxPrice.toString()) : Infinity;
            return price >= min && price <= max;
          });
        }
        
        // Filter by stock status
        if (inStock === 'true') {
          filteredProducts = filteredProducts.filter(product => product.inStock);
        }
        
        // Filter by featured status  
        if (featured === 'true') {
          filteredProducts = filteredProducts.filter(product => product.featured);
        }

        // Filter by best seller status
        if (bestSeller === 'true') {
          filteredProducts = filteredProducts.filter(product => product.isbestseller);
        }
        
        console.log(`Products API: Found ${filteredProducts.length} products for category="${category}" subcategory="${subcategory}" search="${search}"`);
        res.set('Cache-Control', 'no-store');
        return res.status(200).json(filteredProducts);
      }

      // Otherwise get all products
      let products = await storage.getAllProducts();
      
      // Apply best seller filter if specified
      if (req.query.bestSeller === 'true') {
        products = products.filter(product => product.isbestseller);
      }
      
      res.set('Cache-Control', 'no-store');
      res.status(200).json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  }); 


  app.get("/api/products/featured", async (req, res) => {
    try {
      const products = await storage.getFeaturedProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured products" });
    }
  });

  
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });


  app.get("/api/getDashboardData", async (req, res) => {
    try {
      const dashboardData = await storage.getDashboardData();
      res.json(dashboardData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/getEventClassEnrollments", async (req, res) => {
    try {
      const eventClassEnrollments = await storage.getEventEnrollments();
      const classEnrollments = await storage.getclassEnrollments();
      res.json({ eventClassEnrollments, classEnrollments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event class enrollments" });
    }
  });


  // Courses
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  // Custom requests API
// routes.ts
app.post('/api/admin/custom-requests', async (req, res) => {
  try {
    const { images, comment, product_id, user_name, user_email, user_phone } = req.body;
    console.log('Received custom request:', { images, comment, product_id, user_name, user_email, user_phone });
    const result = await storage.createCustomRequest(images, comment, product_id, user_name, user_email, user_phone);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save custom request' });
  }
});

app.get('/api/admin/custom-requests', async (req, res) => {
  try {
    const results = await getAllCustomRequests();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch custom requests' });
  }
});

  // Pay Later routes - Course details email only (no payment required)
  app.post("/api/paylater", async (req, res) => {
    try {
      const { 
        full_name, 
        email_address, 
        phone_number, 
        courses_or_workshops, 
        questions_or_comments 
      } = req.body;
      
      // Validate required fields
      if (!full_name || !email_address || !phone_number || !courses_or_workshops) {
        return res.status(400).json({ 
          error: 'Missing required fields: full_name, email_address, phone_number, courses_or_workshops' 
        });
      }

      // Store pay later request in database
      const payLaterData = {
        full_name,
        email_address,
        phone_number,
        payment_method: 'Pay Later',
        questions_or_comments: questions_or_comments || '',
        courses_or_workshops
      };

      const result = await storage.createPayLaterRequest(payLaterData);
      console.log('Pay later request created:', result.id);

      // Send course details email (no payment required)
      try {
        const courseDetailsEmail = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Course Details - Flower School Bengaluru</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937;">
            <div style="max-width: 700px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,0.06);">
              <div style="padding: 28px 32px; text-align: center; background: linear-gradient(90deg, #e6fffa 0%, #ebf8ff 100%);">
                <h1 style="margin: 0; color: #0f172a; font-size: 22px;">Flower School Bengaluru</h1>
                <p style="margin: 8px 0 0 0; color: #334155; font-size: 13px;">Course Details & Information</p>
              </div>

              <div style="padding: 20px 32px;">
                <div style="background-color:#f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; margin-bottom: 18px;">
                  <strong style="display:block; font-size:16px; color:#065f46;">✅ Pay Later Request Received</strong>
                  <p style="margin:6px 0 0 0; color:#065f46; font-size:14px;">We have received your request to pay later. Our team will call you shortly to confirm the details and help schedule the payment at your convenience.</p>
                </div>

                <h3 style="margin: 0 0 10px 0; color:#0b1220; font-size:16px;">👤 Student Information</h3>
                <div style="background-color: #fbfcfd; padding: 14px; border-radius: 6px; border: 1px solid #e6eef6; margin-bottom: 18px;">
                  <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${payLaterData.full_name}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${payLaterData.email_address}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Phone:</strong> ${payLaterData.phone_number}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Course Interest:</strong> ${payLaterData.courses_or_workshops}</p>
                  ${payLaterData.questions_or_comments ? `<p style="margin: 0;"><strong>Questions:</strong> ${payLaterData.questions_or_comments}</p>` : ''}
                </div>

                <h3 style="margin: 0 0 10px 0; color:#0b1220; font-size:16px;">🌸 What's Next?</h3>
                <div style="background:#fffdfa; padding: 14px; border-radius:6px; border:1px solid #fbe7c6; margin-bottom:18px;">
                  <ul style="margin:0; padding-left:18px; color:#334155; line-height:1.6;">
                    <li>We will call you within 24-48 hours to confirm your request.</li>
                    <li>We will share the detailed curriculum, schedule and any preparatory notes.</li>
                    <li>You can complete the payment later as per mutual convenience.</li>
                    <li>Course materials will be provided upon enrollment and certificate issued after completion.</li>
                  </ul>
                </div>

                <div style="text-align:center; margin-top: 10px;">
                  <p style="margin:0 0 6px 0; color:#475569; font-size:13px;">Need immediate help?</p>
                  <p style="margin:0; font-weight:600; color:#0f172a;">📧 <a href="mailto:info@flowerschoolbengaluru.com" style="color:#0f172a; text-decoration:none;">info@flowerschoolbengaluru.com</a> | 📞 +91 99728 03847</p>
                </div>
              </div>

              <div style="background:#f8fafc; padding:12px 20px; text-align:center; font-size:12px; color:#6b7280;">
                <div>Thank you for choosing Flower School Bengaluru — we look forward to having you with us 🌸</div>
              </div>
            </div>
          </body>
          </html>
        `;

        const msg = {
          to: payLaterData.email_address,
          from: {
            email: 'info@flowerschoolbengaluru.com',
            name: 'Flower School Bengaluru'
          },
          subject: '📚 Course Details - Flower School Bengaluru',
          html: courseDetailsEmail
        };

        await sgMail.send(msg);
        console.log('Course details email sent to:', payLaterData.email_address);
      } catch (emailError) {
        console.error('Error sending course details email:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Course details shared successfully',
        data: result
      });

    } catch (error) {
      console.error('Error processing pay later request:', error);
      res.status(500).json({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/paylater", async (req, res) => {
    try {
      const results = await storage.getAllPayLaterRequests();
      res.json(results);
    } catch (error) {
      console.error('Error fetching pay later requests:', error);
      res.status(500).json({ error: 'Failed to fetch pay later requests' });
    }
  });

  app.get("/api/paylater/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.getPayLaterRequestById(id);
      
      if (!result) {
        return res.status(404).json({ error: 'Pay later request not found' });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching pay later request:', error);
      res.status(500).json({ error: 'Failed to fetch pay later request' });
    }
  });

  app.delete("/api/paylater/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePayLaterRequest(id);
      res.json({ message: 'Pay later request deleted successfully' });
    } catch (error) {
      console.error('Error deleting pay later request:', error);
      res.status(500).json({ error: 'Failed to delete pay later request' });
    }
  });

  // Razorpay Payment Integration Routes
  
  app.post("/api/payment/verify", async (req, res) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        enrollment_data 
      } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
          error: 'Missing required payment verification fields' 
        });
      }

      // Verify payment signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", config.razorpay.keySecret)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;

      if (!isAuthentic) {
        console.error('Payment signature verification failed');
        return res.status(400).json({ 
          error: 'Payment verification failed. Invalid signature.' 
        });
      }

      console.log('Payment verification successful:', razorpay_payment_id);

      // If enrollment data is provided, save to pay later table
      if (enrollment_data) {
        try {
          const payLaterData = {
            full_name: enrollment_data.full_name,
            email_address: enrollment_data.email_address,
            phone_number: enrollment_data.phone_number,
            payment_method: 'Razorpay - Paid',
            questions_or_comments: enrollment_data.questions_or_comments || '',
            courses_or_workshops: enrollment_data.courses_or_workshops,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id
          };

          const payLaterResult = await storage.createPayLaterRequest(payLaterData);
          console.log('Pay later record created after payment:', payLaterResult.id);

          // Send course enrollment completion email after successful payment
          setImmediate(async () => {
            try {
              const enrollmentCompletionEmail = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Course Enrollment Completed - Flower School Bengaluru</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: Arial, sans-serif;">
                  <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #2d3748; margin: 0; font-size: 28px;">Flower School Bengaluru</h1>
                      <p style="color: #666; margin: 5px 0 0 0;">Course Enrollment Completed</p>
                    </div>
                    
                    <div style="background-color: #d4eed6; border-left: 4px solid #48bb78; padding: 20px; margin-bottom: 30px;">
                      <h2 style="color: #2d3748; margin: 0 0 10px 0; font-size: 24px;">🎉 Enrollment Completed Successfully!</h2>
                      <p style="color: #2d3748; margin: 0; font-size: 16px;">
                        Congratulations! Your payment has been confirmed and course enrollment is complete.
                      </p>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">💳 Payment Details</h3>
                      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px;">
                        <p style="margin: 0 0 10px 0;"><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> ${razorpay_order_id}</p>
                        <p style="margin: 0;"><strong>Status:</strong> <span style="color: #48bb78; font-weight: bold;">PAID</span></p>
                      </div>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📚 Course Details</h3>
                      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px;">
                        <p style="margin: 0 0 10px 0;"><strong>Student Name:</strong> ${enrollment_data.full_name}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${enrollment_data.email_address}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Phone:</strong> ${enrollment_data.phone_number}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Course/Workshop:</strong> ${enrollment_data.courses_or_workshops}</p>
                        ${enrollment_data.questions_or_comments ? `<p style="margin: 0;"><strong>Special Requests:</strong> ${enrollment_data.questions_or_comments}</p>` : ''}
                      </div>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">🌟 What's Next?</h3>
                      <ul style="color: #4a5568; line-height: 1.6;">
                        <li>Our team will contact you within 24 hours with course schedule details</li>
                        <li>You'll receive course materials and joining instructions</li>
                        <li>Certificate will be provided upon successful completion</li>
                        <li>Access to our exclusive student community</li>
                        <li>Ongoing support throughout your learning journey</li>
                      </ul>
                    </div>

                    <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e2e8f0;">
                      <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">
                        Welcome to Flower School Bengaluru! Questions?
                      </p>
                      <p style="color: #2d3748; margin: 0; font-weight: 600;">
                        📧 info@flowerschoolbengaluru.com | 📞 +91 99728 03847
                      </p>
                    </div>
                  </div>
                </body>
                </html>
              `;

              const msg = {
                to: enrollment_data.email_address,
                from: {
                  email: 'info@flowerschoolbengaluru.com',
                  name: 'Flower School Bengaluru'
                },
                subject: '🎉 Course Enrollment Completed - Welcome to Flower School Bengaluru!',
                html: enrollmentCompletionEmail
              };

              await sgMail.send(msg);
              console.log('Course enrollment completion email sent to:', enrollment_data.email_address);

            } catch (emailError) {
              console.error('[PAYMENT EMAIL] Failed to send enrollment completion email:', emailError);
              // Don't fail the payment if email fails
            }
          });

          res.json({
            success: true,
            message: 'Payment verified and enrollment recorded successfully',
            payment: {
              order_id: razorpay_order_id,
              payment_id: razorpay_payment_id
            },
            enrollment: payLaterResult
          });
        } catch (enrollmentError) {
          console.error('Error saving enrollment after payment:', enrollmentError);
          // Payment was successful but enrollment saving failed
          res.status(207).json({
            success: true,
            payment_verified: true,
            enrollment_error: 'Payment successful but failed to save enrollment record',
            payment: {
              order_id: razorpay_order_id,
              payment_id: razorpay_payment_id
            }
          });
        }
      } else {
        // Just verify payment without enrollment
        res.json({
          success: true,
          message: 'Payment verified successfully',
          payment: {
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id
          }
        });
      }

    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ 
        error: 'Failed to verify payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/payment/status/:payment_id", async (req, res) => {
    try {
      const { payment_id } = req.params;
      
      if (!payment_id) {
        return res.status(400).json({ error: 'Payment ID is required' });
      }

      // Fetch payment details from Razorpay
      const payment = await razorpay.payments.fetch(payment_id);
      
      res.json({
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          created_at: payment.created_at
        }
      });

    } catch (error) {
      console.error('Error fetching payment status:', error);
      res.status(500).json({ 
        error: 'Failed to fetch payment status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enhanced Payment Create Order - For immediate course payments with email notifications
  app.post("/api/payment/create-order", async (req, res) => {
    try {
      const { 
        amount, 
        currency = 'INR', 
        receipt, 
        notes,
        courseDetails // New field for course information
      } = req.body;
      
      // Validate required fields
      if (!amount || amount <= 0) {
        return res.status(400).json({ 
          error: 'Invalid amount. Amount must be greater than 0' 
        });
      }

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes || {}
      });

      console.log('Razorpay order created:', razorpayOrder.id);

      // If course details are provided, send payment initiated email
      if (courseDetails) {
        try {
          const emailService = {
            async sendCoursePaymentInitiatedEmail(orderData: any, courseData: any) {
              const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Course Payment - Order Created</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: Arial, sans-serif;">
                  <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #2d3748; margin: 0; font-size: 28px;">Flower School Bengaluru</h1>
                      <p style="color: #666; margin: 5px 0 0 0;">Course Payment Order</p>
                    </div>
                    
                    <div style="background-color: #fef5e7; border-left: 4px solid #f6ad55; padding: 20px; margin-bottom: 30px;">
                      <h2 style="color: #2d3748; margin: 0 0 10px 0; font-size: 24px;">⏳ Payment Order Created</h2>
                      <p style="color: #2d3748; margin: 0; font-size: 16px;">
                        Your payment order has been created. Please complete the payment to confirm your enrollment.
                      </p>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">💰 Payment Details</h3>
                      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px;">
                        <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> ${orderData.id}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Amount:</strong> ₹${(orderData.amount / 100).toLocaleString()}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Currency:</strong> ${orderData.currency}</p>
                        <p style="margin: 0;"><strong>Receipt:</strong> ${orderData.receipt}</p>
                      </div>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📚 Course Details</h3>
                      <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px;">
                        <p style="margin: 0 0 10px 0;"><strong>Student Name:</strong> ${courseData.full_name}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${courseData.email_address}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Phone:</strong> ${courseData.phone_number}</p>
                        <p style="margin: 0 0 10px 0;"><strong>Course/Workshop:</strong> ${courseData.courses_or_workshops}</p>
                        ${courseData.questions_or_comments ? `<p style="margin: 0;"><strong>Comments:</strong> ${courseData.questions_or_comments}</p>` : ''}
                      </div>
                    </div>

                    <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e2e8f0;">
                      <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">
                        Complete your payment to confirm enrollment. Need help?
                      </p>
                      <p style="color: #2d3748; margin: 0; font-weight: 600;">
                        📧 info@flowerschoolbengaluru.com | 📞 +91 99728 03847
                      </p>
                    </div>
                  </div>
                </body>
                </html>
              `;

              const msg = {
                to: courseData.email_address,
                from: {
                  email: 'info@flowerschoolbengaluru.com',
                  name: 'Flower School Bengaluru'
                },
                subject: '⏳ Course Payment Order Created - Complete Your Payment',
                html: htmlContent
              };

              await sgMail.send(msg);
              console.log('Payment initiated email sent to:', courseData.email_address);
            }
          };

          await emailService.sendCoursePaymentInitiatedEmail(razorpayOrder, courseDetails);
        } catch (emailError) {
          console.error('Error sending payment initiated email:', emailError);
          // Don't fail the order creation if email fails
        }
      }

      res.status(201).json({
        success: true,
        order: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt
        },
        key: config.razorpay.keyId
      });

    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ 
        error: 'Failed to create payment order',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WhatsApp Debug Test Route
  app.post("/api/whatsapp/test", async (req, res) => {
    try {
      const { phone } = req.body;
      const testPhone = phone || "9159668932"; // Use your phone number as default
      
      console.log('[WHATSAPP TEST] Starting WhatsApp test with phone:', testPhone);

      // Use the same Twilio client configuration
      const twilioWhatsApp = twilio(
        "AC33481cb2b9a8c5cd0e7ebfa5e7ef41be",
        "b6d4fa8e66be7495c3016c7089cb04f4"
      );

      // Format phone number exactly like in pay later
      let formattedPhone = testPhone.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/^91/, '');
      }
      if (!formattedPhone.startsWith('+91')) {
        formattedPhone = '+91' + formattedPhone.replace(/^\+/, '');
      }

      console.log('[WHATSAPP TEST] Formatted phone:', formattedPhone);
      console.log('[WHATSAPP TEST] WhatsApp to:', `whatsapp:${formattedPhone}`);
      console.log('[WHATSAPP TEST] WhatsApp from:', "whatsapp:+15558910172");

      const testMessage = `🧪 WhatsApp Test Message\n\nHello! This is a test message from Bouquet Bar.\n\nTime: ${new Date().toLocaleString()}\n\nIf you receive this, WhatsApp is working! 🎉`;

      // Send test WhatsApp message
      const whatsappResult = await twilioWhatsApp.messages.create({
        body: testMessage,
        from: "whatsapp:+15558910172",
        to: `whatsapp:${formattedPhone}`
      });

      console.log('[WHATSAPP TEST] Message sent successfully:', {
        sid: whatsappResult.sid,
        status: whatsappResult.status,
        direction: whatsappResult.direction,
        to: whatsappResult.to,
        from: whatsappResult.from
      });

      res.json({
        success: true,
        message: 'Test WhatsApp message sent successfully',
        data: {
          messageId: whatsappResult.sid,
          status: whatsappResult.status,
          to: whatsappResult.to,
          from: whatsappResult.from,
          formattedPhone: formattedPhone
        }
      });

    } catch (error) {
      console.error('[WHATSAPP TEST] Error:', error);
      
      // Log detailed error information
      if (error instanceof Error) {
        const twilioError = error as any;
        console.error('[WHATSAPP TEST] Detailed error:', {
          message: twilioError.message,
          code: twilioError.code,
          status: twilioError.status,
          moreInfo: twilioError.moreInfo
        });
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          code: (error as any).code,
          status: (error as any).status
        } : error
      });
    }
  });

  // WhatsApp Message Sending Route
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { phone, message, mediaUrl } = req.body;
      
      // Validate required fields
      if (!phone || !message) {
        return res.status(400).json({
          success: false,
          error: 'Phone number and message are required'
        });
      }

      console.log('[WHATSAPP API] Received WhatsApp send request:', {
        phone: phone.slice(0, 3) + '****' + phone.slice(-4),
        messageLength: message.length,
        hasMedia: !!mediaUrl
      });

      // Import the Twilio client with your credentials
      const twilioClient = twilio(
        "AC33481cb2b9a8c5cd0e7ebfa5e7ef41be",
        "b6d4fa8e66be7495c3016c7089cb04f4"
      );

      // Format phone number for WhatsApp
      let formattedPhone = phone.trim();
      
      // Remove any existing WhatsApp: prefix if present
      formattedPhone = formattedPhone.replace(/^whatsapp:/, '');
      
      // Ensure proper country code format
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/^91/, '');
      }
      if (!formattedPhone.startsWith('+91')) {
        formattedPhone = '+91' + formattedPhone.replace(/^\+/, '');
      }

      // Validate the final format for Indian numbers
      if (!/^\+91[6-9]\d{9}$/.test(formattedPhone)) {
        console.error('[WHATSAPP API] Invalid phone number format:', phone);
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Please use Indian mobile number format.'
        });
      }

      // Format for WhatsApp
      const whatsappTo = `whatsapp:${formattedPhone}`;
      const whatsappFrom = "whatsapp:+15558910172";

      // Prepare message options
      const messageOptions: any = {
        body: message,
        from: whatsappFrom,
        to: whatsappTo
      };

      // Add media if provided
      if (mediaUrl) {
        messageOptions.mediaUrl = mediaUrl;
      }

      console.log('[WHATSAPP API] Sending message with Twilio...', {
        to: whatsappTo.slice(0, 12) + '****' + whatsappTo.slice(-4),
        from: whatsappFrom,
        messageLength: message.length,
        hasMedia: !!mediaUrl
      });

      // Send the WhatsApp message
      const result = await twilioClient.messages.create(messageOptions);

      console.log('[WHATSAPP API] Message sent successfully:', {
        sid: result.sid,
        status: result.status,
        direction: result.direction
      });

      // Check for any errors in the result
      if (result.status === 'failed' || result.errorCode) {
        console.error('[WHATSAPP API] Message status indicates failure:', {
          status: result.status,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage
        });
        
        return res.status(400).json({
          success: false,
          error: result.errorMessage || 'WhatsApp message failed to send',
          twilioStatus: result.status,
          errorCode: result.errorCode
        });
      }

      // Success response
      res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: {
          messageId: result.sid,
          status: result.status,
          to: whatsappTo,
          sentAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[WHATSAPP API] Error sending WhatsApp message:', error);
      
      // Handle Twilio specific errors
      if (error instanceof Error) {
        const twilioError = error as any;
        
        if (twilioError.code === 63018) {
          return res.status(400).json({
            success: false,
            error: 'Invalid WhatsApp number. Make sure the recipient has opted in to WhatsApp.',
            code: twilioError.code
          });
        } else if (twilioError.code === 63016) {
          return res.status(400).json({
            success: false,
            error: 'Recipient needs to join the WhatsApp sandbox first.',
            code: twilioError.code
          });
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to send WhatsApp message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // SendGrid Email Test Route
  app.post("/api/email/test", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      console.log('[EMAIL TEST] Sending test email to:', email);
      
      const emailSent = await emailService.sendTestEmail(email);
      
      if (emailSent) {
        res.status(200).json({
          success: true,
          message: 'Test email sent successfully',
          recipient: email
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('[EMAIL TEST] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Orders
  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Comprehensive order placement with validation and processing
  app.post("/api/orders/place", async (req, res) => {
    try {
      console.log("[ORDER PLACEMENT] Received order data:", JSON.stringify(req.body, null, 2));
      // Handle user identification
      let username: string | null = null;
      let customerName: string | null = null;
      if (req.body.userId && req.body.userId !== 'null') {
        try {
          const user = await storage.getUser(req.body.userId);
          if (user) {
            username = `${user.firstName} ${user.lastName}`.trim() || user.email;
            customerName = username;
          }
        } catch (error) {
          console.log("[ORDER PLACEMENT] Error fetching user details:", error);
        }
      }

      // Set customer name from found username, request body, or default to email/phone
      if (customerName) {
        req.body.customerName = customerName;
      } else if (req.body.firstName && req.body.lastName) {
        req.body.customerName = `${req.body.firstName} ${req.body.lastName}`.trim();
      } else if (req.body.email) {
        req.body.customerName = req.body.email;
      } else if (req.body.phone) {
        req.body.customerName = req.body.phone;
      }

      // Parse and validate order data
      const orderData = orderPlacementSchema.parse(req.body);
      console.log("[ORDER PLACEMENT] Order data validated successfully");

      // Get current user if authenticated
      let currentUser = null;
      try {
        currentUser = await getUserFromSession(req);
        if (currentUser) {
          console.log("[ORDER PLACEMENT] User authenticated:", currentUser.email);
        } else {
          console.log("[ORDER PLACEMENT] Processing guest order");
        }
      } catch (error) {
        console.log("[ORDER PLACEMENT] Authentication check failed, processing as guest order");
        currentUser = null;
      }

      // Validate and process order through comprehensive validation
      console.log("[ORDER PLACEMENT] Starting order validation and processing");
      const orderValidation = await storage.validateAndProcessOrder(orderData);
      if (!orderValidation.isValid) {
        console.log("[ORDER PLACEMENT] Order validation failed:", orderValidation.errors);
        return res.status(400).json({
          success: false,
          message: "Order validation failed",
          errors: orderValidation.errors
        });
      }

      console.log("[ORDER PLACEMENT] Order validation successful, processing order with transaction");

      // Process the entire order placement in a single transaction
      const orderProcessingResult = await storage.processOrderPlacement(orderData, currentUser?.id);
      console.log("[ORDER PLACEMENT] Order processing result:", orderProcessingResult);
      if (!orderProcessingResult.isValid) {
        console.log("[ORDER PLACEMENT] Order processing failed:", orderProcessingResult.errors);
        return res.status(400).json({
          success: false,
          message: "Order processing failed",
          errors: orderProcessingResult.errors
        });
      }

      // Add detailed logging of order details
      console.log("[ORDER PLACEMENT] Order processed successfully", {
        orderDetails: {
          id: orderProcessingResult.order?.id,
          orderNumber: orderProcessingResult.order?.orderNumber,
          customerName: orderProcessingResult.order?.customerName,
          email: orderProcessingResult.order?.email,
          phone: orderProcessingResult.order?.phone,
          status: orderProcessingResult.order?.status,
          total: orderProcessingResult.order?.total
        },
        pricing: orderProcessingResult.calculatedPricing
      });
      const createdOrder = orderProcessingResult.order;
      if (!createdOrder) {
        throw new Error("Failed to create order");
      }
      console.log("[ORDER PLACEMENT] Created order details:", JSON.stringify(createdOrder));
      const orderForNotification = {
        orderNumber: createdOrder.orderNumber || `ORD-${createdOrder.id.slice(0, 8)}`,
        customerName: createdOrder.customerName || 'Customer',
        phone: createdOrder.phone || '',
        total: createdOrder.total?.toString() || '0',
        estimatedDeliveryDate: createdOrder.estimatedDeliveryDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: Array.isArray(createdOrder.items) ? createdOrder.items.map(item => ({
          name: item.name || 'Product',
          quantity: item.quantity || 1,
          price: typeof item.price === 'number' ? item.price.toString() : item.price || '0'
        })) : [],
        deliveryAddress: createdOrder.deliveryAddress || 'Address not provided',
        paymentMethod: createdOrder.paymentMethod || 'Not specified',
      };

      console.log(`[NOTIFICATION] Triggering async notifications for order:`, {
        orderId: createdOrder.id,
        orderNumber: orderForNotification.orderNumber,
        customerName: orderForNotification.customerName,
        phone: orderForNotification.phone
      });
      console.log('Created order:', createdOrder);
      // Use setImmediate to ensure notifications run asynchronously without blocking the response
      setImmediate(async () => {
        try {
          // Ensure order number is properly formatted
          const orderPrefix = 'ORD-';
          const orderNumber = createdOrder.orderNumber || `${orderPrefix}${createdOrder.id.slice(0, 8)}`;
          const formattedOrderNumber = orderNumber.startsWith(orderPrefix)
            ? orderNumber
            : `${orderPrefix}${orderNumber.replace(orderPrefix, '')}`;

          // Always use a real name, email, or phone for customerName
          let customerName = (createdOrder.customerName || '').trim();
          if (!customerName) {
            customerName = createdOrder.email || createdOrder.phone || '';
          }

          const notificationData = {
            orderNumber: createdOrder.orderNumber || formattedOrderNumber,
            customerName,
            phone: createdOrder.phone || '',
            total: createdOrder.total?.toString() || '0',
            estimatedDeliveryDate: createdOrder.estimatedDeliveryDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
            items: Array.isArray(createdOrder.items) ? createdOrder.items.map(item => ({
              name: item.name || 'Product',
              quantity: item.quantity || 1,
              price: (item.price || 0).toString()
            })) : [],
            deliveryAddress: createdOrder.deliveryAddress || 'Address not provided',
            paymentMethod: createdOrder.paymentMethod || 'Not specified',
            paymentStatus: createdOrder.paymentStatus || 'pending'
          };

          console.log(`[NOTIFICATION] Processing async notifications for order:`, {
            orderNumber: notificationData.orderNumber,
            customerName: notificationData.customerName,
            phone: notificationData.phone
          });

          const notificationResults = await notificationService.sendOrderConfirmation({
            ...createdOrder,
            ...notificationData
          });

          // Send order confirmation email
          try {
            console.log(`[EMAIL] Sending order confirmation email for order:`, {
              orderNumber: notificationData.orderNumber,
              customerEmail: createdOrder.email,
              customerName: notificationData.customerName
            });

            if (createdOrder.email) {
              const emailData = {
                orderNumber: notificationData.orderNumber,
                customerName: notificationData.customerName,
                customerEmail: createdOrder.email,
                items: notificationData.items.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price
                })),
                subtotal: orderProcessingResult.calculatedPricing?.subtotal || createdOrder.subtotal || '0',
                deliveryCharge: orderProcessingResult.calculatedPricing?.deliveryCharge || createdOrder.deliveryCharge || '0',
                discountAmount: orderProcessingResult.calculatedPricing?.discountAmount || createdOrder.discountAmount || '0',
                total: orderProcessingResult.calculatedPricing?.total || createdOrder.total || '0',
                paymentMethod: notificationData.paymentMethod,
                deliveryAddress: notificationData.deliveryAddress,
                estimatedDeliveryDate: notificationData.estimatedDeliveryDate.toISOString()
              };

              const emailSent = await emailService.sendOrderConfirmationEmail(emailData);
              
              if (emailSent) {
                console.log(`[EMAIL] Order confirmation email sent successfully for order ${notificationData.orderNumber}`);
              } else {
                console.log(`[EMAIL] Failed to send order confirmation email for order ${notificationData.orderNumber}`);
              }
            } else {
              console.log(`[EMAIL] No email address provided for order ${notificationData.orderNumber}, skipping email`);
            }
          } catch (emailError) {
            console.error(`[EMAIL] Error sending order confirmation email for order ${notificationData.orderNumber}:`, emailError instanceof Error ? emailError.message : 'Unknown email error');
          }
          // Log overall notification status without PII
          const notificationSummary = {
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
            smsStatus: notificationResults.sms.success ? 'sent' : 'failed',
            whatsappStatus: notificationResults.whatsapp.success ? 'sent' : 'failed',
            smsMessageId: notificationResults.sms.messageId || null,
            whatsappMessageId: notificationResults.whatsapp.messageId || null,
            hasErrors: !notificationResults.sms.success || !notificationResults.whatsapp.success,
            notificationTime: new Date().toISOString()
          };

          console.log(`[NOTIFICATION] Summary for order ${createdOrder.orderNumber} (ID: ${createdOrder.id}):`, JSON.stringify(notificationSummary, null, 2));

        } catch (notificationError) {
          // Log error without failing the order
          console.error(`[NOTIFICATION] Async notification error for order ${createdOrder.orderNumber}:`, notificationError instanceof Error ? notificationError.message : 'Unknown error');
        }
      });

      // Send success response with order details
      res.status(201).json({
        success: true,
        message: "Order placed successfully",
        order: createdOrder,
        calculatedPricing: orderProcessingResult.calculatedPricing
      });

    } catch (error) {
      console.error("[ORDER PLACEMENT] Error placing order:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid order data",
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to place order",
        errors: ["Internal server error. Please try again."]
      });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get order by order number
  app.get("/api/orders/number/:orderNumber", async (req, res) => {
    try {
      const order = await storage.getOrderByNumber(req.params.orderNumber);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // User Orders Management Routes - MUST come before /api/orders/:id
  app.get("/api/orders/user", async (req, res) => {
    try {
      console.log("[ORDER HISTORY] Fetching user orders...");
      const user = await getUserFromSession(req);
      if (!user) {
        console.log("[ORDER HISTORY] No user found in session");
        return res.status(401).json({ message: "Authentication required" });
      }
      console.log(`[ORDER HISTORY] User found: ${user.id} (${user.email})`);
      const orders = await storage.getUserOrders(req.query.userId ? String(req.query.userId) : user.id);
      console.log(`[ORDER HISTORY] Found ${orders.length} orders for user ${user.id}`);

      if (orders.length === 0) {
        console.log("[ORDER HISTORY] No orders found, returning empty array");
      } else {
        console.log("[ORDER HISTORY] Orders:", orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status })));
      }

      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ message: "Failed to fetch user orders" });
    }
  });

  // Get specific order by ID - MUST come after specific routes like /user
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const orderId = req.params.id;

      // Validate required fields
      if (!orderId || !status) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          requiredFields: ["orderId", "status"]
        });
      }

      // Validate status value
      const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status value",
          validValues: validStatuses
        });
      }

      const order = await storage.updateOrderStatus(orderId, status);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found"
        });
      }

      // Add status history entry
      await storage.addOrderStatusHistory(orderId, status, `Order status updated to ${status}`);

      res.json({
        success: true,
        message: "Order status updated successfully",
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          statusUpdatedAt: order.statusUpdatedAt
        }
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update order status",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update payment status
  app.patch("/api/orders/:id/payment", async (req, res) => {
    try {
      const { paymentStatus, transactionId } = req.body;
      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }

      const order = await storage.updateOrderPaymentStatus(req.params.id, paymentStatus, transactionId);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  // Enrollments
  app.post("/api/enrollments", async (req, res) => {
    try {
      console.log("[ENROLLMENT] Received enrollment request:", req.body);

      // Parse and validate enrollment data
      const enrollmentData = insertEnrollmentSchema.parse(req.body);

      // Get course details first
      const course = await storage.getCourse(enrollmentData.courseId);
      if (!course) {
        console.error(`[ENROLLMENT] Course not found with ID: ${enrollmentData.courseId}`);
        return res.status(404).json({
          success: false,
          message: "Course not found"
        });
      }

      // Create enrollment record
      console.log("[ENROLLMENT] Creating enrollment record...");
      const enrollment = await storage.createEnrollment(enrollmentData);
      console.log(`[ENROLLMENT] Created enrollment with ID: ${enrollment.id}`);

      // Format phone number for notifications
      const studentPhone = enrollmentData.phone.startsWith('+91')
        ? enrollmentData.phone
        : `+91${enrollmentData.phone.replace(/\D/g, '')}`;

      // Send notifications asynchronously
      setImmediate(async () => {
        try {
          console.log("[ENROLLMENT] Sending notifications...");

          const notificationResult = await notificationService.sendEnrollmentNotifications({
            studentPhone,
            studentName: enrollmentData.fullName,
            studentEmail: enrollmentData.email,
            courseTitle: course.title,
            batch: enrollmentData.batch || 'Next Available Batch',
            adminPhone: config.admin.phone,
            questions: enrollmentData.questions || undefined
          });

          console.log("[ENROLLMENT] Notification result:", {
            studentNotificationStatus: notificationResult.studentNotification.success ? 'sent' : 'failed',
            adminNotificationStatus: notificationResult.adminNotification.success ? 'sent' : 'failed',
            studentPhone: studentPhone.slice(0, 3) + '****' + studentPhone.slice(-4),
            courseTitle: course.title,
            enrollmentId: enrollment.id
          });

        } catch (notificationError) {
          console.error("[ENROLLMENT] Notification error:", notificationError);
          // Don't fail the enrollment if notifications fail
        }
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: "Enrollment created successfully",
        data: {
          ...enrollment,
          courseTitle: course.title,
          courseDuration: course.duration,
          price: course.price
        }
      });

    } catch (error) {
      console.error("[ENROLLMENT] Error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid enrollment data",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
        return res.status(503).json({
          success: false,
          message: "Service temporarily unavailable",
          error: "Database connection error"
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create enrollment",
        error: errorMessage
      });
    }
  });

  app.get("/api/enrollments", async (req, res) => {
    try {
      const enrollments = await storage.getAllEnrollments();
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });


// POST: Save user data from popup form
app.post("/api/categoryuserdata", async (req, res) => {
  try {
    const { fullname, emailaddress, phoneno, question, enquiry } = req.body;
    if (!fullname || !emailaddress || !phoneno) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const userData = await storage.createCategoryUserData({ fullname, emailaddress, phoneno, question, enquiry });
    res.status(201).json({ success: true, data: userData });
  } catch (error) {
    console.error("[CATEGORYUSERDATA] Error creating record:", error);
    res.status(500).json({ success: false, message: "Failed to save user data" });
  }
});

// GET: Return all user data entries
app.get("/api/categoryuserdata", async (req, res) => {
  try {
    const allUserData = await storage.getAllCategoryUserData();
    res.json({ success: true, data: allUserData });
  } catch (error) {
    console.error("[CATEGORYUSERDATA] Error fetching records:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user data" });
  }
});

  // Testimonials
  app.get("/api/testimonials", async (req, res) => {
    try {
      const type = req.query.type as string;
      const testimonials = type
        ? await storage.getTestimonialsByType(type)
        : await storage.getAllTestimonials();
      res.json(testimonials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch testimonials" });
    }
  });

  // Blog posts
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/:id", async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  // Cart Operations
  app.get("/api/cart/:userId", async (req, res) => {
    try {
      const cartItems = await storage.getUserCart(req.params.userId);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching user cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post("/api/cart/:userId/add", async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      const cartItem = await storage.addToCart(req.params.userId, productId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.put("/api/cart/:userId/update", async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      const cartItem = await storage.updateCartItemQuantity(req.params.userId, productId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:userId/remove/:productId", async (req, res) => {
    try {
      await storage.removeFromCart(req.params.userId, req.params.productId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  app.delete("/api/cart/:userId/clear", async (req, res) => {
    try {
      await storage.clearUserCart(req.params.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });


  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Status is required" });
      }

      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Order cancellation route
  app.post("/api/orders/:id/cancel", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const orderId = req.params.id;
      const cancelledOrder = await storage.cancelOrder(orderId, user.id);
      try {
        await notificationService.sendOrderCancellationNotification({
          orderId: cancelledOrder.id,
          orderNumber: cancelledOrder.orderNumber,
          customerName: (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : user?.email || 'Customer',
          customerPhone: cancelledOrder.phone,
          total: cancelledOrder.total?.toString() || '0',
          deliveryAddress: cancelledOrder.deliveryAddress || 'N/A',
          paymentMethod: cancelledOrder.paymentMethod || "Original payment method",
          refundAmount: cancelledOrder.total?.toString() || '0',
          refundMethod: cancelledOrder.paymentMethod || "Original payment method"
        });
      } catch (notificationError) {
        console.error("Failed to send cancellation notification:", notificationError);
        // Don't fail the cancellation if notification fails
      }

      res.json({
        success: true,
        order: cancelledOrder,
        message: "Order cancelled successfully"
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel order";

      // Map specific error types to appropriate HTTP status codes
      if (errorMessage.includes("Order not found")) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (errorMessage.includes("Unauthorized")) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (errorMessage.includes("cannot be cancelled")) {
        return res.status(409).json({ message: "Order cannot be cancelled in current status" });
      }

      res.status(500).json({ message: "Failed to cancel order" });
    }
  });

  // Order address change route
  app.post("/api/orders/:id/address", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const orderId = req.params.id;
      const { deliveryAddress, deliveryPhone } = req.body;

      if (!deliveryAddress) {
        return res.status(400).json({ message: "Delivery address is required" });
      }

      // Get the order first
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order
      if (order.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if order can still have address changed (not shipped or delivered)
      if (order.status && ["shipped", "delivered", "cancelled"].includes(order.status)) {
        return res.status(400).json({
          message: `Cannot change address for ${order.status} orders`
        });
      }

      // Update the order address
      const updatedOrder = await storage.updateOrderAddress(orderId, deliveryAddress);

      // Add status history entry
      await storage.addOrderStatusHistory(orderId, order.status || 'pending', `Address updated to: ${deliveryAddress}`);

      res.json({
        success: true,
        order: updatedOrder,
        message: "Delivery address updated successfully"
      });
    } catch (error) {
      console.error("Error updating order address:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update address";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Order tracking route
  app.get("/api/orders/:id/tracking", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const orderId = req.params.id;

      // Get the order first
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order
      if (order.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get order status history
      const statusHistory = await storage.getOrderStatusHistory(orderId);

      // Define status progression steps
      const statusSteps = [
        { step: "Order Placed", status: "pending", completed: true },
        { step: "Order Confirmed", status: "confirmed", completed: false },
        { step: "Being Prepared", status: "processing", completed: false },
        { step: "Out for Delivery", status: "shipped", completed: false },
        { step: "Delivered", status: "delivered", completed: false }
      ];

      // Mark completed steps based on current order status
      const statusOrder = ["pending", "confirmed", "processing", "shipped", "delivered"];
      const currentStatus = order.status || "pending";
      const currentStatusIndex = statusOrder.indexOf(currentStatus);

      if (currentStatusIndex >= 0) {
        statusSteps.forEach((step, index) => {
          step.completed = index <= currentStatusIndex;
        });
      }

      // Handle cancelled orders
      if (currentStatus === "cancelled") {
        statusSteps.forEach(step => step.completed = false);
        statusSteps.push({ step: "Order Cancelled", status: "cancelled", completed: true });
      }

      res.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          statusUpdatedAt: order.statusUpdatedAt,
          estimatedDeliveryDate: order.estimatedDeliveryDate,
          pointsAwarded: order.pointsAwarded
        },
        statusHistory,
        progressSteps: statusSteps,
        canCancel: ["pending", "confirmed", "processing"].includes(currentStatus)
      });
    } catch (error) {
      console.error("Error fetching order tracking:", error);
      res.status(500).json({ message: "Failed to fetch order tracking" });
    }
  });

  // Background scheduler management routes (admin only)
  app.get("/api/admin/scheduler/status", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization - check if user email is in admin list or has admin role
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";

      const { backgroundScheduler } = await import("./services/background-scheduler");
      const status = backgroundScheduler.getStatus();

      res.json({
        status: status.running ? "running" : "stopped",
        inProgress: status.inProgress,
        nextRun: status.nextRun,
        lastRun: status.lastRun,
        lastResult: status.lastResult,
        message: `Background scheduler is ${status.running ? "active" : "inactive"}`
      });
    } catch (error) {
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ message: "Failed to get scheduler status" });
    }
  });

  app.post("/api/admin/scheduler/trigger", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization - check if user email is in admin list or has admin role
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const { backgroundScheduler } = await import("./services/background-scheduler");
      const result = await backgroundScheduler.triggerStatusProgression();

      res.json(result);
    } catch (error) {
      console.error("Error triggering scheduler:", error);
      res.status(500).json({ message: "Failed to trigger scheduler" });
    }
  });

  
  // Admin: Get event pricing
  app.get('/api/admin/event-pricing', async (req, res) => {
    try {
      const pricing = await storage.getEventPricing();
      res.json({ success: true, data: pricing });
    } catch (error) {
      console.error('Error fetching event pricing:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch event pricing', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

    app.post("/api/admin/event-pricing", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin check (reuse project config if available)
      const isAdmin = (typeof config !== 'undefined' && config?.admin && Array.isArray(config.admin.emails) && config.admin.emails.includes(user.email)) || user.userType === "admin";
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }


      const payload = req.body;
      console.log('[DEBUG] POST /api/admin/event-pricing payload type:', Array.isArray(payload) ? 'array' : typeof payload);
      console.log('[DEBUG] POST /api/admin/event-pricing payload preview:', JSON.stringify(payload).slice(0, 1000));
      if (!payload) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      // Normalize payload into a pricing map: { key: { label, price } }
      const pricingMap: Record<string, { label: string; price: string }> = {};

      const addEntry = (entry: any, idx = 0) => {
        if (!entry) return;
        // If entry already looks like map-entry
        if (entry.key && typeof entry.key === 'string') {
          const key = entry.key;
          const label = entry.label || '';
          const price = entry.price !== undefined && entry.price !== null ? String(entry.price) : '';
          pricingMap[key] = { label, price };
          return;
        }

        // UI-shaped entry: { day, startTime, startAmPm, endTime, endAmPm, price }
        if (entry.day && (entry.startTime || entry.endTime)) {
          const day = (entry.day || '').trim();
          const startTime = (entry.startTime || '').trim();
          const startAmPm = (entry.startAmPm || '').toUpperCase();
          const endTime = (entry.endTime || '').trim();
          const endAmPm = (entry.endAmPm || '').toUpperCase();
          const timeLabel = `${startTime}${startAmPm ? ' ' + startAmPm : ''}${startTime && endTime ? ' - ' : ''}${endTime}${endAmPm ? ' ' + endAmPm : ''}`.trim();
          const label = [day, timeLabel].filter(Boolean).join(' ').trim();
          const key = (entry.key && typeof entry.key === 'string') ? entry.key : ((day && startTime && endTime) ? `${day}_${startTime}_${endTime}`.replace(/\s+/g, '_').toLowerCase() : `slot_${idx}`);
          const price = entry.price !== undefined && entry.price !== null ? String(entry.price) : '';
          pricingMap[key] = { label, price };
          return;
        }

      };

      if (Array.isArray(payload)) {
        payload.forEach((e: any, i: number) => addEntry(e, i));
      } else if (payload && typeof payload === 'object' && !payload.key && !payload.day) {
        // assume it's already a map: { key1: { label, price }, key2: { ... } }
        Object.keys(payload).forEach((k) => {
          const it = payload[k];
          if (it && typeof it === 'object') {
            pricingMap[k] = { label: String(it.label || ''), price: it.price !== undefined && it.price !== null ? String(it.price) : '' };
          }
        });
      } else {
        // single UI-shaped or single-entry object
        addEntry(payload, 0);
      }

      if (!pricingMap || Object.keys(pricingMap).length === 0) {
        console.warn('[WARN] Empty pricing map provided to /api/admin/event-pricing');
        return res.status(400).json({ success: false, error: 'Empty pricing payload' });
      }

      try {
        const updated = await storage.updateEventPricing(pricingMap);
        console.log('[INFO] Event pricing updated successfully. Keys:', Object.keys(pricingMap));
        return res.json({ success: true, data: updated });
      } catch (dbError) {
        console.error('[ERROR] storage.updateEventPricing failed:', dbError instanceof Error ? dbError.stack || dbError.message : dbError);
        // In development return stack for easier debugging
        if (process.env.NODE_ENV !== 'production') {
          return res.status(500).json({ success: false, error: 'DB update failed', details: dbError instanceof Error ? dbError.stack : String(dbError) });
        }
        return res.status(500).json({ success: false, error: 'DB update failed' });
      }
    } catch (error) {
      console.error('Error storing event pricing:', error);
      res.status(500).json({ success: false, error: 'Failed to store event pricing', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  // Admin: Update event pricing
  app.put('/api/admin/event-pricing', async (req, res) => {
    try {
      const payload = req.body;
      console.log('[DEBUG] PUT /api/admin/event-pricing payload type:', Array.isArray(payload) ? 'array' : typeof payload);
      console.log('[DEBUG] PUT /api/admin/event-pricing payload preview:', JSON.stringify(payload).slice(0, 1000));

      if (!payload) {
        return res.status(400).json({ success: false, error: 'Invalid pricing payload' });
      }

      // Normalize same as POST: accept map, array, or UI-shaped entries
      const pricingMap: Record<string, { label: string; price: string }> = {};
      const addEntry = (entry: any, idx = 0) => {
        if (!entry) return;
        if (entry.key && typeof entry.key === 'string') {
          const key = entry.key;
          const label = entry.label || '';
          const price = entry.price !== undefined && entry.price !== null ? String(entry.price) : '';
          pricingMap[key] = { label, price };
          return;
        }
        if (entry.day && (entry.startTime || entry.endTime)) {
          const day = (entry.day || '').trim();
          const startTime = (entry.startTime || '').trim();
          const startAmPm = (entry.startAmPm || '').toUpperCase();
          const endTime = (entry.endTime || '').trim();
          const endAmPm = (entry.endAmPm || '').toUpperCase();
          const timeLabel = `${startTime}${startAmPm ? ' ' + startAmPm : ''}${startTime && endTime ? ' - ' : ''}${endTime}${endAmPm ? ' ' + endAmPm : ''}`.trim();
          const label = [day, timeLabel].filter(Boolean).join(' ').trim();
          const key = (entry.key && typeof entry.key === 'string') ? entry.key : ((day && startTime && endTime) ? `${day}_${startTime}_${endTime}`.replace(/\s+/g, '_').toLowerCase() : `slot_${idx}`);
          const price = entry.price !== undefined && entry.price !== null ? String(entry.price) : '';
          pricingMap[key] = { label, price };
          return;
        }
      };

      if (Array.isArray(payload)) {
        payload.forEach((e: any, i: number) => addEntry(e, i));
      } else if (payload && typeof payload === 'object' && !payload.key && !payload.day) {
        // assume it's already a map
        Object.keys(payload).forEach((k) => {
          const it = payload[k];
          if (it && typeof it === 'object') {
            pricingMap[k] = { label: String(it.label || ''), price: it.price !== undefined && it.price !== null ? String(it.price) : '' };
          }
        });
      } else {
        addEntry(payload, 0);
      }

      if (!pricingMap || Object.keys(pricingMap).length === 0) {
        return res.status(400).json({ success: false, error: 'Empty pricing payload' });
      }

      const updated = await storage.updateEventPricing(pricingMap);
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating event pricing:', error);
      res.status(500).json({ success: false, error: 'Failed to update event pricing', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Admin: Delete a single pricing key
  app.delete('/api/admin/event-pricing/:key', async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

      const key = req.params.key;
      if (!key) return res.status(400).json({ success: false, message: 'Key required' });

      const current = await storage.getEventPricing();
      if (!current || typeof current !== 'object') return res.status(404).json({ success: false, message: 'No pricing found' });
      if (!Object.prototype.hasOwnProperty.call(current, key)) return res.status(404).json({ success: false, message: 'Key not found' });

      const updated = { ...current };
      delete updated[key];

      await storage.updateEventPricing(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error deleting event pricing key:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Favorites Management Routes
  app.get("/api/favorites", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const favorites = await storage.getUserFavorites(user.id);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching user favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      // Check if product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Check if already favorited to prevent duplicates
      const isAlreadyFavorited = await storage.isProductFavorited(user.id, productId);
      if (isAlreadyFavorited) {
        return res.status(400).json({ message: "Product already in favorites" });
      }

      const favorite = await storage.addToFavorites(user.id, productId);
      res.json(favorite);
    } catch (error) {
      console.error("Error adding to favorites:", error);
      res.status(500).json({ message: "Failed to add to favorites" });
    }
  });

  app.delete("/api/favorites/:productId", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.removeFromFavorites(user.id, req.params.productId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from favorites:", error);
      res.status(500).json({ message: "Failed to remove from favorites" });
    }
  });

  app.get("/api/favorites/:productId/status", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const isFavorited = await storage.isProductFavorited(user.id, req.params.productId);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Address Management Routes
  app.get("/api/addresses", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log("Fetching addresses for user:", user.id);
      const addresses = await storage.getUserAddresses(user.id);
      console.log(`Found ${addresses.length} addresses for user ${user.id}`);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post("/api/addresses", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate the address data
      const validatedAddress = addressValidationSchema.parse(req.body);

      const addressData = {
        userId: user.id,
        ...validatedAddress,
      };

      const newAddress = await storage.createAddress(addressData);

      // If this address is marked as default, ensure it's the only default address
      if (validatedAddress.isDefault) {
        await storage.setDefaultAddress(user.id, newAddress.id);
        // Get the updated address with correct default status
        const updatedAddress = await storage.getAddress(newAddress.id);
        return res.status(201).json(updatedAddress);
      }

      res.status(201).json(newAddress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid address data",
          errors: error.errors
        });
      }
      console.error("Error creating address:", error);
      // Include a brief detail in development to help diagnose
      res.status(500).json({ message: "Failed to create address", detail: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const addressId = req.params.id;
      const existingAddress = await storage.getAddress(addressId);
      console.log("Existing address fetched:", existingAddress);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found" });
      }

      await storage.deleteAddress(addressId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  app.put("/api/addresses/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      const addressId = req.params.id;
      // Check if address exists and belongs to user
      const existingAddress = await storage.getAddress(addressId);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found" });
      }

      // Validate the update data
      const validatedUpdates = addressValidationSchema.partial().parse(req.body);

      // If this address is being set as default, handle default logic first
      if (validatedUpdates.isDefault === true) {
        await storage.setDefaultAddress(user.id, addressId);
      }

      const updatedAddress = await storage.updateAddress(addressId, validatedUpdates);

      res.json(updatedAddress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid address data",
          errors: error.errors
        });
      }
      console.error("Error updating address:", error);
      res.status(500).json({ message: "Failed to update address" });
    }
  });


  app.put("/api/addresses/:id/set-default", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      const addressId = req.params.id;
      const existingAddress = await storage.getAddress(addressId);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found" });
      }
      // Set the address as default
      await storage.setDefaultAddress(user.id, addressId);

      // Get the updated address to return
      const updatedAddress = await storage.getAddress(addressId);

      res.json({
        success: true,
        message: "Default address updated successfully",
        address: updatedAddress
      });
    } catch (error) {
      console.error("Error setting default address:", error);
      res.status(500).json({ message: "Failed to set default address" });
    }
  });

  // Delivery Options Routes
  app.get("/api/delivery-options", async (req, res) => {
    try {
      let deliveryOptions = await storage.getActiveDeliveryOptions();

      // Auto-seed delivery options if none exist
      if (deliveryOptions.length === 0) {
        console.log("No delivery options found, bootstrapping default options...");

        const defaultOptions = [
          {
            name: "Standard Delivery",
            description: "1-4 business days delivery",
            estimatedDays: "1-4 business days",
            price: "50.00",
            isActive: true,
            sortOrder: 1,
          },
          {
            name: "Same Day Delivery",
            description: "Same day delivery within city",
            estimatedDays: "Same day",
            price: "250.00",
            isActive: true,
            sortOrder: 3,
          },
        ];

        // Create default delivery options
        for (const option of defaultOptions) {
          await storage.createDeliveryOption(option);
        }

        // Fetch the newly created options
        deliveryOptions = await storage.getActiveDeliveryOptions();
        console.log(`Bootstrapped ${deliveryOptions.length} delivery options`);
      }

      res.json(deliveryOptions);
    } catch (error) {
      console.error("Error fetching delivery options:", error);
      res.status(500).json({ message: "Failed to fetch delivery options" });
    }
  });
  // Twilio status webhook endpoint
  app.post("/api/twilio/status", (req, res) => {
    const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;

    console.log(`[TWILIO WEBHOOK] Message ${MessageSid} to ${To}: ${MessageStatus}`);
    if (ErrorCode) {
      console.log(`[TWILIO WEBHOOK] Error ${ErrorCode}: ${ErrorMessage}`);
    }

    // Respond with 200 to acknowledge receipt
    res.status(200).send('OK');
  });

  app.get("/api/courses/", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/get/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events || []);
    } catch (error) {
      console.error("Error getting events:", error);
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  app.post("/api/events_enrollments", async (req, res) => {
    try {
      console.log("[EVENT ENROLLMENT] Received enrollment request:", req.body);

      // Validate required fields
      const requiredFields = ['eventId', 'firstName', 'lastName', 'email', 'phone'];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      // Validate email format - only allow .com addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({
        status: 'error',
        message: "Invalid email format",
        error: "Email format error",
        details: "Please enter a valid .com email address (e.g., example@example.com)"
      });
    }

      // Validate phone number (assuming Indian format)
      const phoneRegex = /^[6-9]\d{9}$/;
      const cleanPhone = req.body.phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }

      // Get event details first
      const event = await storage.getAllEvents();
      const matchingEvent = event.find((e: any) => e.id === req.body.eventId);

      if (!matchingEvent) {
        console.error(`[EVENT ENROLLMENT] Event not found with ID: ${req.body.eventId}`);
        return res.status(404).json({
          success: false,
          error: "Event not found"
        });
      }

      // Create enrollment record
      console.log("[EVENT ENROLLMENT] Creating enrollment record...");
      const enrollment = await storage.addEventEnrollment({
        ...req.body,
        paymentAmount: parseFloat(req.body.paymentAmount)
      });

      if (!enrollment) {
        throw new Error('Failed to create enrollment');
      }

      console.log(`[EVENT ENROLLMENT] Created enrollment:`, enrollment);

      // Format phone number for notifications
      const studentPhone = cleanPhone.startsWith('+91')
        ? cleanPhone
        : `+91${cleanPhone}`;

      // Send notifications asynchronously
      setImmediate(async () => {
        try {
          console.log("[EVENT ENROLLMENT] Sending notifications...");

          const notificationResult = await notificationService.sendEventEnrollmentNotifications({
            studentPhone,
            studentName: `${req.body.firstName} ${req.body.lastName}`,
            studentEmail: req.body.email,
            eventTitle: (matchingEvent as any).title,
            eventDate: (matchingEvent as any).event_date,
            eventTime: (matchingEvent as any).event_time,
            adminPhone: config.admin.phone
          });

          console.log("[EVENT ENROLLMENT] Notification result:", {
            studentNotificationStatus: notificationResult.studentNotification.success ? 'sent' : 'failed',
            adminNotificationStatus: notificationResult.adminNotification.success ? 'sent' : 'failed',
            studentPhone: studentPhone.slice(0, 3) + '****' + studentPhone.slice(-4),
            eventTitle: (matchingEvent as any).title,
            enrollmentId: enrollment.id
          });

        } catch (notificationError) {
          console.error("[EVENT ENROLLMENT] Notification error:", notificationError);
          // Don't fail the enrollment if notifications fail
        }
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: "Event enrollment created successfully",
        data: {
          ...enrollment,
          eventTitle: (matchingEvent as any).title,
          eventDate: (matchingEvent as any).event_date,
          eventTime: (matchingEvent as any).event_time,
          price: (matchingEvent as any).price
        }
      });

    } catch (error) {
      console.error("[EVENT ENROLLMENT] Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process event enrollment",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/admin/products", async (req, res) => {
    try {
      // Optionally exclude bulky image fields to keep the payload light
      const includeImages = (req.query.includeImages ?? req.query.images ?? '').toString().toLowerCase() === 'true';

      let products = await storage.getAllProducts();

      // Optionally exclude bulky image fields to keep the payload light
      const out = (products || []).map((p: any) => {
        const base: any = {
          ...p,
          // Include isbestseller and iscustom fields
          isbestseller: p.isbestseller || false,
          iscustom: p.iscustom || false,
        };
        if (!includeImages) {
          // Keep primary image for thumbnails but drop the rest to reduce size
          // Note: If you want to drop even the primary image, set base.image = undefined here
          delete base.imagefirst;
          delete base.imagesecond;
          delete base.imagethirder;
          delete base.imagefoure;
          delete base.imagefive;
        }
        return base;
      });

      // Prevent confusing 304s during development and ensure fresh data
      res.set('Cache-Control', 'no-store');
      return res.status(200).json(out);
    } catch (error) {
      console.error("Error getting products:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/admin/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error getting product:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Normalize and compute pricing fields on the server as single source of truth
      const raw = req.body || {};
      const updates: any = { ...raw };

      // Parse boolean helper function
      const parseBool = (v: any) => {
        if (v === true || v === 1 || v === '1') return true;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          return ['true', 'yes', 'on', 'enable'].includes(s);
        }
        return false;
      };

      // Parse boolean fields for product options
      if (raw.iscustom !== undefined) updates.iscustom = parseBool(raw.iscustom);
      if (raw.isCustom !== undefined) updates.iscustom = parseBool(raw.isCustom);
      if (raw.isbestseller !== undefined) updates.isbestseller = parseBool(raw.isbestseller);
      if (raw.isBestSeller !== undefined) updates.isbestseller = parseBool(raw.isBestSeller);
      if (raw.featured !== undefined) updates.featured = parseBool(raw.featured);
      
      // Map discounts_offers field correctly (frontend sends as discounts_offers, database expects discountsOffers)
      if (raw.discounts_offers !== undefined) {
        updates.discountsOffers = parseBool(raw.discounts_offers);
        
        // If discounts_offers is being set to false, clear all discount-related fields
        if (!parseBool(raw.discounts_offers)) {
          updates.originalPrice = null;
          updates.discountPercentage = null;
          updates.discountAmount = null;
        }
      }

      // Parse numeric fields if present and map to correct database field names
      if (raw.price !== undefined) updates.price = isNaN(Number(raw.price)) ? raw.price : Number(raw.price);
      
      // Handle stockQuantity field mapping (frontend might send stockquantity, stockQuantity, or stock_quantity)
      if (raw.stockquantity !== undefined) updates.stockQuantity = Number(raw.stockquantity);
      if (raw.stockQuantity !== undefined) updates.stockQuantity = Number(raw.stockQuantity);
      if (raw.stock_quantity !== undefined) updates.stockQuantity = Number(raw.stock_quantity);
      
      // Handle inStock field mapping (frontend might send instock or inStock)
      if (raw.instock !== undefined) updates.inStock = Boolean(raw.instock);
      if (raw.inStock !== undefined) updates.inStock = Boolean(raw.inStock);
      
      // Map frontend camelCase to database snake_case field names
      if (raw.originalPrice !== undefined) {
        const originalPriceValue = raw.originalPrice === null ? null : Number(raw.originalPrice);
        updates.originalPrice = originalPriceValue; // This will be mapped to original_price by the ORM
      }
      
      if (raw.discountPercentage !== undefined) {
        const discountPercentageValue = raw.discountPercentage === null ? null : Number(raw.discountPercentage);
        updates.discountPercentage = discountPercentageValue; // This will be mapped to discount_percentage by the ORM
      }

      // If discountPercentage is provided (or exists) and originalPrice is present, compute discountAmount and final price
      const hasPct = updates.discountPercentage !== undefined && updates.discountPercentage !== null && !isNaN(updates.discountPercentage);
      const hasOriginal = updates.originalPrice !== undefined && updates.originalPrice !== null && !isNaN(updates.originalPrice);

      if (hasPct && hasOriginal) {
        const { discountAmount, finalPrice, discountPercentage } = calculateDiscount(Number(updates.originalPrice), Number(updates.discountPercentage));
        updates.discountAmount = discountAmount; // This will be mapped to discount_amount by the ORM
        updates.price = finalPrice;
        updates.discountPercentage = discountPercentage;
      }

      // If discountPercentage is provided but originalPrice not provided, try to use current price as originalPrice
      if (hasPct && !hasOriginal && updates.price !== undefined) {
        const { discountAmount, finalPrice, discountPercentage } = calculateDiscount(Number(updates.price), Number(updates.discountPercentage));
        // assume existing price was originalPrice — set both originalPrice and price accordingly
        updates.originalPrice = Number(updates.price);
        updates.discountAmount = discountAmount;
        updates.price = finalPrice;
        updates.discountPercentage = discountPercentage;
      }

      console.log(`Updating product ${id} with:`, Object.keys(updates));

      const product = await storage.updateProduct(id, updates);

      res.json({
        success: true,
        message: "Product updated successfully",
        product
      });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update product",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Unified create product handler (accepts optional images)
 
  app.post("/api/admin/products", async (req, res) => {
    try {
      console.log("Creating product (unified handler)");
      console.log('Incoming body (create unified):', JSON.stringify(req.body || {}));
 
      const parseBool = (v: any) => {
        if (v === true || v === 1 || v === '1') return true;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          return ['true', 'yes', 'on', 'enable'].includes(s);
        }
        return false;
      };

      // Function to clean base64 data (if images are passed)
      const cleanBase64 = (base64String: string | undefined) => {
        if (!base64String) return null;
        if (base64String.includes('base64,')) {
          return base64String.split('base64,')[1];
        }
        return base64String;
      };
 
      // Accept optional images array in the same create payload
  const images = Array.isArray(req.body.images) ? req.body.images : [];

      // Normalize incoming fields and compute discount server-side
      const raw = req.body || {};

      // Parse boolean fields for iscustom and isbestseller after raw is declared
      const computedIsCustom = parseBool(raw.iscustom || raw.isCustom || raw.is_custom);
      const computedBestSeller = parseBool(raw.isbestseller || raw.isBestSeller || raw.is_best_seller || raw.bestSeller);

      // Normalize category: accept array, JSON string, or comma-separated list
      let categoryNorm: any = raw.category;
      if (Array.isArray(raw.category)) {
        categoryNorm = JSON.stringify(raw.category);
      } else if (typeof raw.category === 'string') {
        const trimmed = raw.category.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          // leave as-is (assume valid JSON array)
          categoryNorm = trimmed;
        } else if (trimmed.includes(',')) {
          categoryNorm = JSON.stringify(trimmed.split(',').map((s: string) => s.trim()).filter(Boolean));
        } else {
          categoryNorm = trimmed;
        }
      }

      // Accept multiple possible stock field names
      const stockRaw = raw.stockQuantity ?? raw.stockquantity ?? raw.stock_quantity ?? raw.stock ?? 0;
      const stockQuantity = stockRaw !== undefined ? Number(stockRaw) : 0;

      const productData: any = {
        name: raw.name,
        description: raw.description,
        // price will be final selling price; may be recalculated below
        price: raw.price !== undefined ? Number(raw.price) : undefined,
        originalPrice: raw.originalPrice !== undefined && raw.originalPrice !== null ? Number(raw.originalPrice) : undefined,
        discountPercentage: raw.discountPercentage !== undefined && raw.discountPercentage !== null ? Number(raw.discountPercentage) : undefined,
        discountAmount: raw.discountAmount !== undefined && raw.discountAmount !== null ? Number(raw.discountAmount) : undefined,
        category: categoryNorm,
        stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
        inStock: (raw.inStock !== undefined ? raw.inStock : raw.instock) !== undefined ? Boolean(raw.inStock ?? raw.instock) : true,
        featured: raw.featured || false,
        iscustom: computedIsCustom,
        isbestseller: computedBestSeller,
        colour: raw.colour || null,
        discounts_offers: Boolean(raw.discounts_offers),
        image: cleanBase64(images[0]) || 'placeholder',
        imagefirst: cleanBase64(images[1]) || null,
        imagesecond: cleanBase64(images[2]) || null,
        imagethirder: cleanBase64(images[3]) || null,
        imagefoure: cleanBase64(images[4]) || null
      };

      // Server-side pricing normalization: if discountPercentage is present, prefer originalPrice to compute discountAmount & final price
      if (typeof productData.discountPercentage === 'number' && !isNaN(productData.discountPercentage)) {
        // If originalPrice not provided, assume originalPrice equals provided price (or 0)
        const orig = typeof productData.originalPrice === 'number' && !isNaN(productData.originalPrice) ? productData.originalPrice : (typeof productData.price === 'number' && !isNaN(productData.price) ? productData.price : 0);
        const { discountAmount, finalPrice, discountPercentage } = calculateDiscount(Number(orig), Number(productData.discountPercentage));
        productData.originalPrice = orig;
        productData.discountAmount = discountAmount;
        productData.price = finalPrice;
        productData.discountPercentage = discountPercentage;
      } else {
        // Ensure fields are present and normalized
        if (productData.originalPrice === undefined && typeof productData.price === 'number') {
          productData.originalPrice = Number(productData.price);
        }
        if (productData.discountPercentage === undefined) productData.discountPercentage = 0;
        if (productData.discountAmount === undefined) productData.discountAmount = 0;
      }
 
      // Validate required fields
      if (!productData.name || !productData.description || productData.price === undefined || !productData.category) {
        return res.status(400).json({ error: "Missing required fields" });
      }
 
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });
 
 
  // Enhanced upload endpoint for multiple images at once (alternative)
  app.post("/api/admin/products/:id/upload-images", async (req, res) => {
    try {
      const { id } = req.params;
      const { images } = req.body;

      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: "Images array is required" });
      }

      const imageFields = ['image', 'imagefirst', 'imagesecond', 'imagethirder', 'imagefoure'];
      const updates: any = {};

      // Process each image
      for (let i = 0; i < Math.min(images.length, 5); i++) {
        const fieldName = imageFields[i];
        const imageData = images[i];

        // Clean base64 data
        const cleanImage = imageData.includes('base64,')
          ? imageData.split('base64,')[1]
          : imageData;

        updates[fieldName] = cleanImage;
      }

      const product = await storage.updateProduct(id, updates);

      res.json({
        success: true,
        message: `Uploaded ${Object.keys(updates).length} images successfully`,
        product
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });


  app.delete("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Product id is required' });
      }

      // storage.deleteProduct throws when product not found or deletion fails
      await storage.deleteProduct(id);

      // If we reach here, deletion succeeded
      return res.status(200).json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
      console.error('Error deleting product:', error?.message ?? error);

      // Handle expected 'not found' error coming from storage layer
      if (error instanceof Error && /not found/i.test(error.message)) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // If storage threw a DependencyError or the error message indicates a foreign-key constraint,
      // return 409 Conflict with details so the frontend can present an actionable message.
      const isDependencyError = (error && (error.code === 'has-dependencies' || /has related data|related data|violates foreign key|foreign key constraint/i.test(error.message || '')));
      if (isDependencyError) {
        const detail = error.detail || error.message || String(error);
        return res.status(409).json({
          error: 'Product has related data and cannot be deleted',
          detail,
          suggestion: 'Remove dependent entries (for example, carts) or archive the product instead of deleting.'
        });
      }

      return res.status(500).json({ error: 'Failed to delete product', detail: error?.message ?? String(error) });
    }
  });

  // Duplicate create handler removed — images and other fields are handled by the unified POST /api/admin/products above.

  app.get("/api/admin/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error getting orders:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  app.put("/api/admin/orders/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      console.log(`Updating order ${id} status to ${status}`);

      const order = await storage.updateOrderStatus(id, status);

      res.json({
        success: true,
        message: "Order status updated successfully",
        order
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update order status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/admin/AdminClasses", async (req, res) => {
    try {
      const classes = await storage.AdminClasses();
      res.json(classes);
    } catch (error) {
      console.error("Error getting classes:", error);
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.post("/api/admin/AdminClasses/Add", async (req, res) => {
    try {
      console.log("Received class creation request");

      const classData = {
        title: req.body.title,
        description: req.body.description,
        price: parseFloat(req.body.price),
        duration: req.body.duration,
        sessions: parseInt(req.body.sessions),
        features: JSON.stringify(req.body.features),
        popular: false,
        nextbatch: req.body.nextbatch,
        image: req.body.image,
        category: req.body.category
      };

      // Validate required fields
      if (!classData.title || !classData.description || !classData.price || !classData.duration) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await storage.AddAdminClasses(classData);
      res.status(201).json({
        success: true,
        message: "Class created successfully",
        data: result
      });
    } catch (error) {
      console.error("Error creating class:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create class",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.put("/api/admin/AdminClasses/:id", async (req, res) => {
    try {
      const classId = req.params.id;
      console.log("Received class update request for ID:", classId);

      if (!classId) {
        return res.status(400).json({
          success: false,
          error: "Class ID is required"
        });
      }

      const updateData = {
        title: req.body.title,
        description: req.body.description,
        price: req.body.price ? parseFloat(req.body.price) : undefined,
        duration: req.body.duration,
        sessions: req.body.sessions ? parseInt(req.body.sessions) : undefined,
        features: req.body.features ? JSON.stringify(req.body.features) : undefined,
        nextbatch: req.body.nextbatch,
        image: req.body.image,
        category: req.body.category
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const result = await storage.updateClass(classId, updateData);
      res.json({
        success: true,
        message: "Class updated successfully",
        data: result
      });
    } catch (error) {
      console.error("Error updating class:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update class",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.delete("/api/admin/AdminClasses/:id", async (req, res) => {
    try {
      const classId = req.params.id;
      await storage.deleteClass(classId);

      // Send success response
      res.json({
        success: true,
        message: "Class deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting class:", error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: "Class not found",
            message: error.message
          });
        }

        if (error.message.includes('foreign key constraint')) {
          return res.status(400).json({
            success: false,
            error: "Cannot delete class with dependencies",
            message: "This class has related data (enrollments) that must be removed first."
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to delete class",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Get enrollments for a specific class
  app.get("/api/admin/AdminClasses/:id/enrollments", async (req, res) => {
    try {
      const classId = req.params.id;
      console.log("Fetching enrollments for class ID:", classId);

      if (!classId) {
        return res.status(400).json({
          success: false,
          error: "Class ID is required"
        });
      }

      // Get class details first
      const classQuery = 'SELECT title FROM bouquetbar.courses WHERE id = $1';
      const classResult = await db.query(classQuery, [classId]);

      if (classResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Class not found"
        });
      }

      // Get enrollments for this class
      const enrollmentsQuery = `
        SELECT 
          id,
          fullname,
          email,
          phone,
          batch,
          questions,
          status,
          createdat
        FROM bouquetbar.enrollments 
        WHERE courseid = $1 
        ORDER BY createdat DESC
      `;
      const enrollmentsResult = await db.query(enrollmentsQuery, [classId]);

      res.json({
        success: true,
        classTitle: classResult.rows[0].title,
        enrollmentCount: enrollmentsResult.rows.length,
        enrollments: enrollmentsResult.rows
      });
    } catch (error) {
      console.error("Error fetching class enrollments:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch class enrollments",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // ==================== Coupon Admin Routes ====================
  
  // Get all coupons
  app.get("/api/admin/coupons", async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json({
        success: true,
        data: coupons
      });
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch coupons",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Get single coupon by ID
  app.get("/api/admin/coupons/:id", async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      const coupon = coupons.find((c: any) => c.id === req.params.id);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found"
        });
      }
      res.json({
        success: true,
        data: coupon
      });
    } catch (error) {
      console.error("Error fetching coupon:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch coupon",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Create new coupon
  app.post("/api/admin/coupons", async (req, res) => {
    try {
      const { code, type, value, isActive, startsAt, expiresAt, minOrderAmount, maxDiscount, usageLimit, description } = req.body;

      if (!code || !type || value === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: code, type, value"
        });
      }

      if (!['percentage', 'fixed'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid coupon type. Must be 'percentage' or 'fixed'"
        });
      }

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        type,
        value: parseFloat(value),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        startsAt: startsAt || null,
        expiresAt: expiresAt || null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        description: description || null
      });

      res.status(201).json({
        success: true,
        data: coupon
      });
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create coupon",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update coupon
  app.put("/api/admin/coupons/:id", async (req, res) => {
    try {
      const updates: any = {};
      const { code, type, value, isActive, startsAt, expiresAt, minOrderAmount, maxDiscount, usageLimit, description } = req.body;

      if (code !== undefined) updates.code = code.toUpperCase();
      if (type !== undefined) updates.type = type;
      if (value !== undefined) updates.value = parseFloat(value);
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (startsAt !== undefined) updates.startsAt = startsAt || null;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt || null;
      if (minOrderAmount !== undefined) updates.minOrderAmount = parseFloat(minOrderAmount);
      if (maxDiscount !== undefined) updates.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
      if (usageLimit !== undefined) updates.usageLimit = usageLimit ? parseInt(usageLimit) : null;
      if (description !== undefined) updates.description = description || null;

      const coupon = await storage.updateCoupon(req.params.id, updates);
      res.json({
        success: true,
        data: coupon
      });
    } catch (error) {
      console.error("Error updating coupon:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found"
        });
      }
      res.status(500).json({
        success: false,
        error: "Failed to update coupon",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Delete coupon
  app.delete("/api/admin/coupons/:id", async (req, res) => {
    try {
      await storage.deleteCoupon(req.params.id);
      res.json({
        success: true,
        message: "Coupon deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting coupon:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: "Coupon not found"
        });
      }
      res.status(500).json({
        success: false,
        error: "Failed to delete coupon",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // ==================== End Coupon Admin Routes ====================

  app.get("/api/landing/email", async (req, res) => {
    try {
      const subscriptions = await storage.getAllSubscriptions();
      res.json({
        success: true,
        message: "All subscriptions retrieved",
        data: subscriptions,
        count: subscriptions.length
      });
    } catch (error) {
      console.error("Error getting email subscriptions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get email subscriptions",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/landing/email", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email is required"
        });
      }

      const result = await storage.addEmailSubscription(email);
      res.json({
        success: true,
        message: result.message,
        data: result.subscription,
        isNew: result.isNew
      });
    } catch (error) {
      console.error("Error subscribing email:", error);
      res.status(500).json({
        success: false,
        error: "Failed to subscribe email",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Landing contact: accepts name, email, phone, city, address
  app.post("/api/landing/contact", async (req, res) => {
    try {
      const { name, email, phone, city, address } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const result = await storage.addLandingContact({ name, email, phone, city, address });
      res.json({ success: true, message: 'Contact saved', data: result.contact });
    } catch (error) {
      console.error('Error saving landing contact:', error);
      res.status(500).json({ success: false, error: 'Failed to save contact', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get all landing contacts
  app.get("/api/landing/contacts", async (req, res) => {
    try {
      const contacts = await storage.getAllLandingContacts();
      res.json({ success: true, data: contacts, count: Array.isArray(contacts) ? contacts.length : 0 });
    } catch (error) {
      console.error('Error fetching landing contacts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch landing contacts', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/Feedback", async (req, res) => {
    try {
      const feedback = await storage.getAllFeedback();
      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error("Error getting feedback:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get feedback",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/student-feedback", async (req, res) => {
    try {
      const { student_name, course_name, feedback_text, rating } = req.body;

      // Validate required fields
      if (!student_name || !course_name || !feedback_text || !rating) {
        return res.status(400).json({
          success: false,
          error: "All fields are required: student_name, course_name, feedback_text, rating"
        });
      }

      // Validate rating (should be between 1-5)
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({
          success: false,
          error: "Rating must be an integer between 1 and 5"
        });
      }

      const result = await storage.addStudentFeedback({
        student_name: student_name.trim(),
        course_name: course_name.trim(),
        feedback_text: feedback_text.trim(),
        rating: parseInt(rating)
      });

      res.status(201).json({
        success: true,
        message: "Student feedback added successfully",
        data: result
      });
    } catch (error) {
      console.error("Error adding student feedback:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add student feedback",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/student-feedback/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Feedback ID is required"
        });
      }

      await storage.deleteStudentFeedback(id);

      res.json({
        success: true,
        message: "Student feedback deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting student feedback:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete student feedback",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/office-timing", async (req, res) => {
    try {
      const timings = await storage.getOfficeTimings();
      res.json({
        success: true,
        data: timings
      });
    } catch (error) {
      console.error("Error getting office timings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get office timings"
      });
    }
  });

  app.get("/api/getStudents", async (req, res) => {
    try {
      const students = await storage.getStudents();
      res.json({
        success: true,
        data: students
      });
    } catch (error) {
      console.error("Error getting students:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get students"
      });
    }
  });

  // Instructor Management API Endpoints
  app.get("/api/instructors", async (req, res) => {
    try {
      const instructors = await storage.getAllInstructors();
      res.json({
        success: true,
        data: instructors
      });
    } catch (error) {
      console.error("Error getting instructors:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get instructors"
      });
    }
  });

  app.get("/api/instructors/active", async (req, res) => {
    try {
      const instructors = await storage.getActiveInstructors();
      res.json({
        success: true,
        data: instructors
      });
    } catch (error) {
      console.error("Error getting active instructors:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get active instructors"
      });
    }
  });

  app.get("/api/instructors/specialization/:specialization", async (req, res) => {
    try {
      const { specialization } = req.params;
      const instructors = await storage.getInstructorsBySpecialization(specialization);
      res.json({
        success: true,
        data: instructors
      });
    } catch (error) {
      console.error("Error getting instructors by specialization:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get instructors by specialization"
      });
    }
  });

  app.get("/api/instructors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const instructor = await storage.getInstructor(id);

      if (!instructor) {
        return res.status(404).json({
          success: false,
          error: "Instructor not found"
        });
      }

      res.json({
        success: true,
        data: instructor
      });
    } catch (error) {
      console.error("Error getting instructor:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get instructor"
      });
    }
  });

  app.post("/api/admin/instructors", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const { name, email, phone, role, specialization, experience_years, bio, profile_image, hourly_rate, availability, is_active } = req.body;

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          error: "Name and email are required"
        });
      }

      // Validate email format - only allow .com addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Invalid email format - only .com addresses are allowed"
        });
      }

      const instructorData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        role: role?.trim() || null,
        specialization: specialization?.trim() || null,
        experience_years: experience_years ? parseInt(experience_years) : 0,
        bio: bio?.trim() || null,
        profile_image: profile_image || null,
        hourly_rate: hourly_rate ? parseFloat(hourly_rate) : 0.00,
        availability: availability || [],
        is_active: is_active !== undefined ? is_active : true
      };

      const instructor = await storage.createInstructor(instructorData);

      res.status(201).json({
        success: true,
        message: "Instructor created successfully",
        data: instructor
      });
    } catch (error) {
      console.error("Error creating instructor:", error);

      if (error instanceof Error) {
        if (error.message.includes('Email already exists')) {
          return res.status(409).json({
            success: false,
            error: "Email already exists"
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to create instructor",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/admin/instructors/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required"
        });
      }

      // Validate email format if email is being updated
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
        if (!emailRegex.test(updates.email)) {
          return res.status(400).json({
            success: false,
            error: "Invalid email format - only .com addresses are allowed"
          });
        }
        updates.email = updates.email.trim().toLowerCase();
      }

      // Sanitize string fields
      if (updates.name) updates.name = updates.name.trim();
      if (updates.phone) updates.phone = updates.phone.trim();
      if (updates.role) updates.role = updates.role.trim();
      if (updates.specialization) updates.specialization = updates.specialization.trim();
      if (updates.bio) updates.bio = updates.bio.trim();

      // Convert numeric fields
      if (updates.experience_years) updates.experience_years = parseInt(updates.experience_years);
      if (updates.hourly_rate) updates.hourly_rate = parseFloat(updates.hourly_rate);

      const instructor = await storage.updateInstructor(id, updates);

      res.json({
        success: true,
        message: "Instructor updated successfully",
        data: instructor
      });
    } catch (error) {
      console.error("Error updating instructor:", error);

      if (error instanceof Error) {
        if (error.message.includes('Email already exists')) {
          return res.status(409).json({
            success: false,
            error: "Email already exists"
          });
        }

        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: "Instructor not found"
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to update instructor",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/admin/instructors/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required"
        });
      }

      await storage.deleteInstructor(id);

      res.json({
        success: true,
        message: "Instructor deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting instructor:", error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: "Instructor not found"
          });
        }

        if (error.message.includes('associated classes')) {
          return res.status(400).json({
            success: false,
            error: "Cannot delete instructor with associated classes or bookings"
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to delete instructor",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  app.post("/api/admin/office-timing", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";

      const { office_day, open_time, close_time, is_holiday } = req.body;

      if (!office_day || !open_time || !close_time) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: office_day, open_time, close_time"
        });
      }

      const timing = await storage.createOfficeTiming({
        office_day,
        open_time,
        close_time,
        is_holiday: is_holiday || false
      });

      res.status(201).json({
        success: true,
        message: "Office timing created successfully",
        data: timing
      });
    } catch (error) {
      console.error("Error creating office timing:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create office timing"
      });
    }
  });

  app.put("/api/admin/office-timing/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const { id } = req.params;
      const updates = req.body;

      const timing = await storage.updateOfficeTiming(id, updates);

      res.json({
        success: true,
        message: "Office timing updated successfully",
        data: timing
      });
    } catch (error) {
      console.error("Error updating office timing:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update office timing"
      });
    }
  });

  app.delete("/api/admin/office-timing/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const { id } = req.params;
      await storage.deleteOfficeTiming(id);

      res.json({
        success: true,
        message: "Office timing deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting office timing:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete office timing"
      });
    }
  });

  // Event Management Routes (Admin)
  app.get("/api/admin/events", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const events = await storage.getAllEvents();
      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      console.error("Error getting events:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get events"
      });
    }
  });

  app.get("/api/admin/events/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: "Event not found"
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error("Error getting event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get event"
      });
    }
  });

  app.post("/api/admin/events", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      console.log("Received event creation request:", req.body);

      // Function to clean base64 data
      const cleanBase64 = (base64String: string | undefined) => {
        if (!base64String) return null;
        // Remove the data:image prefix if it exists
        if (base64String.includes('base64,')) {
          return base64String.split('base64,')[1];
        }
        return base64String;
      };

      const eventData = {
        title: req.body.title,
        description: req.body.description,
        event_type: req.body.event_type,
        event_date: req.body.event_date,
        event_time: req.body.event_time,
        duration: req.body.duration,
        instructor: req.body.instructor,
        spots_left: req.body.spots_left ? parseInt(req.body.spots_left) : null,
        image: cleanBase64(req.body.image),
        booking_available: req.body.booking_available !== undefined ? req.body.booking_available : true,
        amount: req.body.amount || '0.00'
      };

      // Validate required fields
      if (!eventData.title || !eventData.event_type || !eventData.event_date) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: title, event_type, event_date"
        });
      }

      const event = await storage.createEvent(eventData);
      res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: event
      });
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.put("/api/admin/events/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventId = req.params.id;
      console.log("Received event update request for ID:", eventId);

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Event ID is required"
        });
      }

      // Function to clean base64 data
      const cleanBase64 = (base64String: string | undefined) => {
        if (!base64String) return undefined;
        // Remove the data:image prefix if it exists
        if (base64String.includes('base64,')) {
          return base64String.split('base64,')[1];
        }
        return base64String;
      };

      const updateData = {
        title: req.body.title,
        description: req.body.description,
        event_type: req.body.event_type,
        event_date: req.body.event_date,
        event_time: req.body.event_time,
        duration: req.body.duration,
        instructor: req.body.instructor,
        spots_left: req.body.spots_left ? parseInt(req.body.spots_left) : undefined,
        image: cleanBase64(req.body.image),
        booking_available: req.body.booking_available,
        amount: req.body.amount
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const event = await storage.updateEvent(eventId, updateData);
      res.json({
        success: true,
        message: "Event updated successfully",
        data: event
      });
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.delete("/api/admin/events/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventId = req.params.id;
      await storage.deleteEvent(eventId);

      // Send success response
      res.json({
        success: true,
        message: "Event deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting event:", error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: "Event not found",
            message: error.message
          });
        }

        if (error.message.includes('enrollments')) {
          return res.status(400).json({
            success: false,
            error: "Cannot delete event with dependencies",
            message: "This event has existing enrollments that must be removed first."
          });
        }
      }

      res.status(500).json({
        success: false,
        error: "Failed to delete event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });


  // Get enrollments for a specific event
  app.get("/api/admin/events/:id/enrollments", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Admin authorization
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventId = req.params.id;
      console.log("Fetching enrollments for event ID:", eventId);

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Event ID is required"
        });
      }

      // Get event details first
      const eventQuery = 'SELECT title FROM bouquetbar.events WHERE id = $1';
      const eventResult = await db.query(eventQuery, [eventId]);

      if (eventResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Event not found"
        });
      }

      // Get enrollments for this event
      const enrollmentsQuery = `
        SELECT 
          id,
          first_name,
          last_name,
          email,
          phone,
          payment_status,
          payment_amount,
          transaction_id,
          enrolled_at
        FROM bouquetbar.events_enrollments 
        WHERE event_id = $1 
        ORDER BY enrolled_at DESC
      `;
      const enrollmentsResult = await db.query(enrollmentsQuery, [eventId]);

      res.json({
        success: true,
        eventTitle: eventResult.rows[0].title,
        enrollmentCount: enrollmentsResult.rows.length,
        enrollments: enrollmentsResult.rows
      });
    } catch (error) {
      console.error("Error fetching event enrollments:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch event enrollments",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Event Management API Endpoints

  // Create a new event
  app.post("/api/events", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized - Admin access required"
        });
      }

      // Check if user is admin
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventData = req.body;
      console.log("Creating event with data:", eventData);

      const newEvent = await storage.createEvent(eventData);

      res.status(201).json({
        success: true,
        message: "Event created successfully",
        event: newEvent
      });
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update an existing event
  app.put("/api/events/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized - Admin access required"
        });
      }

      // Check if user is admin
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventId = req.params.id;
      const eventData = req.body;

      console.log("Updating event with ID:", eventId, "Data:", eventData);

      const updatedEvent = await storage.updateEvent(eventId, eventData);

      if (!updatedEvent) {
        return res.status(404).json({
          success: false,
          error: "Event not found"
        });
      }

      res.json({
        success: true,
        message: "Event updated successfully",
        event: updatedEvent
      });
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Delete an event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const user = await getUserFromSession(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized - Admin access required"
        });
      }

      // Check if user is admin
      const isAdmin = config.admin.emails.includes(user.email) || user.userType === "admin";
      const eventId = req.params.id;
      console.log("Deleting event with ID:", eventId);

      await storage.deleteEvent(eventId);

      res.json({
        success: true,
        message: "Event deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });



  // Impacts endpoints (key/value)
  app.get('/api/impacts', async (req, res) => {
    try {
      const impacts = await storage.getImpacts();
      res.json(impacts);
    } catch (error) {
      console.error('Error fetching impacts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch impacts' });
    }
  });

  app.post('/api/impacts', async (req, res) => {
    try {
      // const user = await getUserFromSession(req);
      // if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      // const isAdmin = config.admin.emails.includes(user.email) || user.userType === 'admin';
      // if (!isAdmin) return res.status(403).json({ success: false, error: 'Forbidden - Admin only' });

      const { title, value } = req.body;
      // Validate input
      if (!title || value === undefined) return res.status(400).json({ success: false, error: 'Missing title or value' });

      // Enforce maximum of 4 impacts
      const existing = await storage.getImpacts();
      if (existing && existing.length >= 4) {
        return res.status(400).json({ success: false, error: 'Maximum of 4 impacts allowed' });
      }

      const created = await storage.createImpact({ title: String(title), value: String(value) });
      res.status(201).json({ success: true, message: 'Impact created', data: created });
    } catch (error) {
      console.error('Error creating impact:', error);
      res.status(500).json({ success: false, error: 'Failed to create impact', message: error instanceof Error ? error.message : String(error) });
    }
  });

       app.put("/api/impacts/:id", async (req, res) => {
        try {
          const user = await getUserFromSession(req);
          if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

         
          
          const { id } = req.params;
          const { title, value } = req.body;

          if (!title || value === undefined) {
            return res.status(400).json({ success: false, error: 'Missing title or value' });
          }

          const updated = await storage.updateImpact(id, { title: String(title), value: String(value) });
          res.json({ success: true, message: 'Impact updated', data: updated });
        } catch (error) {
          console.error('Error updating impact:', error);
          res.status(500).json({ success: false, error: 'Failed to update impact', message: error instanceof Error ? error.message : String(error) });
        }
      });

  app.delete('/api/impacts/:id', async (req, res) => {
    try {
      // const user = await getUserFromSession(req);
      // if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      // const isAdmin = config.admin.emails.includes(user.email) || user.userType === 'admin';
      // if (!isAdmin) return res.status(403).json({ success: false, error: 'Forbidden - Admin only' });

      const { id } = req.params;
      await storage.deleteImpact(id);
      res.json({ success: true, message: 'Impact deleted' });
    } catch (error) {
      console.error('Error deleting impact:', error);
      res.status(500).json({ success: false, error: 'Failed to delete impact' });
    }
  });


  // Get specific event by ID
  app.get("/api/events/:id", async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await storage.getEventById(eventId);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: "Event not found"
        });
      }

      res.json({
        success: true,
        event: event
      });
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Pay Later API Endpoints
  
  // POST /api/paylater - Create a new pay later record
  app.post("/api/paylater", async (req, res) => {
    try {
      const { 
        full_name, 
        email_address, 
        phone_number, 
        payment_method, 
        questions_or_comments 
      } = req.body;

      // Validate required fields
      if (!full_name || !email_address || !phone_number || !payment_method) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: full_name, email_address, phone_number, payment_method"
        });
      }

      // Insert into database
      const result = await db.query(
        `INSERT INTO bouquetbar.paylater 
         (full_name, email_address, phone_number, payment_method, questions_or_comments) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [full_name, email_address, phone_number, payment_method, questions_or_comments || null]
      );

      console.log(`[PAY LATER] New record created for ${full_name} (${email_address})`);

      res.status(201).json({
        success: true,
        message: "Pay later record created successfully",
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error creating pay later record:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create pay later record",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // GET /api/paylater - Get all pay later records
  app.get("/api/paylater", async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM bouquetbar.paylater 
         ORDER BY created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } catch (error) {
      console.error("Error fetching pay later records:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch pay later records",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // GET /api/paylater/:id - Get a specific pay later record
  app.get("/api/paylater/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM bouquetbar.paylater WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Pay later record not found"
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error fetching pay later record:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch pay later record",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // DELETE /api/paylater/:id - Delete a pay later record
  app.delete("/api/paylater/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `DELETE FROM bouquetbar.paylater WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,

          error: "Pay later record not found"
        });
      }

      res.json({
        success: true,
        message: "Pay later record deleted successfully",
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error deleting pay later record:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete pay later record",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Instructor Management API Endpoints

  // POST /api/admin/instructors - Create a new instructor
  app.post("/api/admin/instructors", async (req, res) => {
    try {
      const { 
        name, 
        email, 
        phone, 
        role,
        specialization, 
        experience_years, 
        bio, 
        hourly_rate, 
        profile_image, 
        is_active 
      } = req.body;

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, email"
        });
      }

      // Insert into database
      const result = await db.query(
        `INSERT INTO bouquetbar.instructors 
         (name, email, phone, role, specialization, experience_years, bio, hourly_rate, profile_image, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) 
         RETURNING *`,
        [name, email, phone, role, specialization, experience_years || 0, bio, hourly_rate || 0, profile_image, is_active !== false]
      );

      console.log(`[INSTRUCTOR] New instructor created: ${name} (${email})`);

      res.status(201).json({
        success: true,
        message: "Instructor created successfully",
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error creating instructor:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create instructor",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // GET /api/admin/instructors - Get all instructors
  app.get("/api/admin/instructors", async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM bouquetbar.instructors ORDER BY created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error("Error fetching instructors:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch instructors",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // GET /api/admin/instructors/:id - Get a specific instructor
  app.get("/api/admin/instructors/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM bouquetbar.instructors WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Instructor not found"
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error fetching instructor:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch instructor",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // PUT /api/admin/instructors/:id - Update an instructor
  app.put("/api/admin/instructors/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        name, 
        email, 
        phone, 
        role,
        specialization, 
        experience_years, 
        bio, 
        hourly_rate, 
        profile_image, 
        is_active 
      } = req.body;

      // Check if instructor exists
      const existingResult = await db.query(
        `SELECT * FROM bouquetbar.instructors WHERE id = $1`,
        [id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Instructor not found"
        });
      }

      // Update instructor
      const result = await db.query(
        `UPDATE bouquetbar.instructors 
         SET name = $1, email = $2, phone = $3, role = $4, specialization = $5, 
             experience_years = $6, bio = $7, hourly_rate = $8, profile_image = $9, 
             is_active = $10, updated_at = NOW()
         WHERE id = $11 
         RETURNING *`,
        [name, email, phone, role, specialization, experience_years || 0, bio, hourly_rate || 0, profile_image, is_active !== false, id]
      );

      console.log(`[INSTRUCTOR] Updated instructor: ${name} (${email})`);

      res.json({
        success: true,
        message: "Instructor updated successfully",
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error updating instructor:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update instructor",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // DELETE /api/admin/instructors/:id - Delete an instructor
  app.delete("/api/admin/instructors/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `DELETE FROM bouquetbar.instructors WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Instructor not found"
        });
      }

      console.log(`[INSTRUCTOR] Deleted instructor: ${result.rows[0].name}`);

      res.json({
        success: true,
        message: "Instructor deleted successfully",
        data: result.rows[0]
      });

    } catch (error) {
      console.error("Error deleting instructor:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete instructor",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });



  // Health check endpoint for monitoring and load balancers
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0"
    });
  });

  // Alternative health check endpoints
  app.get("/ping", (req, res) => {
    res.status(200).send("pong");
  });

  app.get("/status", (req, res) => {
    res.status(200).json({
      status: "running",
      timestamp: new Date().toISOString()
    });
  })

  const httpServer = createServer(app);
  return httpServer;
}


