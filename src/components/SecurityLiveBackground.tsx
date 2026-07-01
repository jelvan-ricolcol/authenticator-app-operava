/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";

export default function SecurityLiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Cryptographic and security keywords that glide gently across the matrix
    const keywords = [
      "AES-GCM-256",
      "SHA-256",
      "PBKDF2",
      "ZERO-KNOWLEDGE",
      "TOTP-2FA",
      "WEBAUTHN",
      "SECURE-TUNNEL",
      "RAM-CIPHER",
      "ECDSA",
      "HMAC-SHA1"
    ];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      text?: string;
      fadeSpeed?: number;
      isFading?: boolean;
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(45, Math.floor((width * height) / 32000));

    // Initialize network particles and text nodes
    for (let i = 0; i < particleCount; i++) {
      const isText = Math.random() < 0.25;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: isText ? 10 : Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.15,
        text: isText ? keywords[Math.floor(Math.random() * keywords.length)] : undefined,
        fadeSpeed: 0.005 + Math.random() * 0.005,
        isFading: Math.random() < 0.5
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Core security radar constellation & binary loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle grid backdrop
      ctx.strokeStyle = "rgba(29, 31, 14, 0.035)";
      ctx.lineWidth = 1;
      const gridSize = 80;
      
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Boundary wrapping
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Keep updating opacity for visual breath effect
        if (p.text) {
          if (p.isFading) {
            p.opacity -= p.fadeSpeed || 0.01;
            if (p.opacity <= 0.08) {
              p.isFading = false;
              // Cycle keywords
              p.text = keywords[Math.floor(Math.random() * keywords.length)];
            }
          } else {
            p.opacity += p.fadeSpeed || 0.01;
            if (p.opacity >= 0.45) {
              p.isFading = true;
            }
          }
        }

        // Draw particle node
        if (p.text) {
          ctx.fillStyle = `rgba(29, 31, 14, ${p.opacity * 0.4})`;
          ctx.font = "bold 9px monospace";
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.fillStyle = `rgba(29, 31, 14, ${p.opacity * 0.7})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 3. Constellation networking (draw connecting vectors between close nodes)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Threshold for digital link binding
          if (dist < 150) {
            const opacityFactor = (1 - dist / 150) * 0.04;
            ctx.strokeStyle = `rgba(29, 31, 14, ${opacityFactor})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none -z-20 opacity-70"
    />
  );
}
