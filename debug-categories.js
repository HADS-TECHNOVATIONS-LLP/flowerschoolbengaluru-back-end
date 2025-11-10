// Debug script to check product categories
import { DatabaseStorage } from './database-storage.js';

const storage = new DatabaseStorage();

async function debugCategories() {
  try {
    console.log('Loading all products...');
    const products = await storage.getAllProducts();
    
    console.log(`Total products: ${products.length}`);
    
    // Get unique categories
    const categories = new Set();
    const subcategories = new Set();
    
    products.forEach(product => {
      if (product.category) categories.add(product.category);
      if (product.subcategory) subcategories.add(product.subcategory);
    });
    
    console.log('\nUnique Categories:');
    Array.from(categories).sort().forEach(cat => console.log(`  - "${cat}"`));
    
    console.log('\nUnique Subcategories:');
    Array.from(subcategories).sort().forEach(sub => console.log(`  - "${sub}"`));
    
    // Test "Best Wishes" specifically
    console.log('\n--- Testing "Best Wishes" ---');
    const bestWishesResults = await storage.getProductsByCategoryAndSubcategory('Best Wishes');
    console.log(`Found ${bestWishesResults.length} products for "Best Wishes"`);
    
    if (bestWishesResults.length > 0) {
      console.log('Sample products:');
      bestWishesResults.slice(0, 3).forEach(p => {
        console.log(`  - ${p.name} (Category: "${p.category}", Subcategory: "${p.subcategory || 'N/A'}")`);
      });
    }
    
    // Also test case-insensitive
    console.log('\n--- Testing "best wishes" (lowercase) ---');
    const bestWishesLowerResults = await storage.getProductsByCategoryAndSubcategory('best wishes');
    console.log(`Found ${bestWishesLowerResults.length} products for "best wishes"`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugCategories();