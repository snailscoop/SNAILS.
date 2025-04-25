import { Link } from 'react-router-dom';

export function TrendingHashtags() {
  // Sample trending tags
  const trendingTags = [
    { name: 'bitcoin', count: 2483 },
    { name: 'nostr', count: 1872 },
    { name: 'privacy', count: 943 },
    { name: 'freedom', count: 756 },
    { name: 'technology', count: 621 }
  ];

  return (
    <div className="trending-container">
      <ul className="trending-list">
        {trendingTags.map((tag, index) => (
          <li key={index} className="trending-item">
            <Link to={`/tag/${tag.name}`} className="trending-link">
              <div className="trending-info">
                <span className="trending-tag">#{tag.name}</span>
                <span className="trending-count">{tag.count} posts</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
} 