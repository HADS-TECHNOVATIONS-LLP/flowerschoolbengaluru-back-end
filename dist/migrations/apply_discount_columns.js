import { db } from '../db.js';

async function run() {
  console.log('🚀 Applying migration: add discount columns to bouquetbar.products');
  try {
    await db.query(`
      ALTER TABLE bouquetbar.products
        ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
    `);

    console.log('✅ Columns ensured. Backfilling nulls if any...');

    await db.query(`
      UPDATE bouquetbar.products
      SET discount_percentage = COALESCE(discount_percentage, 0),
          discount_amount = COALESCE(discount_amount, 0)
      WHERE discount_percentage IS NULL OR discount_amount IS NULL;
    `);

    const res = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'bouquetbar' AND table_name = 'products' AND column_name IN ('discount_percentage','discount_amount')
      ORDER BY column_name;
    `);

    console.log('📋 Migration verification:');
    console.table(res.rows);

    const counts = await db.query(`
      SELECT COUNT(*) AS total_products,
             COUNT(discount_percentage) FILTER (WHERE discount_percentage IS NOT NULL) AS with_discount_percentage,
             COUNT(discount_amount) FILTER (WHERE discount_amount IS NOT NULL) AS with_discount_amount
      FROM bouquetbar.products;
    `);

    console.log('📊 Products summary:');
    console.table(counts.rows);

    console.log('✅ Migration applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    try { await db.end(); } catch (e) { /* ignore */ }
  }
}

run();
