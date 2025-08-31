const fs = require('fs');
const path = require('path');

// Simple test to check if the images folder exists and count files
const IMAGES_FOLDER = 'E:\\Downloads\\90s America';

console.log('🧪 Testing image folder access...');
console.log(`📁 Checking folder: ${IMAGES_FOLDER}`);

if (fs.existsSync(IMAGES_FOLDER)) {
  console.log('✅ Folder exists!');
  
  // Count files recursively
  let fileCount = 0;
  let imageCount = 0;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  
  function countFiles(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          countFiles(fullPath);
        } else if (stat.isFile()) {
          fileCount++;
          const ext = path.extname(item).toLowerCase();
          if (imageExtensions.includes(ext)) {
            imageCount++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error reading directory: ${error.message}`);
    }
  }
  
  countFiles(IMAGES_FOLDER);
  
  console.log(`📊 Total files: ${fileCount}`);
  console.log(`🖼️ Image files: ${imageCount}`);
  
  // Show some sample files
  try {
    const items = fs.readdirSync(IMAGES_FOLDER);
    const sampleFiles = items.slice(0, 5);
    console.log('\n📋 Sample files:');
    sampleFiles.forEach(item => {
      const fullPath = path.join(IMAGES_FOLDER, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        const isImage = imageExtensions.includes(ext);
        console.log(`  - ${item} ${isImage ? '🖼️' : '📄'} (${(stat.size / 1024).toFixed(1)} KB)`);
      } else {
        console.log(`  - ${item} 📁`);
      }
    });
  } catch (error) {
    console.error('❌ Error reading sample files:', error.message);
  }
  
} else {
  console.log('❌ Folder does not exist!');
  console.log('💡 Please check the path and make sure the folder exists.');
}

console.log('\n🚀 Ready to run: npm run upload-images');
