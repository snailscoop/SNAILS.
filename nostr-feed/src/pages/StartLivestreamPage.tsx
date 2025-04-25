import { useState } from 'react';
import { useNostrContext } from '../contexts/useNostrContext';
import { ProfileCard } from '../components/ProfileCard';

export function StartLivestreamPage() {
  const { isConnected, isLoading, startLivestream, endLivestream } = useNostrContext();
  const [streamData, setStreamData] = useState({
    title: '',
    summary: '',
    streamUrl: '',
    imageUrl: '',
    tags: ''
  });
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStreamData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStartStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!streamData.title || !streamData.streamUrl) {
      setError('Title and stream URL are required');
      setIsSubmitting(false);
      return;
    }

    try {
      // Parse tags
      const tagList = streamData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Start the livestream
      const eventId = await startLivestream({
        title: streamData.title,
        streaming: streamData.streamUrl,
        summary: streamData.summary,
        image: streamData.imageUrl,
        tags: tagList
      });

      if (eventId) {
        setActiveStream(eventId.id);
        setSuccess('Livestream started successfully!');
        // Clear form after successful submission
        setStreamData({
          title: '',
          summary: '',
          streamUrl: '',
          imageUrl: '',
          tags: ''
        });
      } else {
        setError('Failed to create livestream event');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndStream = async () => {
    if (!activeStream) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await endLivestream(activeStream);
      setSuccess('Livestream ended successfully');
      setActiveStream(null);
    } catch (err) {
      setError(`Error ending stream: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (!isConnected) {
    return (
      <div className="start-livestream-container">
        <div className="not-connected-message">
          <h2>Not Connected</h2>
          <p>You need to be connected to Nostr to start a livestream.</p>
          <p>Please connect your Nostr account first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="start-livestream-container">
      <div className="snailsfeed-sidebar left">
        <div className="snailsfeed-section">
          <ProfileCard />
        </div>
      </div>

      <main className="snailsfeed-main">
        <div className="snailsfeed-section main-card">
          <h1>Start a Livestream</h1>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          {activeStream ? (
            <div className="active-stream-panel">
              <h2>Stream is Live!</h2>
              <p>Your stream is currently active. Share this with your followers!</p>
              <div className="stream-info">
                <p><strong>Stream ID:</strong> {activeStream}</p>
              </div>
              <button 
                className="end-stream-button"
                onClick={handleEndStream}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Ending Stream...' : 'End Stream'}
              </button>
            </div>
          ) : (
            <form className="livestream-form" onSubmit={handleStartStream}>
              <div className="form-group">
                <label htmlFor="title">Stream Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={streamData.title}
                  onChange={handleInputChange}
                  placeholder="My Awesome Livestream"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="summary">Stream Description</label>
                <textarea
                  id="summary"
                  name="summary"
                  value={streamData.summary}
                  onChange={handleInputChange}
                  placeholder="Tell viewers what your stream is about..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="streamUrl">Stream URL *</label>
                <input
                  type="url"
                  id="streamUrl"
                  name="streamUrl"
                  value={streamData.streamUrl}
                  onChange={handleInputChange}
                  placeholder="https://your-streaming-server.com/stream"
                  required
                />
                <small>This should be the HLS (.m3u8) URL for your stream</small>
              </div>

              <div className="form-group">
                <label htmlFor="imageUrl">Thumbnail URL</label>
                <input
                  type="url"
                  id="imageUrl"
                  name="imageUrl"
                  value={streamData.imageUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/your-stream-thumbnail.jpg"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tags">Tags</label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={streamData.tags}
                  onChange={handleInputChange}
                  placeholder="gaming, music, coding (comma separated)"
                />
              </div>

              <button 
                type="submit" 
                className="start-stream-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Starting Stream...' : 'Start Livestream'}
              </button>
            </form>
          )}

          <div className="stream-help">
            <h3>How to Stream</h3>
            <ol>
              <li>Set up a streaming server (like OBS Studio)</li>
              <li>Configure your stream to output an HLS stream</li>
              <li>Paste the HLS URL in the form above</li>
              <li>Click "Start Livestream" to create your Nostr event</li>
              <li>Share your stream with your followers!</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
} 