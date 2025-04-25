import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import '../App.css';

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        <div className="landing-header">
          <h1 className="landing-title">SNAILS.feed</h1>
          <p className="landing-subtitle">A decentralized social network built on the Nostr protocol</p>
        </div>
        
        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon-container">
              <div className="feature-icon">🔒</div>
            </div>
            <h3>Secure & Private</h3>
            <p>Your data belongs to you with cryptographic security and privacy controls</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-container">
              <div className="feature-icon">🌐</div>
            </div>
            <h3>Censorship Resistant</h3>
            <p>Express yourself freely on a platform designed to resist central control</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon-container">
              <div className="feature-icon">⚡</div>
            </div>
            <h3>Interoperable</h3>
            <p>Seamlessly connect with any client in the growing Nostr ecosystem</p>
          </div>
        </div>
        
        <Link to="/snailsfeed" className="get-started-button">
          Enter The Network
        </Link>
      </div>
    </div>
  );
} 