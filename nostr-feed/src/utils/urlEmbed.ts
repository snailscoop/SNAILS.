// URL pattern for general detection
const URL_REGEX = /(https?:\/\/[^\s]+)|(?:nostr:(?:event|note)1[a-zA-Z0-9]{8,}[^\s]*)|(?:nevent:1[a-zA-Z0-9]{8,}[^\s]*)|(?:spotify:[a-zA-Z0-9:]+[^\s]*)/g;

// Specific platform URL patterns
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const RUMBLE_REGEX = /(?:https?:\/\/)?(?:www\.)?rumble\.com\/([a-zA-Z0-9_-]+)/;
const VIMEO_REGEX = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/([0-9]+)/;
const CATBOX_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:files\.)?catbox\.moe\/([a-zA-Z0-9.]+)/;
const STREAMABLE_REGEX = /(?:https?:\/\/)?(?:www\.)?streamable\.com\/([a-zA-Z0-9]+)/;
const SPOTIFY_REGEX = /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)(?:[?#][^\/]*)?/;
const SPOTIFY_URI_REGEX = /spotify:(track|album|playlist|episode|show):([a-zA-Z0-9]+)/;
const ODYSEE_REGEX = /(?:https?:\/\/)?(?:www\.)?odysee\.com\/\$(\/)?([a-zA-Z0-9_-]+)/;
const TWITTER_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/;
const NOSTR_EVENT_REGEX = /(?:nostr:(?:event|note)1([a-zA-Z0-9]{8,}[^\s]*))|(?:nevent:1([a-zA-Z0-9]{8,}[^\s]*))/;

// Image extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac'];

export interface EmbedData {
  type: 'youtube' | 'rumble' | 'vimeo' | 'catbox' | 'streamable' | 'spotify' | 'odysee' | 'twitter' | 'image' | 'video' | 'audio' | 'url' | 'nostr-event';
  url: string;
  id?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  platform?: string;
  noteId?: string;
}

/**
 * Generate iframe embed HTML for the given embed data
 */
export function getEmbedHtml(embed: EmbedData): string {
  switch (embed.type) {
    case 'youtube':
      return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${embed.id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    case 'rumble':
      return `<iframe width="100%" height="315" src="https://rumble.com/embed/v${embed.id}" frameborder="0" allowfullscreen></iframe>`;
    case 'vimeo':
      return `<iframe width="100%" height="315" src="https://player.vimeo.com/video/${embed.id}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    case 'streamable':
      return `<iframe width="100%" height="315" src="https://streamable.com/e/${embed.id}" frameborder="0" allowfullscreen></iframe>`;
    case 'spotify': {
      let height = '80';
      if (embed.embedUrl?.includes('/album/') || embed.embedUrl?.includes('/playlist/')) {
        height = '380';
      } else if (embed.embedUrl?.includes('/episode/') || embed.embedUrl?.includes('/show/')) {
        height = '232';
      }
      return `<iframe src="${embed.embedUrl}" width="100%" height="${height}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen style="border-radius: 12px;"></iframe>`;
    }
    case 'odysee':
      return `<iframe width="100%" height="315" src="https://odysee.com/$/embed/${embed.id}" frameborder="0" allowfullscreen></iframe>`;
    case 'twitter':
      return `<blockquote class="twitter-tweet"><a href="${embed.url}"></a></blockquote>`;
    case 'image':
      return `<img src="${embed.url}" alt="Embedded image" style="max-width: 100%; max-height: 500px;" />`;
    case 'video':
      return `<video controls width="100%" src="${embed.url}"></video>`;
    case 'audio':
      return `<audio controls src="${embed.url}"></audio>`;
    case 'catbox': {
      // Determine if it's an image, video, or other file based on extension
      const extension = embed.url.split('.').pop()?.toLowerCase();
      if (extension && IMAGE_EXTENSIONS.includes(extension)) {
        return `<img src="${embed.url}" alt="Embedded image" style="max-width: 100%; max-height: 500px;" />`;
      } else if (extension && VIDEO_EXTENSIONS.includes(extension)) {
        return `<video controls width="100%" src="${embed.url}"></video>`;
      } else if (extension && AUDIO_EXTENSIONS.includes(extension)) {
        return `<audio controls src="${embed.url}"></audio>`;
      }
      return `<a href="${embed.url}" target="_blank" rel="noopener noreferrer">${embed.url}</a>`;
    }
    case 'nostr-event':
      return `<a href="${embed.url}" target="_blank" rel="noopener noreferrer">${embed.url}</a>`;
    default:
      return `<a href="${embed.url}" target="_blank" rel="noopener noreferrer">${embed.url}</a>`;
  }
}

/**
 * Detect embed type from URL
 */
export function detectEmbedType(url: string): EmbedData | null {
  // Nostr Event
  const nostrEventMatch = url.match(NOSTR_EVENT_REGEX);
  if (nostrEventMatch) {
    // Extract the note ID from whichever group matched (the first or second capturing group)
    const noteId = nostrEventMatch[1] || nostrEventMatch[2];
    return {
      type: 'nostr-event',
      url,
      noteId: noteId,
      platform: 'Nostr'
    };
  }

  // YouTube
  const youtubeMatch = url.match(YOUTUBE_REGEX);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      url,
      id: youtubeMatch[1],
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`,
      aspectRatio: '16:9',
      platform: 'YouTube'
    };
  }

  // Rumble
  const rumbleMatch = url.match(RUMBLE_REGEX);
  if (rumbleMatch) {
    return {
      type: 'rumble',
      url,
      id: rumbleMatch[1],
      embedUrl: `https://rumble.com/embed/v${rumbleMatch[1]}`,
      aspectRatio: '16:9',
      platform: 'Rumble'
    };
  }

  // Vimeo
  const vimeoMatch = url.match(VIMEO_REGEX);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      url,
      id: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      aspectRatio: '16:9',
      platform: 'Vimeo'
    };
  }

  // Catbox
  const catboxMatch = url.match(CATBOX_REGEX);
  if (catboxMatch) {
    return {
      type: 'catbox',
      url,
      id: catboxMatch[1],
      platform: 'Catbox'
    };
  }

  // Streamable
  const streamableMatch = url.match(STREAMABLE_REGEX);
  if (streamableMatch) {
    return {
      type: 'streamable',
      url,
      id: streamableMatch[1],
      embedUrl: `https://streamable.com/e/${streamableMatch[1]}`,
      aspectRatio: '16:9',
      platform: 'Streamable'
    };
  }

  // Spotify
  const spotifyMatch = url.match(SPOTIFY_REGEX);
  if (spotifyMatch) {
    const contentType = spotifyMatch[1];
    const id = spotifyMatch[2];
    
    // Determine aspect ratio based on content type
    let aspectRatio = '3:1'; // Default for tracks
    if (contentType === 'album' || contentType === 'playlist') {
      aspectRatio = '1:1';  
    } else if (contentType === 'episode' || contentType === 'show') {
      aspectRatio = '3:2';
    }
    
    return {
      type: 'spotify',
      url,
      id,
      embedUrl: `https://open.spotify.com/embed/${contentType}/${id}?utm_source=generator&theme=0`,
      aspectRatio,
      platform: 'Spotify'
    };
  }

  // Spotify URI (spotify:track:id format)
  const spotifyUriMatch = url.match(SPOTIFY_URI_REGEX);
  if (spotifyUriMatch) {
    const contentType = spotifyUriMatch[1];
    const id = spotifyUriMatch[2];
    
    // Determine aspect ratio based on content type
    let aspectRatio = '3:1'; // Default for tracks
    if (contentType === 'album' || contentType === 'playlist') {
      aspectRatio = '1:1';  
    } else if (contentType === 'episode' || contentType === 'show') {
      aspectRatio = '3:2';
    }
    
    return {
      type: 'spotify',
      url: `https://open.spotify.com/${contentType}/${id}`,
      id,
      embedUrl: `https://open.spotify.com/embed/${contentType}/${id}?utm_source=generator&theme=0`,
      aspectRatio,
      platform: 'Spotify'
    };
  }

  // Odysee
  const odyseeMatch = url.match(ODYSEE_REGEX);
  if (odyseeMatch) {
    return {
      type: 'odysee',
      url,
      id: odyseeMatch[2],
      embedUrl: `https://odysee.com/$/embed/${odyseeMatch[2]}`,
      aspectRatio: '16:9',
      platform: 'Odysee'
    };
  }

  // Twitter/X
  const twitterMatch = url.match(TWITTER_REGEX);
  if (twitterMatch) {
    return {
      type: 'twitter',
      url,
      id: twitterMatch[2],
      platform: 'Twitter/X'
    };
  }

  // Check for image, video, or audio files
  const extension = url.split('.').pop()?.toLowerCase();
  if (extension) {
    if (IMAGE_EXTENSIONS.includes(extension)) {
      return {
        type: 'image',
        url,
        platform: 'Image'
      };
    } else if (VIDEO_EXTENSIONS.includes(extension)) {
      return {
        type: 'video',
        url,
        platform: 'Video'
      };
    } else if (AUDIO_EXTENSIONS.includes(extension)) {
      return {
        type: 'audio',
        url,
        platform: 'Audio'
      };
    }
  }

  // Generic URL
  return {
    type: 'url',
    url,
    platform: 'Link'
  };
}

/**
 * Extract URLs from text and convert them to embed data
 */
export function extractEmbeds(text: string): EmbedData[] {
  const urls = text.match(URL_REGEX) || [];
  return urls.map(url => detectEmbedType(url)).filter(embed => embed !== null) as EmbedData[];
}

/**
 * Replace URLs in text with their embed components
 */
export function replaceUrlsWithEmbeds(text: string): { textWithoutEmbedUrls: string, embeds: EmbedData[] } {
  const embeds: EmbedData[] = [];
  const urls = text.match(URL_REGEX) || [];
  
  let textWithoutEmbedUrls = text;
  
  urls.forEach(url => {
    const embed = detectEmbedType(url);
    if (embed) {
      embeds.push(embed);
      
      // Replace the URL with a placeholder for rendering
      textWithoutEmbedUrls = textWithoutEmbedUrls.replace(url, '');
    }
  });
  
  // Clean up any double spaces or trailing spaces created by URL removal
  textWithoutEmbedUrls = textWithoutEmbedUrls.replace(/\s+/g, ' ').trim();
  
  return {
    textWithoutEmbedUrls,
    embeds
  };
} 