import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import ThreeDMLoader from '../../../../lib/ThreeDMLoader.js';
import { convertFileSrc } from '@tauri-apps/api/core';

const sanitizeMaterials = (object) => {
  let sanitizedCount = 0;
  const mapTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];

  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const processMaterial = (mat) => {
        let matModified = false;
        mapTypes.forEach(mapName => {
          if (mat[mapName]) {
            const img = mat[mapName].image;
            let isValid = false;
            
            // Validate the image object inside the texture
            if (img) {
               if (img.width > 0 && img.height > 0) {
                 isValid = true;
               } else if (img.data && img.data.length > 0) {
                 isValid = true;
               } else if (img instanceof ImageBitmap || img instanceof HTMLCanvasElement || img instanceof HTMLImageElement) {
                 // Even if width/height is 0 (unloaded), it's a valid object type that might just not be ready.
                 // However, GLTFExporter usually fails if width/height is 0, so let's be strict:
                 if (img.width !== 0 && img.height !== 0) {
                     isValid = true;
                 }
               }
            }

            if (!isValid) {
              console.warn(`[convert3dmToGlb] Removing invalid/empty ${mapName} from material: ${mat.name || 'unnamed'} (Mesh: ${child.name || 'unnamed'})`);
              if (typeof mat[mapName].dispose === 'function') mat[mapName].dispose();
              mat[mapName] = null;
              matModified = true;
            }
          }
        });
        if (matModified) {
          mat.needsUpdate = true;
          sanitizedCount++;
        }
      };

      if (Array.isArray(child.material)) {
        child.material.forEach(processMaterial);
      } else {
        processMaterial(child.material);
      }
    }
  });

  if (sanitizedCount > 0) {
    console.log(`[convert3dmToGlb] Sanitized textures in ${sanitizedCount} materials.`);
  }
};

const applyFallbackMaterials = (object) => {
  let fallbackCount = 0;
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const createFallback = (mat) => {
        const color = mat.color ? mat.color.clone() : new THREE.Color(0xcccccc);
        fallbackCount++;
        return new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.2,
          name: mat.name ? `${mat.name}_fallback` : 'fallback_material'
        });
      };

      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose && m.dispose());
        child.material = child.material.map(createFallback);
      } else {
        if (child.material.dispose) child.material.dispose();
        child.material = createFallback(child.material);
      }
    }
  });
  console.warn(`[convert3dmToGlb] Applied geometry-safe fallback materials to ${fallbackCount} meshes.`);
};



