import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ログ出力用ヘルパー
const overlayLog = (msg: string, err?: any) => {
  const finalMsg = err ? `${msg}: ${err}` : msg;
  console.log(finalMsg);
  invoke('overlay_log', { msg: finalMsg }).catch(() => {});
};

export const CaptureOverlay: React.FC = () => {
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // 1. Rustにスクリーンショットを要求
    invoke<string>('capture_screen')
      .then(b64 => {
        overlayLog(`Capture screen success. length: ${b64.length}`);
        setScreenshotBase64(b64);
        setIsCapturing(true);
        getCurrentWindow().show();
        getCurrentWindow().setFocus();
      })
      .catch(err => {
        overlayLog("キャプチャ失敗", err);
        closeOverlay();
      });

    const closeOverlay = () => {
      try {
        getCurrentWindow().close().catch(e => overlayLog("Close Error", e));
      } catch (e) {
        overlayLog("Close sync error", e);
      }
    };

    // ESCでキャンセル
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isCapturing) return;
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = async () => {
    if (!isDragging || !startPos || !currentPos) return;
    setIsDragging(false);

    let x = Math.min(startPos.x, currentPos.x);
    let y = Math.min(startPos.y, currentPos.y);
    let w = Math.abs(currentPos.x - startPos.x);
    let h = Math.abs(currentPos.y - startPos.y);

    overlayLog(`Pointer up: w=${w}, h=${h}`);

    try {
      // クリックのみの場合は全画面
      if (w < 10 || h < 10) {
        // 画面全体
        x = 0;
        y = 0;
        w = window.innerWidth;
        h = window.innerHeight;
      }

      // キャンバス上でトリミング
      const img = new Image();
      img.src = screenshotBase64!;
      await new Promise(resolve => img.onload = resolve);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        const croppedBase64 = canvas.toDataURL('image/png');
        
        const target = new URLSearchParams(window.location.search).get('target') || 'render';
        
        overlayLog(`Emitting screenshot, length=${croppedBase64.length}, target=${target}`);
        // メインウィンドウに送信
        await emit('screenshot-captured', { dataUrl: croppedBase64, target });
      }
      
      // 自身を閉じる
      getCurrentWindow().close().catch(e => overlayLog("Close failed", e));
    } catch (err: any) {
      overlayLog("Error during image crop/emit", err.toString());
      getCurrentWindow().close().catch(() => {});
    }
  };

  if (!screenshotBase64) {
    return null; // キャプチャロード中は透明
  }

  // 選択矩形の計算
  const rect = startPos && currentPos ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y)
  } : null;

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
        backgroundImage: `url(${screenshotBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => { 
        e.preventDefault(); 
        try {
          getCurrentWindow().close().catch(err => overlayLog("Context menu close err", err));
        } catch (e) {
          overlayLog("Context menu close sync err", e);
        }
      }}
    >
      {/* 半透明のオーバーレイ全体。ただしドラッグ中はその範囲だけ穴を開ける感じでハイライト */}
      <Box sx={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }}>
        {/* Helper Text */}
        {!isDragging && (
          <Box sx={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.7)', px: 3, py: 1.5, borderRadius: 2, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body1" fontWeight="bold">画面をドラッグしてキャプチャ</Typography>
            <Typography variant="caption">クリックで全画面 / ESC・右クリックでキャンセル</Typography>
          </Box>
        )}
        
        {rect && rect.width > 0 && rect.height > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              border: '2px solid #3498db',
              backgroundColor: 'transparent',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', // 周囲を暗くするトリック
              pointerEvents: 'none'
            }}
          />
        )}
      </Box>
    </Box>
  );
};
