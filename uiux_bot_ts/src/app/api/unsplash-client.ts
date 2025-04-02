/**
 * Unsplash API client for UI/UX Lesson Bot
 * Provides methods to search for and retrieve images from Unsplash
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getChildLogger } from '../utils/logger';
import { settings, FALLBACK_IMAGES_DIR } from '../config/settings';

// Configure logger
const logger = getChildLogger('unsplash');

// Configuration for Unsplash API
const UNSPLASH_API_URL = 'https://api.unsplash.com';

/**
 * Interface for image data returned from Unsplash
 */
export interface UnsplashImageData {
  url: string;
  alt_text?: string;
  author?: string;
  download_url?: string;
}

/**
 * Interface for Unsplash API response
 */
interface UnsplashResult {
  id: string;
  created_at: string;
  updated_at: string;
  promoted_at: string | null;
  width: number;
  height: number;
  color: string;
  blur_hash: string;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
    small_s3: string;
  };
  links: {
    self: string;
    html: string;
    download: string;
    download_location: string;
  };
  likes: number;
  liked_by_user: boolean;
  current_user_collections: any[];
  sponsorship: any;
  topic_submissions: any;
  user: {
    id: string;
    username: string;
    name: string;
    portfolio_url: string | null;
    bio: string | null;
    location: string | null;
    links: {
      self: string;
      html: string;
      photos: string;
      likes: string;
      portfolio: string;
      following: string;
      followers: string;
    };
    profile_image: {
      small: string;
      medium: string;
      large: string;
    };
    instagram_username: string | null;
    total_collections: number;
    total_likes: number;
    total_photos: number;
    accepted_tos: boolean;
    for_hire: boolean;
    social: {
      instagram_username: string | null;
      portfolio_url: string | null;
      twitter_username: string | null;
      paypal_email: string | null;
    };
  };
}

interface UnsplashResponse {
  total: number;
  total_pages: number;
  results: UnsplashResult[];
}

/**
 * Search for an image on Unsplash API
 * 
 * @param query - The search query
 * @returns Image data if found, null otherwise
 */
export async function searchImage(query: string): Promise<UnsplashImageData | null> {
  try {
    if (!settings.UNSPLASH_API_KEY) {
      logger.warn('Unsplash API key not set');
      return null;
    }

    const searchTerm = `UI/UX ${query}`;
    logger.info(`Searching Unsplash for: ${searchTerm}`);

    const response = await axios.get<UnsplashResponse>(`${UNSPLASH_API_URL}/search/photos`, {
      params: {
        query: searchTerm,
        per_page: 1,
        orientation: 'landscape',
      },
      headers: {
        Authorization: `Client-ID ${settings.UNSPLASH_API_KEY}`,
      },
      timeout: settings.REQUEST_TIMEOUT * 1000,
    });

    const results = response.data.results;

    if (!results || results.length === 0) {
      logger.warn(`No Unsplash images found for: ${searchTerm}`);
      return null;
    }

    const image = results[0];

    // Notify Unsplash that the image has been downloaded (required by their API terms)
    try {
      await axios.get(image.links.download_location, {
        headers: {
          Authorization: `Client-ID ${settings.UNSPLASH_API_KEY}`,
        },
        timeout: settings.REQUEST_TIMEOUT * 1000,
      });
    } catch (error) {
      logger.error(`Failed to notify Unsplash of download: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      url: image.urls.regular,
      alt_text: image.alt_description || image.description || `UI/UX illustration for ${query}`,
      author: image.user.name,
      download_url: image.links.download,
    };
  } catch (error) {
    logger.error(`Error searching Unsplash: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Ensure the fallback images directory exists and has images
 * If none exist, this could create default images or log a warning
 */
export function ensureFallbackImages(): void {
  try {
    // Create fallback directory if it doesn't exist
    if (!fs.existsSync(FALLBACK_IMAGES_DIR)) {
      fs.mkdirSync(FALLBACK_IMAGES_DIR, { recursive: true });
      logger.info(`Created fallback images directory: ${FALLBACK_IMAGES_DIR}`);
    }

    // Check if there are any images in the directory
    const files = fs.readdirSync(FALLBACK_IMAGES_DIR)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i));

    if (files.length === 0) {
      logger.warn(`No fallback images found in ${FALLBACK_IMAGES_DIR}`);
    } else {
      logger.info(`Found ${files.length} fallback images`);
    }
  } catch (error) {
    logger.error(`Error ensuring fallback images: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default {
  searchImage,
  ensureFallbackImages,
}; 