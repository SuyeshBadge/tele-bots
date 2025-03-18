import { google, youtube_v3 } from 'googleapis';
import { settings } from '../config/settings';
import { getChildLogger } from '../utils/logger';

// Configure logger
const logger = getChildLogger('youtube');

// Initialize YouTube API client
const youtube = google.youtube({
  version: 'v3',
  auth: settings.YOUTUBE_API_KEY
});

interface YouTubeVideo {
  url: string;
  title: string;
  description: string;
  duration: string;
  thumbnailUrl?: string;
}

type SearchResult = youtube_v3.Schema$SearchResult;
type VideoListResult = youtube_v3.Schema$VideoListResponse;

/**
 * Search for a relevant tutorial video on YouTube
 * @param theme The UI/UX design theme to search for
 * @returns Video information if found, null otherwise
 */
export async function searchTutorialVideo(theme: string): Promise<YouTubeVideo | null> {
  try {
    // Create a more specific search query for UI/UX tutorials
    const searchQuery = `${theme} UI UX design tutorial "how to" | "step by step" | "guide" | "tips" | "best practices"`;
    
    // Make the API request
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: searchQuery,
      type: ['video'],
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      maxResults: 5,
      order: 'relevance'
    } as youtube_v3.Params$Resource$Search$List);

    const searchItems = searchResponse.data.items;
    if (!searchItems || searchItems.length === 0) {
      logger.warn(`No videos found for theme: ${theme}`);
      return null;
    }

    // Get video details to check duration
    const videoIds = searchItems
      .map((item: SearchResult) => item.id?.videoId)
      .filter((id: string | null | undefined): id is string => id !== undefined && id !== null);
      
    if (videoIds.length === 0) {
      logger.warn(`No valid video IDs found for theme: ${theme}`);
      return null;
    }

    const videoDetailsResponse = await youtube.videos.list({
      part: ['contentDetails'],
      id: videoIds
    } as youtube_v3.Params$Resource$Videos$List);

    const videoDetails = videoDetailsResponse.data.items;

    // Find the first video that's under 4 minutes
    for (let i = 0; i < searchItems.length; i++) {
      const item = searchItems[i];
      const videoId = item.id?.videoId;
      
      if (!videoId) continue;

      const details = videoDetails?.find(v => v.id === videoId);
      if (!details?.contentDetails?.duration) continue;

      // Parse duration (format: PT1H2M10S)
      const duration = details.contentDetails.duration;
      const hours = duration.match(/(\d+)H/)?.[1] || '0';
      const minutes = duration.match(/(\d+)M/)?.[1] || '0';
      const seconds = duration.match(/(\d+)S/)?.[1] || '0';
      
      const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
      
      // Skip if video is longer than 4 minutes
      if (totalSeconds > 240) continue;

      // Format duration for display
      const formattedDuration = `${minutes}:${seconds.padStart(2, '0')}`;

      // Get thumbnail URL, ensuring it's not null
      const thumbnailUrl = item.snippet?.thumbnails?.high?.url || 
                          item.snippet?.thumbnails?.default?.url || 
                          undefined;

      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: item.snippet?.title || 'UI/UX Design Tutorial',
        description: item.snippet?.description || 'Learn about UI/UX design principles and best practices.',
        duration: formattedDuration,
        thumbnailUrl
      };
    }

    logger.warn(`No suitable videos found for theme: ${theme}`);
    return null;
  } catch (error) {
    logger.error(`Error searching for tutorial video: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Format YouTube duration string to human-readable format
 * @param duration YouTube duration string (e.g., "PT1H2M10S")
 * @returns Formatted duration string
 */
function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '';

  const hours = (match[1] || '').replace('H', '');
  const minutes = (match[2] || '').replace('M', '');
  const seconds = (match[3] || '').replace('S', '');

  let formatted = '';
  if (hours) formatted += `${hours}h `;
  if (minutes) formatted += `${minutes}m `;
  if (seconds) formatted += `${seconds}s`;

  return formatted.trim();
} 