export const convert3dmToGlb = async (file) => {
  return new Promise(async (resolve, reject) => {
    try {
      // window.rhino3dm() is assumed to be loaded via a script tag in index.html
      const rhino = typeof window.rhino3dm === 'function' ? await window.rhino3dm() : null;
      if (!rhino) {
        throw new Error('rhino3dm is not available on the window object.');
      }
      
      const reader = new FileReader();

      // Log file properties to see if Tauri provides the path
      console.log('[convert3dmToGlb] Received file:', file.name, 'path:', file.path);

      reader.onload = function (e) {
        const buffer = e.target.result;

        const urlModifier = (url) => {
          console.log('[ThreeDMLoader] Attempting to resolve URL:', url);
          
          if (url.endsWith('.wasm') || url.startsWith('/lib/rhino3dm/')) {
            return url;
          }

          let finalUrl = url;

          // 1. If it's a relative path and we have the original file path from Tauri
          if (!url.match(/^[a-zA-Z]:[\\/]/) && !url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('data:') && file.path) {
            // file.path is e.g. "C:\\Users\\sekkeiya\\Desktop\\model.3dm"
            const lastSlash = Math.max(file.path.lastIndexOf('\\'), file.path.lastIndexOf('/'));
            if (lastSlash !== -1) {
              const baseDir = file.path.substring(0, lastSlash + 1);
              finalUrl = baseDir + url; // "C:\\Users\\sekkeiya\\Desktop\\texture.jpg"
              console.log('[ThreeDMLoader] Resolved relative path to:', finalUrl);
            }
          }

          // 2. If the URL is a local Windows path (e.g. C:\\... or C:/...)
          if (finalUrl.match(/^[a-zA-Z]:[\\/]/)) {
             // Instead of using assetProtocol (which causes CORS/Tainted canvas issues during GLTF Export),
             // we return a custom prefix. We will intercept ImageLoader to read it manually.
             return 'tauri-local:' + finalUrl;
          }
          return finalUrl;
        };

        const manager = new THREE.LoadingManager();
        manager.setURLModifier(urlModifier);

        // --- FIX FOR THREE.JS BUG ---
        const originalDefaultResolveURL = THREE.DefaultLoadingManager.resolveURL;
        const originalDefaultURLModifier = THREE.DefaultLoadingManager.urlModifier;
        THREE.DefaultLoadingManager.setURLModifier(urlModifier);
        // ------------------------------

        let localItemsLoaded = 0;
        let localItemsTotal = 0;
        let isLocalLoading = false;
        manager.onStart = (url, loaded, total) => {
            console.log(`[LocalManager] onStart: ${url} (${loaded}/${total})`);
            isLocalLoading = true;
            localItemsLoaded = loaded;
            localItemsTotal = total;
        };
        manager.onProgress = (url, loaded, total) => {
            console.log(`[LocalManager] onProgress: ${url} (${loaded}/${total})`);
            isLocalLoading = true;
            localItemsLoaded = loaded;
            localItemsTotal = total;
        };

        let globalItemsLoaded = 0;
        let globalItemsTotal = 0;
        let isGlobalLoading = false;
        const oldDefaultOnStart = THREE.DefaultLoadingManager.onStart;
        const oldDefaultOnProgress = THREE.DefaultLoadingManager.onProgress;
        const oldDefaultOnLoad = THREE.DefaultLoadingManager.onLoad;
        const oldDefaultOnError = THREE.DefaultLoadingManager.onError;

        THREE.DefaultLoadingManager.onStart = (url, loaded, total) => {
            console.log(`[GlobalManager] onStart: ${url} (${loaded}/${total})`);
            isGlobalLoading = true;
            globalItemsLoaded = loaded;
            globalItemsTotal = total;
            if (oldDefaultOnStart) oldDefaultOnStart(url, loaded, total);
        };
        THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
            console.log(`[GlobalManager] onProgress: ${url} (${loaded}/${total})`);
            isGlobalLoading = true;
            globalItemsLoaded = loaded;
            globalItemsTotal = total;
            if (oldDefaultOnProgress) oldDefaultOnProgress(url, loaded, total);
        };

        // --- INTERCEPT IMAGELOADER TO BYPASS CORS & TAINTED CANVAS ---
        const originalImageLoaderLoad = THREE.ImageLoader.prototype.load;
        THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
          if (url && url.startsWith('tauri-local:')) {
            const filePath = url.replace('tauri-local:', '');
            console.log('[ImageLoader] Intercepted local file load:', filePath);
            
            const image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
            const mgr = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
            mgr.itemStart(url);
            
            import('@tauri-apps/plugin-fs').then(({ readFile }) => {
              const normalizedPath = filePath.replace(/\\/g, '/');
              return readFile(normalizedPath);
            }).then((uint8) => {
              let mime = 'image/png';
              if (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')) mime = 'image/jpeg';
              const blob = new Blob([uint8], { type: mime });
              const blobUrl = URL.createObjectURL(blob);
              
              image.onload = () => {
                 URL.revokeObjectURL(blobUrl);
                 if (onLoad) onLoad(image);
                 mgr.itemEnd(url);
              };
              image.onerror = (err) => {
                 URL.revokeObjectURL(blobUrl);
                 mgr.itemError(url);
                 if (onError) onError(err);
              };
              image.src = blobUrl;
            }).catch((err) => {
              console.error("[ImageLoader] Failed to read local file via Tauri plugin-fs:", filePath, err);
              mgr.itemError(url);
              if (onError) onError(err);
            });
            
            return image;
          }
          return originalImageLoaderLoad.apply(this, arguments);
        };
        // -------------------------------------------------------------


        const loader = new ThreeDMLoader(manager);
        const base = import.meta.env.BASE_URL || "/";
        loader.setLibraryPath(`${base.endsWith('/') ? base : base + '/'}lib/rhino3dm/`);
        loader.setRhino3dm(rhino);

        loader.parse(
          buffer,
          async function (object) {
            try {
              // Center the object based strictly on Meshes
              const box = new THREE.Box3();
              let hasGeometry = false;
              object.updateMatrixWorld(true);
              object.traverse((child) => {
                if ((child.isMesh || child.isLine || child.isLineSegments || child.isPoints) && child.geometry) {
                  child.geometry.computeBoundingBox();
                  if (child.geometry.boundingBox) {
                    const childBox = new THREE.Box3().copy(child.geometry.boundingBox);
                    childBox.applyMatrix4(child.matrixWorld);
                    if (!childBox.isEmpty() && isFinite(childBox.min.x) && childBox.min.x > -1e10) {
                      box.union(childBox);
                      hasGeometry = true;
                    }
                  }
                }
              });

              if (!hasGeometry) {
                box.setFromObject(object);
              }

              if (!box.isEmpty()) {
                const center = box.getCenter(new THREE.Vector3());
                if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z) && Math.abs(center.x) < 1e10) {
                  object.position.sub(center);
                }
              }
              
              // Rhino objects are typically Z-up, Three.js is Y-up.
              object.rotateX(-Math.PI / 2);
              object.updateMatrixWorld(true);

              const processAndExport = () => {
                // 1. Sanitize materials by removing invalid textures
                sanitizeMaterials(object);

                const exportObject = (obj) => {
                  return new Promise((res, rej) => {
                    const exporter = new GLTFExporter();
                    exporter.parse(
                      obj,
                      function (gltf) {
                        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                        const fileName = file.name.replace(/\.3dm$/i, '.glb');
                        const glbFile = new File([blob], fileName, { type: 'model/gltf-binary' });
                        res(glbFile);
                      },
                      function (error) {
                        rej(error);
                      },
                      { binary: true }
                    );
                  });
                };

                // First attempt: Export after texture sanitization
                exportObject(object).then((glbFile) => {
                  console.log("[convert3dmToGlb] GLB generation successful on first try.");
                  resolve(glbFile);
                }).catch((error) => {
                  console.warn("[convert3dmToGlb] First export attempt failed with error:", error.message || error);
                  
                  // 2. Second fallback: Discard original materials completely, just keep geometry shapes
                  try {
                    applyFallbackMaterials(object);
                    
                    // Second attempt: Export with fallback materials
                    exportObject(object).then((fallbackGlbFile) => {
                      console.log("[convert3dmToGlb] GLB generation successful using fallback geometry-safe materials.");
                      resolve(fallbackGlbFile);
                    }).catch((fallbackError) => {
                      console.error("[convert3dmToGlb] Final export fallback also failed:", fallbackError);
                      reject(fallbackError);
                    });
                  } catch (fallbackApplyErr) {
                     console.error("[convert3dmToGlb] Failed to apply fallback materials:", fallbackApplyErr);
                     reject(error); // Reject with original error if fallback logic fails
                  }
                });
              };

              let textureDebug = [];
              let hasExported = false;

              const tryExport = () => {
                 if (hasExported) return;
                 hasExported = true;
                 
                 // Restore global DefaultLoadingManager state
                 THREE.DefaultLoadingManager.resolveURL = originalDefaultResolveURL;
                 THREE.DefaultLoadingManager.onError = oldDefaultOnError;
                 THREE.DefaultLoadingManager.onLoad = oldDefaultOnLoad;
                 THREE.DefaultLoadingManager.onStart = oldDefaultOnStart;
                 THREE.DefaultLoadingManager.onProgress = oldDefaultOnProgress;
                 THREE.DefaultLoadingManager.urlModifier = originalDefaultURLModifier;
                 THREE.ImageLoader.prototype.load = originalImageLoaderLoad;

                 if (textureDebug.length > 0) {
                   console.warn("Texture paths that failed:\n" + textureDebug.join('\n'));
                 }
                 
                 processAndExport();
              };

              THREE.DefaultLoadingManager.onError = (url) => {
                  console.warn(`[convert3dmToGlb] DefaultLoadingManager Error loading texture: ${url}`);
                  textureDebug.push(url);
                  if (oldDefaultOnError) oldDefaultOnError(url);
              };

              const checkAndExport = () => {
                  console.log(`[convert3dmToGlb] CHECKING MANAGERS BEFORE EXPORT:
                    Local: isLoading=${isLocalLoading}, ${localItemsLoaded}/${localItemsTotal}
                    Global: isLoading=${isGlobalLoading}, ${globalItemsLoaded}/${globalItemsTotal}
                  `);

                  const isLocalFinished = !isLocalLoading || (localItemsTotal > 0 && localItemsLoaded >= localItemsTotal);
                  const isGlobalFinished = !isGlobalLoading || (globalItemsTotal > 0 && globalItemsLoaded >= globalItemsTotal);

                  if (!isLocalFinished) {
                      console.log(`[convert3dmToGlb] Waiting for local manager...`);
                      manager.onLoad = () => {
                          console.log(`[convert3dmToGlb] Local manager loaded!`);
                          checkAndExport();
                      };
                      return;
                  }

                  if (!isGlobalFinished) {
                      console.log(`[convert3dmToGlb] Waiting for global manager...`);
                      THREE.DefaultLoadingManager.onLoad = () => {
                          console.log(`[convert3dmToGlb] Global manager loaded!`);
                          if (oldDefaultOnLoad) oldDefaultOnLoad();
                          checkAndExport();
                      };
                      return;
                  }

                  // Both are finished
                  tryExport();
              };

              // Start the check
              checkAndExport();

            } catch (err) {
              console.error("[convert3dmToGlb] Setup for export failed:", err);
              // Ensure we restore globals on error
              THREE.DefaultLoadingManager.resolveURL = originalDefaultResolveURL;
              THREE.DefaultLoadingManager.onError = oldDefaultOnError;
              THREE.DefaultLoadingManager.onLoad = oldDefaultOnLoad;
              THREE.DefaultLoadingManager.onStart = oldDefaultOnStart;
              THREE.DefaultLoadingManager.onProgress = oldDefaultOnProgress;
              THREE.DefaultLoadingManager.urlModifier = originalDefaultURLModifier;
              THREE.ImageLoader.prototype.load = originalImageLoaderLoad;
              reject(err);
            }
          },
          function (error) {
            console.error("[convert3dmToGlb] ThreeDMLoader Error:", error);
            // Ensure we restore globals on error
            if (typeof originalDefaultResolveURL !== 'undefined') {
              THREE.DefaultLoadingManager.resolveURL = originalDefaultResolveURL;
            }
            if (typeof originalImageLoaderLoad !== 'undefined') {
              THREE.ImageLoader.prototype.load = originalImageLoaderLoad;
            }
            reject(error);
          }
        );
      };

      reader.onerror = (err) => {
        reject(err);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(err);
    }
  });
};
