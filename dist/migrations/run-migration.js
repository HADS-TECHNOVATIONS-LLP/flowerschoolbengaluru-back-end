import { db } from '../db.js';
async function migrate() {
    console.log('🚀 Starting migration: Add user details to custom requests table...');
    try {
        // Add user detail columns to the custom table
        await db.query(`
      ALTER TABLE bouquetbar.custom 
      ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS user_phone VARCHAR(50);
    `);
        console.log('✅ Columns added successfully!');
        // Verify the columns were added
        const result = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'bouquetbar' 
        AND table_name = 'custom' 
        AND column_name IN ('user_name', 'user_email', 'user_phone')
      ORDER BY column_name;
    `);
        console.log('✅ Migration completed successfully!');
        console.log('📋 Columns added:');
        console.table(result.rows);
        // Check existing data
        const countResult = await db.query(`
      SELECT COUNT(*) as total_requests,
             COUNT(user_name) as with_user_name,
             COUNT(user_email) as with_user_email,
             COUNT(user_phone) as with_user_phone
      FROM bouquetbar.custom;
    `);
        console.log('📊 Custom requests data:');
        console.table(countResult.rows);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        await db.end();
        console.log('🔌 Database connection closed');
    }
}
migrate();
