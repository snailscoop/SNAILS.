import { useMemo } from 'react';
import { ContentEmbed } from './ContentEmbed';
import { extractEmbeds, replaceUrlsWithEmbeds } from '../utils/urlEmbed';

interface ContentEmbedsProps {
  content: string;
  maxEmbeds?: number;
  removeUrls?: boolean;
}

export function ContentEmbeds({ 
  content, 
  maxEmbeds = 5, 
  removeUrls = true 
}: ContentEmbedsProps) {
  // Process content to extract embeds
  const { embeds } = useMemo(() => {
    if (removeUrls) {
      return replaceUrlsWithEmbeds(content);
    } else {
      return {
        embeds: extractEmbeds(content),
        textWithoutEmbedUrls: content
      };
    }
  }, [content, removeUrls]);

  // Limit the number of embeds to display
  const limitedEmbeds = useMemo(() => {
    return embeds.slice(0, maxEmbeds);
  }, [embeds, maxEmbeds]);

  // Handle case when no embeds are found
  if (limitedEmbeds.length === 0) {
    return null;
  }

  return (
    <div className="content-embeds">
      {limitedEmbeds.map((embed, index) => (
        <ContentEmbed key={`${embed.type}-${embed.id || index}`} embed={embed} />
      ))}
      
      {embeds.length > maxEmbeds && (
        <div className="more-embeds-indicator">
          +{embeds.length - maxEmbeds} more links
        </div>
      )}
    </div>
  );
}

// Normalize Nostr event references to proper format
function normalizeNostrLinks(text: string): string {
  // Convert "note:1abc123..." to "nostr:note1abc123..."
  // Convert "nevent:1abc123..." to "nostr:event1abc123..."
  const normalizedText = text
    .replace(/\bnote:1([a-zA-Z0-9]{8,}[^\s]*)/g, 'nostr:note1$1')
    .replace(/\bnevent:1([a-zA-Z0-9]{8,}[^\s]*)/g, 'nostr:event1$1')
    // Also handle raw event IDs that might be displayed in the UI
    .replace(/\bnostr:nevent1([a-zA-Z0-9]{8,}[^\s]*)/g, 'nostr:event1$1');
  
  return normalizedText;
}

// Component that renders text with the URLs removed and embeds below
export function EnhancedContent({ content }: { content: string }) {
  const normalizedContent = useMemo(() => normalizeNostrLinks(content), [content]);
  
  const { textWithoutEmbedUrls, embeds } = useMemo(() => {
    return replaceUrlsWithEmbeds(normalizedContent);
  }, [normalizedContent]);

  return (
    <div className="enhanced-content">
      {/* Only show text part if there's actual text content after URL removal */}
      {textWithoutEmbedUrls && <div className="text-content">{textWithoutEmbedUrls}</div>}
      
      {/* Show embeds if any */}
      {embeds.length > 0 && <ContentEmbeds content={normalizedContent} removeUrls={false} />}
    </div>
  );
} 