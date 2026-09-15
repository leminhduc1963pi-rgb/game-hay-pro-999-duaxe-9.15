/**
 * Apple Catcher Mini-Game Modal Component
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Apple, Play, RotateCcw, Copy, Check } from 'lucide-react';

interface AppleGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppleGameModal: React.FC<AppleGameModalProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Standalone standalone HTML/JS source code that user can copy & paste into a single index.html file to run immediately on PC
  const standaloneHTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Game Hứng Táo - Apple Catcher</title>
  <style>
    body { margin: 0; background: #1e293b; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: #fff; }
    canvas { background: #0f172a; border: 2px solid #38bdf8; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { margin: 0 0 10px 0; color: #38bdf8; }
    p { margin: 5px 0 15px 0; color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🍎 GAME HỨNG TÁO</h1>
  <p>Dùng chuột hoặc phím Mũi Tên Trái / Phải để di chuyển giỏ hứng táo!</p>
  <canvas id="gameCanvas" width="480" height="600"></canvas>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let basket = { x: 200, y: 550, width: 80, height: 20, speed: 8 };
    let apples = [];
    let score = 0;
    let lives = 3;
    let gameOver = false;
    let keys = {};

    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      basket.x = e.clientX - rect.left - basket.width / 2;
    });

    function spawnApple() {
      if (Math.random() < 0.035) {
        apples.push({ x: Math.random() * (canvas.width - 30) + 15, y: 0, radius: 12, speed: 3 + Math.random() * 3 });
      }
    }

    function update() {
      if (gameOver) return;
      if (keys['ArrowLeft'] && basket.x > 0) basket.x -= basket.speed;
      if (keys['ArrowRight'] && basket.x < canvas.width - basket.width) basket.x += basket.speed;
      if (basket.x < 0) basket.x = 0;
      if (basket.x > canvas.width - basket.width) basket.x = canvas.width - basket.width;

      spawnApple();

      for (let i = apples.length - 1; i >= 0; i--) {
        let a = apples[i];
        a.y += a.speed;
        // Collision with basket
        if (a.y + a.radius >= basket.y && a.y - a.radius <= basket.y + basket.height &&
            a.x >= basket.x && a.x <= basket.x + basket.width) {
          score += 10;
          apples.splice(i, 1);
          continue;
        }
        // Missed apple
        if (a.y > canvas.height) {
          lives--;
          apples.splice(i, 1);
          if (lives <= 0) gameOver = true;
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw Basket
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(basket.x, basket.y, basket.width, basket.height);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(basket.x + 5, basket.y + 4, basket.width - 10, basket.height - 8);

      // Draw Apples
      for (let a of apples) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
        // Leaf
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(a.x - 2, a.y - a.radius - 4, 4, 6);
      }

      // Draw HUD
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Điểm: ' + score, 20, 30);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('Mạng: ' + '❤️'.repeat(Math.max(0, lives)), canvas.width - 120, 30);

      if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText('Tổng điểm: ' + score, canvas.width / 2, canvas.height / 2 + 20);
        ctx.font = '14px sans-serif';
        ctx.fillText('F5 để chơi lại', canvas.width / 2, canvas.height / 2 + 60);
        ctx.textAlign = 'left';
      }
    }

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;

  useEffect(() => {
    if (!isOpen || !hasStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let basket = { x: 180, y: 350, width: 70, height: 16, speed: 7 };
    let apples: { x: number; y: number; radius: number; speed: number }[] = [];
    let currentScore = 0;
    let currentLives = 3;
    let gameOver = false;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      basket.x = e.clientX - rect.left - basket.width / 2;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    const gameLoop = () => {
      if (!gameOver) {
        if (Math.random() < 0.035) {
          apples.push({
            x: Math.random() * (canvas.width - 30) + 15,
            y: 0,
            radius: 10,
            speed: 2.5 + Math.random() * 2.5
          });
        }

        for (let i = apples.length - 1; i >= 0; i--) {
          const a = apples[i];
          a.y += a.speed;
          if (
            a.y + a.radius >= basket.y &&
            a.y - a.radius <= basket.y + basket.height &&
            a.x >= basket.x &&
            a.x <= basket.x + basket.width
          ) {
            currentScore += 10;
            setScore(currentScore);
            apples.splice(i, 1);
            continue;
          }
          if (a.y > canvas.height) {
            currentLives--;
            setLives(currentLives);
            apples.splice(i, 1);
            if (currentLives <= 0) {
              gameOver = true;
              setIsGameOver(true);
            }
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Basket
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(basket.x, basket.y, basket.width, basket.height);

      // Apples
      for (const a of apples) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!gameOver) {
        animId = requestAnimationFrame(gameLoop);
      }
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen, hasStarted]);

  if (!isOpen) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(standaloneHTML);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <Apple className="w-5 h-5" />
            Game Hứng Táo (HTML/JavaScript)
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-300">
          <p>
            Đây là mã nguồn HTML/JS hoàn chỉnh cho game hứng táo. Bạn có thể sao chép và dán vào một file <code>game.html</code> trên máy tính để chạy ngay lập tức, hoặc chơi thử bên dưới:
          </p>

          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="font-mono text-cyan-400 text-xs">file: game_hung_tao.html (Đầy đủ 1 file duy nhất)</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Đã Copy vào Clipboard!' : 'Copy Toàn Bộ Code HTML/JS'}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center bg-slate-950 rounded-lg p-3 border border-slate-800">
            <div className="flex justify-between w-full max-w-[400px] mb-2 font-mono font-bold text-xs">
              <span className="text-emerald-400">Điểm: {score}</span>
              <span className="text-rose-400">Mạng: {'❤️'.repeat(Math.max(0, lives))}</span>
            </div>

            {!hasStarted ? (
              <button
                onClick={() => {
                  setScore(0);
                  setLives(3);
                  setIsGameOver(false);
                  setHasStarted(true);
                }}
                className="my-10 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Bấm để Chơi Thử Trực Tiếp
              </button>
            ) : isGameOver ? (
              <div className="my-10 text-center space-y-2">
                <p className="text-rose-400 font-bold text-lg">GAME OVER!</p>
                <p className="text-slate-300">Điểm của bạn: {score}</p>
                <button
                  onClick={() => {
                    setScore(0);
                    setLives(3);
                    setIsGameOver(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Chơi Lại
                </button>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={400}
                height={380}
                className="bg-slate-900 border border-slate-800 rounded cursor-crosshair"
              />
            )}
            <span className="text-[11px] text-slate-500 mt-2">Di chuột để di chuyển giỏ hứng táo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
