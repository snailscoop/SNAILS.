import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import '../App.css';
import { SnailsCard } from '../components/SnailsCard';
import { UserNotesList } from '../components/UserNotesList';
import { UserVideosList } from '../components/UserVideosList';
import { UserBlogsList } from '../components/UserBlogsList';
import { useNostrContext } from '../contexts/useNostrContext';

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { decodePublicKey } = useNostrContext();
  const npub = 'npub1aj8kwq97s04dnw4du0gelatz966xuhp57g906ndylj2r07e2ganqx6hcm4';
  const pubkey = decodePublicKey(npub);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas to be full size of the viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Setup dots
    const dots: Array<{x: number, y: number, size: number, vx: number, vy: number}> = [];
    const numDots = 250; // Increased for more connections

    for (let i = 0; i < numDots; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1.5,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8
      });
    }

    const drawDots = () => {
      for (const dot of dots) {
        // Move dots slightly
        dot.x += dot.vx;
        dot.y += dot.vy;
        
        // Bounce off edges
        if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1;
        
        // Draw the dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(248, 166, 92, 0.3)';
        ctx.fill();
      }
    };

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all dots
      drawDots();

      // Connect dots to each other if they're close enough
      ctx.lineWidth = 0.5;
      ctx.shadowBlur = 0;
      
      for (let i = 0; i < dots.length; i++) {
        const dot1 = dots[i];
        
        // Connect to other dots
        for (let j = i + 1; j < dots.length; j++) {
          const dot2 = dots[j];
          const distance = Math.sqrt(
            Math.pow(dot1.x - dot2.x, 2) + Math.pow(dot1.y - dot2.y, 2)
          );
          
          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(dot1.x, dot1.y);
            ctx.lineTo(dot2.x, dot2.y);
            
            // Opacity based on distance
            const opacity = 0.3 * (1 - distance / 120);
            ctx.strokeStyle = `rgba(248, 166, 92, ${opacity})`;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="landing-page">
      <canvas 
        ref={canvasRef} 
        className="logo-animation-canvas"
      />
      
      <div className="landing-content">
        <div className="new-layout-container">
          {/* Left column with SnailsCard and feature cards below it */}
          <div className="left-column">
            <div className="snails-card-container">
              <SnailsCard defaultNpub={npub} />
            </div>
            
            <div className="feature-cards-container">
              <div className="feature-card">
                <div className="feature-icon-container">
                  <div className="feature-icon">
                    <img src="/bomb.png" alt="Bomb" className="feature-icon-img" />
                  </div>
                </div>
                <h3>SNAILS.pub</h3>
                {pubkey && (
                  <div className="blogs-container">
                    <UserBlogsList pubkey={pubkey} limit={3} className="landing-blogs-list" />
                  </div>
                )}
              </div>
              
              <div className="feature-card">
                <div className="feature-icon-container">
                  <div className="feature-icon">
                    <img src="/charged.png" alt="Charged" className="feature-icon-img" />
                  </div>
                </div>
                <h3>SNAILS.tube</h3>
                {pubkey && (
                  <div className="videos-container">
                    <UserVideosList pubkey={pubkey} limit={3} className="landing-videos-list" />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right column with SNAILS.feed card */}
          <div className="right-column">
            <div className="feature-card interoperable-card">
              <div className="pepe-container">
                <img src="/pepe.png" alt="Pepe" className="pepe-image" />
              </div>
              <h3>SNAILS.feed</h3>
              
              {pubkey && (
                <div className="notes-container">
                  <UserNotesList pubkey={pubkey} limit={5} className="landing-notes-list" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 