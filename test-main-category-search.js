const fetch = require('node-fetch');

async function testMainCategorySearch() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('Testing main category search functionality...\n');

  // Test cases for different main categories
  const testCases = [
    { mainCategory: 'occasion', description: 'Occasion category products' },
    { mainCategory: 'flower-types', description: 'Flower types category products' },
    { mainCategory: 'arrangements', description: 'Arrangements category products' },
    { mainCategory: 'gift-combo', description: 'Gift combo category products' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      console.log(`📡 API Call: ${baseUrl}/api/products?main_category=${testCase.mainCategory}`);
      
      const response = await fetch(`${baseUrl}/api/products?main_category=${testCase.mainCategory}`);
      
      if (!response.ok) {
        console.log(`❌ Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const products = await response.json();
      console.log(`✅ Found ${products.length} products`);
      
      if (products.length > 0) {
        console.log(`📄 Sample product: ${products[0].name || 'No name'}`);
        console.log(`🏷️  Main category: ${products[0].main_category || 'Not specified'}`);
        console.log(`🏷️  Subcategory: ${products[0].subcategory || 'Not specified'}`);
      }
      
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }

  // Test search functionality
  console.log(`\n🧪 Testing search functionality`);
  console.log(`📡 API Call: ${baseUrl}/api/products?search=flowers`);
  
  try {
    const response = await fetch(`${baseUrl}/api/products?search=flowers`);
    
    if (!response.ok) {
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
    } else {
      const products = await response.json();
      console.log(`✅ Search for 'flowers' found ${products.length} products`);
      
      if (products.length > 0) {
        console.log(`📄 Sample search result: ${products[0].name || 'No name'}`);
      }
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
  }

  console.log('\n🎯 Test completed!');
  console.log('\n💡 Usage in frontend:');
  console.log('   - When user searches for "flowers", detect it matches "flower-types" category');
  console.log('   - Call setShowProductsFor("flower-types") to display category products');
  console.log('   - Backend will return all products from flower-types subcategories');
}

// Run the test
testMainCategorySearch().catch(console.error);