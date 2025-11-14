

// Get all custom requests
export async function getAllCustomRequests() {
  const result = await db.query(`SELECT * FROM bouquetbar.custom ORDER BY created_at DESC`);
  return result.rows;
}
import {
  users,
  products,
  courses,
  orders,
  enrollments,
  testimonials,
  blogPosts,
  carts,
  favorites,
  coupons,
  addresses,
  deliveryOptions,
  orderStatusHistory,
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type Course,
  type InsertCourse,
  type Order,
  type InsertOrder,
  type Enrollment,
  type InsertEnrollment,
  type Testimonial,
  type InsertTestimonial,
  type BlogPost,
  type InsertBlogPost,
  type Cart,
  type InsertCart,
  type Favorite,
  type InsertFavorite,
  type Coupon,
  type InsertCoupon,
  type Address,
  type InsertAddress,
  type DeliveryOption,
  type InsertDeliveryOption,
  type OrderPlacement,
  type OrderStatusHistory,
  type InsertOrderStatusHistory
} from "./shared/schema.js";
import { db } from "./db.js";
import { eq, and, sql, inArray, lte } from "drizzle-orm";
import { IStorage } from "./storage.js";

// Custom error to signal dependency/foreign-key constraint issues
export class DependencyError extends Error {
  public code = 'has-dependencies';
  public detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, DependencyError.prototype);
  }
}

export class DatabaseStorage implements IStorage {

  async getUser(id: string): Promise<User | undefined> {
    try {
      if (!id) {
        throw new Error("User ID is required");
      }
      const query = `
      SELECT *
      FROM bouquetbar.users
      WHERE id = '${id}'
      LIMIT 1;
    `;
      console.log("Executing query:", query);
      const result = await db.query(query);
      console.log("Query Result:", result.rows || "No user found");
      return result.rows[0] || undefined;
    } catch (error) {
      console.error("Error in getUser:", error);
      throw new Error(
        `Failed to get user: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }


  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserByEmail(email: string, password: string): Promise<User | undefined> {
    if (!email) return undefined;
    const query = `SELECT *
            FROM bouquetbar.users
            WHERE email = '${email}'
              AND  password='${password}'
              AND isactive=true
            LIMIT 1`;
    console.log('Executing query:', query);
    const result = await db.query(query);
    console.log('Query Result:', result.rows || 'No user found');
    return result.rows[0] || undefined;
  }



  async createCustomRequest(images: string, comment: string, product_id: string, user_name?: string, user_email?: string, user_phone?: string): Promise < User | undefined > {
  try {
    const query = {
      text: `INSERT INTO bouquetbar.custom (images, comment, product_id, user_name, user_email, user_phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      values: [images, comment, product_id, user_name || null, user_email || null, user_phone || null]
    };
    console.log('Executing query:', query);
    const result = await db.query(query.text, query.values);
    console.log('Query Result:', result.rows);
    return result.rows[0] || undefined;
  } catch (error) {
    console.error('Error in createCustomRequest:', error);
    throw new Error(`Failed to create custom request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getUserByEmailOnly(email: string): Promise<User | undefined> {
    if (!email) {
      console.log('getUserByEmailOnly: No email provided');
      return undefined;
    }
    
    try {
      // Use parameterized query to prevent SQL injection
      const query = `SELECT * FROM bouquetbar.users WHERE email = $1 LIMIT 1`;
      console.log('Executing query for email:', email);
      
      const result = await db.query(query, [email]);
      console.log('Query result rows count:', result.rows?.length || 0);
      
      if (result.rows && result.rows.length > 0) {
        console.log('User found for email:', email);
        return result.rows[0] as User;
      } else {
        console.log('No user found for email:', email);
        return undefined;
      }
    } catch (error) {
      console.error('Error in getUserByEmailOnly:', error);
      throw new Error(`Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserByPhone(phone: string): Promise < User | undefined > {
  if(!phone) return undefined;
  const query = `SELECT *
            FROM bouquetbar.users
            WHERE phone = '${phone}'
            LIMIT 1`;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows || 'No user found');
  return result.rows[0] || undefined;
}

  // Check if any user account uses the given password
  async passwordExists(password: string): Promise<boolean> {
    try {
      if (!password) return false;
      const query = {
        text: `SELECT 1 FROM bouquetbar.users WHERE password = $1 LIMIT 1;`,
        values: [password]
      };
      const result = await db.query(query.text, query.values);
      return Array.isArray(result.rows) && result.rows.length > 0;
    } catch (error) {
      console.error('Error checking password existence:', error);
      return false;
    }
  }

  async createUser(insertUser: InsertUser): Promise < User > {
  try {
    // Input validation
    if(!insertUser.email?.trim()) {
  throw new Error('Email is required');
}
if (!insertUser.firstName?.trim()) {
  throw new Error('First name is required');
}
if (!insertUser.lastName?.trim()) {
  throw new Error('Last name is required');
}
if (!insertUser.phone?.trim()) {
  throw new Error('Phone number is required');
}
if (!insertUser.password?.trim()) {
  throw new Error('Password is required');
}

// Email format validation (only allow .com addresses)
const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
if (!emailRegex.test(insertUser.email)) {
  throw new Error('Invalid email format - only .com addresses are allowed');
}

const query = {
  text: `
              INSERT INTO bouquetbar.users (
                email,
                firstname,
                lastname,
                phone,
                usertype,
                password,
                createdat
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING *;
            `,
  values: [
    insertUser.email.trim(),
    insertUser.firstName.trim(),
    insertUser.lastName.trim(),
    insertUser.phone.trim(),
    'user',
    insertUser.password,
    new Date(),
  ]
};

console.log('Executing query:', query);
const result = await db.query(query);
console.log('Insert Result:', result.rows);
return result.rows[0];
    } catch (error) {
  console.error('Error in createUser:', error);
  throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  async updateUser(id: string, updates: Partial<User>): Promise < User > {
  try {
    const updateFields: string[] = [];
    if(updates.email) updateFields.push(`email = '${updates.email}'`);
    if(updates.firstName) updateFields.push(`firstname = '${updates.firstName}'`);
    if(updates.lastName) updateFields.push(`lastname = '${updates.lastName}'`);
    if(updates.phone) updateFields.push(`phone = '${updates.phone}'`);
    if(updates.password) updateFields.push(`password = '${updates.password}'`);
    if(updates.userType) updateFields.push(`usertype = '${updates.userType}'`);

    // Always update "updated_at"
    updateFields.push(`updatedat = NOW()`);

    if(updateFields.length === 1) { // Only updatedAt field
  throw new Error("No fields provided for update.");
}

const updateQuery = `
        UPDATE bouquetbar.users
        SET ${updateFields.join(", ")}
        WHERE id = '${id}'
        RETURNING *;
      `;
console.log("Executing update query:", updateQuery);
const result = await db.query(updateQuery);
if (!result.rows || result.rows.length === 0) {
  throw new Error(`User with id ${id} not found.`);
}

return result.rows[0];
    } catch (error) {
  console.error("[USER UPDATE ERROR] Failed to update user:", error);
  throw error;
}
  }

  async updateUserProfile(id: string, profile: any): Promise < User > {
  try {
    console.log("Updating user profile with data:", profile);
    const updates: string[] = [];
    if(profile.email) updates.push(`email = '${profile.email}'`);

    // Handle both firstName/firstname variations
    const firstName = profile.firstName || profile.firstname;
    if(firstName) updates.push(`firstname = '${firstName}'`);

    // Handle both lastName/lastname variations
    const lastName = profile.lastName || profile.lastname;
    if(lastName) updates.push(`lastname = '${lastName}'`);

    if(profile.phone) updates.push(`phone = '${profile.phone}'`);
    if(profile.password) updates.push(`password = '${profile.password}'`);
    if(profile.userType) updates.push(`usertype = '${profile.userType}'`);
    if(profile.profileImageUrl) updates.push(`profileimageurl = '${profile.profileImageUrl}'`);
    if(profile.defaultAddress) updates.push(`defaultaddress = '${profile.defaultAddress}'`);
    if(profile.deliveryAddress) updates.push(`deliveryaddress = '${profile.deliveryAddress}'`);
    if(profile.country) updates.push(`country = '${profile.country}'`);
    if(profile.state) updates.push(`state = '${profile.state}'`);
    if(profile.points !== undefined) updates.push(`points = ${profile.points}`);
    updates.push(`updatedat = NOW()`);

    if(updates.length === 1) {
  throw new Error("No fields provided for update.");
}

const updateQuery = `
          UPDATE bouquetbar.users
          SET ${updates.join(", ")}
          WHERE id = '${id}'
          RETURNING *;`;
console.log("Executing update query:", updateQuery);
const result = await db.query(updateQuery);
if (!result.rows || result.rows.length === 0) {
  throw new Error(`User with id ${id} not found.`);
}
return result.rows[0];
    } catch (error) {
  console.error("[USER UPDATE ERROR] Failed to update profile:", error);
  throw error;
}
  }


  async deleteUser(id: string): Promise < void> {
  const query = `
    UPDATE bouquetbar.users
    SET isactive = false
    WHERE id = '${id}';`;
  console.log('Executing query:', query);
  await db.query(query);
  console.log('User deleted successfully');
}

  // Product Methods
  async getAllProducts(): Promise < Product[] > {
  try {
    const query = `
      SELECT *
      FROM bouquetbar.products
      WHERE isactive = true
      ORDER BY createdat DESC;
      `;
    console.log('Executing query:', query);
    const result = await db.query(query);
    console.log('Query Result:', result.rows);
    return result.rows;
  } catch(error) {
    console.error('Error in getAllProducts:', error);
    throw new Error(`Failed to get products: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


  async getFeaturedProducts(): Promise < Product[] > {
  const query = `
    SELECT *
    FROM bouquetbar.products
    WHERE isactive = true
    AND featured = true;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);

  return result.rows;
}

//   async getProductsByCategoryAndSubcategory(category: string, subcategory ?: string, searchKeyword ?: string): Promise < Product[] > {
//   try {
//     // If no parameters provided, return all in-stock products
//     if(!category && !subcategory && !searchKeyword) {
//       const q = `SELECT * FROM bouquetbar.products WHERE "inStock" = true AND isactive = true ORDER BY createdat DESC`;
//       console.log('Executing query:', q);
//       const r = await db.query(q);
//       console.log('Query Result:', r.rows?.length ?? 0);
//       return r.rows || [];
//     }

//     const params: any[] = [];
//     const searchClauses: string[] = [];
    
//     if (subcategory) {

//       const subcategoryParamIndex = params.length + 1;
//       params.push(`%${subcategory}%`);
      
//       // First try subcategory column, then category column, then name/description but with higher relevance for exact matches
//       const subcategorySearchClauses = [
//         `subcategory ILIKE $${subcategoryParamIndex}`, // Highest priority: exact subcategory match
//         `category ILIKE $${subcategoryParamIndex}`,     // Medium priority: category field match
//         `name ILIKE $${subcategoryParamIndex}`,         // Lower priority: name contains the term
//         `description ILIKE $${subcategoryParamIndex}`   // Lowest priority: description contains the term
//       ];
      
//       searchClauses.push(`(${subcategorySearchClauses.join(' OR ')})`);
//     } else if (category) {
//       // Only filter by category if no subcategory is provided
//       params.push(`%${category}%`);
//       searchClauses.push(`category ILIKE $${params.length}`);
//     }

//     // Handle keyword search - comprehensive search across all relevant fields
//     if (searchKeyword) {
//       const keywordParamIndex = params.length + 1;
//       params.push(`%${searchKeyword}%`);
      
//       const keywordSearchClauses = [
//         `name ILIKE $${keywordParamIndex}`,
//         `description ILIKE $${keywordParamIndex}`,
//         `category ILIKE $${keywordParamIndex}`,
//         `subcategory ILIKE $${keywordParamIndex}`
//       ];
      
//       searchClauses.push(`(${keywordSearchClauses.join(' OR ')})`);
//     }

//     // Build WHERE clause: require inStock and match search criteria
//     let where = `"inStock" = true AND isactive = true`;
//     if (searchClauses.length > 0) {
//       where += ` AND (${searchClauses.join(' AND ')})`;
//     }

//     // Add relevance-based ordering for better search results
//     let orderBy = `ORDER BY createdat DESC`;
//     if (searchKeyword || subcategory) {
//       const searchTerm = searchKeyword || subcategory;
//       orderBy = `ORDER BY 
//         CASE 
//           WHEN subcategory ILIKE '%${searchTerm}%' THEN 1      -- Highest priority: subcategory exact match
//           WHEN category ILIKE '%${searchTerm}%' THEN 2         -- High priority: category match  
//           WHEN name ILIKE '%${searchTerm}%' THEN 3             -- Medium priority: name match
//           WHEN description ILIKE '%${searchTerm}%' THEN 4      -- Lower priority: description match
//           ELSE 5
//         END, createdat DESC`;
//     }

//     const query = `SELECT * FROM bouquetbar.products WHERE ${where} ${orderBy}`;
//     console.log('Executing strict category search query:', query, 'params:', params);
//     const res = await db.query(query, params);
//     console.log('Strict category search result:', res.rows?.length ?? 0);

//     // IMPORTANT: Return only exact matches - no fallback to all products
//     // This ensures users see only products that actually match their category selection
//     // If no products exist for "Funeral Home Delivery", they will see an empty list
//     return res.rows || [];
//   } catch (error) {
//     console.error('Error in getProductsByCategoryAndSubcategory:', error);
//     // On error, return empty array instead of throwing to keep callers resilient
//     return [];
//   }
// }

  async getProductsByCategoryAndSubcategory(category: string, subcategory?: string, searchKeyword?: string): Promise<Product[]> {
    try {
      // If no parameters provided, return all in-stock products
      if (!category && !subcategory && !searchKeyword) {
        const q = `SELECT * FROM bouquetbar.products WHERE "inStock" = true AND isactive = true ORDER BY createdat DESC`;
        console.log('Executing query: Get all products');
        const r = await db.query(q);
        console.log('Query Result:', r.rows?.length ?? 0);
        return r.rows || [];
      }

      const params: any[] = [];
      const searchClauses: string[] = [];

      // Helper function to add search clauses for a term
      // This will also add simple variants (singular/plural and punctuation-stripped)
      // so searches like "Lilies" will match product names stored as "Lily" or "Lilies".
      const addSearchClause = (term: string, description: string) => {
        const variants = new Set<string>();
        const cleaned = term.trim();
        if (!cleaned) return;
        variants.add(cleaned);

        // simple singularization rules: handle common plural endings
        if (/ies$/i.test(cleaned)) {
          // lilies -> lily
          variants.add(cleaned.replace(/ies$/i, 'y'));
        } else if (/ves$/i.test(cleaned)) {
          // e.g., 'leaves' -> 'leaf' (best-effort)
          variants.add(cleaned.replace(/ves$/i, 'f'));
        } else if (/s$/i.test(cleaned)) {
          // generic plural ending: remove trailing 's'
          variants.add(cleaned.replace(/s$/i, ''));
        }

        // stripped punctuation variant
        const alnum = cleaned.replace(/[^a-zA-Z0-9 ]+/g, '').trim();
        if (alnum && alnum !== cleaned) variants.add(alnum);

        // Build clause that checks all variants (OR between variants).
        // Use main_category and subcategory (both stored as text/JSON) and match using ILIKE so
        // values stored as arrays (JSON) or comma-separated lists will still match the term.
        const variantClauses: string[] = [];
        variants.forEach((v) => {
          const paramIndex = params.length + 1;
          params.push(`%${v}%`);
          variantClauses.push(`(
            LOWER(COALESCE(main_category::text, '')) LIKE LOWER($${paramIndex}) OR
            LOWER(COALESCE(subcategory::text, '')) LIKE LOWER($${paramIndex}) OR
            LOWER(name) LIKE LOWER($${paramIndex}) OR
            LOWER(description) LIKE LOWER($${paramIndex})
          )`);
        });

        if (variantClauses.length > 0) {
          const clause = `(${variantClauses.join(' OR ')})`;
          searchClauses.push(clause);
          console.log(`Added search clause for ${description}: ${Array.from(variants).join(', ')}`);
        }
      };

      // Handle category search (ignore if it's just a navigation category like "flower-types")
      if (category && category !== 'flower-types' && category.toLowerCase() !== 'all') {
        addSearchClause(category, 'category');
      }

      // Handle subcategory search - support comma-separated values for multi-select
      if (subcategory) {
        const subcategories = subcategory.split(',').map(s => s.trim()).filter(Boolean);
        if (subcategories.length > 0) {
          // Use addSearchClause for each subcategory so variants are handled consistently
          subcategories.forEach(sub => addSearchClause(sub, 'subcategory'));
        }
      }

      // Handle keyword search
      if (searchKeyword) {
        addSearchClause(searchKeyword, 'keyword');
      }


  let where = `isactive = true`;
      if (searchClauses.length > 0) {
        // Use OR to combine search clauses for broader matching
        where += ` AND (${searchClauses.join(' OR ')})`;
      }

      const query = `SELECT * FROM bouquetbar.products WHERE ${where} ORDER BY featured DESC, createdat DESC`;
      console.log('Executing search query:', query);
      console.log('With params:', params);
      
      const res = await db.query(query, params);
      console.log('Search result:', res.rows?.length ?? 0, 'products found');

      return res.rows || [];
    } catch (error) {
      console.error('Error in getProductsByCategoryAndSubcategory:', error);
      return [];
    }
  }

  // Get products by main category and subcategory (precise matching for user navigation)
  async getProductsBySpecificSubcategory(subcategory: string, mainCategory?: string): Promise<Product[]> {
    try {
      console.log(`[DB] Searching for products - Main Category: "${mainCategory}", Subcategory: "${subcategory}"`);
      
      const params: any[] = [];
      const conditions: string[] = ['isactive = true'];
      
      // Add main category condition if provided - handle JSON array format like ["flower-types"]
      if (mainCategory && mainCategory !== 'all') {
        params.push(mainCategory);
        conditions.push(`main_category::jsonb ? $${params.length}`);
        console.log(`[DB] Added main category filter for JSON array: "${mainCategory}"`);
      }
      
      // Add subcategory condition - handle JSON array format like ["Lilies"]
      if (subcategory) {
        params.push(subcategory);
        conditions.push(`subcategory::jsonb ? $${params.length}`);
        console.log(`[DB] Added subcategory filter for JSON array: "${subcategory}"`);
      }
      
      const query = `
        SELECT * FROM bouquetbar.products 
        WHERE ${conditions.join(' AND ')}
        ORDER BY featured DESC, createdat DESC
      `;
      
      console.log('Executing specific category/subcategory query:', query);
      console.log('With parameters:', params);
      
      const result = await db.query(query, params);
      console.log(`[DB] Found ${result.rows?.length ?? 0} products for main_category="${mainCategory}" subcategory="${subcategory}"`);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error in getProductsBySpecificSubcategory:', error);
      return [];
    }
  }
  
  
  async getStudents(): Promise < any[] > {
  try {
    const query = `
      SELECT DISTINCT first_name AS name, email, 'Event Students' AS source
      FROM bouquetbar.events_enrollments
      UNION ALL
      SELECT DISTINCT fullname AS name, email, 'Call Students' AS source
      FROM bouquetbar.enrollments
      ORDER BY name DESC;
    `;
    console.log('Executing query:', query);
    const result = await db.query(query);
    console.log('Query Result:', result.rows);
    return result.rows;
  } catch(error) {
    console.error('Error fetching students:', error);
    throw new Error(`Failed to fetch students: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  // Instructor Management Methods
  async getAllInstructors(): Promise < any[] > {
  try {
    const query = `
        SELECT 
          id,
          name,
          email,
          phone,
          role,
          specialization,
          experience_years,
          bio,
          profile_image,
          hourly_rate,
          availability,
          is_active,
          created_at,
          updated_at
        FROM bouquetbar.instructors
        ORDER BY created_at DESC
      `;
    console.log('Executing query:', query);
    const result = await db.query(query);
    console.log('Query Result:', result.rows.length, 'instructors found');
    return result.rows;
  } catch(error) {
    console.error('Error fetching instructors:', error);
    throw new Error(`Failed to fetch instructors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  // Impacts (key/value) methods
  async getImpacts(): Promise < any[] > {
  try {
    const query = `SELECT id, title, value FROM bouquetbar.ourimpact ORDER BY 1 DESC`;
    console.log('Executing query:', query);
    const result = await db.query(query);
    return result.rows || [];
  } catch(error) {
    console.error('Error in getImpacts:', error);
    throw new Error('Failed to get impacts');
  }
}

  async createImpact(impact: { title: string; value: string }): Promise < any > {
  try {
    const q = {
      text: `INSERT INTO bouquetbar.ourimpact(title, value) VALUES ($1, $2) RETURNING *`,
      values: [impact.title, impact.value]
    };
    console.log('Executing query:', q);
    const result = await db.query(q);
    return result.rows[0];
  } catch(error) {
    console.error('Error in createImpact:', error);
    throw new Error('Failed to create impact');
  }
}

  async deleteImpact(id: string): Promise < void> {
  try {
    const q = {
      text: `DELETE FROM bouquetbar.ourimpact
        WHERE id = $1`, values: [id]
    };

    console.log('Executing query:', q);
    await db.query(q);
  } catch(error) {
    console.error('Error in deleteImpact:', error);
    throw new Error('Failed to delete impact');
  }
}

  async updateImpact(id: string, impact: { title: string; value: string }): Promise < any > {
  try {
    const q = {
      text: `UPDATE bouquetbar.ourimpact SET title = $1, value = $2 WHERE id = $3 RETURNING *`,
      values: [impact.title, impact.value, id]
    };
    console.log('Executing query:', q);
    const result = await db.query(q);
    if(!result.rows || result.rows.length === 0) {
  throw new Error('Impact not found');
}
return result.rows[0];
    } catch (error) {
  console.error('Error in updateImpact:', error);
  throw new Error('Failed to update impact');
}
  }

  async getInstructor(id: string): Promise < any | null > {
  try {
    const query = `
        SELECT 
          id,
          name,
          email,
          phone,
          role,
          specialization,
          experience_years,
          bio,
          profile_image,
          hourly_rate,
          availability,
          is_active,
          created_at,
          updated_at
        FROM bouquetbar.instructors
        WHERE id = $1
      `;
    console.log('Executing query:', query, 'with id:', id);
    const result = await db.query(query, [id]);
    console.log('Query Result:', result.rows.length, 'instructor found');
    return result.rows[0] || null;
  } catch(error) {
    console.error('Error fetching instructor:', error);
    throw new Error(`Failed to fetch instructor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async createInstructor(instructorData: any): Promise < any > {
  try {
    const {
      name,
      email,
      phone,
      role,
      specialization,
      experience_years,
      bio,
      profile_image,
      hourly_rate,
      availability,
      is_active
    } = instructorData;

    const query = `
        INSERT INTO bouquetbar.instructors (
          name, email, phone, role, specialization, experience_years, 
          bio, profile_image, hourly_rate, availability, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

    const values = [
      name,
      email,
      phone || null,
      role || null,
      specialization || null,
      experience_years || 0,
      bio || null,
      profile_image || null,
      hourly_rate || 0.00,
      availability ? JSON.stringify(availability) : '[]',
      is_active !== undefined ? is_active : true
    ];

    console.log('Executing query:', query);
    console.log('With values:', values);
    const result = await db.query(query, values);
    console.log('Query Result:', result.rows[0]);
    return result.rows[0];
  } catch(error) {
    console.error('Error creating instructor:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new Error('Email already exists');
    }
    throw new Error(`Failed to create instructor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async updateInstructor(id: string, updates: any): Promise < any > {
  try {
    const allowedFields = [
      'name', 'email', 'phone', 'role', 'specialization', 'experience_years',
      'bio', 'profile_image', 'hourly_rate', 'availability', 'is_active'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        if (key === 'availability' && typeof updates[key] === 'object') {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          updateFields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if(updateFields.length === 0) {
  throw new Error('No valid fields to update');
}

// Add updated_at timestamp
updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

const query = `
        UPDATE bouquetbar.instructors 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

values.push(id);

console.log('Executing query:', query);
console.log('With values:', values);
const result = await db.query(query, values);

if (result.rows.length === 0) {
  throw new Error('Instructor not found');
}

console.log('Query Result:', result.rows[0]);
return result.rows[0];
    } catch (error) {
  console.error('Error updating instructor:', error);
  if (error instanceof Error && error.message.includes('duplicate key')) {
    throw new Error('Email already exists');
  }
  throw new Error(`Failed to update instructor: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async deleteInstructor(id: string): Promise < void> {
  try {
    const query = `DELETE FROM bouquetbar.instructors WHERE id = $1 RETURNING *`;
    console.log('Executing query:', query, 'with id:', id);
    const result = await db.query(query, [id]);

    if(result.rows.length === 0) {
  throw new Error('Instructor not found');
}

console.log('Instructor deleted successfully:', result.rows[0].name);
    } catch (error) {
  console.error('Error deleting instructor:', error);
  if (error instanceof Error && error.message.includes('foreign key constraint')) {
    throw new Error('Cannot delete instructor with associated classes or bookings');
  }
  throw new Error(`Failed to delete instructor: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async getInstructorsBySpecialization(specialization: string): Promise < any[] > {
  try {
    const query = `
        SELECT 
          id, name, email, phone, specialization, experience_years,
          bio, profile_image, hourly_rate, availability, is_active
        FROM bouquetbar.instructors
        WHERE specialization ILIKE $1 AND is_active = true
        ORDER BY experience_years DESC, name ASC
      `;
    console.log('Executing query:', query, 'with specialization:', specialization);
    const result = await db.query(query, [`%${specialization}%`]);
    console.log('Query Result:', result.rows.length, 'instructors found');
    return result.rows;
  } catch(error) {
    console.error('Error fetching instructors by specialization:', error);
    throw new Error(`Failed to fetch instructors by specialization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getActiveInstructors(): Promise < any[] > {
  try {
    const query = `
        SELECT 
          id, name, email, phone, specialization, experience_years,
          bio, profile_image, hourly_rate, availability
        FROM bouquetbar.instructors
        WHERE is_active = true
        ORDER BY name ASC
      `;
    console.log('Executing query:', query);
    const result = await db.query(query);
    console.log('Query Result:', result.rows.length, 'active instructors found');
    return result.rows;
  } catch(error) {
    console.error('Error fetching active instructors:', error);
    throw new Error(`Failed to fetch active instructors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getProductsByCategory(category: string): Promise < Product[] > {
  // Support products where categories are stored in `main_category` or `subcategory`.
  // Match using ILIKE so JSON-encoded arrays or comma-separated lists still match.
  const pattern = `%${category}%`;
  const query = `
    SELECT *
    FROM bouquetbar.products
    WHERE isactive = true
      AND (
        LOWER(COALESCE(main_category::text, '')) LIKE LOWER($1) OR
        LOWER(COALESCE(subcategory::text, '')) LIKE LOWER($1)
      )
    ORDER BY createdat DESC;
  `;
  console.log('Executing query:', query, 'with pattern:', pattern);
  const result = await db.query(query, [pattern]);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  async getProductsByMainCategory(mainCategory: string): Promise<Product[]> {
    try {
      const query = `
        SELECT *
        FROM bouquetbar.products
        WHERE isactive = true
          AND "inStock" = true
          AND (
            main_category::jsonb ? $1 OR
            main_category::text ILIKE $2
          )
        ORDER BY createdat DESC;
      `;
      const searchPattern = `%${mainCategory}%`;
      console.log('Executing getProductsByMainCategory query:', query, 'with main_category:', mainCategory);
      const result = await db.query(query, [mainCategory, searchPattern]);
      console.log('Query Result:', result.rows?.length ?? 0, 'products found');
      return result.rows || [];
    } catch (error) {
      console.error('Error in getProductsByMainCategory:', error);
      return [];
    }
  }

  async getProductsBySubcategory(subcategory: string): Promise<Product[]> {
    try {
      const query = `
        SELECT *
        FROM bouquetbar.products
        WHERE isactive = true
          AND "inStock" = true
          AND (
            subcategory::jsonb ? $1 OR
            subcategory::text ILIKE $2
          )
        ORDER BY createdat DESC;
      `;
      const searchPattern = `%${subcategory}%`;
      console.log('Executing getProductsBySubcategory query:', query, 'with subcategory:', subcategory);
      const result = await db.query(query, [subcategory, searchPattern]);
      console.log('Query Result:', result.rows?.length ?? 0, 'products found');
      return result.rows || [];
    } catch (error) {
      console.error('Error in getProductsBySubcategory:', error);
      return [];
    }
  }

  async getProductsByNameSearch(searchTerm: string): Promise<Product[]> {
    try {
      const query = `
        SELECT *
        FROM bouquetbar.products
        WHERE isactive = true
          AND "inStock" = true
          AND (
            subcategory::jsonb ? $1 OR
            subcategory::text ILIKE $2 OR 
            main_category::jsonb ? $1 OR
            main_category::text ILIKE $2 OR
            name ILIKE $2 OR
            description ILIKE $2
          )
        ORDER BY 
          CASE 
            WHEN name ILIKE $2 THEN 1
            WHEN subcategory::jsonb ? $1 THEN 2
            WHEN main_category::jsonb ? $1 THEN 3
            WHEN subcategory::text ILIKE $2 THEN 4
            WHEN main_category::text ILIKE $2 THEN 5
            WHEN description ILIKE $2 THEN 6
            ELSE 7
          END,
          createdat DESC;
      `;
      const searchPattern = `%${searchTerm}%`;
      console.log('Executing getProductsByNameSearch query:', query, 'with searchTerm:', searchTerm);
      const result = await db.query(query, [searchTerm, searchPattern]);
      console.log('Query Result:', result.rows?.length ?? 0, 'products found');
      return result.rows || [];
    } catch (error) {
      console.error('Error in getProductsByNameSearch:', error);
      return [];
    }
  }

  async getProductsByMainCategoryAndSubcategory(mainCategory: string, subcategory: string): Promise<Product[]> {
    try {
      const query = `
        SELECT *
        FROM bouquetbar.products
        WHERE isactive = true
          AND "inStock" = true
          AND (
            main_category::jsonb ? $1 OR
            main_category::text ILIKE $3
          )
          AND (
            subcategory::jsonb ? $2 OR
            subcategory::text ILIKE $4
          )
        ORDER BY 
          CASE 
            WHEN subcategory::jsonb ? $2 AND main_category::jsonb ? $1 THEN 1
            WHEN subcategory::text ILIKE $4 AND main_category::text ILIKE $3 THEN 2
            ELSE 3
          END,
          createdat DESC;
      `;
      const mainCategoryPattern = `%${mainCategory}%`;
      const subcategoryPattern = `%${subcategory}%`;
      console.log('Executing getProductsByMainCategoryAndSubcategory query:', query, 'with mainCategory:', mainCategory, 'subcategory:', subcategory);
      const result = await db.query(query, [mainCategory, subcategory, mainCategoryPattern, subcategoryPattern]);
      console.log('Query Result:', result.rows?.length ?? 0, 'products found');
      return result.rows || [];
    } catch (error) {
      console.error('Error in getProductsByMainCategoryAndSubcategory:', error);
      return [];
    }
  }

  async getDashboardData(): Promise < any > {
  try {
    const query = `
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM bouquetbar.orders) AS grand_total_orders,
        (SELECT COUNT(*) FROM bouquetbar.orders) AS total_orders,
        (SELECT COUNT(*) FROM bouquetbar.products) AS total_products,
        (SELECT COALESCE(MAX(rating), 0) FROM bouquetbar.student_feedback) AS max_feedback_rating,
        (SELECT COUNT(DISTINCT fullname) FROM bouquetbar.enrollments) AS total_unique_enrollments,
        (SELECT COUNT(*) 
          FROM bouquetbar.enrollments
          WHERE batch IS NOT NULL
            AND (
              CASE
                WHEN batch ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN batch::date
                ELSE TO_DATE(batch || ' 01', 'FMMonth YYYY DD')
              END
            ) <= NOW()
        ) AS total_completed_batches,
        (SELECT COALESCE(JSON_AGG(usermailid ORDER BY createdate DESC), '[]'::json)
          FROM (
            SELECT DISTINCT usermailid, createdate
            FROM bouquetbar.subscribe
            ORDER BY createdate DESC
          ) AS sub
        ) AS subscriber_emails;
    `;

    console.log('Executing dashboard query:', query);

    const result = await db.query(query);

    console.log('Dashboard query result:', result.rows);

    if(result.rows && result.rows.length > 0) {
  return result.rows[0];
} else {
  // Return default values if no data found
  return {
    grand_total_orders: 0,
    total_orders: 0,
    total_products: 0,
    max_feedback_rating: 0,
    total_unique_enrollments: 0,
    total_completed_batches: 0,
    subscriber_emails: []
  };
}
    } catch (error) {
  console.error('Error in getDashboardData:', error);
  // Return safe default values instead of throwing error
  return {
    grand_total_orders: 0,
    total_orders: 0,
    total_products: 0,
    max_feedback_rating: 0,
    total_unique_enrollments: 0,
    total_completed_batches: 0,
    subscriber_emails: []
  };
}
  }

  async getEventClassEnrollments(): Promise < any > {
  const query = `SELECT 
    'Enrollments' AS source,
    fullname AS name,
    email,
    phone,
    batch,
    questions AS status_question,
    createdat AS enrolled_date
FROM bouquetbar.enrollments
UNION ALL
SELECT 
    'Event Enrollments' AS source,
    first_name AS name,
    email,
    phone,
    NULL AS batch,
    NULL AS status_question,
    enrolled_at AS enrolled_date
  FROM bouquetbar.events_enrollments
  WHERE isactive = true
  ORDER BY source, enrolled_date DESC;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  async getEventEnrollments(): Promise < any > {
  const query = `SELECT 
    B.email,
    A.title AS event_title,
    A.event_date
FROM bouquetbar.events AS A
JOIN bouquetbar.events_enrollments AS B ON A.id = B.event_id
WHERE A.isactive = true
ORDER BY B.enrolled_at DESC;`;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  async getclassEnrollments(): Promise < any > {
  const query = `
SELECT 
    B.fullname AS name,
    B.email,
    B.phone,
    B.batch,
    B.questions AS status_question,
    A.title AS course_title
FROM bouquetbar.courses AS A
JOIN bouquetbar.enrollments AS B ON A.id = B.courseid
WHERE A.isactive = true
ORDER BY B.createdat DESC; `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  async getProduct(id: string): Promise < Product | undefined > {
  try {
    const query = `
      SELECT *
      FROM bouquetbar.products
      WHERE id = $1
      AND isactive = true
      LIMIT 1;
      `;
    console.log('Executing query:', query);
    const result = await db.query(query, [id]);
    console.log('Query Result:', result.rows);
    return result.rows[0] || undefined;
  } catch(error) {
    console.error('Error in getProduct:', error);
    throw new Error(`Failed to get product: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async updateProduct(id: string, updates: Partial<Product>): Promise < Product > {
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    // Handle name field
    if(updates.name !== undefined) {
  updateFields.push(`name = $${valueCount}`);
  values.push(updates.name);
  valueCount++;
}

// Handle description field
if (updates.description !== undefined) {
  updateFields.push(`description = $${valueCount}`);
  values.push(updates.description);
  valueCount++;
}

// Handle price field
if (updates.price !== undefined) {
  updateFields.push(`price = $${valueCount}`);
  values.push(typeof updates.price === 'string' ? parseFloat(updates.price) : updates.price);
  valueCount++;
}

    // Handle main_category and subcategory fields (support legacy `category` field)
    if ((updates as any).main_category !== undefined || (updates as any).mainCategory !== undefined) {
      const mainVal = (updates as any).main_category ?? (updates as any).mainCategory;
      const mainValue = Array.isArray(mainVal) ? JSON.stringify(mainVal) : mainVal;
      updateFields.push(`main_category = $${valueCount}`);
      values.push(mainValue);
      valueCount++;
    }

    // Prefer explicit `subcategory` if provided. Otherwise fall back to legacy `category`.
    if ((updates as any).subcategory !== undefined) {
      const subVal = (updates as any).subcategory;
      const subValue = Array.isArray(subVal) ? JSON.stringify(subVal) : subVal;
      updateFields.push(`subcategory = $${valueCount}`);
      values.push(subValue);
      valueCount++;
    } else if ((updates as any).category !== undefined) {
      const catVal = (updates as any).category;
      const catValue = Array.isArray(catVal) ? JSON.stringify(catVal) : catVal;
      updateFields.push(`subcategory = $${valueCount}`);
      values.push(catValue);
      valueCount++;
    }

// Handle stockquantity field
const stockQty = updates.stockQuantity ?? (updates as any).stockquantity;
if (stockQty !== undefined) {
  updateFields.push(`stockquantity = $${valueCount}`);
  values.push(typeof stockQty === 'string' ? parseInt(stockQty) : stockQty);
  valueCount++;
}

// Handle inStock field - FIXED: Use correct property name
const inStockValue = updates.inStock ?? (updates as any).instock;
if (inStockValue !== undefined) {
  updateFields.push(`"inStock" = $${valueCount}`);
  values.push(inStockValue);
  valueCount++;
}

// Handle featured field
if (updates.featured !== undefined) {
  updateFields.push(`featured = $${valueCount}`);
  values.push(updates.featured);
  valueCount++;
}

// Handle iscustom field
if ((updates as any).iscustom !== undefined) {
  updateFields.push(`iscustom = $${valueCount}`);
  values.push(Boolean((updates as any).iscustom));
  valueCount++;
}

// Handle isbestseller field
if ((updates as any).isbestseller !== undefined) {
  updateFields.push(`isbestseller = $${valueCount}`);
  values.push(Boolean((updates as any).isbestseller));
  valueCount++;
}

// NOTE: subcategory handled above (explicit subcategory or legacy category mapping)

// Handle image fields
if (updates.image !== undefined) {
  updateFields.push(`image = $${valueCount}`);
  values.push(updates.image);
  valueCount++;
}

if ((updates as any).imagefirst !== undefined) {
  updateFields.push(`imagefirst = $${valueCount}`);
  values.push((updates as any).imagefirst);
  valueCount++;
}

if ((updates as any).imagesecond !== undefined) {
  updateFields.push(`imagesecond = $${valueCount}`);
  values.push((updates as any).imagesecond);
  valueCount++;
}

if ((updates as any).imagethirder !== undefined) {
  updateFields.push(`imagethirder = $${valueCount}`);
  values.push((updates as any).imagethirder);
  valueCount++;
}

if ((updates as any).imagefoure !== undefined) {
  updateFields.push(`imagefoure = $${valueCount}`);
  values.push((updates as any).imagefoure);
  valueCount++;
}

if ((updates as any).imagefive !== undefined) {
  updateFields.push(`imagefive = $${valueCount}`);
  values.push((updates as any).imagefive);
  valueCount++;
}

// Handle colour field
// (removed duplicate colour handler to avoid multiple assignments)

// isCustom field removed - no longer exists

if ((updates as any).colour !== undefined) {
  updateFields.push(`colour = $${valueCount}`);
  values.push((updates as any).colour);
  valueCount++;
}

// Handle discounts_offers field
if ((updates as any).discounts_offers !== undefined) {
  updateFields.push(`discounts_offers = $${valueCount}`);
  values.push(Boolean((updates as any).discounts_offers));
  valueCount++;
}

// Handle originalPrice field
if ((updates as any).originalPrice !== undefined) {
  // NOTE: database column is named `originalprice` (no underscore) elsewhere in the codebase
  // (createProduct inserts into `originalprice`), so update the same column name here
  updateFields.push(`originalprice = $${valueCount}`);
  const originalPrice = (updates as any).originalPrice;
  values.push(originalPrice === null ? null : parseFloat(originalPrice));
  valueCount++;
}

// Handle discountPercentage field
if ((updates as any).discountPercentage !== undefined) {
  updateFields.push(`discount_percentage = $${valueCount}`);
  const discountPercentage = (updates as any).discountPercentage;
  values.push(discountPercentage === null ? null : parseInt(discountPercentage));
  valueCount++;
}

// Handle discountAmount field
if ((updates as any).discountAmount !== undefined) {
  updateFields.push(`discount_amount = $${valueCount}`);
  const discountAmount = (updates as any).discountAmount;
  values.push(discountAmount === null ? null : parseFloat(discountAmount));
  valueCount++;
}

// Check if any fields to update
if (updateFields.length === 0) {
  throw new Error('No valid fields provided for update');
}

// Always update the updated_at field
updateFields.push(`updatedate = NOW()`);
values.push(id);

const query = `
      UPDATE bouquetbar.products
      SET ${updateFields.join(', ')}
      WHERE id = $${valueCount}
      RETURNING *;
    `;

console.log('Executing update query:', query);
console.log('With values:', values);
const result = await db.query(query, values);

if (!result.rows[0]) {
  throw new Error(`Product with id ${id} not found`);
}

return result.rows[0];
    } catch (error) {
  console.error('Error in updateProduct:', error);
  throw new Error(`Failed to update product: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

 async createProduct(productData: any): Promise<any> {
    try {
      // Accept multiple possible stock field names and coerce to integer
      const stockRaw = productData.stockQuantity ?? productData.stockquantity ?? productData.stock ?? '0';
      const stockQuantity = parseInt(String(stockRaw || '0'), 10);
      if (isNaN(stockQuantity) || stockQuantity < 0) {
        throw new Error('Invalid stock quantity. Must be a non-negative number.');
      }

        // Normalize subcategory and main_category to JSON strings when arrays are provided
        const subcategoryValue = Array.isArray(productData.subcategory) ? JSON.stringify(productData.subcategory) : (Array.isArray(productData.category) ? JSON.stringify(productData.category) : (productData.subcategory ?? productData.category ?? null));
        let mainCategoryValue = Array.isArray(productData.main_category) ? JSON.stringify(productData.main_category) : (Array.isArray(productData.mainCategory) ? JSON.stringify(productData.mainCategory) : (productData.main_category ?? productData.mainCategory ?? null));
        // If main_category not provided, default it to subcategory for backward compatibility
        if (!mainCategoryValue && subcategoryValue) {
          mainCategoryValue = subcategoryValue;
        }

      // Normalize price/original/discount values so we always insert consistent numbers
      const normalizedPrice = (productData.price !== undefined && productData.price !== null) ? Number(productData.price) : (productData.originalPrice !== undefined && productData.originalPrice !== null ? Number(productData.originalPrice) : 0);
      const normalizedOriginal = (productData.originalPrice !== undefined && productData.originalPrice !== null) ? Number(productData.originalPrice) : normalizedPrice;
      const normalizedDiscountPercentage = (productData.discountPercentage !== undefined && productData.discountPercentage !== null)
        ? Number(productData.discountPercentage)
        : (productData.discount_percentage !== undefined && productData.discount_percentage !== null)
          ? Number(productData.discount_percentage)
          : 0;
      const normalizedDiscountAmount = (productData.discountAmount !== undefined && productData.discountAmount !== null)
        ? Number(productData.discountAmount)
        : (productData.discount_amount !== undefined && productData.discount_amount !== null)
          ? Number(productData.discount_amount)
          : 0;

      try {
        const query = {
          text: `
          INSERT INTO bouquetbar.products (
            name, description, price, originalprice, discount_percentage, discount_amount, main_category, subcategory, stockquantity,
            "inStock", featured, iscustom, isbestseller, colour, discounts_offers, image,
            createdat
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          RETURNING *;
        `,
          values: [
            productData.name,
            productData.description,
            productData.price,
            productData.originalPrice,
            productData.discountPercentage,
            productData.discountAmount,
            mainCategoryValue,
            subcategoryValue,
            stockQuantity,
            stockQuantity > 0,
            productData.featured || false,
            productData.iscustom || false,
            productData.isbestseller || false,
            productData.colour || null,
            productData.discounts_offers ? true : false,
            productData.image || null
          ]
        };

        console.log('Executing product insert (with discounts) values:', query.values);
        const result = await db.query(query.text, query.values);
        return result.rows[0];
      } catch (columnError) {
        console.log("Discount columns not found or insert failed, trying basic insert:", columnError && columnError.message ? columnError.message : columnError);
        const basicQuery = {
          text: `
          INSERT INTO bouquetbar.products (
            name, description, price, main_category, subcategory, stockquantity,
            "inStock", featured, iscustom, isbestseller, colour, discounts_offers, image,
            createdat
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          RETURNING *;
        `,
          values: [
            productData.name,
            productData.description,
            normalizedPrice,
            mainCategoryValue,
            subcategoryValue,
            stockQuantity,
            stockQuantity > 0,
            productData.featured || false,
            productData.iscustom || false,
            productData.isbestseller || false,
            productData.colour || null,
            Boolean(productData.discounts_offers),
            productData.image || null
          ]
        };

        console.log('Executing basic product insert values:', basicQuery.values);
        const result = await db.query(basicQuery.text, basicQuery.values);
        return result.rows[0];
      }
    } catch (error) {
      console.error('Error in createProduct:', error);
      throw new Error(`Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
 
  async deleteProduct(id: string): Promise < void> {
  if(!id) {
    throw new Error('Product ID is required');
  }

    try {
    // First check if the product exists
    const product = await this.getProduct(id);
    if(!product) {
      throw new Error('Product not found');
    }

      const query = {
      text: `
        UPDATE bouquetbar.products
        SET isactive = false
        WHERE id = $1
        RETURNING id;
      `,
      values: [id]
    };

    console.log('Executing delete query:', query.text);
    const result = await db.query(query.text, query.values);

    if(result.rowCount === 0) {
  throw new Error('Product could not be deleted');
}

console.log('Product deleted successfully');
    } catch (error: any) {
  console.error('Error in deleteProduct:', error);
  // Detect Postgres foreign key violation (23503) or messages mentioning foreign key constraints
  const isFkViolation = (error && (error.code === '23503' || /foreign key constraint|violates foreign key/i.test(error.message || '')));
  if (isFkViolation) {
    const detail = error.detail || (error instanceof Error ? error.message : String(error));
    throw new DependencyError('Product has related data and cannot be deleted', detail);
  }

  throw new Error(`Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }




  // Inventory Management
  async updateProductStock(productId: string, quantityChange: number): Promise < Product > {
  const query = `
    UPDATE bouquetbar.products
    SET 
      stockquantity = stockquantity + ${quantityChange},
      "inStock" = (stockquantity + ${quantityChange} > 0),
      updated_at = NOW()
    WHERE id = '${productId}'
    AND isactive = true
    RETURNING *;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Update Result:', result.rows);

  return result.rows[0];
}

  async checkProductAvailability(productId: string, requiredQuantity: number): Promise < { available: boolean; currentStock: number } > {
  const query = `
    SELECT stock_quantity
    FROM bouquetbar.products
    WHERE id = '${productId}'
    AND isactive = true
    LIMIT 1;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);

  if(!result.rows[0]) {
  return { available: false, currentStock: 0 };
}

const currentStock = result.rows[0].stock_quantity;
return {
  available: currentStock >= requiredQuantity,
  currentStock
};
  }

  // Course Methods
  async getAllCourses(): Promise < Course[] > {
  const query = `
    SELECT *
    FROM bouquetbar.courses
    WHERE isactive = true;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  async getCourse(id: string): Promise < Course | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.courses
    WHERE id = '${id}'
    AND isactive = true
    LIMIT 1;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0] || undefined;
}

  async createCourse(course: InsertCourse): Promise < Course > {
  const query = `
    INSERT INTO bouquetbar.courses (
      title,
      description,
      price,
      duration,
      sessions,
      features,
      popular,
      nextbatch,
      createdat
    ) VALUES (
      '${course.title}',
      '${course.description}',
      ${course.price},
      '${course.duration}',
      ${course.sessions},
      '${JSON.stringify(course.features)}',
      ${course.popular ?? false},
      '${course.nextBatch ?? ''}',
      NOW()
    )
    RETURNING *;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0];
}


  // Order Methods
  async getAllOrders(): Promise < Order[] > {
  const query = `
    SELECT *
    FROM bouquetbar.orders;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows;
}


  async getOrder(id: string): Promise < Order | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.orders
    WHERE id = '${id}'
    LIMIT 1;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0] || undefined;
}

  async createOrder(order: InsertOrder): Promise < Order > {
  const orderNumber = await this.generateOrderNumber();
  const query = `
    INSERT INTO bouquetbar.orders (
      customername,
      email,
      phone,
      occasion,
      requirements,
      status,
      items,
      total,
      userid,
      deliveryaddress,
      deliverydate,
      subtotal,
      deliveryoptionid,
      deliverycharge,
      couponcode,
      discountamount,
      shippingaddressid,
      ordernumber,
      paymentmethod,
      paymentcharges,
      paymentstatus,
      paymenttransactionid,
      estimateddeliverydate,
      updatedat,
      statusupdatedat,
      pointsawarded,
      createdat
    ) VALUES (
      '${order.customerName}',
      '${order.email}',
      '${order.phone}',
      '${order.occasion ?? ''}',
      '${order.requirements ?? ''}',
      'pending',
      '${JSON.stringify(order.items)}',
      ${order.total},
      '${order.userId ?? ''}',
      '${order.deliveryAddress ?? ''}',
      '${order.deliveryDate ?? ''}',
      ${order.subtotal},
      '${order.deliveryOptionId ?? ''}',
      ${order.deliveryCharge ?? 0},
      '${order.couponCode ?? ''}',
      ${order.discountAmount ?? 0},
      '${order.shippingAddressId ?? ''}',
      '${orderNumber}',
      '${order.paymentMethod}',
      ${order.paymentCharges ?? 0},
      'pending',
      '${order.paymentTransactionId ?? ''}',
      '${order.estimatedDeliveryDate ?? ''}',
      NOW(),
      NOW(),
      ${order.pointsAwarded ?? false},
      NOW()
    )
    RETURNING *;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0];
}


  // Enrollment Methods
  async getAllEnrollments(): Promise < Enrollment[] > {
  const query = `
    SELECT *
    FROM bouquetbar.enrollments;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows;
}


  async getEnrollment(id: string): Promise < Enrollment | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.enrollments
    WHERE id = '${id}'
    LIMIT 1;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0] || undefined;
}


  async createEnrollment(enrollment: InsertEnrollment): Promise < Enrollment > {
  const query = `
    INSERT INTO bouquetbar.enrollments (
      fullname,
      email,
      phone,
      courseid,
      batch,
      questions,
      status,
      createdat
    ) VALUES (
      '${enrollment.fullName}',
      '${enrollment.email}',
      '${enrollment.phone}',
      '${enrollment.courseId}',
      '${enrollment.batch ?? ''}',
      '${enrollment.questions ?? ''}',
      'pending',
      NOW()
    )
    RETURNING *;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0];
}

  // Testimonial Methods
  // Get testimonials by type
  async getTestimonialsByType(type: string): Promise < Testimonial[] > {
  const query = `
    SELECT *
    FROM bouquetbar.testimonials
    WHERE type = '${type}';
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}

  // Get all testimonials
  async getAllTestimonials(): Promise < Testimonial[] > {
  const query = `
    SELECT *
    FROM bouquetbar.testimonials;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}
  async createTestimonial(testimonial: InsertTestimonial): Promise < Testimonial > {
  const query = `
    INSERT INTO bouquetbar.testimonials (
      name,
      location,
      rating,
      comment,
      type,
      image,
      createdat
    ) VALUES (
      '${testimonial.name}',
      '${testimonial.location}',
      ${testimonial.rating},
      '${testimonial.comment}',
      '${testimonial.type}',
      '${testimonial.image ?? ''}',
      NOW()
    )
    RETURNING *;
  `;

  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0];
}

  // Blog Post Methods
  async getAllBlogPosts(): Promise < BlogPost[] > {
  const query = `
    SELECT *
    FROM bouquetbar.blog_posts;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query Result:', result.rows);
  return result.rows;
}


  async getBlogPost(id: string): Promise < BlogPost | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.blog_posts
    WHERE id = '${id}'
    LIMIT 1;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0] || undefined;
}

  async createBlogPost(post: InsertBlogPost): Promise < BlogPost > {
  const query = `
    INSERT INTO bouquetbar.blog_posts (
      title,
      excerpt,
      content,
      category,
      image,
      published_at,
      created_at
    ) VALUES (
      '${post.title}',
      '${post.excerpt}',
      '${post.content}',
      '${post.category}',
      '${post.image}',
      NOW(),
      NOW()
    )
    RETURNING *;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows[0];
}


  // Cart Methods
  async getUserCart(userId: string): Promise < (Cart & { product: Product })[] > {
  const query = `
    SELECT c.*, p.*
    FROM bouquetbar.carts c
    INNER JOIN bouquetbar.products p ON c.productid = p.id
    WHERE c.userid = '${userId}'
    AND isactive = true;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  return result.rows;
}

  async addToCart(userId: string, productId: string, quantity: number): Promise < Cart > {
  const checkQuery = `
    SELECT *
    FROM bouquetbar.carts
    WHERE userid = '${userId}' AND productid = '${productId}'
    LIMIT 1;
  `;
  const existing = await db.query(checkQuery);

  if(existing.rows[0]) {
  const updateQuery = `
      UPDATE bouquetbar.carts
      SET quantity = quantity + ${quantity}, updatedat = NOW()
      WHERE userid = '${userId}' AND productid = '${productId}'
      RETURNING *;
    `;
  const result = await db.query(updateQuery);
  return result.rows[0];
}

const insertQuery = `
    INSERT INTO bouquetbar.carts (userid, productid, quantity, createdat, updatedat)
    VALUES ('${userId}', '${productId}', ${quantity}, NOW(), NOW())
    RETURNING *;
  `;
const result = await db.query(insertQuery);
return result.rows[0];
  }

  async updateCartItemQuantity(userId: string, productId: string, quantity: number): Promise < Cart > {
  const query = `
    UPDATE bouquetbar.carts
    SET quantity = ${quantity}, updatedat = NOW()
    WHERE userid = '${userId}' AND productid = '${productId}'
    RETURNING *;
  `;
  const result = await db.query(query);
  return result.rows[0];
}


  async removeFromCart(userId: string, productId: string): Promise < void> {
  const query = `
    DELETE FROM bouquetbar.carts
    WHERE userid = '${userId}' AND productid = '${productId}';
  `;
  await db.query(query);
}


  async clearUserCart(userId: string): Promise < void> {
  const query = `
    DELETE FROM bouquetbar.carts
    WHERE userid = '${userId}';
  `;
  await db.query(query);
}

  // Order Status Methods
  async getUserOrders(userId: string): Promise < Order[] > {
  const query = `SELECT 
          o.ordernumber,
          oi.item->>'quantity' AS quantity,
          o.status,
          o.total,
          o.deliveryaddress,
          p.image,
          o.*
      FROM bouquetbar.orders o
      JOIN LATERAL jsonb_array_elements(o.items) AS oi(item) ON true
      JOIN bouquetbar.products p ON p.id = oi.item->>'productId'
      WHERE o.userid = '${userId}' AND isactive = true`;

  const result = await db.query(query);
  return result.rows;
}

  async getOrderByNumber(orderNumber: string): Promise < Order | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.orders
    WHERE ordernumber = '${orderNumber}'
    LIMIT 1;
  `;
  const result = await db.query(query);
  return result.rows[0] || undefined;
}

  // ...existing code...
  async createCategoryUserData({ fullname, emailaddress, phoneno, question, enquiry }: { fullname: string; emailaddress: string; phoneno: string; question?: string; enquiry?: string }) {
  const result = await db.query(
    `INSERT INTO bouquetbar.categoryuserdata (fullname, emailaddress, phoneno, question, enquiry)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
    [fullname, emailaddress, phoneno, question || null, enquiry || null]
  );
  return result.rows[0];
}

  async getAllCategoryUserData() {
  const result = await db.query(
    `SELECT * FROM bouquetbar.categoryuserdata ORDER BY created_at DESC`
  );
  return result.rows;
}
  // Add these methods to your DatabaseStorage class

  async addStudentFeedback(feedback: {
  student_name: string;
  course_name: string;
  feedback_text: string;
  rating: number;
}): Promise < any > {
  try {
    const query = `
      INSERT INTO bouquetbar.student_feedback(
        student_name, 
        course_name, 
        feedback_text, 
        rating,
        submitted_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;

    const values = [
      feedback.student_name,
      feedback.course_name,
      feedback.feedback_text,
      feedback.rating
    ];

    console.log('Executing student feedback insert query:', query);
    console.log('Values:', values);

    const result = await db.query(query, values);
    console.log('Student feedback added successfully:', result.rows[0]);
    return result.rows[0];
  } catch(error) {
    console.error('Error in addStudentFeedback:', error);
    throw new Error(`Failed to add student feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getAllFeedback(): Promise < any[] > {
  try {
    const query = `
      SELECT 
      id,
        student_name, 
        course_name, 
        feedback_text, 
        rating
      FROM bouquetbar.student_feedback
      ORDER BY 1 DESC;
    `;
    console.log('Executing student feedback query:', query);
    const result = await db.query(query);
    console.log('Student feedback Query Result:', result.rows);
    return result.rows || [];
  } catch(error) {
    console.error('Error in getAllStudentFeedback:', error);
    throw new Error(`Failed to get student feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async deleteStudentFeedback(id: string): Promise < void> {
  try {
    const query = `
      DELETE FROM bouquetbar.student_feedback
      WHERE id = $1
      RETURNING id;
    `;

    console.log('Executing delete student feedback query:', query);
    const result = await db.query(query, [id]);

    if(result.rowCount === 0) {
  throw new Error('Student feedback not found');
}

console.log('Student feedback deleted successfully');
    } catch (error) {
  console.error('Error in deleteStudentFeedback:', error);
  throw new Error(`Failed to delete student feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  // ...existing code...

  // Office Timing Methods
  async getOfficeTimings(): Promise < any[] > {
  try {
    const query = `
      SELECT 
        id,
        office_day,
        open_time,
        close_time,
        is_holiday
      FROM bouquetbar.office_timing
      ORDER BY 
        CASE office_day
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END;
    `;
    console.log('Executing office timing query:', query);
    const result = await db.query(query);
    return result.rows || [];
  } catch(error) {
    console.error('Error in getOfficeTimings:', error);
    throw new Error(`Failed to get office timings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async createOfficeTiming(timing: {
  office_day: string;
  open_time: string;
  close_time: string;
  is_holiday: boolean;
}): Promise < any > {
  try {
    // Check if timing already exists for this day
    const checkQuery = `
      SELECT id FROM bouquetbar.office_timing 
      WHERE office_day = $1;
    `;
    const existing = await db.query(checkQuery, [timing.office_day]);

    if(existing.rows.length > 0) {
  throw new Error(`Office timing for ${timing.office_day} already exists`);
}

const query = `
      INSERT INTO bouquetbar.office_timing(
        office_day,
        open_time,
        close_time,
        is_holiday
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

const values = [
  timing.office_day,
  timing.open_time,
  timing.close_time,
  timing.is_holiday
];

console.log('Executing office timing insert query:', query);
const result = await db.query(query, values);
return result.rows[0];
    } catch (error) {
  console.error('Error in createOfficeTiming:', error);
  throw new Error(`Failed to create office timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async updateOfficeTiming(id: string, updates: any): Promise < any > {
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    if(updates.office_day !== undefined) {
  updateFields.push(`office_day = $${valueCount}`);
  values.push(updates.office_day);
  valueCount++;
}

if (updates.open_time !== undefined) {
  updateFields.push(`open_time = $${valueCount}`);
  values.push(updates.open_time);
  valueCount++;
}

if (updates.close_time !== undefined) {
  updateFields.push(`close_time = $${valueCount}`);
  values.push(updates.close_time);
  valueCount++;
}

if (updates.is_holiday !== undefined) {
  updateFields.push(`is_holiday = $${valueCount}`);
  values.push(updates.is_holiday);
  valueCount++;
}

if (updateFields.length === 0) {
  throw new Error("No fields provided for update");
}

values.push(id);

const query = `
      UPDATE bouquetbar.office_timing
      SET ${updateFields.join(', ')}
      WHERE id = $${valueCount}
      RETURNING *;
    `;

console.log('Executing office timing update query:', query);
const result = await db.query(query, values);

if (!result.rows[0]) {
  throw new Error(`Office timing with id ${id} not found`);
}

return result.rows[0];
    } catch (error) {
  console.error('Error in updateOfficeTiming:', error);
  throw new Error(`Failed to update office timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async deleteOfficeTiming(id: string): Promise < void> {
  try {
    const query = `
      DELETE FROM bouquetbar.office_timing
      WHERE id = $1
      RETURNING id;
    `;

    console.log('Executing delete office timing query:', query);
    const result = await db.query(query, [id]);

    if(result.rowCount === 0) {
  throw new Error('Office timing not found');
}

console.log('Office timing deleted successfully');
    } catch (error) {
  console.error('Error in deleteOfficeTiming:', error);
  throw new Error(`Failed to delete office timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  async updateOrderPaymentStatus(id: string, paymentStatus: string, transactionId ?: string): Promise < Order > {
  const query = `
    UPDATE bouquetbar.orders
    SET paymentstatus = '${paymentStatus}',
        paymenttransactionid = ${transactionId ? `'${transactionId}'` : 'NULL'},
        updatedat = NOW()
    WHERE id = '${id}'
    RETURNING *;
  `;
  const result = await db.query(query);
  return result.rows[0];
}


  async generateOrderNumber(): Promise < string > {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `BBORD${year}${month}${day}`;

  const query = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(ordernumber FROM '${datePrefix}(\\d+)') AS INTEGER)), 0) AS maxordernum
    FROM bouquetbar.orders
    WHERE ordernumber LIKE '${datePrefix}%'
      AND createdat >= '${now.toISOString().slice(0, 10)} 00:00:00'
      AND createdat < '${now.toISOString().slice(0, 10)} 23:59:59';
  `;

  const result = await db.query(query);
  const maxOrderNum = result.rows[0].maxordernum || 0;
  const nextNumber = String(maxOrderNum + 1).padStart(4, '0');
  return `${datePrefix}${nextNumber}`;
}


  //PROCESS TO CHECK THE ALL DATA - Removed duplicate method

  async validateCartItems(items: Array<{ productId?: string; quantity?: number; unitPrice?: number; productName?: string; totalPrice?: number }>): Promise < {
  isValid: boolean;
  errors?: string[];
  validatedItems?: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
} > {
  const errors: string[] = [];
  const validatedItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }> =[];
for (const item of items) {
  // Validate required fields
  if (!item.productId) {
    errors.push(`Product ID is required`);
    continue;
  }

  if (!item.quantity || item.quantity <= 0) {
    errors.push(`Valid quantity is required`);
    continue;
  }

  if (!item.unitPrice || item.unitPrice <= 0) {
    errors.push(`Valid unit price is required`);
    continue;
  }

  const query = `
        SELECT * FROM bouquetbar.products
        WHERE id = '${item.productId}'
        AND isactive = true
        LIMIT 1;
      `;
  const result = await db.query(query);
  const product = result.rows[0];

  if (!product) {
    errors.push(`Product with ID ${item.productId} not found`);
    continue;
  }

  if (!product.inStock) {
    errors.push(`Product ${product.name} is out of stock`);
    continue;
  }

  if (product.stockquantity < item.quantity) {
    errors.push(`Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.stockquantity}`);
    continue;
  }

  const currentPrice = parseFloat(product.price);
  if (Math.abs(currentPrice - item.unitPrice) > 0.01) {
    errors.push(`Price mismatch for ${product.name}. Current: ${currentPrice}, Provided: ${item.unitPrice}`);
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

  async calculateOrderPricing(subtotal: number, deliveryOptionId: string, couponCode ?: string, paymentMethod ?: string): Promise < {
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  paymentCharges: number;
  total: number;
} > {
  // ✅ Delivery option
  // Remove delivery charge calculation - always 0
  const deliveryCharge = 0;

  // ✅ Coupon discount
  let discountAmount = 0;
  if(couponCode) {
    const couponQuery = `
        SELECT * FROM bouquetbar.coupons
        WHERE code = '${couponCode}'
        AND isactive = true
        LIMIT 1;
      `;
    const couponResult = await db.query(couponQuery);
    const coupon = couponResult.rows[0];

    if (coupon) {
      if (coupon.type === "percentage") {
        discountAmount = (subtotal * parseFloat(coupon.value)) / 100;
        if (coupon.maxdiscount) {
          discountAmount = Math.min(discountAmount, parseFloat(coupon.maxdiscount));
        }
      } else if (coupon.type === "fixed") {
        discountAmount = parseFloat(coupon.value);
      }
    }
  }

    // ✅ Payment charges - calculate without delivery charge
    let paymentCharges = 0;
  if(paymentMethod === "Card" || paymentMethod === "Online") {
  paymentCharges = Math.max((subtotal - discountAmount) * 0.02, 5);
}

const total = subtotal - discountAmount + paymentCharges;

return { subtotal, deliveryCharge, discountAmount, paymentCharges, total };
  }



  async awardUserPoints(userId: string, points: number): Promise < void> {
  const query = `
    UPDATE bouquetbar.users
    SET points = COALESCE(points, 0) + ${points},
        updatedat = NOW()
    WHERE id = '${userId}';
  `;
  await db.query(query);
}

  /**
   * List orders that are eligible for status advancement based on their current status and time
   */
  async listAdvancableOrders(cutoffDate: Date, statuses: string[]) {
  const statusesList = statuses.map(s => `'${s}'`).join(',');
  const query = `
    SELECT *
    FROM bouquetbar.orders
    WHERE status IN (${statusesList})
      AND (statusupdatedat <= '${cutoffDate.toISOString()}' OR statusupdatedat IS NULL)
      AND createdat <= '${cutoffDate.toISOString()}'
    ORDER BY createdat;
  `;
  const result = await db.query(query);
  return result.rows;
}


  /**
   * Advance an order's status to the next state
   */
  async advanceOrderStatus(orderId: string, nextStatus: string) {
  const now = new Date();

  const query = `
    UPDATE bouquetbar.orders
    SET status = '${nextStatus}',
        statusupdatedat = NOW(),
        updatedat = NOW()
    WHERE id = '${orderId}'
    RETURNING *;
  `;
  const result = await db.query(query);
  const order = result.rows[0];

  if (nextStatus === "processing" && order.user_id) {
    await this.awardUserPoints(order.user_id, 50);
  }

  await this.addOrderStatusHistory(orderId, nextStatus, "Status automatically updated");
  return order;
}


  async getOrderStatusHistory(orderId: string) {
  const query = `
    SELECT *
    FROM bouquetbar.order_status_history
    WHERE order_id = '${orderId}'
    ORDER BY changedat;
  `;
  const result = await db.query(query);
  return result.rows;
}

  async addOrderStatusHistory(orderId: string, status: string, note ?: string) {
  const query = `
    INSERT INTO bouquetbar.order_status_history (order_id, status, note, changed_at)
    VALUES ('${orderId}', '${status}', ${note ? `'${note}'` : 'NULL'}, NOW());
  `;
  await db.query(query);
}


  async validateStockAvailability(items: Array<{ productId: string; quantity: number }>) {
  const errors: string[] = [];
  const stockValidation: any[] = [];

  for (const item of items) {
    const query = `
      SELECT *
      FROM bouquetbar.products
      WHERE id = '${item.productId}'
      AND isactive = true
      LIMIT 1;
    `;
    const result = await db.query(query);
    const product = result.rows[0];

    if (!product) {
      errors.push(`Product ${item.productId} not found`);
      continue;
    }

    const sufficient = product.stock_quantity >= item.quantity;
    stockValidation.push({
      productId: item.productId,
      productName: product.name,
      requiredQuantity: item.quantity,
      availableStock: product.stock_quantity,
      sufficient
    });

    if (!sufficient) {
      errors.push(`Insufficient stock for ${product.name}. Required: ${item.quantity}, Available: ${product.stock_quantity}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    stockValidation
  };
}

  async decrementProductsStock(items: Array<{ productId: string; quantity: number }>) {
  for (const item of items) {
    const query = `
      UPDATE bouquetbar.products
      SET stockquantity = stockquantity - ${item.quantity},
          updated_at = NOW()
      WHERE id = '${item.productId}';
    `;
    await db.query(query);
  }
}

  async cancelOrder(orderId: string, userId ?: string) {
  try {
    // First get the order to verify ownership if userId is provided
    if (userId) {
      const orderCheck = await db.query(`
          SELECT * FROM bouquetbar.orders 
          WHERE id = '${orderId}' AND userid = '${userId}'
          LIMIT 1;
        `);

      if (!orderCheck.rows.length) {
        throw new Error("Order not found or access denied");
      }

      const order = orderCheck.rows[0];
      if (order.status === 'delivered' || order.status === 'cancelled') {
        throw new Error(`Order cannot be cancelled as it is already ${order.status}`);
      }
    }

    const query = `
        UPDATE bouquetbar.orders
        SET status = 'cancelled',
            statusupdated_at = NOW(),
            updatedat = NOW()
        WHERE id = '${orderId}'
        RETURNING *;
      `;
    const result = await db.query(query);

    if (!result.rows[0]) {
      throw new Error("Order not found");
    }

    await this.addOrderStatusHistory(orderId, "cancelled", "Order cancelled");
    return result.rows[0];
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    throw error;
  }
}

  async incrementCouponUsage(code: string): Promise < Coupon > {
  const query = `
      UPDATE bouquetbar.coupons
      SET timesused = timesused + 1, updatedat = NOW()
      WHERE code = '${code}'
      RETURNING *;
    `;
  const result = await db.query(query);
  return result.rows[0];
}

  async deleteCoupon(id: string): Promise < void> {
  const query = `
      DELETE FROM bouquetbar.coupons
      WHERE id = '${id}';
    `;
  await db.query(query);
}

  async getAllDeliveryOptions(): Promise < DeliveryOption[] > {
  const query = `
      SELECT *
      FROM bouquetbar.delivery_options
      ORDER BY sortorder;
    `;
  const result = await db.query(query);
  return result.rows;
}

  async getDeliveryOption(id: string): Promise < DeliveryOption | undefined > {
  const query = `
      SELECT *
      FROM bouquetbar.delivery_options
      WHERE id = '${id}'
      LIMIT 1;
    `;
  const result = await db.query(query);
  return result.rows[0] || undefined;
}


  async updateOrderAddress(orderId: string, addressId: string): Promise < Order > {
  const query = `
    UPDATE bouquetbar.orders
    SET addressid = '${addressId}', updatedat = NOW()
    WHERE id = '${orderId}'
    RETURNING *;
  `;
  const result = await db.query(query);
  return result.rows[0];
}

  async getUserFavorites(userId: string): Promise < (Favorite & { product: Product })[] > {
  const query = `
    SELECT 
      f.id,
      f.userid,
      f.productid,
      f.createdat,
      p.*
    FROM bouquetbar.favorites f
    INNER JOIN bouquetbar.products p
      ON f.productid = p.id
    WHERE  f.userid = '${userId}' AND isactive = true;
    f.userid = '${userId}';
  `;
  console.log("Executing query:", query);
  const result = await db.query(query);
  console.log("Query Result:", result.rows);

  return result.rows as (Favorite & { product: Product })[];
}

  async addToFavorites(userId: string, productId: string): Promise < Favorite > {
  const query = `
    INSERT INTO bouquetbar.favorites (userid, productid)
    VALUES ('${userId}', '${productId}')
    RETURNING *;
  `;

  console.log("Executing query:", query);
  const result = await db.query(query);
  console.log("Inserted Favorite:", result.rows[0]);

  return result.rows[0] as Favorite;
}

  async removeFromFavorites(userId: string, productId: string): Promise < void> {
  const query = `
    DELETE FROM bouquetbar.favorites
    WHERE userid = '${userId}' AND productid = '${productId}';
  `;

  console.log("Executing query:", query);
  await db.query(query);
  console.log(`Removed favorite for user: ${userId}, product: ${productId}`);
}

  async isProductFavorited(userId: string, productId: string): Promise < boolean > {
  const query = `
    SELECT 1
    FROM bouquetbar.favorites
    WHERE userid = '${userId}' AND productid = '${productId}'
    LIMIT 1;
  `;
  console.log("Executing query:", query);
  const result = await db.query(query);
  console.log("Is Favorited:", (result.rowCount ?? 0) > 0);

  return(result.rowCount ?? 0) > 0;
  }


  // Main entry point: handles end-to-end order placement
  async processOrderPlacement(
    orderData: OrderPlacement,
    userId ?: string
  ): Promise < {
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
  } > {
    try {
      // Step 1: Validate the order
      const validation = await this.validateAndProcessOrder(orderData);
      if(!validation.isValid) {
  return {
    isValid: false,
    errors: validation.errors
  };
}

// Step 2: Create order inside transaction
const createdOrder = await this.createOrderWithTransaction(
  validation.validatedOrder!,
  orderData.couponCode,
  userId
);

return {
  isValid: true,
  order: createdOrder,
  calculatedPricing: validation.calculatedPricing
};
    } catch (error) {
  console.error("[ORDER PROCESSING ERROR]:", error);
  return {
    isValid: false,
    errors: ["Failed to process order placement"]
  };
}
  }

  async validateAndProcessOrder(orderData: OrderPlacement): Promise < {
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
} > {
  const errors: string[] = [];

  // ✅ 1. Validate cart items
  const cartValidation = await this.validateCartItems(orderData.items);
  if(!cartValidation.isValid) {
  errors.push(...(cartValidation.errors || []));
}

// ✅ 2. Validate delivery option
const queryDelivery = `
      SELECT *
      FROM bouquetbar.delivery_options
      WHERE id = '${orderData.deliveryOptionId}'
      LIMIT 1;
    `;
const deliveryResult = await db.query(queryDelivery);
const deliveryOption = deliveryResult.rows[0];
if (!deliveryOption) {
  errors.push("Invalid delivery option");
}

// ✅ 3. Validate shipping address if user is logged in
if (orderData.userId && orderData.shippingAddressId) {
  const queryAddress = `
        SELECT *
        FROM bouquetbar.addresses
        WHERE id = '${orderData.shippingAddressId}' 
          AND userid = '${orderData.userId}'
                  AND isactive=true
        LIMIT 1;
      `;
  const addressResult = await db.query(queryAddress);
  const address = addressResult.rows[0];
  if (!address) {
    errors.push("Invalid shipping address");
  }
}

// ❌ Stop if errors found
if (errors.length > 0) {
  return { isValid: false, errors };
}

// ✅ 4. Calculate pricing (server-side check)
const calculatedPricing = await this.calculateOrderPricing(
  orderData.subtotal,
  orderData.deliveryOptionId,
  orderData.couponCode,
  orderData.paymentMethod
);

// ✅ 5. Validate pricing consistency with tolerance
const tolerance = 0.01;
if (Math.abs(calculatedPricing.deliveryCharge - orderData.deliveryCharge) > tolerance) {
  errors.push("Delivery charge mismatch");
}
if (Math.abs(calculatedPricing.discountAmount - orderData.discountAmount) > tolerance) {
  errors.push("Discount amount mismatch");
}
// if (Math.abs(calculatedPricing.total - orderData.total) > tolerance) {
//   errors.push("Total amount mismatch");
// }

// ❌ Stop if errors found
if (errors.length > 0) {
  return { isValid: false, errors };
}

// ✅ 6. Construct validated order object
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
  // include optional payment transaction id/status if client provided (e.g., after gateway payment)
  paymentTransactionId: orderData.paymentTransactionId,
  paymentStatus: orderData.paymentStatus,
  total: calculatedPricing.total.toString(),
  shippingAddressId: orderData.shippingAddressId,
  deliveryAddress: orderData.deliveryAddress,
  deliveryDate: orderData.deliveryDate ? (() => {
    const date = new Date(orderData.deliveryDate);
    return isNaN(date.getTime()) ? undefined : date;
  })() : undefined,
  estimatedDeliveryDate: deliveryOption
    ? (() => {
      const daysString = deliveryOption.estimateddays.split('-')[0];
      const days = parseInt(daysString);
      if (isNaN(days) || days < 0) {
        return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default to 3 days
      }
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    })()
    : undefined,
};

// ✅ 7. Return successful validation
return {
  isValid: true,
  validatedOrder,
  calculatedPricing,
};
  }


  async createOrderWithTransaction(
  validatedOrder: InsertOrder,
  couponCode ?: string,
  userId ?: string
): Promise < Order > {
  try {
    // 1️⃣ Generate order number
    const orderNumber = await this.generateOrderNumber();

    // 2️⃣ Validate userId if provided
    let validUserId: string | null = null, username: string | null = null;
    if(userId) {
      const userCheck = await db.query(`
        SELECT id, firstname FROM bouquetbar.users WHERE id = '${userId}';
      `);
      if (!userCheck.rows.length) {
        throw new Error(`User with ID ${userId} does not exist.`);
      }
      validUserId = userId;
      username = userCheck.rows[0].firstname;
    }

      console.log("Creating order for user:", validUserId);
    console.log("Username:", username);
    // 3️⃣ Insert order
    const insertOrderQuery = `
      INSERT INTO bouquetbar.orders (
        customername,
        email,
        phone,
        occasion,
        requirements,
        status,
        items,
        total,
        createdat,
        userid,
        deliveryaddress,
        deliverydate,
        subtotal,
        deliverycharge,
        couponcode,
        discountamount,
        shippingaddressid,
        ordernumber,
        paymentmethod,
        paymentcharges,
        paymentstatus,
        paymenttransactionid,
        estimateddeliverydate,
        updatedat,
        statusupdated_at,
        pointsawarded
      ) VALUES (
        '${username || validatedOrder.customerName || ''}',
        '${validatedOrder.email}',
        '${validatedOrder.phone}',
        '${validatedOrder.occasion || ""}',
        '${validatedOrder.requirements || ""}',
        'pending',
        '${JSON.stringify(validatedOrder.items)}',
        ${validatedOrder.total},
        NOW(),
        ${validUserId ? `'${validUserId}'` : "NULL"},
        '${validatedOrder.deliveryAddress || ""}',
        ${validatedOrder.deliveryDate && validatedOrder.deliveryDate instanceof Date && !isNaN(validatedOrder.deliveryDate.getTime()) ? `'${validatedOrder.deliveryDate.toISOString()}'` : "NULL"},
        ${validatedOrder.subtotal},
        ${validatedOrder.deliveryCharge || 0},
        '${couponCode || ""}',
        ${validatedOrder.discountAmount || 0},
        ${validatedOrder.shippingAddressId ? `'${validatedOrder.shippingAddressId}'` : "NULL"},
        '${orderNumber}',
  '${validatedOrder.paymentMethod || 'Cash'}',
  ${validatedOrder.paymentCharges || 0},
  '${validatedOrder.paymentStatus || 'pending'}',
  '${validatedOrder.paymentTransactionId || ""}',
        ${validatedOrder.estimatedDeliveryDate && validatedOrder.estimatedDeliveryDate instanceof Date && !isNaN(validatedOrder.estimatedDeliveryDate.getTime()) ? `'${validatedOrder.estimatedDeliveryDate.toISOString()}'` : "NULL"},
        NOW(),
        NOW(),
        ${validatedOrder.pointsAwarded ? "true" : "false"}
      )
      RETURNING *;
    `;

    console.log('Executing insert order query:', insertOrderQuery);
    const result = await db.query(insertOrderQuery);

    // 4️⃣ Decrement product stock
    const orderItems = validatedOrder.items as Array<{ productId: string; quantity: number }>;
    for(const item of orderItems) {
      const stockQuery = `
        UPDATE bouquetbar.products
        SET 
          stockquantity = CAST(stockquantity AS INTEGER) - ${item.quantity}
        WHERE id = '${item.productId}' AND CAST(stockquantity AS INTEGER) >= ${item.quantity}
        RETURNING id, name, stockquantity;
      `;
      console.log('Executing stock decrement query:', stockQuery);
      const stockResult = await db.query(stockQuery);

      if (!stockResult.rows || stockResult.rows.length === 0) {
        throw new Error(`Insufficient stock for Product ID ${item.productId}`);
      }
    }

      // 5️⃣ Increment coupon usage
      if(couponCode) {
      const couponQuery = `
        UPDATE bouquetbar.coupons
        SET timesused = timesused + 1, updatedat = NOW()
        WHERE code = '${couponCode}';
      `;
      await db.query(couponQuery);
    }

      // 6️⃣ Clear user cart
      if(validUserId) {
      const cartQuery = `
        DELETE FROM bouquetbar.carts
        WHERE userid = '${validUserId}';
      `;
      await db.query(cartQuery);
    }

      return result.rows[0];
  } catch(error) {
    console.error("[ORDER ERROR] Order creation failed:", error);
    throw error;
  }
}

  async createAddress(address: InsertAddress): Promise < Address > {
  try {
    // ✅ If default, unset other default addresses first
    if(address.isDefault) {
  const unsetQuery = `
          UPDATE bouquetbar.addresses
          SET isdefault = false, updatedat = NOW()
          WHERE userid = '${address.userId}' AND isdefault = true;
        `;
  await db.query(unsetQuery);
}

// ✅ Insert new address into addresses table using parameterized query
const insertQuery = {
  text: `
        INSERT INTO bouquetbar.addresses (
          userid, fullname, phone, email, addressline1, addressline2, landmark,
          city, state, postalcode, country, addresstype, isdefault, isactive, createdat, updatedat
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW())
        RETURNING *;
      `,
  values: [
    address.userId,
    address.fullName,
    address.phone,
    address.email || null,
    address.addressLine1,
    address.addressLine2 || null,
    address.landmark || null,
    address.city,
    address.state,
    address.postalCode,
    address.country || 'India',
    address.addressType || 'Home',
    address.isDefault ? true : false,
  ]
};
const result = await db.query(insertQuery.text, insertQuery.values);
return result.rows[0];
    } catch (error) {
  console.error("Error in createAddress:", error);
  throw new Error(`Failed to insert address: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  async setDefaultAddress(userId: string, addressId: string): Promise < void> {
  try {
    console.log('=== SET DEFAULT ADDRESS ===');
    console.log('User ID:', userId);
    console.log('Address ID:', addressId);

    // 1️⃣ Remove default from all addresses of this user
    const unsetQuery = `
      UPDATE bouquetbar.addresses
      SET isdefault = false, updatedat = NOW()
      WHERE userid = '${userId}' AND isdefault = true AND isactive = true
    `;
    console.log('Unsetting default query:', unsetQuery);
    await db.query(unsetQuery);

    // 2️⃣ Set the new default address
    const setQuery = `
      UPDATE bouquetbar.addresses
      SET isdefault = true, updatedat = NOW()
      WHERE id = '${addressId}' AND userid = '${userId}' AND isactive = true
    `;
    console.log('Setting default query:', setQuery);
    const result = await db.query(setQuery);

    console.log('Set default result:', result);
    console.log('Rows affected:', result.rowCount);

    if(result.rowCount === 0) {
  throw new Error('Address not found or does not belong to user');
}

    } catch (error) {
  console.error("Error in setDefaultAddress:", error);
  throw new Error(
    `Failed to set default address: ${error instanceof Error ? error.message : "Unknown error"}`
  );
}
  }

  async createDeliveryOption(option: {
  name: string;
  description: string;
  estimatedDays: string;
  price: string;
  isActive: boolean;
  sortOrder: number;
}): Promise < DeliveryOption > {
  try {
    const query = `
      INSERT INTO bouquetbar.delivery_options 
        (name, description, estimateddays, price, isactive, sortorder, createdat) 
      VALUES (
        '${option.name}',
        '${option.description}',
        '${option.estimatedDays}',
        ${option.price},
        ${option.isActive},
        ${option.sortOrder},
        NOW()
      )
      RETURNING *;
    `;

    console.log("Executing query:", query);
    const result = await db.query(query);

    return result.rows[0];
  } catch(error) {
    console.error("Error in createDeliveryOption:", error);
    throw new Error(
      `Failed to create delivery option: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}


  async getUserAddresses(userId: string): Promise < Address[] > {
  const query = `
    SELECT *
    FROM bouquetbar.addresses
    WHERE userid = '${userId}'
            AND isactive=true
    ORDER BY createdat;
  `;
  const result = await db.query(query);
  return result.rows;
}

  async deleteAddress(id: string): Promise < void> {
  const query = `
    UPDATE bouquetbar.addresses
    SET isactive = false, updatedat = NOW() 
    WHERE id = '${id}' AND isactive=true;
  `;
  await db.query(query);
}

  async getAddress(id: string): Promise < Address | undefined > {
  try {
    if(!id) {
      throw new Error("Address ID is required");
    }
      const query = `
      SELECT *
      FROM bouquetbar.addresses
      WHERE id = '${id}'
        AND isactive=true
      LIMIT 1;
    `;
    console.log("Executing query:", query);
    const result = await db.query(query);
    console.log("Query Result:", result.rows || "No address found");

    return result.rows[0] || undefined;
  } catch(error) {
    console.error("Error in getAddress:", error);
    throw new Error(
      `Failed to get address: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}



  async getActiveDeliveryOptions(): Promise < DeliveryOption[] > {
  const query = `
    SELECT *
    FROM bouquetbar.delivery_options
    WHERE isactive = true
    ORDER BY sortorder;
  `;
  const result = await db.query(query);
  return result.rows;
}


  async addFavorite(userId: string, productId: string): Promise < Favorite > {
  const query = `
    INSERT INTO bouquetbar.favorites (userid, productid, createdat)
    VALUES ('${userId}', '${productId}', NOW())
    RETURNING *;
  `;
  const result = await db.query(query);
  return result.rows[0];
}


  async removeFavorite(userId: string, productId: string): Promise < void> {
  const query = `
    DELETE FROM bouquetbar.favorites
    WHERE userid = '${userId}' AND productid = '${productId}';
  `;
  await db.query(query);
}


  async getFavorites(userId: string): Promise < (Favorite & { product: Product })[] > {
  const query = `
    SELECT f.*, p.*
    FROM bouquetbar.favorites f
    INNER JOIN bouquetbar.products p ON f.productid = p.id
    WHERE f.userid = '${userId}' AND p.isactive = true
    ORDER BY f.createdat;
  `;
  const result = await db.query(query);
  return result.rows;
}


  async addCoupon(coupon: InsertCoupon): Promise < Coupon > {
  const query = `
    INSERT INTO bouquetbar.coupons (code, type, value, maxdiscount, minordervalue, expiresat, createdat)
    VALUES ('${coupon.code}', '${coupon.type}', ${coupon.value}, ${coupon.maxDiscount || 0}, ${coupon.minOrderAmount || 0}, ${coupon.expiresAt ? `'${coupon.expiresAt}'` : 'NULL'}, NOW())
    RETURNING *;
  `;
  const result = await db.query(query);
  return result.rows[0];
}


  async getCoupon(code: string): Promise < Coupon | undefined > {
  const query = `
    SELECT *
    FROM bouquetbar.coupons
    WHERE code = '${code}'
    LIMIT 1;
  `;
  const result = await db.query(query);
  return result.rows[0] || undefined;
}

  async getCouponByCode(code: string): Promise < Coupon | undefined > {
  try {
    const normalizedCode = code.trim().toUpperCase();
    const query = `
      SELECT 
        id,
        code,
        type,
        value,
        isactive,
        startsat,
        expiresat,
        minorder_amount,
        maxdiscount,
        usagelimit,
        timesused,
        description,
        createdat,
        updatedat
      FROM bouquetbar.coupons
      WHERE UPPER(code) = $1
      LIMIT 1;
    `;
    const result = await db.query(query, [normalizedCode]);
    const row = result.rows[0];
    
    if (!row) {
      return undefined;
    }
    
    // Map snake_case columns to camelCase for consistency with schema
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      isActive: row.isactive,
      startsAt: row.startsat,
      expiresAt: row.expiresat,
      minOrderAmount: row.minorder_amount,
      maxDiscount: row.maxdiscount,
      usageLimit: row.usagelimit,
      timesUsed: row.timesused,
      description: row.description,
      createdAt: row.createdat,
      updatedAt: row.updatedat
    } as Coupon;
  } catch (error) {
    console.error('Error in getCouponByCode:', error);
    throw new Error(`Failed to fetch coupon by code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getAllCoupons(): Promise < Coupon[] > {
  try {
    const query = `
      SELECT 
        id,
        code,
        type,
        value,
        isactive,
        startsat,
        expiresat,
        minorder_amount,
        maxdiscount,
        usagelimit,
        timesused,
        description,
        createdat,
        updatedat
      FROM bouquetbar.coupons
      ORDER BY createdat DESC;
    `;
    const result = await db.query(query);
    
    // Map snake_case columns to camelCase for consistency
    return result.rows.map(row => ({
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      isActive: row.isactive,
      startsAt: row.startsat,
      expiresAt: row.expiresat,
      minOrderAmount: row.minorder_amount,
      maxDiscount: row.maxdiscount,
      usageLimit: row.usagelimit,
      timesUsed: row.timesused,
      description: row.description,
      createdAt: row.createdat,
      updatedAt: row.updatedat
    } as Coupon));
  } catch (error) {
    console.error('Error in getAllCoupons:', error);
    throw new Error(`Failed to fetch coupons: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async createCoupon(coupon: InsertCoupon): Promise < Coupon > {
  const query = `
    INSERT INTO bouquetbar.coupons 
      (code, type, value, isactive, startsat, expiresat, minorder_amount, maxdiscount, usagelimit, description, createdat, updatedat)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    RETURNING *;
  `;
  const result = await db.query(query, [
    coupon.code,
    coupon.type,
    coupon.value,
    coupon.isActive !== undefined ? coupon.isActive : true,
    coupon.startsAt || null,
    coupon.expiresAt || null,
    coupon.minOrderAmount || 0,
    coupon.maxDiscount || null,
    coupon.usageLimit || null,
    coupon.description || null
  ]);
  return result.rows[0];
}

  async updateCoupon(id: string, updates: Partial<Coupon>): Promise < Coupon > {
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if(updates.code !== undefined) {
    updateFields.push(`code = $${paramIndex++}`);
    values.push(updates.code);
  }
  if(updates.type !== undefined) {
    updateFields.push(`type = $${paramIndex++}`);
    values.push(updates.type);
  }
  if(updates.value !== undefined) {
    updateFields.push(`value = $${paramIndex++}`);
    values.push(updates.value);
  }
  if(updates.isActive !== undefined) {
    updateFields.push(`isactive = $${paramIndex++}`);
    values.push(updates.isActive);
  }
  if(updates.startsAt !== undefined) {
    updateFields.push(`startsat = $${paramIndex++}`);
    values.push(updates.startsAt || null);
  }
  if(updates.expiresAt !== undefined) {
    updateFields.push(`expiresat = $${paramIndex++}`);
    values.push(updates.expiresAt || null);
  }
  if(updates.minOrderAmount !== undefined) {
    updateFields.push(`minorder_amount = $${paramIndex++}`);
    values.push(updates.minOrderAmount);
  }
  if(updates.maxDiscount !== undefined) {
    updateFields.push(`maxdiscount = $${paramIndex++}`);
    values.push(updates.maxDiscount || null);
  }
  if(updates.usageLimit !== undefined) {
    updateFields.push(`usagelimit = $${paramIndex++}`);
    values.push(updates.usageLimit || null);
  }
  if(updates.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    values.push(updates.description || null);
  }

  updateFields.push(`updatedat = NOW()`);
  values.push(id);

  const query = `
    UPDATE bouquetbar.coupons
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *;
  `;
  const result = await db.query(query, values);
  
  if (!result.rows[0]) {
    throw new Error('Coupon not found');
  }
  
  return result.rows[0];
}

  async updateAddress(id: string, updates: Partial<Address>): Promise < Address > {
  try {
    const updateFields: string[] = [];
    if(updates.fullName) updateFields.push(`fullname = '${updates.fullName}'`);
    if(updates.phone) updateFields.push(`phone = '${updates.phone}'`);
    if(updates.email) updateFields.push(`email = '${updates.email}'`);
    if(updates.addressLine1) updateFields.push(`addressline1 = '${updates.addressLine1}'`);
    if(updates.addressLine2 !== undefined) updateFields.push(`addressline2 = ${updates.addressLine2 ? `'${updates.addressLine2}'` : 'NULL'}`);
    if(updates.landmark !== undefined) updateFields.push(`landmark = ${updates.landmark ? `'${updates.landmark}'` : 'NULL'}`);
    if(updates.city) updateFields.push(`city = '${updates.city}'`);
    if(updates.state) updateFields.push(`state = '${updates.state}'`);
    if(updates.postalCode) updateFields.push(`postalcode = '${updates.postalCode}'`);
    if(updates.country) updateFields.push(`country = '${updates.country}'`);
    if(updates.addressType) updateFields.push(`addresstype = '${updates.addressType}'`);
    if(updates.isDefault !== undefined) updateFields.push(`isdefault = ${updates.isDefault}`);

    updateFields.push(`updatedat = NOW()`);

    const query = `
        UPDATE bouquetbar.addresses
        SET ${updateFields.join(', ')}
        WHERE id = '${id}' AND isactive = true
        RETURNING *;
      `;

    const result = await db.query(query);
    if(!result.rows[0]) {
  throw new Error(`Address with id ${id} not found`);
}
return result.rows[0];
    } catch (error) {
  console.error('Error in updateAddress:', error);
  throw new Error(`Failed to update address: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  async validateCoupon(code: string, orderSubtotal: number): Promise < {
  isValid: boolean;
  discount?: number;
  error?: string;
} > {
  const coupon = await this.getCoupon(code);

  if(!coupon) {
    return { isValid: false, error: "Invalid coupon code" };
  }

    const now = new Date();
  if(coupon.expiresAt && coupon.expiresAt < now) {
  return { isValid: false, error: "Coupon has expired" };
}

if (coupon.minOrderAmount && orderSubtotal < parseFloat(coupon.minOrderAmount)) {
  return {
    isValid: false,
    error: `Order subtotal must be at least ${coupon.minOrderAmount} to use this coupon`
  };
}

// Calculate discount
let discount = 0;
if (coupon.type === "percentage") {
  discount = (orderSubtotal * parseFloat(coupon.value)) / 100;
  if (coupon.maxDiscount) {
    discount = Math.min(discount, parseFloat(coupon.maxDiscount));
  }
} else {
  discount = Math.min(parseFloat(coupon.value), orderSubtotal);
}

return { isValid: true, discount };
  }


  async getCourses(): Promise < any[] > {
  const query = `
        SELECT * FROM 
      bouquetbar.courses
      WHERE isactive = true
      ORDER BY created_at DESC;
  `;
  console.log('Executing query:', query);
  const result = await db.query(query);
  console.log('Query executed successfully');
  return result.rows || [];
}

  async getAllEvents(): Promise < Event[] > {
  const query = `
    SELECT 
      id,
      title,
      event_type,
      event_date,
      event_time::text as event_time,
      duration::text as duration,
      instructor,
      spots_left,
      image,
      booking_available,
      created_at,
      updated_at,
      amount
    FROM bouquetbar.events
    WHERE isactive = true
    ORDER BY event_date ASC;
  `;
  console.log('Executing getAllEvents query:', query);
  const result = await db.query(query);
  return result.rows || [];
}

  async getEventById(id: string): Promise < Event | null > {
  try {
    if(!id) {
      throw new Error('Event ID is required');
    }

      const query = `
        SELECT 
          id,
          title,
          event_type,
          event_date,
          event_time::text as event_time,
          duration::text as duration,
          instructor,
          spots_left,
          image,
          booking_available,
          created_at,
          updated_at,
          amount
        FROM bouquetbar.events
        WHERE id = $1 AND isactive = true
        LIMIT 1;
      `;
    console.log('Executing getEventById query:', query, 'with id:', id);
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  } catch(error) {
    console.error('Error in getEventById:', error);
    throw new Error(`Failed to fetch event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getEvent(id: string): Promise < Event | undefined > {
  try {
    if(!id) {
      throw new Error('Event ID is required');
    }

      const query = `
        SELECT 
          id,
          title,
          event_type,
          event_date,
          event_time::text as event_time,
          duration::text as duration,
          instructor,
          spots_left,
          image,
          booking_available,
          created_at,
          updated_at,
          amount
        FROM bouquetbar.events
        WHERE id = $1 AND isactive = true
        LIMIT 1;
      `;
    console.log('Executing query:', query);
    const result = await db.query(query, [id]);
    return result.rows[0] || undefined;
  } catch(error) {
    console.error('Error in getEvent:', error);
    throw new Error(`Failed to get event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async createEvent(eventData: any): Promise < Event > {
  try {
    const {
      title,
      event_type,
      event_date,
      event_time,
      duration,
      instructor,
      spots_left,
      image,
      booking_available,
      amount
    } = eventData;

    const query = `
        INSERT INTO bouquetbar.events(
          title,
          event_type,
          event_date,
          event_time,
          duration,
          instructor,
          spots_left,
          image,
          booking_available,
          amount,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )
        RETURNING *;
      `;

    const values = [
      title,
      event_type,
      event_date,
      event_time || null,
      duration || null,
      instructor || null,
      spots_left || null,
      image || null,
      booking_available !== undefined ? booking_available : true,
      amount || '0.00'
    ];

    console.log('Executing event creation query:', query);
    console.log('Values:', values);

    const result = await db.query(query, values);
    console.log('Event created successfully:', result.rows[0]);
    return result.rows[0];
  } catch(error) {
    console.error('Error creating event:', error);
    throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async updateEvent(id: string, updates: any): Promise < Event > {
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    if(updates.title !== undefined) {
  updateFields.push(`title = $${valueCount}`);
  values.push(updates.title);
  valueCount++;
}

if (updates.event_type !== undefined) {
  updateFields.push(`event_type = $${valueCount}`);
  values.push(updates.event_type);
  valueCount++;
}

if (updates.event_date !== undefined) {
  updateFields.push(`event_date = $${valueCount}`);
  values.push(updates.event_date);
  valueCount++;
}

if (updates.event_time !== undefined) {
  updateFields.push(`event_time = $${valueCount}`);
  values.push(updates.event_time);
  valueCount++;
}

if (updates.duration !== undefined) {
  updateFields.push(`duration = $${valueCount}`);
  values.push(updates.duration);
  valueCount++;
}

if (updates.instructor !== undefined) {
  updateFields.push(`instructor = $${valueCount}`);
  values.push(updates.instructor);
  valueCount++;
}

if (updates.spots_left !== undefined) {
  updateFields.push(`spots_left = $${valueCount}`);
  values.push(updates.spots_left);
  valueCount++;
}

if (updates.image !== undefined) {
  updateFields.push(`image = $${valueCount}`);
  values.push(updates.image);
  valueCount++;
}

if (updates.booking_available !== undefined) {
  updateFields.push(`booking_available = $${valueCount}`);
  values.push(updates.booking_available);
  valueCount++;
}

if (updates.amount !== undefined) {
  updateFields.push(`amount = $${valueCount}`);
  values.push(updates.amount);
  valueCount++;
}

if (updateFields.length === 0) {
  throw new Error("No fields provided for update");
}

// Always update the updated_at field
updateFields.push(`updated_at = NOW()`);
values.push(id);

const query = `
        UPDATE bouquetbar.events
        SET ${updateFields.join(', ')}
        WHERE id = $${valueCount}
        RETURNING *;
      `;

console.log('Executing update event query:', query);
console.log('With values:', values);
const result = await db.query(query, values);

if (!result.rows[0]) {
  throw new Error(`Event with id ${id} not found`);
}

return result.rows[0];
    } catch (error) {
  console.error('Error in updateEvent:', error);
  throw new Error(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async deleteEvent(id: string): Promise < void> {
  try {
    if(!id) {
      throw new Error('Event ID is required');
    }

      // First check if the event exists
      const eventCheck = await db.query('SELECT id FROM bouquetbar.events WHERE id = $1', [id]);
    if(eventCheck.rows.length === 0) {
  throw new Error('Event not found');
}

const query = `
        UPDATE bouquetbar.events
        SET isactive = false
        WHERE id = $1
        RETURNING id;
      `;

console.log('Executing delete event query:', query);
const result = await db.query(query, [id]);

if (result.rowCount === 0) {
  throw new Error('Event could not be deleted');
}

console.log('Event deleted successfully');
    } catch (error) {
  console.error('Error in deleteEvent:', error);
  throw new Error(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }


  async getsubscribe(email ?: string): Promise < any[] > {
  try {
    if(!email) {
      // If no email provided, return all subscribers
      const query = `
          SELECT * FROM bouquetbar.subscribe
          ORDER BY createdat DESC;
        `;
      console.log('Executing query:', query);
      const result = await db.query(query);
      return result.rows || [];
    }

      // Check if email is already subscribed
      const checkQuery = `
        SELECT * FROM bouquetbar.subscribe
        WHERE usermailid = $1
        LIMIT 1;
      `;
    console.log('Executing check query:', checkQuery);
    const result = await db.query(checkQuery, [email]);

    if(result.rows.length === 0) {
  // Email not found, add new subscription
  const insertQuery = `
          INSERT INTO bouquetbar.subscribe (usermailid, createdat)
          VALUES ($1, NOW())
          RETURNING *;
        `;
  console.log('Executing insert query:', insertQuery);
  const insertResult = await db.query(insertQuery, [email]);
  return insertResult.rows || [];
}

// Email already exists, return existing record
return result.rows || [];
    } catch (error) {
  console.error('Error in getsubscribe:', error);
  throw new Error(`Failed to process subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async getAllSubscriptions(): Promise < any[] > {
  try {
    const query = `
        SELECT usermailid, createdat 
        FROM bouquetbar.subscribe
        ORDER BY createdat DESC;
      `;
    console.log('Executing query:', query);
    const result = await db.query(query);
    return result.rows || [];
  } catch(error) {
    console.error('Error in getAllSubscriptions:', error);
    throw new Error(`Failed to get subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async addEmailSubscription(email: string): Promise < any > {
  try {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
    if(!emailRegex.test(email)) {
  throw new Error('Invalid email format');
}

// Check if email already exists
const checkQuery = `
        SELECT * FROM bouquetbar.subscribe
        WHERE usermailid = $1
        LIMIT 1;
      `;
const existingResult = await db.query(checkQuery, [email]);

if (existingResult.rows.length > 0) {
  return {
    isNew: false,
    subscription: existingResult.rows[0],
    message: 'Email already subscribed'
  };
}

// Add new subscription
const insertQuery = `
        INSERT INTO bouquetbar.subscribe (usermailid, createdate)
        VALUES ($1, NOW())
        RETURNING *;
      `;
const result = await db.query(insertQuery, [email]);
return {
  isNew: true,
  subscription: result.rows[0],
  message: 'Successfully subscribed'
};
    } catch (error) {
  console.error('Error in addEmailSubscription:', error);
  throw new Error(`Failed to add email subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  // Save landing contact (name, email, phone, city, address)
  async addLandingContact(contact: { name: string; email: string; phone: string; city?: string; address?: string }): Promise < any > {
  try {
    if(!contact || !contact.email) {
  throw new Error('Contact and email are required');
}

// Basic email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.com$/i;
if (!emailRegex.test(contact.email)) {
  throw new Error('Invalid email format - only .com addresses are allowed');
}

// Ensure table exists with new columns (safe to run repeatedly)
const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bouquetbar.landing_contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT,
          email TEXT NOT NULL,
          phone TEXT,
          city TEXT,
          address TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
await db.query(createTableQuery);

const insertQuery = `
        INSERT INTO bouquetbar.landing_contacts (name, email, phone, city, address)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
const result = await db.query(insertQuery, [
  contact.name || null, 
  contact.email, 
  contact.phone || null,
  contact.city || null,
  contact.address || null
]);
return { success: true, contact: result.rows[0] };
    } catch (error) {
  console.error('Error in addLandingContact:', error);
  throw new Error(`Failed to add landing contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async getAllLandingContacts(): Promise < any[] > {
  try {
    // Ensure table exists to avoid errors when empty (including new columns)
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bouquetbar.landing_contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT,
          email TEXT NOT NULL,
          phone TEXT,
          city TEXT,
          address TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
    await db.query(createTableQuery);

    const query = `SELECT id, name, email, phone, city, address, created_at FROM bouquetbar.landing_contacts ORDER BY created_at DESC;`;
    const result = await db.query(query);
    return result.rows;
  } catch(error) {
    console.error('Error in getAllLandingContacts:', error);
    throw new Error(`Failed to fetch landing contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async getEventPricing(): Promise < any > {
  try {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bouquetbar.event_pricing (
          id SERIAL PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          label TEXT,
          price TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;
    await db.query(createTableQuery);

    const query = `SELECT key, label, price, updated_at FROM bouquetbar.event_pricing;`;
    const result = await db.query(query);

    // Convert rows to an object keyed by `key`
    const obj: any = {};
    for(const row of result.rows) {
  obj[row.key] = { label: row.label, price: row.price, updated_at: row.updated_at };
}
return obj;
    } catch (error) {
  console.error('Error in getEventPricing:', error);
  throw new Error(`Failed to get event pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async updateEventPricing(pricing: any): Promise < any > {
  try {

    const keys = Object.keys(pricing || {});

    // Upsert each provided key
    for(const key of keys) {
      const item = pricing[key];
      const upsertQuery = `
          INSERT INTO bouquetbar.event_pricing (key, label, price, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, price = EXCLUDED.price, updated_at = NOW();
        `;
      await db.query(upsertQuery, [key, item.label || null, String(item.price || '')]);
    }

      await db.query('COMMIT');
    return await this.getEventPricing();
  } catch(error) {
    try { await db.query('ROLLBACK'); } catch (e) { /* ignore rollback errors */ }
    console.error('Error in updateEventPricing:', error);
    throw new Error(`Failed to update event pricing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


  async addEventEnrollment(enrollment: {
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  paymentMethod: string;
  paymentAmount: number;
  transactionId?: string;
}): Promise < any > {
  try {
    // First verify if the event exists
    const checkEventQuery = 'SELECT id FROM bouquetbar.events WHERE id = $1';
    const eventResult = await db.query(checkEventQuery, [enrollment.eventId]);

    if(eventResult.rows.length === 0) {
  throw new Error('Event not found');
}

// Insert the enrollment
const query = `
            INSERT INTO bouquetbar.events_enrollments (
                event_id,
                first_name,
                last_name,
                email,
                phone,
                payment_status,
                payment_amount,
                transaction_id,
                enrolled_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
            ) RETURNING *
        `;
const values = [
  enrollment.eventId,
  enrollment.firstName,
  enrollment.lastName,
  enrollment.email,
  enrollment.phone,
  enrollment.paymentMethod === 'online' ? 'completed' : 'pending',
  enrollment.paymentAmount,
  enrollment.transactionId || null
];

console.log('Executing enrollment query with values:', values);
const result = await db.query(query, values);
console.log('Insert Result:', result.rows);
return result.rows[0];
    } catch (error) {
  console.error('Error in addEventEnrollment:', error);
  throw error;
}
  }




  async updateOrderStatus(id: string, status: string): Promise < Order > {
  try {
    await db.query('BEGIN');
    try {
      const updateQuery = `
          UPDATE bouquetbar.orders
          SET 
            status = $1, 
            statusupdated_at = NOW(), 
            updatedat = NOW()
          WHERE id = $2
          RETURNING *;
        `;
      const result = await db.query(updateQuery, [status, id]);

      if(result.rows.length === 0) {
  throw new Error('Order not found');
}
const historyQuery = `
          INSERT INTO bouquetbar.order_status_history 
          (order_id, status, note, changed_at)
          VALUES ($1, $2, $3, NOW());
        `;
await db.query(historyQuery, [id, status, `Status updated to ${status || 'No Note'}`]);
if (status === 'delivered') {
  const order = result.rows[0];
  if (order.userid && !order.pointsawarded) {
    const points = Math.floor(parseFloat(order.total) / 100);
    if (points > 0) {
      const updateUserQuery = `
                UPDATE bouquetbar.users
                SET 
                  points = COALESCE(points, 0) + $1,
                  updatedat = NOW()
                WHERE id = $2;
              `;
      await db.query(updateUserQuery, [points, order.userid]);
      await db.query(`
                UPDATE bouquetbar.orders
                SET pointsawarded = true
                WHERE id = $1;
              `, [id]);
    }
  }
}
await db.query('COMMIT');
return result.rows[0];
      } catch (error) {
  await db.query('ROLLBACK');
  throw error;
}
    } catch (error) {
  console.error('Error updating order status:', error);
  throw error;
}
  }


  async AdminClasses(): Promise < any[] > {
  const query = `
        SELECT 
          id,
          title,
          description,
          price,
          duration,
          sessions,
          features,
          popular,
          nextbatch,
          created_at,
          image,
          category
        FROM bouquetbar.courses
        WHERE isactive = true
        ORDER BY created_at DESC;
    `;
  const result = await db.query(query);
  return result.rows;
}

  async AddAdminClasses(classData: any): Promise < any > {
  try {
    const {
      title,
      description,
      price,
      duration,
      sessions,
      features,
      nextbatch,
      image,
      category
    } = classData;

    const query = `
        INSERT INTO bouquetbar.courses(
          title,
          description,
          price,
          duration,
          sessions,
          features,
          popular,
          nextbatch,
          created_at,
          image,
          category
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10
        )
        RETURNING *;
      `;

    const values = [
      title,
      description,
      price,
      duration,
      sessions,
      JSON.stringify(features),
      false, // default value for popular
      nextbatch,
      image,
      category
    ];

    const result = await db.query(query, values);
    console.log('Class added successfully:', result.rows[0]);
    return result.rows[0];
  } catch(error) {
    console.error('Error adding class:', error);
    throw new Error('Failed to add class');
  }
}

  async updateClass(id: string, updates: any): Promise < any > {
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    if(updates.title !== undefined) {
  updateFields.push(`title = $${valueCount}`);
  values.push(updates.title);
  valueCount++;
}

if (updates.description !== undefined) {
  updateFields.push(`description = $${valueCount}`);
  values.push(updates.description);
  valueCount++;
}

if (updates.price !== undefined) {
  updateFields.push(`price = $${valueCount}`);
  values.push(updates.price);
  valueCount++;
}

if (updates.duration !== undefined) {
  updateFields.push(`duration = $${valueCount}`);
  values.push(updates.duration);
  valueCount++;
}

if (updates.sessions !== undefined) {
  updateFields.push(`sessions = $${valueCount}`);
  values.push(updates.sessions);
  valueCount++;
}

if (updates.features !== undefined) {
  updateFields.push(`features = $${valueCount}`);
  values.push(JSON.stringify(updates.features));
  valueCount++;
}

if (updates.nextbatch !== undefined) {
  updateFields.push(`nextbatch = $${valueCount}`);
  values.push(updates.nextbatch);
  valueCount++;
}

if (updates.image !== undefined) {
  updateFields.push(`image = $${valueCount}`);
  values.push(updates.image);
  valueCount++;
}

if (updates.category !== undefined) {
  updateFields.push(`category = $${valueCount}`);
  values.push(updates.category);
  valueCount++;
}

if (updates.popular !== undefined) {
  updateFields.push(`popular = $${valueCount}`);
  values.push(updates.popular);
  valueCount++;
}

if (updateFields.length === 0) {
  throw new Error("No fields provided for update");
}

// Always update the updated_at field
updateFields.push(`updated_at = NOW()`);
values.push(id);

const query = `
      UPDATE bouquetbar.courses
      SET ${updateFields.join(', ')}
      WHERE id = $${valueCount}
      RETURNING *;
    `;

console.log('Executing update class query:', query);
console.log('With values:', values);
const result = await db.query(query, values);

if (!result.rows[0]) {
  throw new Error(`Class with id ${id} not found`);
}

return result.rows[0];
    } catch (error) {
  console.error('Error in updateClass:', error);
  throw new Error(`Failed to update class: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  async deleteClass(id: string): Promise < void> {
  try {
    if(!id) {
      throw new Error('Class ID is required');
    }

      // First check if the class exists
      const classCheck = await db.query('SELECT id FROM bouquetbar.courses WHERE id = $1', [id]);
    if(classCheck.rows.length === 0) {
  throw new Error('Class not found');
}

const query = `
      UPDATE bouquetbar.courses
      SET isactive = false
      WHERE id = $1
      RETURNING id;
    `;

console.log('Executing delete class query:', query);
const result = await db.query(query, [id]);

if (result.rowCount === 0) {
  throw new Error('Class could not be deleted');
}

console.log('Class deleted successfully');
    } catch (error) {
  console.error('Error in deleteClass:', error);
  throw new Error(`Failed to delete class: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
  }

  // Pay Later functionality
  async createPayLaterRequest(payLaterData: {
    full_name: string;
    email_address: string;
    phone_number: string;
    payment_method: string;
    questions_or_comments?: string;
    courses_or_workshops?: string;
    payment_id?: string;
    order_id?: string;
  }): Promise<any> {
    try {
      // Ensure table exists with all columns including payment fields
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bouquetbar.paylater (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          full_name TEXT NOT NULL,
          email_address TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          questions_or_comments TEXT,
          courses_or_workshops TEXT,
          payment_id TEXT,
          order_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await db.query(createTableQuery);

      const insertQuery = `
        INSERT INTO bouquetbar.paylater 
        (full_name, email_address, phone_number, payment_method, questions_or_comments, courses_or_workshops, payment_id, order_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      
      const result = await db.query(insertQuery, [
        payLaterData.full_name,
        payLaterData.email_address,
        payLaterData.phone_number,
        payLaterData.payment_method,
        payLaterData.questions_or_comments || null,
        payLaterData.courses_or_workshops || null,
        payLaterData.payment_id || null,
        payLaterData.order_id || null
      ]);

      console.log('Pay Later request created successfully:', result.rows[0]);
      return { success: true, payLater: result.rows[0], id: result.rows[0].id };
    } catch (error) {
      console.error('Error in createPayLaterRequest:', error);
      throw new Error(`Failed to create pay later request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


      async getAllPayLaterRequests() {
        try {
            // Ensure table exists to avoid errors when empty
            const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bouquetbar.paylater (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          full_name TEXT NOT NULL,
          email_address TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          questions_or_comments TEXT,
          courses_or_workshops TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
            await db.query(createTableQuery);
            const query = `
        SELECT * FROM bouquetbar.paylater
        ORDER BY created_at DESC
      `;
            const result = await db.query(query);
            return result.rows;
        }
        catch (error) {
            console.error('Error in getAllPayLaterRequests:', error);
            throw new Error(`Failed to fetch pay later requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
  async getPayLaterRequestById(id: string): Promise<any | undefined> {
    try {
      const query = `
        SELECT * FROM bouquetbar.paylater 
        WHERE id = $1
      `;
      const result = await db.query(query, [id]);
      return result.rows[0] || undefined;
    } catch (error) {
      console.error('Error in getPayLaterRequestById:', error);
      throw new Error(`Failed to fetch pay later request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deletePayLaterRequest(id: string): Promise<void> {
    try {
      const query = `
        DELETE FROM bouquetbar.paylater 
        WHERE id = $1
        RETURNING id;
      `;
      const result = await db.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('Pay later request not found');
      }
      
      console.log('Pay later request deleted successfully');
    } catch (error) {
      console.error('Error in deletePayLaterRequest:', error);
      throw new Error(`Failed to delete pay later request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}
