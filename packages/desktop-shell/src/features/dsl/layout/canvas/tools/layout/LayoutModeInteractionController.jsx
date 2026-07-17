import React, { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore, useViewportEditorMode } from "../../../store/useEditorModeStore";
import { useMaterialViewStore } from "../../../store/useMaterialViewStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useLayoutTaskStore } from "../../../store/useLayoutTaskStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";
import { useLightingStore } from "../../../store/useLightingStore";
import { useUiPropertiesSelectionStore } from "../../../store/uiPropertiesSelectionStore";

export default function LayoutModeInteractionController({
  active,
  selectedItemIds,
  onChangeTransforms,
  onCommitTransforms,
  onDeleteItems,
  snapGridSize = 0.5,
  orbitRef,
  items,
}) {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const { layoutSubMode } = useViewportEditorMode();
  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const gridCellSizeMm = useEditorModeStore((s) => s.gridCellSizeMm);
  const setLayoutCameraRotationIndex = useEditorModeStore((s) => s.setLayoutCameraRotationIndex);
  const getObject = useSceneObjectRegistryStore((s) => s.getObject);
  const { camera, gl, scene, raycaster } = useThree();
  
  const dragState = useRef({
    isDragging: false,
    initialMousePos: null,
    startXzMap: new Map(), // ItemId -> initial intersection point offset
    initialPosMap: new Map(), // ItemId -> initial position
    yPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    lastUpdates: [],
  });

  // 現在押下中のキーを追跡（AR同時押し検出用）
  const pressedKeysRef = useRef(new Set());

  useEffect(() => {
    if (!active || editorMode !== "layout") {
      dragState.current.isDragging = false;
      return;
    }

    const dom = gl.domElement;
    let animationFrameId = null;

    // --- Interaction ---
    function getMouseNdc(e) {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return new THREE.Vector2(x, y);
    }

    // Attempt to start drag if we click on a selected object
    const onPointerDown = (e) => {
      if (e.button !== 0) return; // Only left click drag
      
      // Prevent LayoutModeInteractionController from dragging if the user is interacting with the Gizmo
      if (useViewportUiStore.getState().isGizmoActive()) return;

      const selectedObjArray = selectedItemIds.map(id => getObject(id)).filter(Boolean);
      if (selectedObjArray.length === 0) return;

      const ndc = getMouseNdc(e);
      raycaster.setFromCamera(ndc, camera);

      // CRITICAL FIX: Raycast against the entire scene to see if the Gizmo is in front of the object
      // Because PivotControls uses depthTest={false}, the Gizmo renders on top of everything, 
      // even if the furniture is physically closer to the camera. Thus, we must check ALL hits.
      const allHits = raycaster.intersectObjects(scene.children, true);
      let isGizmoHit = false;
      for (const hit of allHits) {
        let node = hit.object;
        while (node) {
          if (node.userData && node.userData.isGizmo) {
            isGizmoHit = true;
            break;
          }
          node = node.parent;
        }
        if (isGizmoHit) break;
      }
      
      if (isGizmoHit) return; // Let Gizmo handle it!

      // Check if we clicked on one of the selected objects (or their children)
      const intersects = raycaster.intersectObjects(selectedObjArray, true);
      
      if (intersects.length > 0) {
        // Drag starts!
        const hitPoint = intersects[0].point; // World coordinate of click
        dragState.current.isDragging = true;
        dragState.current.initialMousePos = hitPoint.clone();

        const planeY = hitPoint.y;
        dragState.current.yPlane.set(new THREE.Vector3(0, 1, 0), -planeY);

        dragState.current.startXzMap.clear();
        dragState.current.initialPosMap.clear();

        selectedObjArray.forEach(obj => {
          const id = obj.userData.itemId;
          if (id) {
            const initialPos = obj.position.clone();
            dragState.current.initialPosMap.set(id, initialPos);
            
            // Calculate vector from click point to object center
            const offset = initialPos.clone().sub(hitPoint);
            dragState.current.startXzMap.set(id, offset);
          }
        });

        // Suppress generic OrbitControls or selection routines
        e.stopPropagation();
      }
    };

    const onPointerMove = (e) => {
      if (!dragState.current.isDragging) return;
      
      // CRITICAL FIX: If Gizmo is actively being dragged, abort LayoutMode drag to prevent grid-snapping override.
      if (useViewportUiStore.getState().isGizmoActive()) {
        dragState.current.isDragging = false;
        dom.style.cursor = ""; // 指定を外す（"default" だとハンドルのホバーカーソルを塗り潰す）
        return;
      }

      e.preventDefault();

      const ndc = getMouseNdc(e);
      raycaster.setFromCamera(ndc, camera);

      const hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragState.current.yPlane, hit);

      if (hit) {
        dom.style.cursor = "move"; // 手（grabbing）は使わない
        
        const updates = [];
        Array.from(dragState.current.startXzMap.entries()).forEach(([id, offset]) => {
          const initialPos = dragState.current.initialPosMap.get(id);
          // New position mathematically
          const targetX = hit.x + offset.x;
          const targetZ = hit.z + offset.z;
          
          // Snap to grid only if visible
          const activeSnapSize = gridCellSizeMm;
          const snappedX = isGridVisible ? Math.round(targetX / activeSnapSize) * activeSnapSize : targetX;
          const snappedZ = isGridVisible ? Math.round(targetZ / activeSnapSize) * activeSnapSize : targetZ;

          updates.push({
            itemId: id,
            transform: { position: [snappedX, initialPos.y, snappedZ] },
          });
        });

        if (updates.length > 0 && typeof onChangeTransforms === "function") {
          dragState.current.lastUpdates = updates;
          onChangeTransforms(updates);
        }
      }
    };

    const onPointerUp = (e) => {
      if (!dragState.current.isDragging) return;
      dragState.current.isDragging = false;
      dom.style.cursor = ""; // 指定を外す（"default" だとハンドルのホバーカーソルを塗り潰す）
      
      if (typeof onCommitTransforms === "function" && dragState.current.lastUpdates.length > 0) {
         onCommitTransforms(dragState.current.lastUpdates);
      }
      dragState.current.lastUpdates = [];
    };

    // --- Key events for R-rotation and Snapping ---
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    };

    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === "delete" || key === "backspace") {
        if (selectedItemIds.length > 0 && typeof onDeleteItems === "function") {
          onDeleteItems(selectedItemIds);
        } else {
          // 1) ライトが選択されていれば削除する（hemisphere = Ambience は環境光なので除外）
          const sel = useUiPropertiesSelectionStore.getState().selection;
          if (sel?.kind === "light" && sel.lightId) {
            const lights = useLightingStore.getState().lights;
            const target = lights.find((l) => l.id === sel.lightId);
            if (target && target.type !== "hemisphere") {
              useLightingStore.getState().removeLight(sel.lightId);
              useUiPropertiesSelectionStore.getState().clearSelection?.();
              return;
            }
          }
          // 2) アクティブな zone を削除
          const activeZoneId = useLayoutTaskStore.getState().activeZoneId;
          if (activeZoneId) {
            window.dispatchEvent(
              new CustomEvent("LayoutShell:DeleteZone", {
                detail: { id: activeZoneId }
              })
            );
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === "c") {
        const activeZoneId = useLayoutTaskStore.getState().activeZoneId;
        if (activeZoneId) {
           const zone = useLayoutTaskStore.getState().zones.find(z => z.id === activeZoneId);
           if (zone) useLayoutTaskStore.getState().setZoneClipboard(zone);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === "v") {
        const cbZone = useLayoutTaskStore.getState().zoneClipboard;
        if (cbZone && cbZone.rect) {
          // Paste with 500mm offset
          const clonedRect = { ...cbZone.rect, x: cbZone.rect.x + 500, z: cbZone.rect.z + 500 };
          const newZone = {
            ...cbZone,
            id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            name: `${cbZone.name} (Copy)`,
            rect: clonedRect,
          };
          const currentZones = useLayoutTaskStore.getState().zones;
          window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", {
             detail: { zones: [...currentZones, newZone] }
          }));
          useLayoutTaskStore.getState().setActiveZoneId(newZone.id);
        }
        return;
      }

      // Diagonal view switching via Arrow keys (only if no items are selected)。
      // Material 一人称（見渡し）中は MaterialLookController が矢印キーで視線を90度回すため、
      // ここでのオービット回転は無効化する（カメラの取り合いで面選択が壊れるのを防ぐ）。
      if ((key === "arrowright" || key === "arrowleft" || key === "arrowup" || key === "arrowdown")
          && layoutSubMode === "furniture_iso" && !useMaterialViewStore.getState().firstPerson) {
        if (selectedItemIds.length === 0) {
          const store = useEditorModeStore.getState();
          
          if (orbitRef?.current && (key === "arrowright" || key === "arrowleft")) {
            // ==========================================
            // CRITICAL FIX FOR PIVOT DRIFT
            // ==========================================
            const camPos = camera.position;
            const target = orbitRef.current.target;
            
            if (Math.abs(target.y) > 0.1) {
              const camDir = new THREE.Vector3().subVectors(target, camPos).normalize();
              const floorY = 0; 
              
              if (Math.abs(camDir.y) > 0.01) {
                const distanceToFloor = (floorY - camPos.y) / camDir.y;
                if (distanceToFloor > 0) {
                  const newTarget = camPos.clone().add(camDir.multiplyScalar(distanceToFloor));
                  orbitRef.current.target.copy(newTarget);
                  orbitRef.current.update();
                }
              }
            }

            const pivot = orbitRef.current.target.clone();
            const offset = camera.position.clone().sub(pivot);

            // Execute simple 90 degree orbit rotation when pressing left/right
            if (key === "arrowright" || key === "arrowleft") {
              if (animationFrameId !== null) return; // Prevent concurrent animations from causing weird angles
              
              const orbit = orbitRef.current;
              const startUp = camera.up.clone();
              const isTopView = Math.abs(startUp.y) < 0.5;

              // Setup ISO View (Azimuthal) targets
              const startAngle = orbit.getAzimuthalAngle();
              const targetAngle = startAngle + (key === "arrowright" ? -Math.PI / 2 : Math.PI / 2);
              const startPos = camera.position.clone();
              const radius = startPos.distanceTo(pivot);
              const polar = orbit.getPolarAngle();
              
              // Setup Top View (Up Vector) targets
              const upDirection = key === "arrowright" ? Math.PI / 2 : -Math.PI / 2;
              const targetUp = startUp.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), upDirection);

              const startTime = performance.now();
              const duration = 250;
              
              const animateRotation = () => {
                const now = performance.now();
                const t = Math.min(1, (now - startTime) / duration);
                const f = t - 1;
                const easeTime = f * f * f + 1; // cubic ease out
                
                if (isTopView) {
                  // In Top View, camera is looking straight down. Only rotate the Up vector.
                  camera.up.copy(startUp).lerp(targetUp, easeTime).normalize();
                } else {
                  // In ISO View, rotate the camera position around the target.
                  const angle = startAngle + (targetAngle - startAngle) * easeTime;
                  const x = pivot.x + radius * Math.sin(polar) * Math.sin(angle);
                  const z = pivot.z + radius * Math.sin(polar) * Math.cos(angle);
                  const y = pivot.y + radius * Math.cos(polar);
                  camera.position.set(x, y, z);
                }
                
                orbit.update();
                
                if (t < 1) {
                  animationFrameId = requestAnimationFrame(animateRotation);
                } else {
                  animationFrameId = null;
                }
              };
              animationFrameId = requestAnimationFrame(animateRotation);
            }
          }

          // Handle UI state updates and Vertical Tilt Transitions (Top/Ceiling)
          // setLayoutCameraRotationIndex は「増分」を受け取る（内部で現在値に加算）。
          //   右=−1 / 左=+1 で 0↔1↔2↔3 を巡回。以前は現在値そのものを渡していたため
          //   index が {0,1,3} しか取れず（2=南が不達）、方位針が N/E だけになっていた。
          if (key === "arrowright") store.setLayoutCameraRotationIndex(-1);
          else if (key === "arrowleft") store.setLayoutCameraRotationIndex(1);
          else if (key === "arrowup" || key === "arrowdown") {
            const currentTilt = store.layoutCameraTilt;
            const nextTilt = key === "arrowup" 
              ? (currentTilt === "ceiling" ? "default" : "ceiling") 
              : (currentTilt === "top" ? "default" : "top");
              
            store.setLayoutCameraTilt(nextTilt);
          }
          
          e.preventDefault();
          return;
        }
      }

      // 押下中キーを記録（AR同時押し検出用）
      pressedKeysRef.current.add(key);

      if (selectedItemIds.length === 0) return;

      // R キーによる回転は廃止（ユーザー要望）。
      // 実際のキーボード入力（isTrusted）のみ無効化し、ツールバーの
      // 回転ボタンが発火する合成イベント（isTrusted=false）は通す。
      if (key === "r" && e.isTrusted) return;

      if (key === "r") {
        // R 単体 or Shift+R のみ回転。A が同時押しされている場合（AR = 右揃えなど）はスキップ
        if (pressedKeysRef.current.has("a")) return;
        // Ctrl/Meta/Alt との組み合わせも無視
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const store = useEditorModeStore.getState();
        const rotateStepRad = (store.rotateStepDeg * Math.PI) / 180;
        const objs = selectedItemIds.map(id => getObject(id)).filter(Boolean);
        const updates = [];

        // R → 時計回り（+1ステップ）、Shift+R → 反時計回り（-1ステップ）
        const direction = e.shiftKey ? -1 : 1;

        objs.forEach(obj => {
          // Parse using YXZ because ZYX restricts the middle axis (Y) to [-90, 90], causing 2-pattern clipping.
          const eulerYXZ = new THREE.Euler().setFromQuaternion(obj.quaternion, "YXZ");
          
          // Current angle in radians
          let currentY = eulerYXZ.y;
          
          // Calculate the exact step count it's currently closest to
          let stepCount = Math.round(currentY / rotateStepRad);
          
          // Move by one step in the specified direction
          stepCount += direction;
          
          // Apply snapped Y rotation safely
          eulerYXZ.y = stepCount * rotateStepRad;
          
          // Convert back to ZYX via quaternion so the rest of the system interprets [x,y,z] correctly
          const finalQuat = new THREE.Quaternion().setFromEuler(eulerYXZ);
          const finalEulZYX = new THREE.Euler().setFromQuaternion(finalQuat, "ZYX");
          
          updates.push({
            itemId: obj.userData.itemId,
            transform: { rotation: [finalEulZYX.x, finalEulZYX.y, finalEulZYX.z] }
          });
        });

        if (updates.length > 0 && typeof onChangeTransforms === "function") {
          onChangeTransforms(updates);
          // Auto-commit rotation
          setTimeout(() => {
            if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          }, 50);
        }
      } else if (key === "pagedown" || key === "pageup") {
        const objs = selectedItemIds.map(id => getObject(id)).filter(Boolean);
        const updates = [];
        
        const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
        const snapRaycaster = new THREE.Raycaster();

        objs.forEach(obj => {
          const targetObj = obj.getObjectByName("gltf-scene") || obj;
          const box = new THREE.Box3().setFromObject(targetObj);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const currentY = obj.position.y;
          
          if (key === "pagedown") {
            // Snap to Floor using Raycast
            let targetY = 0;
            if (colliders.length > 0) {
              snapRaycaster.set(new THREE.Vector3(center.x, box.min.y + 0.1, center.z), new THREE.Vector3(0, -1, 0));
              const intersects = snapRaycaster.intersectObjects(colliders, true);
              if (intersects.length > 0) {
                targetY = intersects[0].point.y;
              }
            }
            const offsetToBottom = currentY - box.min.y;
            updates.push({
              itemId: obj.userData.itemId,
              transform: { position: [obj.position.x, targetY + offsetToBottom, obj.position.z] }
            });
          } else if (key === "pageup") {
            // Snap to Ceiling using Raycast
            let targetY = 2700;
            if (colliders.length > 0) {
              snapRaycaster.set(new THREE.Vector3(center.x, box.max.y - 0.1, center.z), new THREE.Vector3(0, 1, 0));
              const intersects = snapRaycaster.intersectObjects(colliders, true);
              if (intersects.length > 0) {
                targetY = intersects[0].point.y;
              }
            }
            const offsetToTop = box.max.y - currentY;
            updates.push({
              itemId: obj.userData.itemId,
              transform: { position: [obj.position.x, targetY - offsetToTop, obj.position.z] }
            });
          }
        });

        if (updates.length > 0 && typeof onChangeTransforms === "function") {
          onChangeTransforms(updates);
          setTimeout(() => {
            if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          }, 50);
        }
        e.preventDefault();
      } else if (key === "end") {
        // Snap to Object — 直下のオブジェクト上面に底面を合わせる
        const objs = selectedItemIds.map(id => getObject(id)).filter(Boolean);
        const allObjects = useSceneObjectRegistryStore.getState().getAllObjects();
        const updates = [];
        const snapRaycaster = new THREE.Raycaster();

        objs.forEach(obj => {
          const otherObjects = allObjects.filter((o) => o !== obj);
          if (otherObjects.length === 0) return;

          const targetObj = obj.getObjectByName("gltf-scene") || obj;
          const box = new THREE.Box3().setFromObject(targetObj);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const currentY = obj.position.y;

          snapRaycaster.set(new THREE.Vector3(center.x, 5000, center.z), new THREE.Vector3(0, -1, 0));
          const intersects = snapRaycaster.intersectObjects(otherObjects, true);
          const hit = intersects.find((i) => i.point.y <= box.min.y + 1);
          if (!hit) return;

          const offsetToBottom = currentY - box.min.y;
          updates.push({
            itemId: obj.userData.itemId,
            transform: { position: [obj.position.x, hit.point.y + offsetToBottom, obj.position.z] }
          });
        });

        if (updates.length > 0 && typeof onChangeTransforms === "function") {
          onChangeTransforms(updates);
          setTimeout(() => {
            if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          }, 50);
        }
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };

    const onWindowBlur = () => {
      // フォーカスが外れたときに押下状態をリセット（Alt+Tab など）
      pressedKeysRef.current.clear();
    };

    // Bind event listeners
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      pressedKeysRef.current.clear();
      dom.style.cursor = ""; // 指定を外す（"default" だとハンドルのホバーカーソルを塗り潰す）
    };
  }, [active, editorMode, selectedItemIds, getObject, camera, gl, raycaster, onChangeTransforms, onCommitTransforms, gridCellSizeMm, isGridVisible]);

  return null;
}
