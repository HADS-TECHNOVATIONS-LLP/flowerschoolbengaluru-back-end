const fetch = require('node-fetch');

async function testSubcategorySearch() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('Testing subcategory search functionality...\n');

  // Test cases for different subcategories
  const testCases = [
    { subcategory: 'lilies', description: 'Lilies subcategory products' },
    { subcategory: 'roses', description: 'Roses subcategory products' },
    { subcategory: 'bouquets', description: 'Bouquets subcategory products' },
    { subcategory: 'chocolates', description: 'Chocolates subcategory products' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      console.log(`📡 API Call: ${baseUrl}/api/products/subcategory/${testCase.subcategory}`);
      
      const response = await fetch(`${baseUrl}/api/products/subcategory/${testCase.subcategory}`);
      
      if (!response.ok) {
        console.log(`❌ Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.totalProducts} products`);
      
      if (data.products && data.products.length > 0) {
        console.log(`📄 Sample product: ${data.products[0].name || 'No name'}`);
        console.log(`🏷️  Main category: ${data.products[0].main_category || 'Not specified'}`);
        console.log(`🏷️  Subcategory: ${data.products[0].subcategory || 'Not specified'}`);
      }
      
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }

  console.log('\n🎯 Test completed!');
  console.log('\n💡 Usage in frontend:');
  console.log('   - When user searches for "lilies", detect it matches subcategory');
  console.log('   - Call setShowSubcategoryProducts("lilies") to display subcategory products');
  console.log('   - Backend will return all products where subcategory ILIKE "%lilies%"');
  console.log('   - Products display in flat grid with clear button to exit subcategory view');
}

// Run the test
testSubcategorySearch().catch(console.error);