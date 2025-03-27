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
 * Search for relevant tutorial videos on YouTube
 * @param theme The UI/UX design theme to search for
 * @param excludeIds Array of video IDs to exclude from results
 * @param maxResults Maximum number of results to return
 * @returns Array of video information or empty array if none found
 */
export async function searchTutorialVideos(
  searchQueries: string[], 
  excludeIds: string[] = [], 
  maxResults: number = 3
): Promise<YouTubeVideo[]> {
  try {
    const foundVideos: YouTubeVideo[] = [];
    
    // Try each query until we find suitable videos
    for (const searchQuery of searchQueries) {
      logger.info(`Searching YouTube for: "${searchQuery}"`);
      
      // Make the API request
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        q: searchQuery,
        type: ['video'],
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        maxResults: 10,
        order: 'relevance'
      } as youtube_v3.Params$Resource$Search$List);

      const searchItems = searchResponse.data.items;
      if (!searchItems || searchItems.length === 0) {
        logger.warn(`No videos found for query: ${searchQuery}`);
        continue; // Try next query
      }

      // Get video details to check duration
      const videoIds = searchItems
        .map((item: SearchResult) => item.id?.videoId)
        .filter((id: string | null | undefined): id is string => id !== undefined && id !== null);
        
      if (videoIds.length === 0) {
        logger.warn(`No valid video IDs found for query: ${searchQuery}`);
        continue; // Try next query
      }

      const videoDetailsResponse = await youtube.videos.list({
        part: ['contentDetails'],
        id: videoIds
      } as youtube_v3.Params$Resource$Videos$List);

      const videoDetails = videoDetailsResponse.data.items;

      // Find videos that match our criteria (under 4 minutes, 1000+ views)
      for (let i = 0; i < searchItems.length; i++) {
        if (foundVideos.length >= maxResults) break;
        
        const item = searchItems[i];
        const videoId = item.id?.videoId;
        
        if (!videoId) continue;
        
        // Skip if in exclude list
        if (excludeIds.includes(videoId)) {
          logger.info(`Skipping already sent video: ${videoId}`);
          continue;
        }

        // Check views
        const videoStatsDetailsResponse = await youtube.videos.list({
          part: ['statistics'],
          id: [videoId]
        } as youtube_v3.Params$Resource$Videos$List);

        const videoStatsDetails = videoStatsDetailsResponse.data.items;
        const views = videoStatsDetails?.find(v => v.id === videoId)?.statistics?.viewCount;
        if (!views || parseInt(views) < 1000) continue;

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

        // Add this video to our results
        logger.info(`Found suitable video for query "${searchQuery}": ${item.snippet?.title}`);
        foundVideos.push({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: item.snippet?.title || 'UI/UX Design Tutorial',
          description: item.snippet?.description || 'Learn about UI/UX design principles and best practices.',
          duration: formattedDuration,
          thumbnailUrl
        });
      }
      
      // If we found enough videos, no need to try more queries
      if (foundVideos.length >= maxResults) {
        break;
      }
    }
    
    logger.info(`Found ${foundVideos.length} videos for queries: ${searchQueries.join(', ')}`);
    return foundVideos;
  } catch (error) {
    logger.error(`Error searching for tutorial videos: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Search for a single tutorial video on YouTube (backward compatibility)
 * @param theme The UI/UX design theme to search for
 * @param excludeIds Array of video IDs to exclude from results
 * @returns Video information if found, null otherwise
 */
export async function searchTutorialVideo(query: string, excludeIds: string[] = []): Promise<YouTubeVideo | null> {
  const videos = await searchTutorialVideos([query], excludeIds, 1);
  return videos.length > 0 ? videos[0] : null;
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