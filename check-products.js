import { DatabaseStorage } from './database-storage.js';

const storage = new DatabaseStorage();

async function checkProducts() {
  try {
    console.log('Checking products in database...');
    
    // Get all products
    const products = await storage.getAllProducts();
    console.log(`Found ${products.length} products`);
    
    // Look for "Mixed Roses" specifically
    const mixedRoses = products.find(p => p.name.toLowerCase().includes('mixed') && p.name.toLowerCase().includes('roses'));
    if (mixedRoses) {
      console.log('Found Mixed Roses product:', {
        id: mixedRoses.id,
        name: mixedRoses.name,
        stockQuantity: mixedRoses.stockQuantity,
        inStock: mixedRoses.inStock,
        price: mixedRoses.price
      });
    } else {
      console.log('Mixed Roses product not found. Available products:');
      products.forEach(p => {
        console.log(`- ${p.name} (Stock: ${p.stockQuantity}, ID: ${p.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking products:', error);
  }
}

checkProducts();