const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection string - add this to your .env file
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = '90s-america';
const COLLECTION_NAME = 'images';

// Path to your 90s images folder
const IMAGES_FOLDER = 'E:\\Downloads\\90s America';

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

async function uploadImages() {
  let client;
  
  try {
    console.log('🚀 Starting image upload to MongoDB Atlas...');
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Clear existing images (optional - comment out if you want to keep existing)
    // await collection.deleteMany({});
    // console.log('🗑️ Cleared existing images');
    
    // Check if images folder exists
    if (!fs.existsSync(IMAGES_FOLDER)) {
      throw new Error(`Images folder not found: ${IMAGES_FOLDER}`);
    }
    
    console.log(`📁 Scanning folder: ${IMAGES_FOLDER}`);
    
    // Get all files recursively
    const imageFiles = [];
    
    function scanDirectory(dirPath, relativePath = '') {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, relativeItemPath);
        } else if (stat.isFile()) {
          // Check if it's an image file
          const ext = path.extname(item).toLowerCase();
          if (IMAGE_EXTENSIONS.includes(ext)) {
            imageFiles.push({
              fullPath,
              relativePath: relativeItemPath,
              filename: item,
              extension: ext,
              size: stat.size,
              lastModified: stat.mtime
            });
          }
        }
      }
    }
    
    // Start scanning
    scanDirectory(IMAGES_FOLDER);
    console.log(`📸 Found ${imageFiles.length} image files`);
    
    if (imageFiles.length === 0) {
      console.log('❌ No image files found');
      return;
    }
    
    // Process images in batches to avoid memory issues
    const BATCH_SIZE = 50;
    let uploadedCount = 0;
    
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (imageFile) => {
        try {
          // Read image file as base64
          const imageBuffer = fs.readFileSync(imageFile.fullPath);
          const base64Image = imageBuffer.toString('base64');
          
          // Create image document
          const imageDoc = {
            filename: imageFile.filename,
            relativePath: imageFile.relativePath,
            extension: imageFile.extension,
            size: imageFile.size,
            lastModified: imageFile.lastModified,
            base64Data: base64Image,
            mimeType: getMimeType(imageFile.extension),
            uploadDate: new Date(),
            tags: generateTags(imageFile.filename, imageFile.relativePath)
          };
          
          // Check if image already exists (by filename and path)
          const existingImage = await collection.findOne({
            filename: imageFile.filename,
            relativePath: imageFile.relativePath
          });
          
          if (existingImage) {
            console.log(`⏭️ Skipping existing: ${imageFile.relativePath}`);
            return { skipped: true, filename: imageFile.filename };
          }
          
          // Insert new image
          await collection.insertOne(imageDoc);
          console.log(`✅ Uploaded: ${imageFile.relativePath}`);
          return { uploaded: true, filename: imageFile.filename };
          
        } catch (error) {
          console.error(`❌ Error processing ${imageFile.filename}:`, error.message);
          return { error: true, filename: imageFile.filename, error: error.message };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      const uploaded = batchResults.filter(r => r.uploaded).length;
      const skipped = batchResults.filter(r => r.skipped).length;
      const errors = batchResults.filter(r => r.error).length;
      
      uploadedCount += uploaded;
      
      console.log(`📊 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`);
    }
    
    // Create indexes for better performance
    await collection.createIndex({ filename: 1, relativePath: 1 }, { unique: true });
    await collection.createIndex({ tags: 1 });
    await collection.createIndex({ uploadDate: 1 });
    
    console.log('🎉 Image upload completed!');
    console.log(`📊 Total uploaded: ${uploadedCount}`);
    console.log(`📊 Total in database: ${await collection.countDocuments()}`);
    
    // Show some sample data
    const sampleImages = await collection.find({}).limit(3).toArray();
    console.log('\n📋 Sample images in database:');
    sampleImages.forEach(img => {
      console.log(`  - ${img.filename} (${img.relativePath}) - ${img.tags.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Error during upload:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Helper function to get MIME type
function getMimeType(extension) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

// Helper function to generate tags from filename and path
function generateTags(filename, relativePath) {
  const tags = [];
  
  // Add filename without extension as tag
  const nameWithoutExt = path.parse(filename).name;
  tags.push(nameWithoutExt.toLowerCase());
  
  // Add folder names as tags
  const pathParts = relativePath.split(path.sep);
  pathParts.forEach(part => {
    if (part && part !== filename) {
      tags.push(part.toLowerCase());
    }
  });
  
  // Add some 90s specific tags based on content
  const filenameLower = filename.toLowerCase();
  if (filenameLower.includes('movie') || filenameLower.includes('film')) tags.push('movie');
  if (filenameLower.includes('music') || filenameLower.includes('song')) tags.push('music');
  if (filenameLower.includes('fashion') || filenameLower.includes('style')) tags.push('fashion');
  if (filenameLower.includes('toy') || filenameLower.includes('game')) tags.push('toy');
  if (filenameLower.includes('car') || filenameLower.includes('vehicle')) tags.push('vehicle');
  
  // Remove duplicates and return
  return [...new Set(tags)];
}

// Run the script
if (require.main === module) {
  uploadImages().catch(console.error);
}

module.exports = { uploadImages };
