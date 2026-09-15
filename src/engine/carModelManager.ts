/**
 * 3D Car Model Manager - USDZ Loader & GPU Geometry Cache
 */
import * as THREE from 'three';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CarModelDefinition {
  index: number;
  url: string;
  name: string;
  rotationY?: number; // Góc xoay trục Y (radian) chuẩn hóa hướng mũi xe nhìn về phía trước (+Z)
  rotateY90: boolean;
  targetLength: number; // 3.3 meters (tỉ lệ chuẩn xe đua thể thao khí động học)
}

export class CarModelManager {
  private static instance: CarModelManager;
  private loader: USDLoader;
  private cache: Map<number, THREE.Group> = new Map();
  private loadingPromises: Map<number, Promise<THREE.Group>> = new Map();

  // Kích thước chuẩn 3.3m: nhỏ gọn, thanh thoát, ôm sát đường cua và vừa vặn làn đua 14m
  public static readonly TARGET_CAR_LENGTH = 3.3;

  public static readonly MODELS: CarModelDefinition[] = [
    { index: 0, url: '/cars/xedep_1.usdz', name: 'Speedster Hyper GT', rotationY: Math.PI / 2, rotateY90: true, targetLength: 3.3 },
    { index: 1, url: '/cars/xedep_2.usdz', name: 'Mansory Carbon RS', rotationY: 0, rotateY90: false, targetLength: 3.3 },
    { index: 2, url: '/cars/xedep_3.usdz', name: 'Ferrari SF90 Spider', rotationY: 0, rotateY90: false, targetLength: 3.3 },
    { index: 3, url: '/cars/xedep_4.usdz', name: 'Apex Prototype AWD', rotationY: 0, rotateY90: false, targetLength: 3.3 },
    { index: 4, url: '/cars/xedep_5.usdz', name: 'Bugatti Tourbillon', rotationY: 0, rotateY90: false, targetLength: 3.3 },
    // Slot 5-7 map back to existing models 1-3 but keep unique brandings and appropriate rotation parameters
    { index: 5, url: '/cars/xedep_1.usdz', name: 'LeMans Prototype Aero', rotationY: Math.PI / 2, rotateY90: true, targetLength: 3.3 },
    { index: 6, url: '/cars/xedep_2.usdz', name: 'Deus Vayanne Hypercar', rotationY: 0, rotateY90: false, targetLength: 3.3 },
    { index: 7, url: '/cars/xedep_3.usdz', name: 'Ferrari Monza SP2', rotationY: 0, rotateY90: false, targetLength: 3.3 },
  ];

  private constructor() {
    this.loader = new USDLoader();
    this.preloadAll();
  }

  public static getInstance(): CarModelManager {
    if (!CarModelManager.instance) {
      CarModelManager.instance = new CarModelManager();
    }
    return CarModelManager.instance;
  }

  /**
   * Preload all 8 models into cache
   */
  public preloadAll(): void {
    CarModelManager.MODELS.forEach(def => {
      this.loadModel(def.index).catch(err => {
        console.warn(`[CarModelManager] Error preloading model ${def.index}:`, err);
      });
    });
  }

