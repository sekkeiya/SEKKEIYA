import React, { useRef, useState, useEffect, useCallback } from 'react';

import { Box, Typography, Snackbar } from '@mui/material';
import { useDspStore } from '../store/useDspStore';
import type { PresentationElement } from '../types/dsp.types';
import { dspAssetUploadService } from '../upload/dspAssetUploadService';
import { getAuth } from 'firebase/auth';
import { useAIDriveDragStore } from '../../../store/useAIDriveDragStore';
import { resolveAssetPreviewUrl } from '../../../store/useAIDriveStore';

export const PresentsCanvas: React.FC = () => {
  const { projectId, presentation, selectedPageId, selectedElementIds, setSelectedElementIds, updateElements, addElements, addElement, deleteElements, undo, redo, isSnapEnabled, isGridEnabled, gridSize, activeTool, setActiveTool, setSelectedPageId } = useDspStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasW = presentation?.canvasSize?.width || 1587;
  const canvasH = presentation?.canvasSize?.height || 1122;
  const [baseScale, setBaseScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  // Scroll-to-advance state
  const scrollAccumRef = useRef(0);
  const scrollCooldownRef = useRef(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0..1 progress toward page flip
  const [slideAnim, setSlideAnim] = useState<'none' | 'slide-up' | 'slide-down'>('none');
  const slideAnimKeyRef = useRef(0);
  const [isPanDragging, setIsPanDragging] = useState(false);
  const [panDragStart, setPanDragStart] = useState<{ x: number, y: number } | null>(null);
  const [panStartOffset, setPanStartOffset] = useState<{ x: number, y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [cropMode, setCropMode] = useState<{
    elementId: string; imgX: number; imgY: number; imgW: number; imgH: number; imgAR: number;
  } | null>(null);
  const cropModeRef = useRef(cropMode);
  useEffect(() => { cropModeRef.current = cropMode; }, [cropMode]);
  type CropDragType = 'move' | 'nw' | 'ne' | 'sw' | 'se';
  const cropDragRef = useRef<{
    type: CropDragType;
    startMouseX: number; startMouseY: number;
    startImgX: number; startImgY: number; startImgW: number; startImgH: number;
    elW: number; elH: number; k: number;
  } | null>(null);
  const applyCropModeRef = useRef<() => void>(() => {});

  // Reset scroll accumulation when page changes externally (e.g., slide list click)
  useEffect(() => {
    scrollAccumRef.current = 0;
    setScrollProgress(0);
    setSlideAnim('none');
  }, [selectedPageId]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        const canvasW = presentation?.canvasSize?.width || 1587;
        const canvasH = presentation?.canvasSize?.height || 1122;
        setBaseScale(Math.min(width / canvasW, height / canvasH));
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [canvasW, canvasH]);

  useEffect(() => {
    if (wrapperRef.current) {
      const { width, height } = wrapperRef.current.getBoundingClientRect();
      setBaseScale(Math.min(width / canvasW, height / canvasH));
    }
  }, [canvasW, canvasH]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const SCROLL_THRESHOLD = 150; // px needed for page advance
    const SCROLL_COOLDOWN  = 500; // ms lock after advance

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // always prevent browser scroll

      if (e.ctrlKey || e.metaKey) {
        // ── Zoom ──────────────────────────────────────────────────────────────
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoomLevel(prev => Math.max(0.1, Math.min(prev * zoomDelta, 10)));
        return;
      }

      // ── Horizontal pan: always allow ──────────────────────────────────────
      if (e.deltaX !== 0) {
        setPanOffset(prev => ({ ...prev, x: prev.x - e.deltaX }));
      }

      if (scrollCooldownRef.current) return;

      // ── Accumulate Y scroll for page advance ──────────────────────────────
      scrollAccumRef.current += e.deltaY;
      const progress = Math.min(Math.abs(scrollAccumRef.current) / SCROLL_THRESHOLD, 1);
      setScrollProgress(scrollAccumRef.current > 0 ? progress : -progress);

      // Slight Y pan proportional to accumulation (gives tactile feel without full pan)
      const panFraction = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.25, 8);
      setPanOffset(prev => ({ ...prev, y: prev.y - panFraction }));

      const advancePage = (dir: 'next' | 'prev') => {
        const state = useDspStore.getState();
        const pages = state.presentation?.pages ?? [];
        const idx = pages.findIndex(p => p.id === state.selectedPageId);
        const targetIdx = dir === 'next' ? idx + 1 : idx - 1;
        if (targetIdx < 0 || targetIdx >= pages.length) {
          // Bounce back — no more pages
          scrollAccumRef.current = 0;
          setScrollProgress(0);
          setPanOffset({ x: 0, y: 0 });
          return;
        }

        // Trigger slide animation, then switch page
        const animDir = dir === 'next' ? 'slide-up' : 'slide-down';
        slideAnimKeyRef.current += 1;
        setSlideAnim(animDir);

        setTimeout(() => {
          state.setSelectedPageId(pages[targetIdx].id);
          setSlideAnim('none');
          setPanOffset({ x: 0, y: 0 });
          setScrollProgress(0);
        }, 220); // matches CSS animation duration

        scrollAccumRef.current = 0;
        scrollCooldownRef.current = true;
        setTimeout(() => { scrollCooldownRef.current = false; }, SCROLL_COOLDOWN);
      };

      if (scrollAccumRef.current > SCROLL_THRESHOLD) {
        advancePage('next');
      } else if (scrollAccumRef.current < -SCROLL_THRESHOLD) {
        advancePage('prev');
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);
  
  const totalScale = baseScale * zoomLevel;
  
  const [isDragging, setIsDragging] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [localTransforms, setLocalTransforms] = useState<Record<string, { x: number; y: number; w: number; h: number; startX: number; startY: number; startW?: number; startH?: number; startBindingId?: string | null; endBindingId?: string | null }>>({});
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const { pendingDropAsset, consumeDropAsset } = useAIDriveDragStore();

  type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'start' | 'end' | null;
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const [marqueeStart, setMarqueeStart] = useState<{x: number, y: number} | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{x: number, y: number} | null>(null);

  // Pencil drawing state
  const [isDrawingPencil, setIsDrawingPencil] = useState(false);
  const [pencilPoints, setPencilPoints] = useState<{x: number; y: number}[]>([]);
  const pencilColor = '#1d1d1f';
  const pencilWidth = 3;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;
      
      // Delete selection
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedElementIds.length > 0) {
        deleteElements(selectedElementIds);
        return;
      }

      // Undo / Redo
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          redo();
        } else if (e.key === 'c' || e.key === 'C') {
          const state = useDspStore.getState();
          const p = state.presentation?.pages.find(pg => pg.id === state.selectedPageId);
          if (p && state.selectedElementIds.length > 0) {
            const els = p.elements.filter(el => state.selectedElementIds.includes(el.id));
            navigator.clipboard.writeText(JSON.stringify({ type: 'sekkeiya-3dsp-elements', elements: els }));
            setToastMessage(`${els.length}個の要素をコピーしました`);
          }
        } else if (e.key === 'v' || e.key === 'V') {
          navigator.clipboard.readText().then(text => {
            try {
              const data = JSON.parse(text);
              const state = useDspStore.getState();
              if (data.type === 'sekkeiya-3dsp-elements' && data.elements && state.selectedPageId) {
                const newElements = data.elements.map((el: any, i: number) => ({
                  ...el,
                  id: `el_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                  x: el.x + 20,
                  y: el.y + 20,
                }));
                state.addElements(state.selectedPageId, newElements);
                state.setSelectedElementIds(newElements.map((el: any) => el.id));
                setToastMessage(`${newElements.length}個の要素をペーストしました`);
              }
            } catch (err) {}
          });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, deleteElements, undo, redo]);

  useEffect(() => {
    const handleCropKey = (e: KeyboardEvent) => {
      if (!cropModeRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setCropMode(null); }
      if (e.key === 'Enter')  { e.preventDefault(); e.stopPropagation(); applyCropModeRef.current(); }
    };
    window.addEventListener('keydown', handleCropKey, { capture: true });
    return () => window.removeEventListener('keydown', handleCropKey, { capture: true });
  }, []);

  // Handle pointer events based drops from AI Drive
  useEffect(() => {
    if (pendingDropAsset && pendingDropAsset.target === '3dsp-slide' && selectedPageId && canvasRef.current) {
      console.log('[PresentsCanvas] Handling pointer drop:', pendingDropAsset);
      
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasW = presentation?.canvasSize?.width || 1587;
      const currentScale = rect.width / canvasW;
      
      // Calculate coordinates
      const x = (pendingDropAsset.clientX - rect.left) / currentScale;
      const y = (pendingDropAsset.clientY - rect.top) / currentScale;
      
      const model = pendingDropAsset.asset;
      const isImage = model.itemType === 'image' || model.category === 'image' || model.type === 'image';
      const resolvedSrc = resolveAssetPreviewUrl(model) || '';

      if (isImage) {
        const el: PresentationElement = {
          id: `img_${Date.now()}`,
          type: 'image',
          x, y, w: 300, h: 200, zIndex: 10, rotation: 0,
          data: {
            src: resolvedSrc,
            alt: model.title || model.name,
            assetId: model.id,
            name: model.title || model.name || 'AI Drive Image'
          }
        };
        addElements(selectedPageId, [el]);
        setToastMessage(`Image Asset dropped: ${el.data.name || 'Unknown'}`);
      } else {
        const el: PresentationElement = {
          id: `el_${Date.now()}`,
          type: 'modelCard',
          x, y, w: 200, h: 200, zIndex: 10, rotation: 0,
          data: {
            title: model.title || model.name || 'Untitled',
            subtitle: model.brand || '',
            thumbnailUrl: resolvedSrc,
            bgcolor: '#ffffff'
          }
        };
        addElements(selectedPageId, [el]);
        setToastMessage(`Model Asset dropped: ${el.data.title || 'Untitled'}`);
      }
      
      consumeDropAsset();
    }
  }, [pendingDropAsset, selectedPageId, addElements, consumeDropAsset]);

  if (!presentation || !selectedPageId) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)' }}>
        <Typography color="text.secondary">スライドが選択されていません</Typography>
      </Box>
    );
  }

  const page = presentation.pages.find(p => p.id === selectedPageId);
  if (!page) return null;

  const handleElementPointerDown = (e: React.PointerEvent<HTMLDivElement>, el: PresentationElement) => {
    if (e.button !== 0) return;
    if (cropModeRef.current) {
      if (cropModeRef.current.elementId !== el.id) applyCropModeRef.current();
      return;
    }
    e.stopPropagation();
    if (editingElementId === el.id) return; // Don't drag if editing current element
    
    if (editingElementId && editingElementId !== el.id) {
       handleCommitEdit();
    }

    let idsToDrag = [el.id];
    if (selectedElementIds.includes(el.id)) {
        idsToDrag = selectedElementIds;
    } else {
        if (!e.shiftKey) {
            setSelectedElementIds([el.id]);
        } else {
            idsToDrag = [...selectedElementIds, el.id];
            setSelectedElementIds(idsToDrag);
        }
    }

    setIsDragging(true);
    if (e.ctrlKey || e.metaKey) {
        setIsDuplicating(true);
    }
    
    const newTransforms: Record<string, any> = {};
    idsToDrag.forEach(id => {
       const element = page.elements.find(p => p.id === id);
       if (element) {
           newTransforms[id] = { x: element.x, y: element.y, w: element.w, h: element.h, startX: element.x, startY: element.y, startW: element.w, startH: element.h };
       }
    });

    page.elements.forEach(el => {
        if (el.type === 'line' && !idsToDrag.includes(el.id)) {
            const data = el.data as any;
            if (idsToDrag.includes(data.startBindingId) || idsToDrag.includes(data.endBindingId)) {
                newTransforms[el.id] = { 
                   x: el.x, y: el.y, w: el.w, h: el.h, 
                   startX: el.x, startY: el.y, startW: el.w, startH: el.h 
                };
            }
        }
    });

    setLocalTransforms(newTransforms);
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const canvasW = presentation?.canvasSize?.width || 1587;
    const currentScale = rect.width / canvasW;
    setDragOffset({
      x: (e.clientX - rect.left) / currentScale,
      y: (e.clientY - rect.top) / currentScale
    });
  };

  const handleElementDoubleClick = (e: React.MouseEvent, el: PresentationElement) => {
    e.stopPropagation();
    if (el.type === 'text') {
      const data = el.data as import('../types/dsp.types').TextElementData;
      setEditingElementId(el.id);
      setEditingText(data.text === 'テキストを入力' ? '' : data.text);
      setSelectedElementIds([el.id]);
    }
    if (el.type === 'image') {
      const data = el.data as import('../types/dsp.types').ImageElementData;
      if (data.src) {
        const img = new window.Image();
        img.onload = () => {
          const imgAR = img.naturalWidth / img.naturalHeight;
          const elAR = el.w / el.h;
          const k = imgAR / elAR;
          let crop: { imgX: number; imgY: number; imgW: number; imgH: number };
          if (data.crop) {
            crop = data.crop;
          } else if (k >= 1) {
            crop = { imgX: -(k - 1) / 2, imgY: 0, imgW: k, imgH: 1 };
          } else {
            const ih = 1 / k;
            crop = { imgX: 0, imgY: -(ih - 1) / 2, imgW: 1, imgH: ih };
          }
          setCropMode({ elementId: el.id, ...crop, imgAR });
          setSelectedElementIds([el.id]);
        };
        img.src = data.src;
      } else {
        openImageFilePicker(el.id);
      }
    }
  };

  const openImageFilePicker = (elementId: string) => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!projectId || !userId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const tempEl: PresentationElement = { id: elementId, type: 'image', x: 0, y: 0, w: 0, h: 0, zIndex: 0, rotation: 0, data: { src: '', alt: 'Uploading...' } };
        updateElements([{ id: elementId, updates: { data: { ...(page?.elements.find(e => e.id === elementId)?.data || {}), src: '' } } }]);
        const uploadResult = await dspAssetUploadService.uploadLocalImage(projectId!, file, userId!);
        const currentEl = useDspStore.getState().presentation?.pages.flatMap(p => p.elements).find(e => e.id === elementId);
        updateElements([{ id: elementId, updates: { data: { ...(currentEl?.data || {}), src: uploadResult.src, assetId: uploadResult.assetId, storagePath: uploadResult.storagePath, mimeType: uploadResult.mimeType, name: uploadResult.name } } }], true);
        setToastMessage(`画像を追加しました: ${file.name}`);
      } catch (err) {
        console.error('Image upload failed', err);
        setToastMessage('画像のアップロードに失敗しました');
      }
    };
    input.click();
  };

  const handleCommitEdit = () => {
    if (editingElementId) {
      const el = page.elements.find(e => e.id === editingElementId);
      if (el) {
        updateElements([{ id: editingElementId, updates: { data: { ...el.data, text: editingText } as import('../types/dsp.types').TextElementData } }], true);
      }
      setEditingElementId(null);
    }
  };

  const getCanvasCoords = (e: React.PointerEvent): {x: number; y: number} => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cW = presentation?.canvasSize?.width || 1587;
    const scale = rect.width / cW;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const handleCanvasClick = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (cropModeRef.current) { applyCropModeRef.current(); return; }

    // Pencil mode: start drawing
    if (activeTool === 'pencil' && canvasRef.current) {
      e.stopPropagation();
      const pt = getCanvasCoords(e);
      setIsDrawingPencil(true);
      setPencilPoints([pt]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (e.target === canvasRef.current || e.currentTarget === e.target) {
      handleCommitEdit();
      if (!e.shiftKey) {
          setSelectedElementIds([]);
      }

      const rect = canvasRef.current!.getBoundingClientRect();
      const canvasW = presentation?.canvasSize?.width || 1587;
      const currentScale = rect.width / canvasW;
      const x = (e.clientX - rect.left) / currentScale;
      const y = (e.clientY - rect.top) / currentScale;
      setMarqueeStart({ x, y });
      setMarqueeCurrent({ x, y });
    }
  };

  const handleResizeDown = (e: React.PointerEvent, handle: ResizeHandle, el: PresentationElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedElementIds([el.id]);
    setResizeHandle(handle);
    setResizeStart({ x: el.x, y: el.y, w: el.w, h: el.h });
    const newTransforms: Record<string, any> = {
      [el.id]: { x: el.x, y: el.y, w: el.w, h: el.h, startX: el.x, startY: el.y }
    };
    if (page) {
        page.elements.forEach(lineEl => {
            if (lineEl.type === 'line' && lineEl.id !== el.id) {
                const data = lineEl.data as any;
                if (data.startBindingId === el.id || data.endBindingId === el.id) {
                    newTransforms[lineEl.id] = {
                       x: lineEl.x, y: lineEl.y, w: lineEl.w, h: lineEl.h,
                       startX: lineEl.x, startY: lineEl.y, startW: lineEl.w, startH: lineEl.h
                    };
                }
            }
        });
    }
    setLocalTransforms(newTransforms);
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const canvasW = presentation?.canvasSize?.width || 1587;
    const currentScale = rect.width / canvasW;
    setDragOffset({
      x: (e.clientX - rect.left) / currentScale,
      y: (e.clientY - rect.top) / currentScale
    });
  };

  const handlePointerUp = () => {
    if (isDrawingPencil && activeTool === 'pencil') {
      setIsDrawingPencil(false);
      if (pencilPoints.length >= 2 && selectedPageId) {
        const xs = pencilPoints.map(p => p.x);
        const ys = pencilPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const pathData = pencilPoints.map((p, i) =>
          `${i === 0 ? 'M' : 'L'} ${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`
        ).join(' ');
        addElement(selectedPageId, {
          type: 'drawing',
          x: minX, y: minY,
          w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1),
          zIndex: 10, rotation: 0, opacity: 100,
          data: { pathData, stroke: pencilColor, strokeWidth: pencilWidth }
        });
      }
      setPencilPoints([]);
      return;
    }

    if (isPanDragging) {
        setIsPanDragging(false);
        setPanDragStart(null);
        setPanStartOffset(null);
        return;
    }

    if (marqueeStart && marqueeCurrent) {
        const left = Math.min(marqueeStart.x, marqueeCurrent.x);
        const right = Math.max(marqueeStart.x, marqueeCurrent.x);
        const top = Math.min(marqueeStart.y, marqueeCurrent.y);
        const bottom = Math.max(marqueeStart.y, marqueeCurrent.y);

        const newSelectedIds = page.elements.filter(el => {
            const ex1 = Math.min(el.x, el.x + el.w);
            const ex2 = Math.max(el.x, el.x + el.w);
            const ey1 = Math.min(el.y, el.y + el.h);
            const ey2 = Math.max(el.y, el.y + el.h);
            return ex1 < right && ex2 > left && ey1 < bottom && ey2 > top;
        }).map(el => el.id);

        if (newSelectedIds.length > 0) {
            if (marqueeStart.x !== marqueeCurrent.x || marqueeStart.y !== marqueeCurrent.y) {
               setSelectedElementIds([...selectedElementIds, ...newSelectedIds.filter(id => !selectedElementIds.includes(id))]);
            }
        }
        setMarqueeStart(null);
        setMarqueeCurrent(null);
        return;
    }

    if (Object.keys(localTransforms).length > 0) {
      if (isDuplicating) {
         const newEls = Object.keys(localTransforms).map(id => {
             const el = page.elements.find(e => e.id === id);
             if (!el) return null;
             let extraData: any = {};
             if (el.type === 'line') {
                  const t = localTransforms[id];
                  let newData = { ...el.data };
                  if (t.startBindingId !== undefined) {
                      if (t.startBindingId === null) delete (newData as any).startBindingId;
                      else (newData as any).startBindingId = t.startBindingId;
                  }
                  if (t.endBindingId !== undefined) {
                      if (t.endBindingId === null) delete (newData as any).endBindingId;
                      else (newData as any).endBindingId = t.endBindingId;
                  }
                  extraData.data = newData;
             }
             return {
                 ...el,
                 _originalId: el.id,
                 x: localTransforms[id].x,
                 y: localTransforms[id].y,
                 w: localTransforms[id].w,
                 h: localTransforms[id].h,
                 ...extraData
             };
         }).filter(Boolean) as PresentationElement[];
         
         addElements(selectedPageId, newEls.map(({ id, ...rest }) => rest));
      } else {
          const updates = Object.keys(localTransforms).map(id => {
              const el = page.elements.find(e => e.id === id);
              let extraUpdates: any = {};
              if (el?.type === 'line') {
                  const t = localTransforms[id];
                  let newData = { ...el.data };
                  let changed = false;
                  if (t.startBindingId !== undefined) {
                      if (t.startBindingId === null) delete (newData as any).startBindingId;
                      else (newData as any).startBindingId = t.startBindingId;
                      changed = true;
                  }
                  if (t.endBindingId !== undefined) {
                      if (t.endBindingId === null) delete (newData as any).endBindingId;
                      else (newData as any).endBindingId = t.endBindingId;
                      changed = true;
                  }
                  if (changed) extraUpdates.data = newData;
              }

              return {
                id, 
                updates: {
                   x: localTransforms[id].x,
                   y: localTransforms[id].y,
                   w: localTransforms[id].w,
                   h: localTransforms[id].h,
                   ...extraUpdates
                }
              };
          });
          updateElements(updates, true);
      }
    }
    
    setIsDragging(false);
    setIsDuplicating(false);
    setResizeHandle(null);
    setLocalTransforms({});
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDrawingPencil && activeTool === 'pencil' && canvasRef.current) {
      const pt = getCanvasCoords(e);
      setPencilPoints(prev => [...prev, pt]);
      return;
    }

    if (isPanDragging && panDragStart && panStartOffset) {
        setPanOffset({
            x: panStartOffset.x + (e.clientX - panDragStart.x),
            y: panStartOffset.y + (e.clientY - panDragStart.y)
        });
        return;
    }

    if (marqueeStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasW = presentation?.canvasSize?.width || 1587;
        const currentScale = rect.width / canvasW;
        setMarqueeCurrent({
           x: (e.clientX - rect.left) / currentScale,
           y: (e.clientY - rect.top) / currentScale
        });
        return;
    }

    if (resizeHandle && Object.keys(localTransforms).length > 0 && canvasRef.current) {
      const id = Object.keys(localTransforms)[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasW = presentation?.canvasSize?.width || 1587;
      const currentScale = rect.width / canvasW;
      const currentX = (e.clientX - rect.left) / currentScale;
      const currentY = (e.clientY - rect.top) / currentScale;
      
      const dx = currentX - dragOffset.x;
      const dy = currentY - dragOffset.y;
      
      const SNAP_DIST = 15;
      const getSnapPoint = (targetX: number, targetY: number, currentId: string): {x: number, y: number, elementId: string} | null => {
          let closestDist = SNAP_DIST;
          let snapPoint: { x: number; y: number; elementId: string } | null = null;
          page.elements.forEach(el => {
              if (el.id === currentId || el.type === 'line') return;
              const isLocal = !!localTransforms[el.id];
              const elX = isLocal ? localTransforms[el.id].x : el.x;
              const elY = isLocal ? localTransforms[el.id].y : el.y;
              const elW = isLocal ? localTransforms[el.id].w : el.w;
              const elH = isLocal ? localTransforms[el.id].h : el.h;

              const pts = [
                  { x: elX + elW / 2, y: elY },           // Top Center
                  { x: elX + elW / 2, y: elY + elH },     // Bottom Center
                  { x: elX, y: elY + elH / 2 },           // Left Center
                  { x: elX + elW, y: elY + elH / 2 },     // Right Center
                  { x: elX + elW / 2, y: elY + elH / 2 }  // Center
              ];
              pts.forEach(pt => {
                  const dist = Math.hypot(pt.x - targetX, pt.y - targetY);
                  if (dist < closestDist) {
                      closestDist = dist;
                      snapPoint = { ...pt, elementId: el.id };
                  }
              });
          });
          return snapPoint;
      };
      
      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newW = resizeStart.w;
      let newH = resizeStart.h;
      
      let startBindingId = localTransforms[id]?.startBindingId;
      let endBindingId = localTransforms[id]?.endBindingId;

      if (resizeHandle === 'start') {
        let rawX = resizeStart.x + dx;
        let rawY = resizeStart.y + dy;
        const snap = (isSnapEnabled && !e.altKey) ? getSnapPoint(rawX, rawY, id) : null;
        if (snap) {
            rawX = snap.x;
            rawY = snap.y;
            startBindingId = snap.elementId;
        } else {
            startBindingId = null;
        }

        const endX = resizeStart.x + resizeStart.w;
        const endY = resizeStart.y + resizeStart.h;

        // Orthogonal snap (horizontal/vertical)
        if (!snap && isSnapEnabled && !e.altKey) {
            const diffX = Math.abs(rawX - endX);
            const diffY = Math.abs(rawY - endY);
            if (e.shiftKey) {
                if (diffX < diffY) rawX = endX; else rawY = endY;
            } else {
                if (diffX < 10) rawX = endX;
                if (diffY < 10) rawY = endY;
            }
        }

        newX = rawX;
        newY = rawY;
        
        newW = endX - newX;
        newH = endY - newY;
      } else if (resizeHandle === 'end') {
        let rawEndX = resizeStart.x + resizeStart.w + dx;
        let rawEndY = resizeStart.y + resizeStart.h + dy;
        const snap = (isSnapEnabled && !e.altKey) ? getSnapPoint(rawEndX, rawEndY, id) : null;
        if (snap) {
            rawEndX = snap.x;
            rawEndY = snap.y;
            endBindingId = snap.elementId;
        } else {
            endBindingId = null;
        }
        
        const startX = resizeStart.x;
        const startY = resizeStart.y;

        // Orthogonal snap (horizontal/vertical)
        if (!snap && isSnapEnabled && !e.altKey) {
            const diffX = Math.abs(rawEndX - startX);
            const diffY = Math.abs(rawEndY - startY);
            if (e.shiftKey) {
                if (diffX < diffY) rawEndX = startX; else rawEndY = startY;
            } else {
                if (diffX < 10) rawEndX = startX;
                if (diffY < 10) rawEndY = startY;
            }
        }

        newW = rawEndX - startX;
        newH = rawEndY - startY;
      } else {
        if (resizeHandle.includes('l')) {
          newX = resizeStart.x + dx;
          newW = resizeStart.w - dx;
        }
        if (resizeHandle.includes('r')) {
          newW = resizeStart.w + dx;
        }
        if (resizeHandle.includes('t')) {
          newY = resizeStart.y + dy;
          newH = resizeStart.h - dy;
        }
        if (resizeHandle.includes('b')) {
          newH = resizeStart.h + dy;
        }
        
        if (isGridEnabled && !e.altKey) {
            if (resizeHandle.includes('l')) {
                const oldRight = newX + newW;
                newX = Math.round(newX / gridSize) * gridSize;
                newW = oldRight - newX;
            }
            if (resizeHandle.includes('r')) {
                newW = Math.round((newX + newW) / gridSize) * gridSize - newX;
            }
            if (resizeHandle.includes('t')) {
                const oldBottom = newY + newH;
                newY = Math.round(newY / gridSize) * gridSize;
                newH = oldBottom - newY;
            }
            if (resizeHandle.includes('b')) {
                newH = Math.round((newY + newH) / gridSize) * gridSize - newY;
            }
        }

        if (newW < 20) {
          if (resizeHandle.includes('l')) newX -= (20 - newW);
          newW = 20;
        }
        if (newH < 20) {
          if (resizeHandle.includes('t')) newY -= (20 - newH);
          newH = 20;
        }
      }
      
      const newTransforms = { ...localTransforms, [id]: { ...localTransforms[id], x: newX, y: newY, w: newW, h: newH, startBindingId, endBindingId } };
      
      const getSnapIndex = (pt: {x: number, y: number}, bounds: {x: number, y: number, w: number, h: number}) => {
          const pts = [
              { x: bounds.x + bounds.w / 2, y: bounds.y },
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h },
              { x: bounds.x, y: bounds.y + bounds.h / 2 },
              { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 },
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
          ];
          let minD = Infinity; let idx = -1;
          pts.forEach((p, i) => { const d = Math.hypot(p.x - pt.x, p.y - pt.y); if (d < minD) { minD = d; idx = i; } });
          return idx;
      };
      
      const getSnapPointByIndex = (idx: number, bounds: {x: number, y: number, w: number, h: number}) => {
          const pts = [
              { x: bounds.x + bounds.w / 2, y: bounds.y },
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h },
              { x: bounds.x, y: bounds.y + bounds.h / 2 },
              { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 },
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
          ];
          return pts[idx];
      };

      Object.keys(newTransforms).forEach(lineId => {
          const lineEl = page.elements.find(e => e.id === lineId);
          if (lineEl?.type === 'line' && lineId !== id) {
             const data = lineEl.data as any;
             const lineStart = { x: newTransforms[lineId].startX, y: newTransforms[lineId].startY };
             const lineEnd = { x: newTransforms[lineId].startX + (newTransforms[lineId].startW || 0), y: newTransforms[lineId].startY + (newTransforms[lineId].startH || 0) };
             
             let finalLineStartX = lineStart.x;
             let finalLineStartY = lineStart.y;
             let finalLineEndX = lineEnd.x;
             let finalLineEndY = lineEnd.y;
             
             const originalTargetBounds = { x: resizeStart.x, y: resizeStart.y, w: resizeStart.w, h: resizeStart.h };
             const newTargetBounds = { x: newX, y: newY, w: newW, h: newH };

             if (data.startBindingId === id) {
                 const idx = getSnapIndex(lineStart, originalTargetBounds);
                 const newPt = getSnapPointByIndex(idx, newTargetBounds);
                 finalLineStartX = newPt.x;
                 finalLineStartY = newPt.y;
             }
             if (data.endBindingId === id) {
                 const idx = getSnapIndex(lineEnd, originalTargetBounds);
                 const newPt = getSnapPointByIndex(idx, newTargetBounds);
                 finalLineEndX = newPt.x;
                 finalLineEndY = newPt.y;
             }
             
             newTransforms[lineId].x = finalLineStartX;
             newTransforms[lineId].y = finalLineStartY;
             newTransforms[lineId].w = finalLineEndX - finalLineStartX;
             newTransforms[lineId].h = finalLineEndY - finalLineStartY;
          }
      });
      
      setLocalTransforms(newTransforms);
      return;
    }

    if (isDragging && Object.keys(localTransforms).length > 0 && canvasRef.current) {
      const containerRect = canvasRef.current.getBoundingClientRect();
      const canvasW = presentation?.canvasSize?.width || 1587;
      const currentScale = containerRect.width / canvasW;
      const currentX = (e.clientX - containerRect.left) / currentScale;
      const currentY = (e.clientY - containerRect.top) / currentScale;
      
      let dx = currentX - dragOffset.x;
      let dy = currentY - dragOffset.y;
      
      if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) {
              dy = 0;
          } else {
              dx = 0;
          }
      }
      
      setLocalTransforms(prev => {
         const next = { ...prev };
         Object.keys(next).forEach(id => {
             const el = page.elements.find(e => e.id === id);
             if (el?.type === 'line' && !selectedElementIds.includes(el.id)) {
                 const data = el.data as any;
                 let newX = next[id].startX;
                 let newY = next[id].startY;
                 let newW = next[id].startW || el.w;
                 let newH = next[id].startH || el.h;
                 
                 if (data.startBindingId && selectedElementIds.includes(data.startBindingId)) {
                     newX += dx;
                     newY += dy;
                     newW -= dx;
                     newH -= dy;
                 }
                 if (data.endBindingId && selectedElementIds.includes(data.endBindingId)) {
                     newW += dx;
                     newH += dy;
                 }
                 next[id] = { ...next[id], x: newX, y: newY, w: newW, h: newH };
             } else {
                 let rawX = next[id].startX + dx;
                 let rawY = next[id].startY + dy;
                 if (isGridEnabled && !e.altKey) {
                    rawX = Math.round(rawX / gridSize) * gridSize;
                    rawY = Math.round(rawY / gridSize) * gridSize;
                 }
                 next[id] = { ...next[id], x: rawX, y: rawY };
             }
         });
         return next;
      });
    }
  };

  const selectedSet = new Set(selectedElementIds);

  const elementsToRender = [...(page?.elements || [])];
  if (isDuplicating) {
    Object.keys(localTransforms).forEach(id => {
       const el = page?.elements.find(e => e.id === id);
       if (el) {
           elementsToRender.push({
               ...el,
               id: 'dup-' + el.id,
               x: localTransforms[id].x,
               y: localTransforms[id].y,
               w: localTransforms[id].w,
               h: localTransforms[id].h
           });
       }
    });
  }

  if (!page) return null;

  applyCropModeRef.current = () => {
    const cm = cropModeRef.current;
    if (!cm) return;
    const state = useDspStore.getState();
    const p = state.presentation?.pages.find(pg => pg.id === state.selectedPageId);
    const targetEl = p?.elements.find(e => e.id === cm.elementId);
    if (targetEl) {
      updateElements([{ id: cm.elementId, updates: { data: { ...targetEl.data, crop: { imgX: cm.imgX, imgY: cm.imgY, imgW: cm.imgW, imgH: cm.imgH } } } }], true);
    }
    setCropMode(null);
  };

  // Progress bar height & position for scroll-to-advance visual feedback
  const absProgress = Math.abs(scrollProgress);
  const progressDir = scrollProgress > 0 ? 'bottom' : scrollProgress < 0 ? 'top' : null;

  return (
    <>
      {/* CSS keyframes for slide transitions */}
      <style>{`
        @keyframes dsp-slide-up-enter {
          from { opacity: 0; transform: translate(var(--dsp-tx,0px), calc(var(--dsp-ty,0px) + 56px)) scale(var(--dsp-sc,1)); }
          to   { opacity: 1; transform: translate(var(--dsp-tx,0px), var(--dsp-ty,0px)) scale(var(--dsp-sc,1)); }
        }
        @keyframes dsp-slide-down-enter {
          from { opacity: 0; transform: translate(var(--dsp-tx,0px), calc(var(--dsp-ty,0px) - 56px)) scale(var(--dsp-sc,1)); }
          to   { opacity: 1; transform: translate(var(--dsp-tx,0px), var(--dsp-ty,0px)) scale(var(--dsp-sc,1)); }
        }
        @keyframes dsp-bounce {
          from { transform: translateY(0); opacity: 0.6; }
          to   { transform: translateY(4px); opacity: 1; }
        }
      `}</style>
    <Box
      sx={{
         flex: 1,
         bgcolor: '#1e1e1e',
         position: 'relative',
         overflow: 'hidden',
         cursor: activeTool === 'pencil' ? 'crosshair' : (isPanDragging ? 'grabbing' : 'auto')
      }}
      onPointerDown={(e) => {
        if (cropModeRef.current && e.button === 0) { applyCropModeRef.current(); return; }
        if (e.button === 2 || e.button === 1) { // Right or Middle click
          e.preventDefault();
          setIsPanDragging(true);
          setPanDragStart({ x: e.clientX, y: e.clientY });
          setPanStartOffset({ x: panOffset.x, y: panOffset.y });
        } else if (e.button === 0 && canvasRef.current && e.target !== canvasRef.current && !canvasRef.current.contains(e.target as Node)) {
          handleCommitEdit();
          if (!e.shiftKey) setSelectedElementIds([]);
          
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasW = presentation?.canvasSize?.width || 1587;
          const currentScale = rect.width / canvasW;
          const x = (e.clientX - rect.left) / currentScale;
          const y = (e.clientY - rect.top) / currentScale;
          setMarqueeStart({ x, y });
          setMarqueeCurrent({ x, y });
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDragOverCapture={(e) => console.log('[CanvasRoot] drag over capture')}
      onDropCapture={(e) => console.log('[CanvasRoot] drop capture')}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        console.log('[CanvasRoot] drag over (bubbled)');
      }}
      onDrop={(e) => {
        e.preventDefault();
        console.log('[CanvasRoot] drop (bubbled)');
      }}
    >
      <Box sx={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: 4
      }} ref={wrapperRef}>
        <Box 
          ref={canvasRef}
          data-drop-target="3dsp-slide"
          onPointerDown={handleCanvasClick as any}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
            console.log('[CanvasRoot] drag over (bubbled)');
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={async (e) => {
            setIsDragOver(false);
            e.preventDefault();
            console.log('[Canvas] DROP DETECTED', Array.from(e.dataTransfer.types));
            if (!selectedPageId) return;

            const rect = canvasRef.current!.getBoundingClientRect();
            const canvasW = presentation?.canvasSize?.width || 1587;
            const currentScale = rect.width / canvasW;
            const x = (e.clientX - rect.left) / currentScale;
            const y = (e.clientY - rect.top) / currentScale;

            // 1. Try AI Drive Asset
            try {
              const sekkeiyaAssetStr = e.dataTransfer.getData('application/sekkeiya-asset');
              if (sekkeiyaAssetStr) {
                const model = JSON.parse(sekkeiyaAssetStr);
                console.log('[PresentsCanvas] Parsed AI Drive Asset:', model);

                const isImage = model.itemType === 'image' || model.category === 'image' || model.type === 'image';
                const resolvedSrc = resolveAssetPreviewUrl(model) || '';
                console.log('[PresentsCanvas] Resolved src for image/model:', resolvedSrc);

                if (isImage) {
                  const el: PresentationElement = {
                    id: `img_${Date.now()}`,
                    type: 'image',
                    x, y, w: 300, h: 200, zIndex: 10, rotation: 0,
                    data: {
                      src: resolvedSrc,
                      alt: model.title || model.name,
                      assetId: model.id,
                      name: model.title || model.name || 'AI Drive Image'
                    }
                  };
                  addElements(selectedPageId, [el]);
                  setToastMessage(`Image Asset dropped: ${el.data.name || 'Unknown'}`);
                } else {
                  const el: PresentationElement = {
                    id: `el_${Date.now()}`,
                    type: 'modelCard',
                    x, y, w: 200, h: 200, zIndex: 10, rotation: 0,
                    data: {
                      title: model.title || model.name || 'Untitled',
                      subtitle: model.brand || '',
                      thumbnailUrl: resolvedSrc,
                      bgcolor: '#ffffff'
                    }
                  };
                  addElements(selectedPageId, [el]);
                  setToastMessage(`Model Asset dropped: ${el.data.title || 'Untitled'}`);
                }
                return;
              }
            } catch(err) {
              console.warn("Failed to parse sekkeiya-asset drop", err);
            }

            // 2. Try Files (Local Images)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];
              if (file.type.startsWith('image/')) {
                const auth = getAuth();
                const userId = auth.currentUser?.uid;
                if (!projectId || !userId) {
                  console.error("Project ID or User ID missing for upload");
                  return;
                }
                
                try {
                  // Pre-insert a placeholder
                  const tempId = `img_${Date.now()}`;
                  const tempEl: PresentationElement = {
                    id: tempId, type: 'image',
                    x, y, w: 300, h: 200, zIndex: 10, rotation: 0,
                    data: { src: '', alt: 'Uploading...' }
                  };
                  addElements(selectedPageId, [tempEl]);

                  const uploadResult = await dspAssetUploadService.uploadLocalImage(projectId, file, userId);
                  
                  updateElements([{
                    id: tempId,
                    updates: {
                      data: {
                        src: uploadResult.src,
                        assetId: uploadResult.assetId,
                        storagePath: uploadResult.storagePath,
                        mimeType: uploadResult.mimeType,
                        name: uploadResult.name
                      }
                    }
                  }]);
                  setToastMessage(`Local Image dropped & uploaded: ${file.name}`);
                } catch (error) {
                  console.error("Upload failed", error);
                }
                return;
              }
            }

            // 3. Try URL
            const urlStr = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
            if (urlStr && (urlStr.startsWith('http://') || urlStr.startsWith('https://'))) {
              const el: PresentationElement = {
                id: `link_${Date.now()}`, type: 'link',
                x, y, w: 300, h: 48, zIndex: 10, rotation: 0,
                data: { url: urlStr, text: urlStr, color: '#007aff', fontSize: '14px', textAlign: 'left' }
              };
              addElements(selectedPageId, [el]);
              setToastMessage(`URL Link dropped: ${urlStr}`);
              return;
            }
          }}
          sx={{
            width: canvasW,
            height: canvasH,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${totalScale})`,
            transformOrigin: 'center',
            // CSS custom props for keyframe animations to reference current transform
            '--dsp-tx': `${panOffset.x}px`,
            '--dsp-ty': `${panOffset.y}px`,
            '--dsp-sc': totalScale,
            ...(slideAnim === 'slide-up'
              ? { animation: `dsp-slide-up-enter 0.22s cubic-bezier(0.22,1,0.36,1) both` }
              : slideAnim === 'slide-down'
              ? { animation: `dsp-slide-down-enter 0.22s cubic-bezier(0.22,1,0.36,1) both` }
              : {}),
            bgcolor: '#ffffff',
            backgroundImage: isGridEnabled ? 'linear-gradient(to right, #ececec 1px, transparent 1px), linear-gradient(to bottom, #ececec 1px, transparent 1px)' : 'none',
            backgroundSize: isGridEnabled ? `${gridSize}px ${gridSize}px` : 'none',
            position: 'relative',
            boxShadow: isDragOver ? '0 0 0 4px #007aff' : '0 10px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {elementsToRender.map(el => {
             // If it's a real original element being duplicated, it should stay put.
             // If it's a duplicated element (isDup), it already holds its transform coordinates.
             // If we're not duplicating and it's local, follow localTransforms.
                const isDup = el.id.startsWith('dup-');
                const originalId = isDup ? el.id.replace('dup-', '') : el.id;
                const data = el.data as any;
                
                const isLocal = !!localTransforms[originalId] && !isDuplicating;
                const renderX = isLocal ? localTransforms[originalId].x : el.x;
                const renderY = isLocal ? localTransforms[originalId].y : el.y;
                const renderW = isLocal ? localTransforms[originalId].w : el.w;
                const renderH = isLocal ? localTransforms[originalId].h : el.h;
                
                const isSelected = selectedSet.has(originalId);

             return (
               <Box
                 key={el.id}
                 onPointerDown={e => handleElementPointerDown(e, el)}
                 onDoubleClick={e => handleElementDoubleClick(e, el)}
                 sx={{
                   position: 'absolute',
                   left: renderX,
                   top: renderY,
                   width: el.type === 'line' ? 0 : renderW,
                   height: el.type === 'line' ? 0 : renderH,
                   zIndex: el.zIndex,
                   transform: `rotate(${el.rotation || 0}deg)`,
                   // Basic styles depending on type
                   backgroundColor: data.bgcolor || (el.type === 'shape' ? data.fill : 'transparent'),
                   borderRadius: data.borderRadius || 0,
                   boxShadow: data.boxShadow || 'none',
                   color: el.type === 'text' ? data.color : '#000',
                   fontSize: el.type === 'text' ? data.fontSize : undefined,
                   fontWeight: data.fontWeight || (el.type === 'text' ? 'normal' : undefined),
                   textAlign: el.type === 'text' ? data.textAlign : undefined,
                   opacity: (el.opacity ?? 100) / 100,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: el.type === 'text' && data.textAlign === 'center' ? 'center' : (el.type === 'text' && data.textAlign === 'right' ? 'flex-end' : 'flex-start'),
                   p: data.padding ?? (el.type === 'text' ? 1.5 : 0),
                   userSelect: 'none',
                   outline: isSelected && el.type !== 'line' ? '2px solid #007aff' : 'none',
                   outlineOffset: '2px',
                   cursor: isSelected ? (isDragging ? 'grabbing' : 'grab') : 'default',
                 }}
               >
                 {el.type === 'text' && (
                    editingElementId === el.id ? (
                      <textarea
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleCommitEdit();
                          } else if (e.key === 'Escape') {
                            handleCommitEdit();
                          }
                          e.stopPropagation();
                        }}
                        onBlur={handleCommitEdit}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          background: 'transparent',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 'inherit',
                          color: 'inherit',
                          textAlign: 'inherit' as any,
                          padding: 0,
                          margin: 0
                        }}
                      />
                    ) : (data.text)
                  )}
                 {el.type === 'image' && (() => {
                   const imgData = data as import('../types/dsp.types').ImageElementData;
                   if (!imgData.src) {
                     return (
                       <Box
                         sx={{ width: '100%', height: '100%', border: '2px dashed #c7c7cc', borderRadius: data.borderRadius || 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.5)', color: '#8e8e93', cursor: 'pointer', gap: 1, transition: 'all 0.15s', '&:hover': { borderColor: '#007aff', bgcolor: 'rgba(0,122,255,0.05)', color: '#007aff' } }}
                         onDoubleClick={(e) => { e.stopPropagation(); openImageFilePicker(el.id); }}
                       >
                         <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                         <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11, textAlign: 'center', px: 1, lineHeight: 1.4 }}>ダブルクリックで画像を追加<br/>またはドラッグ&ドロップ</Typography>
                       </Box>
                     );
                   }
                   // ── Inline crop mode (PowerPoint-style) ──────────────────────
                   if (cropMode?.elementId === el.id) {
                     const cm = cropMode;
                     const k = cm.imgAR / (renderW / renderH); // imgW = k * imgH constraint
                     const MIN_CROP_SIZE = 0.15;
                     return (
                       <Box sx={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                         {/* Dimmed full image visible outside frame */}
                         <Box component="img" draggable={false} src={imgData.src}
                           sx={{ position: 'absolute', left: `${cm.imgX * 100}%`, top: `${cm.imgY * 100}%`, width: `${cm.imgW * 100}%`, height: `${cm.imgH * 100}%`, opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}
                         />
                         {/* Full-brightness clipped image — drag to reposition */}
                         <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
                           <Box component="img" draggable={false} src={imgData.src}
                             onPointerDown={(e) => {
                               e.stopPropagation(); e.preventDefault();
                               (e.target as HTMLElement).setPointerCapture(e.pointerId);
                               cropDragRef.current = { type: 'move', startMouseX: e.clientX, startMouseY: e.clientY, startImgX: cm.imgX, startImgY: cm.imgY, startImgW: cm.imgW, startImgH: cm.imgH, elW: renderW, elH: renderH, k };
                             }}
                             onPointerMove={(e) => {
                               const drag = cropDragRef.current;
                               if (!drag || drag.type !== 'move') return;
                               const dx = (e.clientX - drag.startMouseX) / (totalScale * drag.elW);
                               const dy = (e.clientY - drag.startMouseY) / (totalScale * drag.elH);
                               setCropMode(prev => prev ? { ...prev, imgX: drag.startImgX + dx, imgY: drag.startImgY + dy } : null);
                             }}
                             onPointerUp={() => { cropDragRef.current = null; }}
                             sx={{ position: 'absolute', left: `${cm.imgX * 100}%`, top: `${cm.imgY * 100}%`, width: `${cm.imgW * 100}%`, height: `${cm.imgH * 100}%`, cursor: 'move', userSelect: 'none' }}
                           />
                         </Box>
                         {/* Frame border */}
                         <Box sx={{ position: 'absolute', inset: 0, border: '2px solid #007aff', pointerEvents: 'none', zIndex: 2 }} />
                         {/* Corner handles on image corners (may extend outside frame) */}
                         {(['nw', 'ne', 'sw', 'se'] as const).map(corner => {
                           const hLeft = (corner.includes('w') ? cm.imgX : cm.imgX + cm.imgW) * 100;
                           const hTop  = (corner.includes('n') ? cm.imgY : cm.imgY + cm.imgH) * 100;
                           const cur   = (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize';
                           return (
                             <Box key={corner}
                               onPointerDown={(e) => {
                                 e.stopPropagation(); e.preventDefault();
                                 (e.target as HTMLElement).setPointerCapture(e.pointerId);
                                 cropDragRef.current = { type: corner, startMouseX: e.clientX, startMouseY: e.clientY, startImgX: cm.imgX, startImgY: cm.imgY, startImgW: cm.imgW, startImgH: cm.imgH, elW: renderW, elH: renderH, k };
                               }}
                               onPointerMove={(e) => {
                                 const drag = cropDragRef.current;
                                 if (!drag || drag.type === 'move') return;
                                 const dx = (e.clientX - drag.startMouseX) / (totalScale * drag.elW);
                                 const dy = (e.clientY - drag.startMouseY) / (totalScale * drag.elH);
                                 const { startImgX: sx, startImgY: sy, startImgW: sw, startImgH: sh, k: dk } = drag;
                                 let nX = sx, nY = sy, nW = sw, nH = sh;
                                 if (drag.type === 'se') { nW = Math.max(MIN_CROP_SIZE, sw + dx); nH = nW / dk; }
                                 else if (drag.type === 'ne') { nW = Math.max(MIN_CROP_SIZE, sw + dx); nH = nW / dk; nY = (sy + sh) - nH; }
                                 else if (drag.type === 'sw') { nW = Math.max(MIN_CROP_SIZE, sw - dx); nH = nW / dk; nX = (sx + sw) - nW; }
                                 else { nW = Math.max(MIN_CROP_SIZE, sw - dx); nH = nW / dk; nX = (sx + sw) - nW; nY = (sy + sh) - nH; }
                                 setCropMode(prev => prev ? { ...prev, imgX: nX, imgY: nY, imgW: nW, imgH: nH } : null);
                               }}
                               onPointerUp={() => { cropDragRef.current = null; }}
                               sx={{ position: 'absolute', left: `${hLeft}%`, top: `${hTop}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, bgcolor: '#fff', border: '2px solid #007aff', borderRadius: '2px', cursor: cur, zIndex: 3 }}
                             />
                           );
                         })}
                         {/* Confirm / Cancel tooltip */}
                         <Box sx={{ position: 'absolute', bottom: -34, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(0,0,0,0.72)', borderRadius: 1.5, px: 1.5, py: 0.5, zIndex: 10, pointerEvents: 'auto', whiteSpace: 'nowrap' }}>
                           <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', cursor: 'pointer', '&:hover': { color: '#fff' } }}
                             onPointerDown={(e) => { e.stopPropagation(); setCropMode(null); }}>Esc — キャンセル</Typography>
                           <Box sx={{ width: 1, height: 12, bgcolor: 'rgba(255,255,255,0.25)', mx: 0.5 }} />
                           <Typography sx={{ fontSize: 11, color: '#4da0ff', fontWeight: 700, cursor: 'pointer', '&:hover': { color: '#007aff' } }}
                             onPointerDown={(e) => { e.stopPropagation(); applyCropModeRef.current(); }}>Enter — 適用</Typography>
                         </Box>
                       </Box>
                     );
                   }
                   // ── Saved crop (normal view) ─────────────────────────────────
                   if (imgData.crop) {
                     return (
                       <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', borderRadius: imgData.borderRadius || 0 }}>
                         <Box component="img" draggable={false} src={imgData.src} alt={imgData.alt || 'element'}
                           sx={{ position: 'absolute', left: `${imgData.crop.imgX * 100}%`, top: `${imgData.crop.imgY * 100}%`, width: `${imgData.crop.imgW * 100}%`, height: `${imgData.crop.imgH * 100}%`, pointerEvents: 'none' }}
                         />
                       </Box>
                     );
                   }
                   return (
                     <Box component="img" draggable={false} src={imgData.src} alt={imgData.alt || 'element'}
                       sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: imgData.borderRadius || 0, pointerEvents: 'none' }}
                     />
                   );
                 })()}
                 {el.type === 'modelCard' && (
                   <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                     <Box component="img" src={data.thumbnailUrl} sx={{ flex: 1, objectFit: 'cover' }} />
                     <Box sx={{ p: 1.5 }}>
                       <Typography variant="caption" sx={{ fontWeight: 600, color: '#1d1d1f', display: 'block' }}>{data.title}</Typography>
                       {data.subtitle && <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.7rem' }}>{data.subtitle}</Typography>}
                     </Box>
                   </Box>
                 )}
                 {el.type === 'link' && (
                   <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', p: 1, borderRadius: data.borderRadius || 1, bgcolor: data.bgcolor || 'rgba(255,255,255,0.8)', border: data.border || '1px solid #e5e5ea', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                     <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: data.color || '#007aff', textDecoration: 'underline', fontSize: data.fontSize || '14px', width: '100%', textAlign: data.textAlign || 'left', userSelect: 'none', pointerEvents: isDragging ? 'none' : 'auto' }} onPointerDown={(e) => {
                       // prevent navigating if we are just selecting or dragging
                       if (isSelected) { e.preventDefault(); }
                     }}>
                        {data.text || data.url}
                     </a>
                   </Box>
                 )}
                 {el.type === 'shape' && (
                   <Box sx={{ width: '100%', height: '100%', borderRadius: data.shapeType === 'circle' ? '50%' : (data.borderRadius || '0'), border: data.border || 'none' }} />
                 )}
                 {el.type === 'line' && (() => {
                    const angle = Math.atan2(renderH, renderW) * (180 / Math.PI);
                    const arrowScale = Math.max(1, parseInt(data.strokeWidth || '3') / 3);
                    return (
                      <svg width="1" height="1" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
                        {/* Hit Area for easier selection */}
                        <line 
                          x1="0" 
                          y1="0" 
                          x2={renderW} 
                          y2={renderH} 
                          stroke="rgba(0,0,0,0)" 
                          strokeWidth="24" 
                          strokeLinecap="round" 
                          pointerEvents="stroke"
                        />
                        {/* Visible Line */}
                        <line 
                          x1="0" 
                          y1="0" 
                          x2={renderW} 
                          y2={renderH} 
                          stroke={data.stroke || '#86868b'} 
                          strokeWidth={data.strokeWidth || '3'} 
                          strokeLinecap="round" 
                          strokeDasharray={data.strokeDasharray && data.strokeDasharray !== 'none' ? data.strokeDasharray : undefined}
                          pointerEvents="stroke"
                        />
                        {data.showArrow && (
                          <g transform={`translate(${renderW}, ${renderH}) rotate(${angle}) scale(${arrowScale})`}>
                            <path 
                              d="M 0 0 L -14 -7 L -14 7 Z" 
                              fill={data.stroke || '#86868b'} 
                            />
                          </g>
                        )}
                      </svg>
                    );
                 })()}

                 {el.type === 'drawing' && (() => {
                   const d = el.data as import('../types/dsp.types').DrawingElementData;
                   return (
                     <svg width={renderW || 1} height={renderH || 1} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
                       <path d={d.pathData} stroke={d.stroke || '#1d1d1f'} strokeWidth={d.strokeWidth || 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                     </svg>
                   );
                 })()}

                 {/* Sizing Handles (Apple-style hollow blue circles) */}
                 {isSelected && selectedElementIds.length === 1 && el.type !== 'line' && !isDragging && (
                   <>
                     <Box onPointerDown={(e) => handleResizeDown(e, 'tl', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:-6, left:-6, cursor:'nwse-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 't', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:-6, left:'calc(50% - 6px)', cursor:'ns-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'tr', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:-6, right:-6, cursor:'nesw-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'l', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:'calc(50% - 6px)', left:-6, cursor:'ew-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'r', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:'calc(50% - 6px)', right:-6, cursor:'ew-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'bl', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', bottom:-6, left:-6, cursor:'nesw-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'b', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', bottom:-6, left:'calc(50% - 6px)', cursor:'ns-resize', borderRadius: '50%', zIndex: 10 }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'br', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', bottom:-6, right:-6, cursor:'nwse-resize', borderRadius: '50%', zIndex: 10 }} />
                   </>
                 )}
                 {isSelected && el.type === 'line' && selectedElementIds.length === 1 && !isDragging && (
                   <>
                     <Box onPointerDown={(e) => handleResizeDown(e, 'start', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top:-6, left:-6, cursor:'move', borderRadius: '50%' }} />
                     <Box onPointerDown={(e) => handleResizeDown(e, 'end', el)} sx={{ position:'absolute', width:12, height:12, bgcolor:'#fff', border: '1.5px solid #007aff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', top: renderH - 6, left: renderW - 6, cursor:'move', borderRadius: '50%' }} />
                   </>
                 )}
               </Box>
             );
           })}

          {/* Live pencil stroke preview */}
          {isDrawingPencil && pencilPoints.length >= 2 && (() => {
            const xs = pencilPoints.map(p => p.x);
            const ys = pencilPoints.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const d = pencilPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`).join(' ');
            return (
              <svg style={{ position: 'absolute', left: minX, top: minY, overflow: 'visible', pointerEvents: 'none', zIndex: 9998 }} width={1} height={1}>
                <path d={d} stroke={pencilColor} strokeWidth={pencilWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            );
          })()}

          {marqueeStart && marqueeCurrent && (
             <Box sx={{
                 position: "absolute",
                 left: Math.min(marqueeStart.x, marqueeCurrent.x),
                 top: Math.min(marqueeStart.y, marqueeCurrent.y),
                 width: Math.abs(marqueeStart.x - marqueeCurrent.x),
                 height: Math.abs(marqueeStart.y - marqueeCurrent.y),
                 border: "1px solid #007aff",
                 bgcolor: "rgba(0, 122, 255, 0.1)",
                 pointerEvents: "none",
                 zIndex: 9999
             }} />
          )}

        </Box>
      </Box>
      {/* ── Scroll progress indicator ── */}
      {absProgress > 0.05 && progressDir && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(progressDir === 'bottom' ? { bottom: 12 } : { top: 12 }),
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {/* Arrow hint */}
          <Box sx={{
            fontSize: 18,
            color: 'rgba(41,182,246,0.9)',
            lineHeight: 1,
            animation: 'dsp-bounce 0.6s ease-in-out infinite alternate',
          }}>
            {progressDir === 'bottom' ? '▼' : '▲'}
          </Box>
          {/* Progress bar */}
          <Box sx={{
            width: 72,
            height: 3,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.12)',
            overflow: 'hidden',
          }}>
            <Box sx={{
              height: '100%',
              width: `${absProgress * 100}%`,
              bgcolor: '#29b6f6',
              borderRadius: 2,
              transition: 'width 0.05s linear',
            }} />
          </Box>
        </Box>
      )}

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
    </>
  );
};
