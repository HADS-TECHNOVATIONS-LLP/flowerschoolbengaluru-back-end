import { neon } from '@neondatabase/serverless';

const sql = neon('postgres://postgres:2002@localhost:5432/bouquetbar');

async function checkProducts() {
  try {
    console.log('Checking products in database...');
    
    // Query all products
    const products = await sql`SELECT id, name, stockquantity, instock, price FROM products ORDER BY name`;
    console.log(`Found ${products.length} products:`);
    
    // Look for "Mixed Roses" specifically
    const mixedRoses = products.find(p => p.name.toLowerCase().includes('mixed') && p.name.toLowerCase().includes('roses'));
    if (mixedRoses) {
      console.log('\n🌹 Found Mixed Roses product:');
      console.log({
        id: mixedRoses.id,
        name: mixedRoses.name,
        stockQuantity: mixedRoses.stockquantity,
        inStock: mixedRoses.instock,
        price: mixedRoses.price
      });
    } else {
      console.log('\n❌ Mixed Roses product not found.');
    }
    
    console.log('\n📋 All available products:');
    products.forEach((p, index) => {
      console.log(`${index + 1}. ${p.name} (Stock: ${p.stockquantity}, In Stock: ${p.instock}, ID: ${p.id})`);
    });
    
    // Search for any products with "Roses" in the name
    const roseProducts = products.filter(p => p.name.toLowerCase().includes('roses'));
    if (roseProducts.length > 0) {
      console.log('\n🌹 Products with "Roses" in name:');
      roseProducts.forEach(p => {
        console.log(`- ${p.name} (Stock: ${p.stockquantity}, ID: ${p.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking products:', error);
  }
}

checkProducts();