/**
 * Test script for image URLs for Telegram
 */

import * as imageManager from './app/api/image-manager';
import { getChildLogger } from './app/utils/logger';
import { settings } from './app/config/settings';

const logger = getChildLogger('test-image');

async function testImageURLs() {
  logger.info('Starting image URL test');
  
  const themes = [
    'UI Design',
    'Color Theory',
    'User Experience'
  ];
  
  for (const theme of themes) {
    logger.info(`Testing image retrieval for theme: ${theme}`);
    
    try {
      const imageDetails = await imageManager.getImageForLesson(theme);
      
      if (imageDetails) {
        logger.info(`Success! Found image for theme: ${theme}`);
        logger.info(`Image source: ${imageDetails.source}`);
        logger.info(`Image URL: ${imageDetails.url}`);
        
        // Validate URL format
        if (imageDetails.url.startsWith('http://') || imageDetails.url.startsWith('https://')) {
          logger.info('✅ URL has correct format (starts with http:// or https://)');
        } else {
          logger.error(`❌ URL has incorrect format: ${imageDetails.url}`);
        }
        
        // Log other details
        if (imageDetails.alt_text) {
          logger.info(`Alt text: ${imageDetails.alt_text}`);
        }
        
        if (imageDetails.author) {
          logger.info(`Author: ${imageDetails.author}`);
        }
      } else {
        logger.error(`No image found for theme: ${theme}`);
      }
    } catch (error) {
      logger.error(`Error testing image for theme ${theme}: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    logger.info('----------------------------');
  }
  
  logger.info('Image URL test complete');
}

// Run the test
testImageURLs()
  .then(() => {
    logger.info('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }); 