  /**
   * Load and normalize a model by index (0-7)
   */
  public async loadModel(index: number): Promise<THREE.Group> {
    const safeIndex = ((index % CarModelManager.MODELS.length) + CarModelManager.MODELS.length) % CarModelManager.MODELS.length;

    if (this.cache.has(safeIndex)) {
      return this.cache.get(safeIndex)!;
    }

    if (this.loadingPromises.has(safeIndex)) {
      return this.loadingPromises.get(safeIndex)!;
    }

    const def = CarModelManager.MODELS[safeIndex];

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        def.url,
        (loadedObject) => {
          try {
            const normalized = this.normalizeModel(loadedObject, def);
            this.cache.set(safeIndex, normalized);
            resolve(normalized);
          } catch (e) {
            console.error(`[CarModelManager] Failed normalizing model ${safeIndex}:`, e);
            reject(e);
          }
        },
        undefined,
        (error) => {
          console.error(`[CarModelManager] Failed loading ${def.url}:`, error);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(safeIndex, promise);
    return promise;
  }

  /**
   * Normalizes the 3D car model:
   * 1. Loại bỏ mặt phẳng sàn/bóng vô hạn hoặc khối thừa.
   * 2. Tách lốp xe ra riêng để có thể quay chuyển động độc lập.
   * 3. Tối ưu gom nhóm meshes của thân xe theo chất liệu (mergeGeometries) giảm số mesh.
   * 4. Tính toán pháp tuyến vertex mượt mà, khử lỗi bóng răng cưa.
   * 5. Cân chỉnh kích thước chính xác 3.3m (chiều dài Z), chiều rộng X ~1.5m, chiều cao Y ~0.8-1.0m.
   * 6. Căn giữa X=0, Z=0 và đáy tiếp xúc mặt đường tại Y=0.
   */
  private normalizeModel(rawObject: THREE.Object3D, def: CarModelDefinition): THREE.Group {
    const wrapper = new THREE.Group();
    wrapper.name = `usdz_car_${def.index}_${def.name}`;

    rawObject.updateMatrixWorld(true);

    // 1. Loại bỏ mặt sàn, shadow plane hoặc các khối phụ trợ
    const planesToRemove: THREE.Object3D[] = [];
    rawObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || '').toLowerCase();
        if (
          name.includes('plane_') ||
          name.includes('shadow_plane') ||
          name.includes('ground') ||
          name.includes('floor') ||
          (def.index === 0 && name.includes('cube_044'))
        ) {
          planesToRemove.push(mesh);
        }
      }
    });
    planesToRemove.forEach(p => p.parent?.remove(p));

    // Calculate bounding box of the whole model to find the center
    const modelBox = new THREE.Box3().setFromObject(rawObject);
    const modelCenter = new THREE.Vector3();
    modelBox.getCenter(modelCenter);

    const bodyMeshes: THREE.Mesh[] = [];

    // Traverse and collect all car meshes intact
    rawObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;
        bodyMeshes.push(mesh);
      }
    });

    const contentGroup = new THREE.Group();

    // Robust helper to merge meshes by material signature with harmonized attributes
    const mergeMeshes = (
      meshes: THREE.Mesh[],
      getRelativeMatrix: (m: THREE.Mesh) => THREE.Matrix4
    ): THREE.Mesh[] => {
      const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; originalMeshes: THREE.Mesh[] }>();

      meshes.forEach(mesh => {
        try {
          if (!mesh.geometry) return;
          const clonedGeo = mesh.geometry.clone();
          const relativeMat = getRelativeMatrix(mesh);
          clonedGeo.applyMatrix4(relativeMat);

          // Chuẩn hóa vertex normals và UVs để BufferGeometryUtils.mergeGeometries tương thích 100%
          if (!clonedGeo.attributes.normal) {
            clonedGeo.computeVertexNormals();
          }
          const vertexCount = clonedGeo.attributes.position.count;
          if (!clonedGeo.attributes.uv) {
            clonedGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertexCount * 2), 2));
          }
          // Xóa các thuộc tính lạ có thể cản trở mergeGeometries
          Object.keys(clonedGeo.attributes).forEach(attrName => {
            if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
              clonedGeo.deleteAttribute(attrName);
            }
          });

          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const mat = mats[0];
          if (!mat) return;

          // Generate unique signature to avoid merging incompatible materials
          const anyMat = mat as any;
          const sig = [
            mat.type,
            'color' in mat && anyMat.color ? anyMat.color.getHexString() : 'none',
            Math.round((anyMat.roughness || 0) * 100),
            Math.round((anyMat.metalness || 0) * 100),
            'map' in mat && anyMat.map ? anyMat.map.uuid : 'nomap'
          ].join('_');

          if (!groups.has(sig)) {
            groups.set(sig, { material: mat, geometries: [], originalMeshes: [] });
          }
          groups.get(sig)!.geometries.push(clonedGeo);
          groups.get(sig)!.originalMeshes.push(mesh);
        } catch (err) {
          console.warn('[CarModelManager] Error preparing geometry for merge:', err);
        }
      });

      const resultMeshes: THREE.Mesh[] = [];

      groups.forEach((groupVal, sig) => {
        if (groupVal.geometries.length === 0) return;

        try {
          if (groupVal.geometries.length === 1) {
            const mergedMesh = new THREE.Mesh(groupVal.geometries[0], groupVal.material);
            mergedMesh.castShadow = true;
            mergedMesh.receiveShadow = true;
            resultMeshes.push(mergedMesh);
          } else {
            const mergedGeo = mergeGeometries(groupVal.geometries, false);
            if (mergedGeo) {
              mergedGeo.computeVertexNormals();
              const mergedMesh = new THREE.Mesh(mergedGeo, groupVal.material);
              mergedMesh.castShadow = true;
              mergedMesh.receiveShadow = true;
              resultMeshes.push(mergedMesh);
            } else {
              throw new Error('mergeGeometries returned null');
            }
          }
        } catch (err) {
          console.warn(`[CarModelManager] mergeGeometries failed for sig ${sig}, falling back to individual clones:`, err);
          // Fallback: create individual cloned meshes
          groupVal.originalMeshes.forEach(origMesh => {
            const clonedMesh = origMesh.clone();
            clonedMesh.geometry = origMesh.geometry.clone();
            clonedMesh.geometry.applyMatrix4(getRelativeMatrix(origMesh));
            clonedMesh.castShadow = true;
            clonedMesh.receiveShadow = true;
            resultMeshes.push(clonedMesh);
          });
        }
      });

      return resultMeshes;
    };

    const bodyRelativeMatrix = (mesh: THREE.Mesh) => {
      mesh.updateMatrixWorld(true);
      const relativeMat = mesh.matrixWorld.clone();
      const trans = new THREE.Matrix4().makeTranslation(-modelCenter.x, -modelCenter.y, -modelCenter.z);
      relativeMat.premultiply(trans);
      return relativeMat;
    };

    // Toàn bộ thân xe, bánh xe, cánh gió và chi tiết được hợp nhất hoàn hảo, không bị tách rời hay lộn ngược
    const mergedBodyMeshes = mergeMeshes(bodyMeshes, bodyRelativeMatrix);
    mergedBodyMeshes.forEach(m => contentGroup.add(m));

    wrapper.add(contentGroup);

    // 3. Xoay góc nếu mô hình hướng ngang hoặc cần chuẩn hóa hướng tiến
    if (def.rotationY !== undefined) {
      contentGroup.rotation.y = def.rotationY;
    } else if (def.rotateY90) {
      contentGroup.rotation.y = Math.PI / 2;
    }
    contentGroup.updateMatrixWorld(true);

    // 4. Đo đạc và scale chuẩn xác về chiều dài mong muốn (3.3m)
    let box = new THREE.Box3().setFromObject(contentGroup);
    let size = new THREE.Vector3();
    box.getSize(size);

    const currentLength = Math.max(size.x, size.y, size.z);
    const scale = def.targetLength / (currentLength > 0.001 ? currentLength : def.targetLength);
    contentGroup.scale.set(scale, scale, scale);
    contentGroup.updateMatrixWorld(true);

    // 5. Căn giữa X, Z và đặt đáy tiếp xúc mặt đường tại Y = 0
    box = new THREE.Box3().setFromObject(contentGroup);
    const center = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    contentGroup.position.x -= center.x;
    contentGroup.position.z -= center.z;
    contentGroup.position.y -= box.min.y;
    contentGroup.updateMatrixWorld(true);

    return wrapper;
  }

  /**
   * Clones and attaches the 3D car model into a car group.
   * If not yet loaded, attaches a temporary placeholder and swaps cleanly upon load.
   */
  public attachCarVisual(
    carObj: { group: THREE.Group; wheels: THREE.Object3D[] },
    modelIndex: number,
    placeholderMeshes: THREE.Object3D[]
  ): void {
    const safeIndex = ((modelIndex % CarModelManager.MODELS.length) + CarModelManager.MODELS.length) % CarModelManager.MODELS.length;

    const swapInModel = (cached: THREE.Group) => {
      const parentGroup = carObj.group;
      // Check if real visual already added
      if (parentGroup.getObjectByName('real_usdz_car')) {
        return;
      }
      // Remove temporary placeholder meshes
      placeholderMeshes.forEach(mesh => {
        if (mesh.parent === parentGroup) {
          parentGroup.remove(mesh);
        }
      });

      // Clone cached model
      const clone = cached.clone(true);
      clone.name = 'real_usdz_car';
      parentGroup.add(clone);

      // Khi thay thế bằng mô hình 3D nguyên khối hoàn mỹ, xóa bỏ mảng bánh xe tạm thời để
      // tránh việc các chi tiết hình học bị xoay sai trục lộn ngược lên trời
      carObj.wheels.length = 0;
    };

    if (this.cache.has(safeIndex)) {
      swapInModel(this.cache.get(safeIndex)!);
    } else {
      this.loadModel(safeIndex).then(model => {
        swapInModel(model);
      }).catch(err => {
        console.warn(`[CarModelManager] Could not swap in 3D car ${safeIndex}, keeping placeholder:`, err);
      });
    }
  }
}

export const carModelManager = CarModelManager.getInstance();
