const db = require('./db');

(async () => {
  try {
    // Check if discount columns exist
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND table_schema = 'bouquetbar'
      AND column_name IN ('discount_percentage', 'discount_amount', 'original_price')
      ORDER BY column_name;
    `);
    console.log('Discount columns in database:');
    console.table(columns.rows);
    
    // Check sample products
    const sample = await db.query(`
      SELECT id, name, price, original_price, discount_percentage, discount_amount, discounts_offers
      FROM bouquetbar.products 
      ORDER BY createdat DESC
      LIMIT 5;
    `);
    console.log('\nSample products with discount data:');
    console.table(sample.rows);
    
    // Check if any products have discount data
    const withDiscounts = await db.query(`
      SELECT COUNT(*) as total_products,
             COUNT(original_price) as with_original_price,
             COUNT(discount_percentage) as with_discount_percentage,
             COUNT(discount_amount) as with_discount_amount
      FROM bouquetbar.products;
    `);
    console.log('\nDiscount data statistics:');
    console.table(withDiscounts.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
})();