import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

type LayoutType = 'wall' | 'shelf' | 'box';

interface MedicineEntry {
  name: string;
  qty: number;
}

interface MedicineCatalogEntry {
  name: string;
  category?: string;
}

interface ProductCatalogItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
}

interface LayoutItem {
  id: string;
  type: LayoutType;
  color: string;
  name?: string;
  medicines?: MedicineEntry[];
  capacity?: number;
  minStock?: number;
  maxStock?: number;
  tag?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

interface LayoutPreset {
  id: string;
  name: string;
  items: LayoutItem[];
}

interface PicklistItem {
  id: string;
  name: string;
  qty: number;
  status: 'pending' | 'picked';
  applied?: boolean;
  tag?: string;
  boxIds: string[];
}

@Component({
  selector: 'app-visual-space-mapper',
  templateUrl: './visual-space-mapper.component.html',
  styleUrls: ['./visual-space-mapper.component.scss']
})
export class VisualSpaceMapperComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sceneCanvas') sceneCanvasRef!: ElementRef<HTMLCanvasElement>;

  mode: 'drawWall' | 'drawShelf' | 'drawBox' | 'select' | 'delete' = 'select';
  transformMode: 'translate' | 'rotate' | 'scale' = 'translate';

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private transformControls!: TransformControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private floorMesh: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private previewMesh: THREE.Mesh | null = null;
  private drawStart = new THREE.Vector3();
  private drawActive = false;
  private drawTarget: { mesh: THREE.Mesh; type: LayoutType } | null = null;
  private wallDrawStartY = 0;
  private wallDrawHeight = 0;

  private layoutItems: LayoutItem[] = [];
  private layoutMap = new Map<string, LayoutItem>();
  private wallMeshes = new Map<string, THREE.Mesh>();
  private shelfMeshes = new Map<string, THREE.Mesh>();
  private boxMeshes = new Map<string, THREE.Mesh>();
  private boxLabels = new Map<string, THREE.Object3D>();
  private tagFlags = new Map<string, THREE.Object3D>();
  private selectedMesh: THREE.Mesh | null = null;
  private shelfCapacityBadges = new Map<string, THREE.Mesh>();
  shelfCapacityEnabled = false;
  zonePickerEnabled = false;
  activeZoneTag: string | null = null;
  selectedBoxIds: string[] = [];
  batchLabelOpen = false;
  batchLabelForm = {
    prefix: 'A',
    start: 1,
    tag: ''
  };
  contextMenu = {
    visible: false,
    x: 0,
    y: 0,
    boxId: '' as string | null
  };
  medicinePopup = {
    visible: false,
    boxName: '',
    medicines: [] as MedicineEntry[],
    capacity: 0,
    boxId: '' as string | null
  };
  medicineForm = {
    name: '',
    capacity: 0,
    minStock: 0,
    maxStock: 0,
    tag: '',
    medicineName: '',
    quantity: 1,
    mode: 'deposit' as 'deposit' | 'withdraw'
  };
  picklistOpen = false;
  picklistSearch = '';
  picklistItems: PicklistItem[] = [];
  picklistActive = false;
  picklistCurrentId: string | null = null;
  pickQtyMap: Record<number, number> = {};
  productCatalog: ProductCatalogItem[] = [];
  auditOpen = false;
  auditTargetName = 'No shelf selected';
  auditTargetIds: string[] = [];
  auditInput = '';
  auditResults: Array<{ name: string; expected: number; scanned: number; diff: number; status: 'match' | 'missing' | 'extra' }> = [];
  auditSummary = {
    matched: 0,
    missing: 0,
    extra: 0
  };
  auditReport = '';
  restockOpen = false;
  restockItems: Array<{
    id: string;
    name: string;
    tag: string;
    total: number;
    min: number;
    max: number;
    suggested: number;
    medicines: string[];
  }> = [];
  restockSummary = {
    lowBoxes: 0,
    totalSuggested: 0
  };
  restockSelections: Record<string, string> = {};
  heatmapEnabled = false;

  private animationFrameId: number | null = null;
  private storageKey = 'buildaq_pharmacy_layout_v2';
  private productStorageKey = 'buildaq_pharmacy_products';
  private picklistStorageKey = 'buildaq_pharmacy_picklist';
  private wallHeight = 3;
  private wallThickness = 0.1;
  private shelfDepth = 0.5;
  private boxDepth = 0.2;
  wallColor = '#6b7280';
  shelfColor = '#475569';
  boxColor = '#1f2937';
  presets: LayoutPreset[] = [];
  selectedPresetId = '';
  private medicineCatalog: MedicineCatalogEntry[] | null = null;
  private layoutUpdatedHandler = () => this.reloadLayoutFromStorage();
  private productsUpdatedHandler = () => this.reloadLayoutFromStorage();

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.presets = this.buildPresets();
    this.loadLayout();
    window.addEventListener('buildaq-layout-updated', this.layoutUpdatedHandler);
    window.addEventListener('buildaq-products-updated', this.productsUpdatedHandler);
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
    setTimeout(() => this.onResize(), 0);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer?.dispose();
    this.controls?.dispose();
    this.transformControls?.dispose();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDownHandler);
    window.removeEventListener('click', this.onWindowClick);
    window.removeEventListener('buildaq-layout-updated', this.layoutUpdatedHandler);
    window.removeEventListener('buildaq-products-updated', this.productsUpdatedHandler);
  }

  setMode(mode: 'drawWall' | 'drawShelf' | 'drawBox' | 'select' | 'delete'): void {
    this.mode = mode;
    this.detachTransform();
  }

  toggleZonePicker(): void {
    this.zonePickerEnabled = !this.zonePickerEnabled;
    if (!this.zonePickerEnabled) {
      this.clearZoneFilter();
    }
  }

  clearZoneFilter(): void {
    this.activeZoneTag = null;
    this.applyZoneFilter();
  }

  openBatchLabel(): void {
    if (!this.selectedBoxIds.length) {
      this.snackBar.open('Select boxes first (Shift+Click)', 'Close', { duration: 2000 });
      return;
    }
    this.batchLabelOpen = true;
  }

  closeBatchLabel(): void {
    this.batchLabelOpen = false;
  }

  applyBatchLabel(): void {
    if (!this.selectedBoxIds.length) return;
    const prefix = (this.batchLabelForm.prefix || 'A').trim().toUpperCase();
    const start = Number(this.batchLabelForm.start);
    const startIndex = Number.isFinite(start) && start > 0 ? start : 1;
    const tag = this.batchLabelForm.tag.trim();

    const selectedItems = this.selectedBoxIds
      .map(id => this.layoutMap.get(id))
      .filter((item): item is LayoutItem => item !== undefined && item.type === 'box')
      .sort((a, b) => {
        if (a.position.y !== b.position.y) return b.position.y - a.position.y;
        if (a.position.z !== b.position.z) return a.position.z - b.position.z;
        return a.position.x - b.position.x;
      });

    selectedItems.forEach((item, index) => {
      item.name = `${prefix}${startIndex + index}`;
      if (tag) {
        item.tag = tag;
      }
      this.updateBoxLabel(item.id);
    });
    this.saveLayout();
    this.batchLabelOpen = false;
  }

  setTransformMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.transformMode = mode;
    this.transformControls?.setMode(mode);
  }

  clearLayout(): void {
    this.layoutItems = [];
    this.layoutMap.clear();
    this.wallMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.shelfMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.boxMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.boxLabels.forEach(label => this.disposeObject(label));
    this.tagFlags.forEach(flag => this.disposeObject(flag));
    this.wallMeshes.clear();
    this.shelfMeshes.clear();
    this.boxMeshes.clear();
    this.boxLabels.clear();
    this.tagFlags.clear();
    this.clearShelfCapacityBadges();
    this.clearBatchSelection();
    this.activeZoneTag = null;
    this.saveLayout();
    this.snackBar.open('Layout cleared', 'Close', { duration: 2000 });
  }

  get filteredCatalog(): ProductCatalogItem[] {
    const term = this.picklistSearch.trim().toLowerCase();
    if (!term) return this.productCatalog;
    return this.productCatalog.filter(item =>
      item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term)
    );
  }

  async applyPreset(): Promise<void> {
    if (!this.selectedPresetId) return;
    if (this.selectedPresetId === 'stocked-india-demo') {
      this.clearLayout();
      const items = await this.buildStockedDemoLayout();
      this.layoutItems = items.map(item => ({ ...item, id: this.generateId() }));
      this.layoutMap = new Map(this.layoutItems.map(item => [item.id, item]));
      this.rebuildFromLayout();
      this.saveLayout();
      this.snackBar.open('Loaded preset: India Demo (Stocked)', 'Close', { duration: 2500 });
      return;
    }
    const preset = this.presets.find(item => item.id === this.selectedPresetId);
    if (!preset) return;
    this.clearLayout();
    this.layoutItems = preset.items.map(item => ({ ...item, id: this.generateId() }));
    this.layoutMap = new Map(this.layoutItems.map(item => [item.id, item]));
    this.rebuildFromLayout();
    this.saveLayout();
    this.snackBar.open(`Loaded preset: ${preset.name}`, 'Close', { duration: 2500 });
  }

  private initThree(): void {
    const canvas = this.sceneCanvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f3f4f6');

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    this.camera.position.set(6, 6, 6);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 10, 5);
    this.scene.add(ambient, directional);

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode(this.transformMode);
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !Boolean(event.value);
    });
    this.transformControls.addEventListener('objectChange', () => {
      this.syncSelectedMesh();
    });
    const controlsObject = this.transformControls as unknown as {
      isObject3D?: boolean;
      getHelper?: () => unknown;
    };
    if (controlsObject?.isObject3D) {
      this.scene.add(this.transformControls as unknown as THREE.Object3D);
    } else {
      const helper = controlsObject?.getHelper?.();
      if (helper && (helper as { isObject3D?: boolean }).isObject3D) {
        this.scene.add(helper as THREE.Object3D);
      }
    }

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDownHandler);
    window.addEventListener('click', this.onWindowClick);

    this.updateFloor();
    this.rebuildFromLayout();
  }

  private updateFloor(): void {
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
    }
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }

    const geometry = new THREE.PlaneGeometry(12, 10);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.floorMesh);

    this.gridHelper = new THREE.GridHelper(12, 24, '#c7c7c7', '#e2e2e2');
    this.scene.add(this.gridHelper);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.mode === 'select' || this.mode === 'delete') {
      if (event.button === 2) {
        this.openContextMenu(event);
        return;
      }
      if (this.zonePickerEnabled) {
        const tag = this.pickZoneTag(event);
        if (tag) {
          this.activeZoneTag = this.activeZoneTag === tag ? null : tag;
          this.applyZoneFilter();
          return;
        }
      }
      const hits = this.raycaster.intersectObjects(this.collectMeshes(), true);
      if (!hits.length) {
        this.detachTransform();
        this.clearBatchSelection();
        return;
      }
      const target = hits[0].object as THREE.Mesh;
      const id = this.getLayoutIdFromObject(target);
      if (id && this.auditOpen) {
        this.setAuditTargetFromId(id);
        return;
      }
      if (id && this.boxMeshes.has(id) && this.mode === 'select') {
        if (event.shiftKey) {
          this.toggleBatchSelection(id);
          return;
        }
        this.setSingleSelection(id);
        this.selectMesh(this.boxMeshes.get(id)!);
        this.openBoxManager(id);
        return;
      }
      if (this.mode === 'delete') {
        this.deleteMesh(target);
        return;
      }
      this.clearBatchSelection();
      this.selectMesh(target);
      return;
    }

    if (this.mode === 'drawWall') {
      const hit = this.raycaster.intersectObject(this.floorMesh!)[0];
      if (!hit) return;
      this.drawActive = true;
      this.controls.enabled = false;
      this.drawStart.copy(hit.point);
      this.wallDrawStartY = event.clientY;
      this.wallDrawHeight = 0.6;
      this.createPreviewWall();
      return;
    }

    if (this.mode === 'drawShelf') {
      const hit = this.raycaster.intersectObjects([...this.wallMeshes.values()])[0];
      if (!hit) return;
      this.drawActive = true;
      this.controls.enabled = false;
      this.drawTarget = { mesh: hit.object as THREE.Mesh, type: 'shelf' };
      this.drawStart.copy(hit.point);
      this.createPreviewShelf();
      return;
    }

    if (this.mode === 'drawBox') {
      const hit = this.raycaster.intersectObjects([...this.shelfMeshes.values()])[0];
      if (!hit) return;
      this.drawActive = true;
      this.controls.enabled = false;
      this.drawTarget = { mesh: hit.object as THREE.Mesh, type: 'box' };
      this.drawStart.copy(hit.point);
      this.createPreviewBox();
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drawActive || !this.previewMesh) return;
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.mode === 'drawWall') {
      const hit = this.raycaster.intersectObject(this.floorMesh!)[0];
      if (!hit) return;
      this.updatePreviewWall(hit.point, event);
      return;
    }

    if (this.mode === 'drawShelf' && this.drawTarget) {
      const hit = this.raycaster.intersectObject(this.drawTarget.mesh)[0];
      if (!hit) return;
      this.updatePreviewShelf(hit.point);
      return;
    }

    if (this.mode === 'drawBox' && this.drawTarget) {
      const hit = this.raycaster.intersectObject(this.drawTarget.mesh)[0];
      if (!hit) return;
      this.updatePreviewBox(hit.point);
    }
  };

  private onPointerUp = (): void => {
    if (!this.drawActive || !this.previewMesh) return;
    this.drawActive = false;
    this.controls.enabled = true;

    if (this.mode === 'drawWall') {
      this.commitPreview('wall');
      return;
    }

    if (this.mode === 'drawShelf') {
      this.commitPreview('shelf');
      return;
    }

    if (this.mode === 'drawBox') {
      this.commitPreview('box');
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    this.openContextMenu(event);
  };

  private createPreviewWall(): void {
    const geometry = new THREE.BoxGeometry(0.1, this.wallDrawHeight || this.wallHeight, this.wallThickness);
    const material = new THREE.MeshStandardMaterial({
      color: this.getActiveColor(),
      opacity: 0.6,
      transparent: true
    });
    this.previewMesh = new THREE.Mesh(geometry, material);
    const height = this.wallDrawHeight || this.wallHeight;
    this.previewMesh.position.set(this.drawStart.x, height / 2, this.drawStart.z);
    this.scene.add(this.previewMesh);
  }

  private updatePreviewWall(endPoint: THREE.Vector3, event: PointerEvent): void {
    const length = this.drawStart.distanceTo(endPoint);
    if (length < 0.2) return;
    const deltaY = this.wallDrawStartY - event.clientY;
    const height = Math.min(6, Math.max(0.4, Math.abs(deltaY) * 0.02));
    this.wallDrawHeight = height;
    const center = new THREE.Vector3().addVectors(this.drawStart, endPoint).multiplyScalar(0.5);
    const angle = Math.atan2(endPoint.z - this.drawStart.z, endPoint.x - this.drawStart.x);
    this.previewMesh!.geometry.dispose();
    this.previewMesh!.geometry = new THREE.BoxGeometry(length, height, this.wallThickness);
    this.previewMesh!.position.set(center.x, height / 2, center.z);
    this.previewMesh!.rotation.set(0, -angle, 0);
  }

  private getHitNormal(mesh: THREE.Mesh, point: THREE.Vector3): THREE.Vector3 {
    const localPoint = mesh.worldToLocal(point.clone());
    const geom = mesh.geometry as THREE.BoxGeometry;
    const params = geom.parameters as { width: number; height: number; depth: number };
    const halfDepth = params.depth / 2;
    const normal = new THREE.Vector3(0, 0, 1);
    if (Math.abs(localPoint.z) > halfDepth * 0.5) {
      normal.set(0, 0, localPoint.z > 0 ? 1 : -1);
    }
    return normal.applyEuler(mesh.rotation);
  }

  private createPreviewShelf(): void {
    const geometry = new THREE.BoxGeometry(0.4, 0.4, this.shelfDepth);
    const material = new THREE.MeshStandardMaterial({
      color: this.getActiveColor(),
      opacity: 0.6,
      transparent: true
    });
    this.previewMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.previewMesh);
  }

  private updatePreviewShelf(point: THREE.Vector3): void {
    const wall = this.drawTarget!.mesh;
    const localStart = wall.worldToLocal(this.drawStart.clone());
    const localEnd = wall.worldToLocal(point.clone());
    const width = Math.abs(localEnd.x - localStart.x);
    const height = Math.abs(localEnd.y - localStart.y);
    if (width < 0.3 || height < 0.3) return;
    const hitNormal = this.drawTarget?.mesh
      ? this.getHitNormal(this.drawTarget.mesh, point)
      : new THREE.Vector3(0, 0, 1);
    const cameraDir = new THREE.Vector3().subVectors(this.camera.position, wall.getWorldPosition(new THREE.Vector3()));
    const facingSign = cameraDir.dot(hitNormal) >= 0 ? 1 : -1;
    const depthOffset = facingSign * this.shelfDepth / 2;
    const centerLocal = new THREE.Vector3(
      (localStart.x + localEnd.x) / 2,
      (localStart.y + localEnd.y) / 2,
      depthOffset
    );
    const centerWorld = wall.localToWorld(centerLocal.clone());
    this.previewMesh!.geometry.dispose();
    this.previewMesh!.geometry = new THREE.BoxGeometry(width, height, this.shelfDepth);
    this.previewMesh!.position.copy(centerWorld);
    this.previewMesh!.rotation.copy(wall.rotation);
  }

  private createPreviewBox(): void {
    const geometry = new THREE.BoxGeometry(0.2, 0.2, this.boxDepth);
    const material = new THREE.MeshStandardMaterial({
      color: this.getActiveColor(),
      opacity: 0.7,
      transparent: true
    });
    this.previewMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.previewMesh);
  }

  private updatePreviewBox(point: THREE.Vector3): void {
    const shelf = this.drawTarget!.mesh;
    const localStart = shelf.worldToLocal(this.drawStart.clone());
    const localEnd = shelf.worldToLocal(point.clone());
    const width = Math.abs(localEnd.x - localStart.x);
    const height = Math.abs(localEnd.y - localStart.y);
    if (width < 0.05 || height < 0.05) return;
    const centerLocal = new THREE.Vector3(
      (localStart.x + localEnd.x) / 2,
      (localStart.y + localEnd.y) / 2,
      shelf.userData?.['depth'] ? shelf.userData['depth'] / 2 - this.boxDepth / 2 : this.boxDepth / 2
    );
    const centerWorld = shelf.localToWorld(centerLocal.clone());
    this.previewMesh!.geometry.dispose();
    this.previewMesh!.geometry = new THREE.BoxGeometry(width, height, this.boxDepth);
    this.previewMesh!.position.copy(centerWorld);
    this.previewMesh!.rotation.copy(shelf.rotation);
  }

  private commitPreview(type: LayoutType): void {
    if (!this.previewMesh) return;
    const mesh = this.previewMesh;
    this.previewMesh = null;
    this.drawTarget = null;
    const id = this.generateId();
    const color = this.getActiveColor(type);
    const name = type === 'box' ? this.promptBoxName() : undefined;
    mesh.material = new THREE.MeshStandardMaterial({ color });
    mesh.userData = { layoutId: id, layoutType: type, depth: type === 'shelf' ? this.shelfDepth : this.boxDepth };
    if (type === 'wall') this.wallMeshes.set(id, mesh);
    if (type === 'shelf') this.shelfMeshes.set(id, mesh);
    if (type === 'box') this.boxMeshes.set(id, mesh);
    this.layoutItems.push({
      id,
      type,
      color,
      name,
      medicines: type === 'box' ? [] : undefined,
      minStock: type === 'box' ? 0 : undefined,
      maxStock: type === 'box' ? 0 : undefined,
      tag: type === 'box' ? '' : undefined,
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
      size: this.extractSize(mesh)
    });
    this.layoutMap.set(id, this.layoutItems[this.layoutItems.length - 1]);
    if (type === 'box') {
      const size = this.layoutItems[this.layoutItems.length - 1].size;
      const label = this.createBoxLabel(name || 'Box', size, null, this.getLabelSide(this.layoutItems[this.layoutItems.length - 1]));
      mesh.add(label);
      this.boxLabels.set(id, label);
    }
    this.saveLayout();
    this.scene.add(mesh);
  }

  private selectMesh(mesh: THREE.Mesh): void {
    this.selectedMesh = mesh;
    this.transformControls.attach(mesh);
  }

  private detachTransform(): void {
    this.transformControls.detach();
    this.selectedMesh = null;
  }

  private setSingleSelection(id: string): void {
    this.selectedBoxIds = [id];
    this.updateBatchSelectionVisuals();
  }

  private toggleBatchSelection(id: string): void {
    if (this.selectedBoxIds.includes(id)) {
      this.selectedBoxIds = this.selectedBoxIds.filter(existing => existing !== id);
    } else {
      this.selectedBoxIds = [...this.selectedBoxIds, id];
    }
    this.updateBatchSelectionVisuals();
  }

  private clearBatchSelection(): void {
    if (!this.selectedBoxIds.length) return;
    this.selectedBoxIds = [];
    this.updateBatchSelectionVisuals();
  }

  private updateBatchSelectionVisuals(): void {
    this.boxMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material?.emissive) return;
      const original = mesh.userData?.['origBatchEmissive'] as THREE.Color | undefined;
      const intensity = mesh.userData?.['origBatchEmissiveIntensity'] as number | undefined;
      if (original) {
        material.emissive.copy(original);
        material.emissiveIntensity = intensity ?? 0;
      } else if (!mesh.userData?.['origBatchEmissive']) {
        mesh.userData['origBatchEmissive'] = material.emissive.clone();
        mesh.userData['origBatchEmissiveIntensity'] = material.emissiveIntensity;
      }
      material.emissive.set('#000000');
      material.emissiveIntensity = 0;
    });

    this.selectedBoxIds.forEach(id => {
      const mesh = this.boxMeshes.get(id);
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material?.emissive) return;
      material.emissive.set('#38bdf8');
      material.emissiveIntensity = 0.6;
    });
  }

  private deleteMesh(mesh: THREE.Mesh): void {
    const id = mesh.userData?.['layoutId'] as string | undefined;
    if (!id) return;
    this.disposeMesh(mesh);
    this.wallMeshes.delete(id);
    this.shelfMeshes.delete(id);
    this.boxMeshes.delete(id);
    const label = this.boxLabels.get(id);
    if (label) {
      this.disposeObject(label);
      this.boxLabels.delete(id);
    }
    this.layoutItems = this.layoutItems.filter(item => item.id !== id);
    this.layoutMap.delete(id);
    this.saveLayout();
  }

  private collectMeshes(): THREE.Mesh[] {
    return [...this.wallMeshes.values(), ...this.shelfMeshes.values(), ...this.boxMeshes.values()];
  }

  private syncSelectedMesh(): void {
    if (!this.selectedMesh) return;
    const id = this.selectedMesh.userData?.['layoutId'] as string | undefined;
    if (!id) return;
    const item = this.layoutMap.get(id);
    if (!item) return;
    item.position = { x: this.selectedMesh.position.x, y: this.selectedMesh.position.y, z: this.selectedMesh.position.z };
    item.rotation = { x: this.selectedMesh.rotation.x, y: this.selectedMesh.rotation.y, z: this.selectedMesh.rotation.z };
    item.size = this.extractSize(this.selectedMesh);
    this.saveLayout();
  }

  openContextMenu(event: MouseEvent): void {
    this.updatePointer(event as unknown as PointerEvent);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.boxMeshes.values()], true);
    if (!hits.length) {
      this.contextMenu.visible = false;
      return;
    }
    const id = this.getLayoutIdFromObject(hits[0].object);
    if (!id) return;
    this.contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      boxId: id
    };
  }

  renameSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    const newName = window.prompt('Rename box', item.name || 'Box') || '';
    if (!newName.trim()) return;
    item.name = newName.trim();
    this.updateBoxLabel(item.id);
    this.saveLayout();
    this.contextMenu.visible = false;
  }

  addMedicineToSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    this.depositMedicineToSelectedBox();
  }

  depositMedicineToSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    const medicine = window.prompt('Medicine name?') || '';
    if (!medicine.trim()) return;
    const qtyInput = window.prompt('Deposit quantity?', '1') || '';
    const qty = Number(qtyInput);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (!item.medicines) {
      item.medicines = [];
    }
    const existing = item.medicines.find(entry => entry.name.toLowerCase() === medicine.trim().toLowerCase());
    if (existing) {
      existing.qty += qty;
    } else {
      item.medicines.push({ name: medicine.trim(), qty });
    }
    const capacity = item.capacity ?? 0;
    const total = this.getTotalQty(item);
    if (capacity > 0 && total > capacity) {
      this.snackBar.open(`Over capacity by ${total - capacity}`, 'Close', { duration: 3000 });
    }
    this.updateBoxLabel(item.id);
    this.saveLayout();
    this.contextMenu.visible = false;
  }

  withdrawMedicineFromSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    const medicine = window.prompt('Medicine name?') || '';
    if (!medicine.trim()) return;
    const qtyInput = window.prompt('Withdraw quantity?', '1') || '';
    const qty = Number(qtyInput);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (!item.medicines) {
      item.medicines = [];
    }
    const existing = item.medicines.find(entry => entry.name.toLowerCase() === medicine.trim().toLowerCase());
    if (existing) {
      existing.qty -= qty;
    } else {
      item.medicines.push({ name: medicine.trim(), qty: -qty });
    }
    this.updateBoxLabel(item.id);
    this.saveLayout();
    this.contextMenu.visible = false;
  }

  setCapacityForSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    const input = window.prompt('Set box capacity (total qty)?', String(item.capacity ?? '')) || '';
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) return;
    item.capacity = value;
    this.updateBoxLabel(item.id);
    this.saveLayout();
    this.contextMenu.visible = false;
  }

  viewMedicinesInSelectedBox(): void {
    if (!this.contextMenu.boxId) return;
    const item = this.layoutMap.get(this.contextMenu.boxId);
    if (!item || item.type !== 'box') return;
    const meds = item.medicines || [];
    if (meds.length === 0) {
      this.snackBar.open('No medicines in this box yet', 'Close', { duration: 2000 });
      this.contextMenu.visible = false;
      return;
    }
    this.medicinePopup = {
      visible: true,
      boxName: item.name || 'Box',
      medicines: meds,
      capacity: item.capacity || 0,
      boxId: item.id
    };
    this.contextMenu.visible = false;
  }

  closeMedicinePopup(): void {
    this.medicinePopup.visible = false;
  }

  openPicklist(): void {
    this.picklistOpen = true;
    this.picklistActive = false;
    this.picklistCurrentId = null;
    this.loadProductCatalog();
    this.loadPicklist();
    this.applyPicklistHighlights();
  }

  closePicklist(): void {
    this.picklistOpen = false;
    this.picklistActive = false;
    this.picklistCurrentId = null;
    this.clearPickHighlights();
  }

  setPickQty(productId: number, value: number): void {
    const qty = Number(value);
    const previous = this.pickQtyMap[productId] || 1;
    if (value === null || value === undefined || value === ('' as unknown as number) || Number.isNaN(qty)) {
      this.pickQtyMap[productId] = previous;
      return;
    }
    this.pickQtyMap[productId] = Number.isFinite(qty) && qty > 0 ? qty : 1;
    if (this.picklistOpen) {
      this.applyPicklistHighlights();
    }
  }

  getPickQty(productId: number): number {
    return this.pickQtyMap[productId] || 1;
  }

  addToPicklist(product: ProductCatalogItem): void {
    const qty = this.getPickQty(product.id);
    const existing = this.picklistItems.find(item => item.name.toLowerCase() === product.name.toLowerCase());
    if (existing) {
      existing.qty += qty;
      existing.status = 'pending';
    } else {
      this.picklistItems.push({
        id: this.generateId(),
        name: product.name,
        qty,
        status: 'pending',
        boxIds: []
      });
    }
    this.updatePicklistMappings();
    this.savePicklist();
    this.applyPicklistHighlights();
  }

  startPicklist(): void {
    if (!this.picklistItems.length) return;
    this.picklistActive = true;
    this.picklistItems = this.picklistItems
      .map(item => ({ ...item, status: item.status || 'pending' }))
      .sort((a, b) => (a.tag || '').localeCompare(b.tag || '') || a.name.localeCompare(b.name));
    this.picklistCurrentId = this.picklistItems.find(item => item.status === 'pending')?.id || null;
    this.applyPicklistHighlights();
  }

  focusPickItem(item: PicklistItem): void {
    if (!item.boxIds.length) return;
    const targets = item.boxIds.map(id => this.boxMeshes.get(id)).filter(Boolean) as THREE.Mesh[];
    if (!targets.length) return;
    const center = targets.reduce((acc, mesh) => acc.add(mesh.position), new THREE.Vector3()).divideScalar(targets.length);
    this.controls.target.copy(center);
    this.camera.position.set(center.x + 3, center.y + 3, center.z + 3);
    this.controls.update();
  }

  togglePicked(item: PicklistItem): void {
    const nextStatus = item.status === 'picked' ? 'pending' : 'picked';
    if (nextStatus === 'picked' && !item.applied) {
      this.applyPicklistAdjustment(item, -item.qty);
      item.applied = true;
    } else if (nextStatus === 'pending' && item.applied) {
      this.applyPicklistAdjustment(item, item.qty);
      item.applied = false;
    }
    item.status = nextStatus;
    if (this.picklistCurrentId === item.id && item.status === 'picked') {
      this.picklistCurrentId = this.picklistItems.find(i => i.status === 'pending')?.id || null;
    }
    this.savePicklist();
    this.applyPicklistHighlights();
  }

  private applyPicklistAdjustment(item: PicklistItem, delta: number): void {
    if (!item.boxIds.length || !Number.isFinite(delta) || delta === 0) return;
    const targetName = item.name.trim().toLowerCase();
    if (!targetName) return;
    let pending = Math.abs(delta);
    const isConsume = delta < 0;
    const boxes = item.boxIds
      .map(id => this.layoutMap.get(id))
      .filter((box): box is LayoutItem => box !== undefined && box.type === 'box');

    if (isConsume) {
      boxes.forEach(box => {
        if (!box.medicines || pending <= 0) return;
        const entry = box.medicines.find(med => med.name.toLowerCase() === targetName);
        if (!entry || entry.qty <= 0) return;
        const take = Math.min(entry.qty, pending);
        entry.qty -= take;
        pending -= take;
      });

      if (pending > 0) {
        const fallback = boxes[0];
        if (fallback) {
          if (!fallback.medicines) fallback.medicines = [];
          const entry = fallback.medicines.find(med => med.name.toLowerCase() === targetName);
          if (entry) {
            entry.qty -= pending;
          } else {
            fallback.medicines.push({ name: item.name, qty: -pending });
          }
        }
      }
    } else {
      const targetBox = boxes[0];
      if (!targetBox) return;
      if (!targetBox.medicines) targetBox.medicines = [];
      const entry = targetBox.medicines.find(med => med.name.toLowerCase() === targetName);
      if (entry) {
        entry.qty += pending;
      } else {
        targetBox.medicines.push({ name: item.name, qty: pending });
      }
    }

    boxes.forEach(box => this.updateBoxLabel(box.id));
    this.saveLayout();
  }

  clearPicklist(): void {
    this.picklistItems = [];
    this.picklistCurrentId = null;
    this.picklistActive = false;
    this.savePicklist();
    this.clearPickHighlights();
  }

  openAudit(): void {
    this.auditOpen = true;
    this.auditResults = [];
    this.auditSummary = { matched: 0, missing: 0, extra: 0 };
    if (this.selectedMesh) {
      const id = this.getLayoutIdFromObject(this.selectedMesh);
      if (id) {
        this.setAuditTargetFromId(id);
      }
    }
  }

  closeAudit(): void {
    this.auditOpen = false;
  }

  openRestock(): void {
    this.restockOpen = true;
    this.computeRestockList();
  }

  closeRestock(): void {
    this.restockOpen = false;
  }

  focusRestockItem(id: string): void {
    const mesh = this.boxMeshes.get(id);
    if (!mesh) return;
    this.selectMesh(mesh);
    this.openBoxManager(id);
  }

  applyRestockItem(id: string): void {
    const item = this.layoutMap.get(id);
    if (!item || item.type !== 'box') return;
    const selectedMedicine = this.restockSelections[id];
    if (!selectedMedicine) {
      this.snackBar.open('Select a medicine before restocking', 'Close', { duration: 2000 });
      return;
    }
    const total = this.getTotalQty(item);
    const min = item.minStock ?? 0;
    const max = item.maxStock ?? 0;
    const target = max > 0 ? max : min;
    if (target <= total) return;
    const delta = target - total;
    if (!item.medicines) item.medicines = [];
    const existing = item.medicines.find(entry => entry.name === selectedMedicine);
    if (existing) {
      existing.qty += delta;
    } else {
      item.medicines.push({ name: selectedMedicine, qty: delta });
    }
    this.updateBoxLabel(item.id);
    this.saveLayout();
    this.computeRestockList();
  }

  applyRestockAll(): void {
    const missing = this.restockItems.filter(item => !this.restockSelections[item.id]);
    if (missing.length) {
      this.snackBar.open('Select a medicine for each box before applying', 'Close', { duration: 2500 });
      return;
    }
    this.restockItems.forEach(item => this.applyRestockItem(item.id));
  }

  toggleHeatmap(): void {
    this.heatmapEnabled = !this.heatmapEnabled;
    if (this.heatmapEnabled) {
      this.applyHeatmap();
      return;
    }
    this.clearHeatmap();
  }

  toggleShelfCapacity(): void {
    this.shelfCapacityEnabled = !this.shelfCapacityEnabled;
    if (this.shelfCapacityEnabled) {
      this.updateShelfCapacityBadges();
      return;
    }
    this.clearShelfCapacityBadges();
  }

  clearAuditInput(): void {
    this.auditInput = '';
    this.auditResults = [];
    this.auditSummary = { matched: 0, missing: 0, extra: 0 };
    this.auditReport = '';
  }

  openBoxManager(id: string): void {
    const item = this.layoutMap.get(id);
    if (!item || item.type !== 'box') return;
    this.medicinePopup = {
      visible: true,
      boxName: item.name || 'Box',
      medicines: item.medicines || [],
      capacity: item.capacity || 0,
      boxId: id
    };
    this.medicineForm = {
      name: item.name || 'Box',
      capacity: item.capacity || 0,
      minStock: item.minStock || 0,
      maxStock: item.maxStock || 0,
      tag: item.tag || '',
      medicineName: '',
      quantity: 1,
      mode: 'deposit'
    };
  }

  selectMedicine(name: string): void {
    this.medicineForm.medicineName = name;
  }

  saveMedicinePopup(): void {
    const id = this.medicinePopup.boxId;
    if (!id) return;
    const item = this.layoutMap.get(id);
    if (!item || item.type !== 'box') return;
    const name = this.medicineForm.name.trim();
    if (name) {
      item.name = name;
    }
    const capacity = Number(this.medicineForm.capacity);
    if (Number.isFinite(capacity) && capacity >= 0) {
      item.capacity = capacity;
    }
    const minStock = Number(this.medicineForm.minStock);
    if (Number.isFinite(minStock) && minStock >= 0) {
      item.minStock = minStock;
    }
    const maxStock = Number(this.medicineForm.maxStock);
    if (Number.isFinite(maxStock) && maxStock >= 0) {
      item.maxStock = maxStock;
    }
    const tag = this.medicineForm.tag.trim();
    item.tag = tag;
    const medName = this.medicineForm.medicineName.trim();
    const qty = Number(this.medicineForm.quantity);
    if (medName && Number.isFinite(qty) && qty > 0) {
      if (!item.medicines) item.medicines = [];
      const existing = item.medicines.find(entry => entry.name.toLowerCase() === medName.toLowerCase());
      const delta = this.medicineForm.mode === 'deposit' ? qty : -qty;
      if (existing) {
        existing.qty += delta;
      } else {
        item.medicines.push({ name: medName, qty: delta });
      }
    }
    this.updateBoxLabel(id);
    this.openBoxManager(id);
    this.saveLayout();
  }

  cancelMedicinePopup(): void {
    this.closeMedicinePopup();
  }

  updateQuantity(delta: number): void {
    const next = Math.max(1, (Number(this.medicineForm.quantity) || 1) + delta);
    this.medicineForm.quantity = next;
  }

  private renameBoxAtEvent(event: MouseEvent): void {
    this.updatePointer(event as unknown as PointerEvent);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.boxMeshes.values()], true);
    if (!hits.length) return;
    const target = hits[0].object as THREE.Object3D;
    const id = this.getLayoutIdFromObject(target);
    if (!id) return;
    const item = this.layoutMap.get(id);
    if (!item || item.type !== 'box') return;
    const newName = window.prompt('Rename box', item.name || 'Box') || '';
    if (!newName.trim()) return;
    item.name = newName.trim();
    this.updateBoxLabel(id);
    this.saveLayout();
  }

  private getLayoutIdFromObject(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const id = current.userData?.['layoutId'] as string | undefined;
      if (id) return id;
      current = current.parent;
    }
    return null;
  }

  private updateBoxLabel(id: string): void {
    const item = this.layoutMap.get(id);
    const boxMesh = this.boxMeshes.get(id);
    if (!item || !boxMesh) return;
    const label = this.boxLabels.get(id);
    if (label) {
      label.parent?.remove(label);
    }
    const updated = this.createBoxLabel(
      this.getBoxDisplayName(item),
      item.size,
      this.getStockStatus(item),
      this.getLabelSide(item)
    );
    boxMesh.add(updated);
    this.boxLabels.set(id, updated);
  }

  private getBoxDisplayName(item: LayoutItem): string {
    const base = item.name || 'Box';
    const total = this.getTotalQty(item);
    const capacity = item.capacity || 0;
    const hasDeficit = (item.medicines || []).some(entry => entry.qty < 0);
    if (capacity > 0) {
      return hasDeficit ? `${base} (${total}/${capacity})!` : `${base} (${total}/${capacity})`;
    }
    return total > 0 ? `${base} (${total})${hasDeficit ? '!' : ''}` : base;
  }

  private getTotalQty(item: LayoutItem): number {
    return (item.medicines || []).reduce((sum, entry) => sum + entry.qty, 0);
  }

  private getLabelSide(item: LayoutItem): 'front' | 'back' {
    if (item.type !== 'box') return 'front';
    const isRightWall = item.position.x > 0.1;
    const rightFacing = Math.abs((item.rotation.y || 0) - Math.PI / 2) < 0.2;
    return isRightWall && rightFacing ? 'back' : 'front';
  }

  private setAuditTargetFromId(id: string): void {
    const item = this.layoutMap.get(id);
    if (!item) return;
    if (item.type === 'box') {
      this.auditTargetIds = [id];
      this.auditTargetName = item.name || 'Selected Box';
      this.computeAuditResults();
      return;
    }
    if (item.type === 'shelf') {
      const candidates = this.layoutItems.filter(entry => entry.type === 'box');
      const shelfBounds = {
        x: item.size.x / 2 + 0.6,
        y: item.size.y / 2 + 0.6,
        z: item.size.z / 2 + 1.2
      };
      const shelfPos = item.position;
      const boxes = candidates.filter(box =>
        Math.abs(box.position.x - shelfPos.x) <= shelfBounds.x &&
        Math.abs(box.position.y - shelfPos.y) <= shelfBounds.y &&
        Math.abs(box.position.z - shelfPos.z) <= shelfBounds.z
      );
      this.auditTargetIds = boxes.map(box => box.id);
      this.auditTargetName = item.name || 'Selected Shelf';
      this.computeAuditResults();
      return;
    }
    this.auditTargetIds = [];
    this.auditTargetName = 'Select a shelf or box';
    this.auditResults = [];
  }

  private applyHeatmap(): void {
    this.clearHeatmap();
    this.layoutItems.forEach(item => {
      if (item.type !== 'box') return;
      const mesh = this.boxMeshes.get(item.id);
      if (!mesh) return;
      const ratio = this.getCapacityRatio(item);
      const color = this.getHeatmapColor(ratio);
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!mesh.userData?.['origColor']) {
        mesh.userData['origColor'] = material.color.clone();
      }
      material.color.set(color);
    });
  }

  private clearHeatmap(): void {
    this.boxMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const original = mesh.userData?.['origColor'] as THREE.Color | undefined;
      if (original) {
        material.color.copy(original);
      }
    });
  }

  private getCapacityRatio(item: LayoutItem): number {
    const capacity = item.capacity ?? 0;
    const total = this.getTotalQty(item);
    if (!capacity) return 0;
    return Math.max(0, Math.min(1.5, total / capacity));
  }

  private getHeatmapColor(ratio: number): string {
    if (ratio <= 0.2) return '#3b82f6';
    if (ratio <= 0.5) return '#10b981';
    if (ratio <= 0.8) return '#f59e0b';
    if (ratio <= 1.0) return '#ef4444';
    return '#b91c1c';
  }

  private computeRestockList(): void {
    const items = this.layoutItems
      .filter(item => item.type === 'box')
      .map(item => {
        const total = this.getTotalQty(item);
        const min = item.minStock ?? 0;
        const max = item.maxStock ?? 0;
        const needsRestock = min > 0 && total < min;
        const target = max > 0 ? max : min;
        const suggested = needsRestock ? Math.max(0, target - total) : 0;
        const medicines = (item.medicines || []).map(entry => entry.name).filter(name => name);
        return {
          id: item.id,
          name: item.name || 'Box',
          tag: item.tag || 'General',
          total,
          min,
          max,
          suggested,
          medicines
        };
      })
      .filter(item => item.suggested > 0)
      .sort((a, b) => b.suggested - a.suggested);

    this.restockItems = items;
    const nextSelections: Record<string, string> = {};
    items.forEach(item => {
      const existing = this.restockSelections[item.id];
      if (existing && item.medicines.includes(existing)) {
        nextSelections[item.id] = existing;
        return;
      }
      if (item.medicines.length) {
        nextSelections[item.id] = item.medicines[0];
      }
    });
    this.restockSelections = nextSelections;
    this.restockSummary = {
      lowBoxes: items.length,
      totalSuggested: items.reduce((sum, item) => sum + item.suggested, 0)
    };
  }

  private clearShelfCapacityBadges(): void {
    this.shelfCapacityBadges.forEach(badge => {
      badge.parent?.remove(badge);
      badge.geometry.dispose();
      const material = badge.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach(mat => mat.dispose());
      } else {
        material.dispose();
      }
    });
    this.shelfCapacityBadges.clear();
  }

  private updateShelfCapacityBadges(): void {
    if (!this.shelfCapacityEnabled) {
      this.clearShelfCapacityBadges();
      return;
    }
    this.clearShelfCapacityBadges();
    const shelves = this.layoutItems.filter(item => item.type === 'shelf');
    shelves.forEach(shelf => {
      const mesh = this.shelfMeshes.get(shelf.id);
      if (!mesh) return;
      const boxes = this.getBoxesForShelf(shelf);
      const totalQty = boxes.reduce((sum, box) => sum + this.getTotalQty(box), 0);
      const totalCapacity = boxes.reduce((sum, box) => sum + (box.capacity ?? 0), 0);
      const capacity = totalCapacity > 0 ? totalCapacity : boxes.length * 100;
      const ratio = capacity > 0 ? totalQty / capacity : 0;
      const percent = Math.round(Math.min(1.5, Math.max(0, ratio)) * 100);
      const color = this.getHeatmapColor(ratio);
      const side = this.getShelfLabelSide(shelf);
      const badge = this.createShelfCapacityBadge(`${percent}%`, color);
      const offset = shelf.size.z / 2 + 0.08;
      badge.position.set(0, shelf.size.y / 2 + 0.12, (side === 'front' ? 1 : -1) * offset);
      if (side === 'back') {
        badge.rotation.y = Math.PI;
      }
      mesh.add(badge);
      this.shelfCapacityBadges.set(shelf.id, badge);
    });
  }

  private getBoxesForShelf(shelf: LayoutItem): LayoutItem[] {
    const candidates = this.layoutItems.filter(entry => entry.type === 'box');
    const shelfBounds = {
      x: shelf.size.x / 2 + 0.6,
      y: shelf.size.y / 2 + 0.6,
      z: shelf.size.z / 2 + 1.2
    };
    const shelfPos = shelf.position;
    return candidates.filter(box =>
      Math.abs(box.position.x - shelfPos.x) <= shelfBounds.x &&
      Math.abs(box.position.y - shelfPos.y) <= shelfBounds.y &&
      Math.abs(box.position.z - shelfPos.z) <= shelfBounds.z
    );
  }

  private getShelfLabelSide(item: LayoutItem): 'front' | 'back' {
    const isRightWall = item.position.x > 0.1;
    const rightFacing = Math.abs((item.rotation.y || 0) - Math.PI / 2) < 0.2;
    return isRightWall && rightFacing ? 'back' : 'front';
  }

  private createShelfCapacityBadge(text: string, color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 54px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(0.5, 0.24);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 10;
    return mesh;
  }

  runAudit(): void {
    this.computeAuditResults();
  }

  copyAuditReport(): void {
    if (!this.auditReport) {
      this.generateAuditReport();
    }
    if (!this.auditReport) return;
    navigator.clipboard?.writeText(this.auditReport).catch(() => {
      // noop
    });
  }

  downloadAuditReport(): void {
    if (!this.auditReport) {
      this.generateAuditReport();
    }
    if (!this.auditReport) return;
    const blob = new Blob([this.auditReport], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-report-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private generateAuditReport(): void {
    if (!this.auditResults.length) {
      this.auditReport = '';
      return;
    }
    const lines = [
      `Audit Report: ${new Date().toLocaleString()}`,
      `Target: ${this.auditTargetName}`,
      `Matched: ${this.auditSummary.matched}, Missing: ${this.auditSummary.missing}, Extra: ${this.auditSummary.extra}`,
      '',
      'Name | Expected | Scanned | Diff | Status'
    ];
    this.auditResults.forEach(result => {
      lines.push(
        `${result.name} | ${result.expected} | ${result.scanned} | ${result.diff} | ${result.status}`
      );
    });
    this.auditReport = lines.join('\n');
  }

  private computeAuditResults(): void {
    const expectedMap = new Map<string, number>();
    this.auditTargetIds.forEach(id => {
      const item = this.layoutMap.get(id);
      if (!item || item.type !== 'box' || !item.medicines) return;
      item.medicines.forEach(entry => {
        const name = entry.name.trim();
        if (!name) return;
        expectedMap.set(name, (expectedMap.get(name) || 0) + entry.qty);
      });
    });

    const scannedMap = new Map<string, number>();
    const lines = this.auditInput.split('\n').map(line => line.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split(/[,|\t]/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) return;
      let name = parts[0];
      let qty = 1;
      if (parts.length > 1) {
        const parsed = Number(parts[1]);
        qty = Number.isFinite(parsed) ? parsed : 1;
      } else {
        const match = line.match(/(.+)\s+(\d+)$/);
        if (match) {
          name = match[1].trim();
          qty = Number(match[2]);
        }
      }
      scannedMap.set(name, (scannedMap.get(name) || 0) + qty);
    });

    const allNames = new Set<string>([...expectedMap.keys(), ...scannedMap.keys()]);
    const results: Array<{ name: string; expected: number; scanned: number; diff: number; status: 'match' | 'missing' | 'extra' }> = [];
    let matched = 0;
    let missing = 0;
    let extra = 0;
    allNames.forEach(name => {
      const expected = expectedMap.get(name) || 0;
      const scanned = scannedMap.get(name) || 0;
      const diff = scanned - expected;
      let status: 'match' | 'missing' | 'extra' = 'match';
      if (diff < 0) status = 'missing';
      if (diff > 0) status = 'extra';
      if (status === 'match') matched += 1;
      if (status === 'missing') missing += 1;
      if (status === 'extra') extra += 1;
      results.push({ name, expected, scanned, diff, status });
    });

    this.auditResults = results.sort((a, b) => a.name.localeCompare(b.name));
    this.auditSummary = { matched, missing, extra };
    this.generateAuditReport();
  }

  private getStockStatus(item: LayoutItem): 'low' | 'high' | null {
    const total = this.getTotalQty(item);
    const minStock = item.minStock ?? 0;
    const maxStock = item.maxStock ?? 0;
    if (minStock > 0 && total < minStock) return 'low';
    if (maxStock > 0 && total > maxStock) return 'high';
    return null;
  }

  private extractSize(mesh: THREE.Mesh): { x: number; y: number; z: number } {
    const geometry = mesh.geometry as THREE.BoxGeometry;
    const params = geometry.parameters as { width?: number; height?: number; depth?: number } | undefined;
    if (params?.width && params?.height && params?.depth) {
      return {
        x: params.width * mesh.scale.x,
        y: params.height * mesh.scale.y,
        z: params.depth * mesh.scale.z
      };
    }
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { x: size.x, y: size.y, z: size.z };
  }

  private saveLayout(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.layoutItems));
    window.dispatchEvent(new Event('buildaq-layout-updated'));
    if (this.scene) {
      this.updateTagFlags();
      if (this.restockOpen) {
        this.computeRestockList();
      }
      if (this.shelfCapacityEnabled) {
        this.updateShelfCapacityBadges();
      }
    }
  }

  private savePicklist(): void {
    localStorage.setItem(this.picklistStorageKey, JSON.stringify(this.picklistItems));
  }

  private loadPicklist(): void {
    const raw = localStorage.getItem(this.picklistStorageKey);
    if (!raw) {
      this.picklistItems = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PicklistItem[];
      this.picklistItems = parsed.map(item => ({
        ...item,
        status: item.status || 'pending',
        applied: item.applied ?? item.status === 'picked',
        boxIds: item.boxIds || []
      }));
    } catch (error) {
      console.warn('Failed to parse picklist', error);
      this.picklistItems = [];
    }
    this.updatePicklistMappings();
  }

  private loadProductCatalog(): void {
    const raw = localStorage.getItem(this.productStorageKey);
    if (!raw) {
      this.productCatalog = [];
      return;
    }
    try {
      this.productCatalog = JSON.parse(raw) as ProductCatalogItem[];
    } catch (error) {
      console.warn('Failed to parse product catalog', error);
      this.productCatalog = [];
    }
  }

  private loadLayout(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as LayoutItem[];
      this.layoutItems = parsed.map(item => {
        if (item.type === 'box') {
          item.minStock = Number.isFinite(item.minStock as number) ? (item.minStock as number) : 0;
          item.maxStock = Number.isFinite(item.maxStock as number) ? (item.maxStock as number) : 0;
          item.tag = typeof item.tag === 'string' ? item.tag : '';
        }
        if (item.medicines && item.medicines.length > 0 && typeof item.medicines[0] === 'string') {
          const legacy = item.medicines as unknown as string[];
          return {
            ...item,
            medicines: legacy.map(name => ({ name, qty: 1 }))
          };
        }
        return item;
      });
      this.layoutMap = new Map(parsed.map(item => [item.id, item]));
    } catch (error) {
      console.warn('Failed to parse saved layout', error);
    }
  }

  private rebuildFromLayout(): void {
    this.layoutItems.forEach(item => {
      const geometry = new THREE.BoxGeometry(item.size.x, item.size.y, item.size.z);
      const material = new THREE.MeshStandardMaterial({
        color: item.color || (item.type === 'wall' ? this.wallColor : item.type === 'shelf' ? this.shelfColor : this.boxColor)
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(item.position.x, item.position.y, item.position.z);
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
      mesh.userData = { layoutId: item.id, layoutType: item.type, depth: item.size.z };
      if (item.type === 'wall') this.wallMeshes.set(item.id, mesh);
      if (item.type === 'shelf') this.shelfMeshes.set(item.id, mesh);
      if (item.type === 'box') this.boxMeshes.set(item.id, mesh);
      this.scene.add(mesh);
      if (item.type === 'box') {
        const label = this.createBoxLabel(
          this.getBoxDisplayName(item),
          item.size,
          this.getStockStatus(item),
          this.getLabelSide(item)
        );
        mesh.add(label);
        this.boxLabels.set(item.id, label);
      }
    });
    this.updateTagFlags();
    this.applyPicklistHighlights();
    this.clearBatchSelection();
    if (this.shelfCapacityEnabled) {
      this.updateShelfCapacityBadges();
    }
  }

  private reloadLayoutFromStorage(): void {
    this.layoutItems = [];
    this.layoutMap.clear();
    this.wallMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.shelfMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.boxMeshes.forEach(mesh => this.disposeMesh(mesh));
    this.boxLabels.forEach(label => this.disposeObject(label));
    this.tagFlags.forEach(flag => this.disposeObject(flag));
    this.wallMeshes.clear();
    this.shelfMeshes.clear();
    this.boxMeshes.clear();
    this.boxLabels.clear();
    this.tagFlags.clear();
    this.loadLayout();
    if (this.scene) {
      this.rebuildFromLayout();
    }
    this.applyPicklistHighlights();
    if (this.heatmapEnabled) {
      this.applyHeatmap();
    }
    this.clearBatchSelection();
    if (this.restockOpen) {
      this.computeRestockList();
    }
    if (this.shelfCapacityEnabled) {
      this.updateShelfCapacityBadges();
    }
  }

  private updatePicklistMappings(): void {
    this.picklistItems = this.picklistItems.map(item => {
      const matches = this.findBoxesForProduct(item.name);
      const tag = matches.length ? this.layoutMap.get(matches[0])?.tag : undefined;
      return { ...item, boxIds: matches, tag };
    });
  }

  private findBoxesForProduct(name: string): string[] {
    const target = name.trim().toLowerCase();
    const ids: string[] = [];
    this.layoutItems.forEach(item => {
      if (item.type !== 'box' || !item.medicines) return;
      if (item.medicines.some(med => med.name.toLowerCase() === target)) {
        ids.push(item.id);
      }
    });
    return ids;
  }

  private applyPicklistHighlights(): void {
    this.clearPickHighlights();
    if (!this.picklistOpen || !this.picklistItems.length) return;
    this.picklistItems.forEach(item => {
      const highlightColor = item.status === 'picked' ? '#94a3b8' : '#38bdf8';
      if (this.picklistCurrentId === item.id) {
        this.highlightBoxes(item.boxIds, '#f59e0b', 1.6, 'PICK');
        return;
      }
      this.highlightBoxes(
        item.boxIds,
        highlightColor,
        item.status === 'picked' ? 0.6 : 1.1,
        item.status === 'picked' ? 'DONE' : 'PICK'
      );
    });
  }

  private clearPickHighlights(): void {
    this.boxMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material?.emissive) return;
      const original = mesh.userData?.['origEmissive'] as THREE.Color | undefined;
      const intensity = mesh.userData?.['origEmissiveIntensity'] as number | undefined;
      if (original) {
        material.emissive.copy(original);
        material.emissiveIntensity = intensity ?? 0;
      } else {
        material.emissive.set('#000000');
        material.emissiveIntensity = 0;
      }

      const outline = mesh.userData?.['pickOutline'] as THREE.LineSegments | undefined;
      if (outline) {
        mesh.remove(outline);
        outline.geometry.dispose();
        const outlineMaterial = outline.material as THREE.Material | THREE.Material[];
        if (Array.isArray(outlineMaterial)) {
          outlineMaterial.forEach(mat => mat.dispose());
        } else {
          outlineMaterial.dispose();
        }
        delete mesh.userData['pickOutline'];
      }

      const badge = mesh.userData?.['pickBadge'] as THREE.Mesh | undefined;
      if (badge) {
        mesh.remove(badge);
        badge.geometry.dispose();
        const badgeMaterial = badge.material as THREE.Material | THREE.Material[];
        if (Array.isArray(badgeMaterial)) {
          badgeMaterial.forEach(mat => mat.dispose());
        } else {
          badgeMaterial.dispose();
        }
        delete mesh.userData['pickBadge'];
      }
    });
  }

  private highlightBoxes(ids: string[], color: string, intensity: number, badgeText = 'PICK'): void {
    ids.forEach(id => {
      const mesh = this.boxMeshes.get(id);
      if (!mesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material) return;
      if (!mesh.userData?.['origEmissive']) {
        mesh.userData['origEmissive'] = material.emissive.clone();
        mesh.userData['origEmissiveIntensity'] = material.emissiveIntensity;
      }
      material.emissive.set(color);
      material.emissiveIntensity = intensity;

      const item = this.layoutMap.get(id);
      if (!item) return;

      const outline = mesh.userData?.['pickOutline'] as THREE.LineSegments | undefined;
      if (!outline) {
        const newOutline = this.createPickOutline(item.size, color);
        mesh.add(newOutline);
        mesh.userData['pickOutline'] = newOutline;
      } else {
        (outline.material as THREE.LineBasicMaterial).color.set(color);
      }

      const badge = mesh.userData?.['pickBadge'] as THREE.Mesh | undefined;
      if (!badge) {
        const side = this.getLabelSide(item);
        const newBadge = this.createPickBadge(item.size, side, badgeText, color);
        mesh.add(newBadge);
        mesh.userData['pickBadge'] = newBadge;
      } else {
        const badgeMaterial = badge.material as THREE.MeshBasicMaterial;
        if (badgeMaterial.map) {
          badgeMaterial.map.dispose();
        }
        const nextBadge = this.createPickBadge(
          item.size,
          this.getLabelSide(item),
          badgeText,
          color
        );
        badgeMaterial.map = (nextBadge.material as THREE.MeshBasicMaterial).map || null;
        badgeMaterial.needsUpdate = true;
        const { position, rotation, scale } = nextBadge;
        badge.position.copy(position);
        badge.rotation.copy(rotation);
        badge.scale.copy(scale);
        nextBadge.geometry.dispose();
        const nextMaterial = nextBadge.material as THREE.Material;
        nextMaterial.dispose();
      }
    });
  }

  private createPickOutline(
    size: { x: number; y: number; z: number },
    color: string
  ): THREE.LineSegments {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const outline = new THREE.LineSegments(geometry, material);
    outline.renderOrder = 12;
    outline.scale.set(1.03, 1.03, 1.03);
    return outline;
  }

  private createPickBadge(
    size: { x: number; y: number; z: number },
    side: 'front' | 'back',
    text: string,
    color: string
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 54px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true
    });
    const badgeWidth = Math.min(size.x * 0.5, 0.7);
    const badgeHeight = Math.min(size.y * 0.22, 0.25);
    const geometry = new THREE.PlaneGeometry(badgeWidth, badgeHeight);
    const badge = new THREE.Mesh(geometry, material);

    const zOffset = size.z / 2 + 0.015;
    const yOffset = size.y / 2 - badgeHeight / 2 - 0.05;
    const xOffset = -size.x / 2 + badgeWidth / 2 + 0.06;
    badge.position.set(xOffset, yOffset, side === 'front' ? zOffset : -zOffset);
    badge.rotation.y = side === 'front' ? 0 : Math.PI;
    badge.renderOrder = 13;
    return badge;
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(material)) {
      material.forEach(mat => mat.dispose());
    } else {
      material.dispose();
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(material => material.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }

  private generateId(): string {
    return '_' + Math.random().toString(36).slice(2, 10);
  }

  private buildPresets(): LayoutPreset[] {
    return [
      {
        id: 'stocked-india-demo',
        name: 'India Demo (Stocked)',
        items: []
      },
      {
        id: 'compact-pharmacy',
        name: 'Compact Pharmacy',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: 0
        })
      },
      {
        id: 'wide-pharmacy',
        name: 'Wide Pharmacy',
        items: this.buildPharmacyLayout({
          roomWidth: 12,
          roomDepth: 9,
          shelfHeight: 1.4,
          shelfDepth: 0.55,
          boxRows: 2,
          boxCols: 10,
          deskFacing: Math.PI
        })
      },
      {
        id: 'corner-pharmacy',
        name: 'Corner Pharmacy',
        items: this.buildPharmacyLayout({
          roomWidth: 9,
          roomDepth: 7,
          shelfHeight: 1.2,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 7,
          deskFacing: Math.PI / 2
        })
      },
      {
        id: 'front-desk-east',
        name: 'Front Desk East',
        items: this.buildPharmacyLayout({
          roomWidth: 11,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 9,
          deskFacing: -Math.PI / 2
        })
      },
      {
        id: 'central-desk-north',
        name: 'Central Desk North',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 9,
          shelfHeight: 1.35,
          shelfDepth: 0.55,
          boxRows: 2,
          boxCols: 8,
          deskFacing: 0,
          deskPosition: { x: 0.8, z: 0.6 }
        })
      },
      {
        id: 'desk-west-ne',
        name: 'Desk West - NE',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: Math.PI,
          deskPosition: { x: 2.0, z: -2.0 }
        })
      },
      {
        id: 'desk-west-se',
        name: 'Desk West - SE',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: Math.PI,
          deskPosition: { x: 2.0, z: 2.0 }
        })
      },
      {
        id: 'desk-south-east',
        name: 'Desk South - East Corner',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: Math.PI / 2,
          deskPosition: { x: 2.6, z: 3.0 }
        })
      },
      {
        id: 'desk-south-west',
        name: 'Desk South - West Corner',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: -Math.PI / 2,
          deskPosition: { x: -2.6, z: 3.0 }
        })
      },
      {
        id: 'desk-south-center',
        name: 'Desk South - Center',
        items: this.buildPharmacyLayout({
          roomWidth: 10,
          roomDepth: 8,
          shelfHeight: 1.3,
          shelfDepth: 0.5,
          boxRows: 2,
          boxCols: 8,
          deskFacing: Math.PI,
          deskPosition: { x: 0, z: 3.0 }
        })
      }
    ];
  }

  private buildPharmacyLayout(config: {
    roomWidth: number;
    roomDepth: number;
    shelfHeight: number;
    shelfDepth: number;
    boxRows: number;
    boxCols: number;
    deskFacing: number;
    deskPosition?: { x: number; z: number };
  }): LayoutItem[] {
    const wallHeight = 3;
    const wallThickness = 0.1;
    const wallColor = '#6b7280';
    const shelfColor = '#475569';
    const boxColor = '#111827';

    const halfW = config.roomWidth / 2;
    const halfD = config.roomDepth / 2;
    const wallBack: LayoutItem = {
      id: this.generateId(),
      type: 'wall',
      color: wallColor,
      position: { x: 0, y: wallHeight / 2, z: -halfD },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: config.roomWidth, y: wallHeight, z: wallThickness }
    };
    const wallLeft: LayoutItem = {
      id: this.generateId(),
      type: 'wall',
      color: wallColor,
      position: { x: -halfW, y: wallHeight / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      size: { x: config.roomDepth, y: wallHeight, z: wallThickness }
    };
    const wallRight: LayoutItem = {
      id: this.generateId(),
      type: 'wall',
      color: wallColor,
      position: { x: halfW, y: wallHeight / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      size: { x: config.roomDepth, y: wallHeight, z: wallThickness }
    };

    const shelfBack: LayoutItem = {
      id: this.generateId(),
      type: 'shelf',
      color: shelfColor,
      name: 'Back Shelf',
      position: { x: 0, y: config.shelfHeight / 2 + 0.4, z: -halfD + config.shelfDepth / 2 + 0.05 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: config.roomWidth - 1, y: config.shelfHeight, z: config.shelfDepth }
    };
    const shelfLeft: LayoutItem = {
      id: this.generateId(),
      type: 'shelf',
      color: shelfColor,
      name: 'Left Shelf',
      position: { x: -halfW + config.shelfDepth / 2 + 0.05, y: config.shelfHeight / 2 + 0.4, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      size: { x: config.roomDepth - 1, y: config.shelfHeight, z: config.shelfDepth }
    };
    const shelfRight: LayoutItem = {
      id: this.generateId(),
      type: 'shelf',
      color: shelfColor,
      name: 'Right Shelf',
      position: { x: halfW - config.shelfDepth / 2 - 0.05, y: config.shelfHeight / 2 + 0.4, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      size: { x: config.roomDepth - 1, y: config.shelfHeight, z: config.shelfDepth }
    };

    const items = [wallBack, wallLeft, wallRight, shelfBack, shelfLeft, shelfRight];

    const addBoxes = (shelf: LayoutItem, facing: 'north' | 'west' | 'east', prefix: string): void => {
      const width = shelf.size.x;
      const height = shelf.size.y;
      const depth = shelf.size.z;
      const boxW = width / config.boxCols;
      const boxH = height / config.boxRows;
      const boxD = 0.22;

      for (let r = 0; r < config.boxRows; r += 1) {
        for (let c = 0; c < config.boxCols; c += 1) {
          const label = `${String.fromCharCode(65 + r)}${c + 1}`;
          const localX = -width / 2 + boxW / 2 + c * boxW;
          const localY = -height / 2 + boxH / 2 + r * boxH;
          let pos = { x: shelf.position.x, y: shelf.position.y + localY, z: shelf.position.z };
          if (facing === 'north') {
            pos = {
              x: shelf.position.x + localX,
              y: shelf.position.y + localY,
              z: shelf.position.z + depth / 2 + boxD / 2
            };
          } else if (facing === 'west') {
            pos = {
              x: shelf.position.x + depth / 2 + boxD / 2,
              y: shelf.position.y + localY,
              z: shelf.position.z + localX
            };
          } else {
            pos = {
              x: shelf.position.x - depth / 2 - boxD / 2,
              y: shelf.position.y + localY,
              z: shelf.position.z + localX
            };
          }
          items.push({
            id: this.generateId(),
            type: 'box',
            color: boxColor,
            name: `${prefix}-${label}`,
            position: pos,
            rotation: { x: 0, y: shelf.rotation.y, z: 0 },
            size: { x: boxW * 0.9, y: boxH * 0.85, z: boxD }
          });
        }
      }
    };

    addBoxes(shelfBack, 'north', 'B');
    addBoxes(shelfLeft, 'west', 'L');
    addBoxes(shelfRight, 'east', 'R');

    items.push(
      {
        id: this.generateId(),
        type: 'box',
        color: '#0f172a',
        name: 'Fridge',
        position: { x: halfW - 0.8, y: 1.1, z: halfD - 1.2 },
        rotation: { x: 0, y: Math.PI, z: 0 },
        size: { x: 0.8, y: 2.2, z: 0.7 }
      },
      {
        id: this.generateId(),
        type: 'box',
        color: '#7c3e1d',
        name: 'Counter',
        position: { x: 0, y: 0.5, z: -halfD + 2.2 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 2.8, y: 1, z: 0.9 }
      },
      {
        id: this.generateId(),
        type: 'box',
        color: '#8b5e3c',
        name: 'Desk',
        position: {
          x: config.deskPosition?.x ?? -1.2,
          y: 0.38,
          z: config.deskPosition?.z ?? 0.8
        },
        rotation: { x: 0, y: config.deskFacing, z: 0 },
        size: { x: 1.4, y: 0.75, z: 0.7 }
      },
      {
        id: this.generateId(),
        type: 'box',
        color: '#1f2937',
        name: 'Chair Seat',
        position: {
          x: (config.deskPosition?.x ?? -1.2) + Math.sin(config.deskFacing) * 0.6,
          y: 0.42,
          z: (config.deskPosition?.z ?? 0.8) + Math.cos(config.deskFacing) * 0.6
        },
        rotation: { x: 0, y: config.deskFacing, z: 0 },
        size: { x: 0.55, y: 0.12, z: 0.55 }
      },
      {
        id: this.generateId(),
        type: 'box',
        color: '#111827',
        name: 'Chair Back',
        position: {
          x: (config.deskPosition?.x ?? -1.2) + Math.sin(config.deskFacing) * 0.75,
          y: 0.75,
          z: (config.deskPosition?.z ?? 0.8) + Math.cos(config.deskFacing) * 0.75
        },
        rotation: { x: 0, y: config.deskFacing, z: 0 },
        size: { x: 0.55, y: 0.6, z: 0.12 }
      },
      {
        id: this.generateId(),
        type: 'box',
        color: '#0f172a',
        name: 'Chair Base',
        position: {
          x: (config.deskPosition?.x ?? -1.2) + Math.sin(config.deskFacing) * 0.6,
          y: 0.2,
          z: (config.deskPosition?.z ?? 0.8) + Math.cos(config.deskFacing) * 0.6
        },
        rotation: { x: 0, y: config.deskFacing, z: 0 },
        size: { x: 0.45, y: 0.08, z: 0.45 }
      }
    );

    return items;
  }

  private async buildStockedDemoLayout(): Promise<LayoutItem[]> {
    const layout = this.buildPharmacyLayout({
      roomWidth: 12,
      roomDepth: 9,
      shelfHeight: 1.35,
      shelfDepth: 0.55,
      boxRows: 2,
      boxCols: 10,
      deskFacing: Math.PI,
      deskPosition: { x: -2.2, z: 2.8 }
    });
    const catalog = await this.loadMedicineCatalog();
    if (catalog.length === 0) {
      return layout;
    }
    this.ensureProductCatalogSeeded(catalog);
    const boxes = layout.filter(item =>
      item.type === 'box' && item.name && (item.name.startsWith('B-') || item.name.startsWith('L-') || item.name.startsWith('R-'))
    );
    this.seedBoxMedicines(boxes, catalog);
    return layout;
  }

  private seedBoxMedicines(boxes: LayoutItem[], catalog: MedicineCatalogEntry[]): void {
    const sortedBoxes = boxes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let catalogIndex = 0;
    const highBoxes = 6;
    const lowBoxes = 6;
    sortedBoxes.forEach((box, index) => {
      const isHigh = index < highBoxes;
      const isLow = index >= sortedBoxes.length - lowBoxes;
      const medsInBox = isHigh ? 8 : isLow ? 2 : 5;
      const medicines: MedicineEntry[] = [];
      const tagCounts = new Map<string, number>();
      for (let i = 0; i < medsInBox && catalogIndex < catalog.length; i += 1, catalogIndex += 1) {
        const entry = catalog[catalogIndex];
        const qty = this.seedMedicineQty(isHigh, isLow, i, catalogIndex);
        medicines.push({ name: entry.name, qty });
        if (entry.category) {
          const tag = this.normalizeTag(entry.category);
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      box.medicines = medicines;
      box.tag = this.pickDominantTag(tagCounts, index);
      const minStock = isHigh ? 70 : isLow ? 30 : 40;
      const maxStock = isHigh ? 140 : isLow ? 80 : 120;
      box.minStock = minStock;
      box.maxStock = maxStock;
      box.capacity = maxStock;
    });
  }

  private pickDominantTag(tagCounts: Map<string, number>, index: number): string {
    if (tagCounts.size > 0) {
      return [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const fallback = ['General', 'Pain Relief', 'Gastro', 'Antibiotics', 'Respiratory', 'Vitamins', 'Dermatology'];
    return fallback[index % fallback.length];
  }

  private normalizeTag(category: string): string {
    const value = category.toLowerCase();
    if (value.includes('pain') || value.includes('analges')) return 'Pain Relief';
    if (value.includes('antibiotic')) return 'Antibiotics';
    if (value.includes('gastro') || value.includes('ulcer') || value.includes('acidity')) return 'Gastro';
    if (value.includes('respir') || value.includes('cough') || value.includes('cold') || value.includes('asthma')) {
      return 'Respiratory';
    }
    if (value.includes('cardiac') || value.includes('heart') || value.includes('hypertension')) return 'Cardiac';
    if (value.includes('diabet')) return 'Diabetes';
    if (value.includes('derma') || value.includes('skin')) return 'Dermatology';
    if (value.includes('vitamin') || value.includes('supplement') || value.includes('nutrition')) return 'Vitamins';
    if (value.includes('women') || value.includes('pregnan') || value.includes('gyn')) return "Women's Health";
    if (value.includes('baby') || value.includes('pediatric')) return 'Baby Care';
    if (value.includes('ent') || value.includes('ophthal') || value.includes('eye') || value.includes('ear')) {
      return 'ENT/Ophthalmic';
    }
    if (value.includes('dental')) return 'Dental';
    if (value.includes('wound') || value.includes('antiseptic')) return 'Wound Care';
    if (value.includes('ayur')) return 'Ayurveda';
    if (value.includes('homeo')) return 'Homeopathy';
    if (value.includes('disposable') || value.includes('syringe')) return 'Disposables';
    return 'General';
  }

  private seedMedicineQty(isHigh: boolean, isLow: boolean, slotIndex: number, catalogIndex: number): number {
    if (isHigh) {
      return 18 + (slotIndex % 4) * 6;
    }
    if (isLow) {
      return 4 + (slotIndex % 2) * 3;
    }
    return 8 + (catalogIndex % 6) * 2;
  }

  private async loadMedicineCatalog(): Promise<MedicineCatalogEntry[]> {
    if (this.medicineCatalog) return this.medicineCatalog;
    try {
      const primary = await fetch('/assets/data/medicine-catalog-300.json');
      const response = primary.ok ? primary : await fetch('assets/data/medicine-catalog-300.json');
      if (!response.ok) throw new Error('Failed to load medicine catalog');
      const data = (await response.json()) as MedicineCatalogEntry[];
      this.medicineCatalog = data.filter(entry => entry?.name);
      return this.medicineCatalog;
    } catch (error) {
      console.warn('Unable to load medicine catalog', error);
      this.medicineCatalog = [];
      return this.medicineCatalog;
    }
  }

  private ensureProductCatalogSeeded(catalog: MedicineCatalogEntry[]): void {
    const raw = localStorage.getItem(this.productStorageKey);
    if (raw) {
      try {
        const existing = JSON.parse(raw) as ProductCatalogItem[];
        if (Array.isArray(existing) && existing.length > 0) {
          return;
        }
      } catch {
        // Fall through to seed.
      }
    }
    const products: ProductCatalogItem[] = catalog.map((entry, index) => ({
      id: index + 1,
      name: entry.name,
      category: entry.category || 'Medicine',
      quantity: 50
    }));
    localStorage.setItem(this.productStorageKey, JSON.stringify(products));
    window.dispatchEvent(new Event('buildaq-products-updated'));
  }

  private promptBoxName(): string {
    return 'Box';
  }

  private createBoxLabel(
    text: string,
    size: { x: number; y: number; z: number },
    status: 'low' | 'high' | null,
    side: 'front' | 'back' = 'front'
  ): THREE.Object3D {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const statusColor = status === 'low' ? '#ef4444' : status === 'high' ? '#22c55e' : '#ffffff';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      if (status) {
        ctx.fillStyle = statusColor;
        ctx.fillRect(8, 8, canvas.width - 16, 22);
        ctx.beginPath();
        const iconSize = 28;
        const iconCenterX = canvas.width - 36;
        const iconCenterY = 19;
        if (status === 'low') {
          ctx.moveTo(iconCenterX, iconCenterY + iconSize / 2);
          ctx.lineTo(iconCenterX - iconSize / 2, iconCenterY - iconSize / 2);
          ctx.lineTo(iconCenterX + iconSize / 2, iconCenterY - iconSize / 2);
        } else {
          ctx.moveTo(iconCenterX, iconCenterY - iconSize / 2);
          ctx.lineTo(iconCenterX - iconSize / 2, iconCenterY + iconSize / 2);
          ctx.lineTo(iconCenterX + iconSize / 2, iconCenterY + iconSize / 2);
        }
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      let fontSize = 140;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      while (ctx.measureText(text).width > canvas.width - 40 && fontSize > 40) {
        fontSize -= 8;
        ctx.font = `bold ${fontSize}px Arial`;
      }
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    material.side = THREE.DoubleSide;
    const width = Math.max(0.1, size.x * 0.98);
    const height = Math.max(0.1, size.y * 0.98);
    const group = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    front.position.set(0, 0, (side === 'front' ? 1 : -1) * (size.z / 2 + 0.01));
    if (side === 'back') {
      front.rotation.y = Math.PI;
    }
    group.add(front);
    if (text.toLowerCase().includes('desk')) {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      back.position.set(0, 0, -size.z / 2 - 0.01);
      back.rotation.y = Math.PI;
      group.add(back);
    }
    return group;
  }

  private updateTagFlags(): void {
    this.tagFlags.forEach(flag => this.disposeObject(flag));
    this.tagFlags.clear();
    const taggedBoxes = this.layoutItems.filter(item => item.type === 'box' && item.tag && item.tag.trim());
    if (taggedBoxes.length === 0) return;
    const groups = new Map<string, LayoutItem[]>();
    taggedBoxes.forEach(item => {
      const tag = item.tag!.trim();
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(item);
    });
    groups.forEach((items, tag) => {
      const agg = items.reduce(
        (acc, item) => {
          acc.x += item.position.x;
          acc.z += item.position.z;
          acc.y = Math.max(acc.y, item.position.y + item.size.y / 2);
          return acc;
        },
        { x: 0, y: 0, z: 0 }
      );
      const count = items.length || 1;
      const x = agg.x / count;
      const z = agg.z / count;
      const y = agg.y + 0.6;
      const flag = this.createTagFlag(tag);
      flag.position.set(x, y, z);
      const angle = Math.atan2(0 - x, 0 - z);
      flag.rotation.y = angle;
      this.scene.add(flag);
      this.tagFlags.set(tag, flag);
    });
    this.applyZoneFilter();
  }

  private createTagFlag(text: string): THREE.Object3D {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.fillStyle = '#f8fafc';
      let fontSize = 96;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      while (ctx.measureText(text).width > canvas.width - 40 && fontSize > 32) {
        fontSize -= 6;
        ctx.font = `bold ${fontSize}px Arial`;
      }
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const boardMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), boardMaterial);
    board.position.set(0, 0.45, 0.05);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#475569' });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 16), poleMaterial);
    pole.position.set(-0.55, 0.2, 0);
    const group = new THREE.Group();
    group.add(pole, board);
    group.userData['tag'] = text;
    return group;
  }

  private pickZoneTag(event: MouseEvent): string | null {
    this.updatePointer(event as unknown as PointerEvent);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.tagFlags.values()], true);
    if (!hits.length) return null;
    let current: THREE.Object3D | null = hits[0].object;
    while (current) {
      const tag = current.userData?.['tag'] as string | undefined;
      if (tag) return tag;
      current = current.parent;
    }
    return null;
  }

  private applyZoneFilter(): void {
    const active = this.activeZoneTag;
    this.boxMeshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material) return;
      if (!mesh.userData?.['zoneOrigOpacity']) {
        mesh.userData['zoneOrigOpacity'] = material.opacity;
        mesh.userData['zoneOrigTransparent'] = material.transparent;
        mesh.userData['zoneOrigDepthWrite'] = material.depthWrite;
      }
      const id = mesh.userData?.['layoutId'] as string | undefined;
      const item = id ? this.layoutMap.get(id) : undefined;
      const matches = !active || Boolean(item?.tag && item.tag.trim() === active);
      if (matches) {
        material.opacity = mesh.userData['zoneOrigOpacity'] as number;
        material.transparent = mesh.userData['zoneOrigTransparent'] as boolean;
        material.depthWrite = mesh.userData['zoneOrigDepthWrite'] as boolean;
      } else {
        material.transparent = true;
        material.opacity = 0.12;
        material.depthWrite = false;
      }
      material.needsUpdate = true;
      const label = id ? this.boxLabels.get(id) : undefined;
      if (label) {
        label.visible = matches;
      }
    });
  }

  private getActiveColor(forType?: LayoutType): string {
    const type = forType || (this.mode === 'drawWall' ? 'wall' : this.mode === 'drawShelf' ? 'shelf' : 'box');
    if (type === 'wall') return this.wallColor;
    if (type === 'shelf') return this.shelfColor;
    return this.boxColor;
  }

  private onKeyDownHandler = (event: KeyboardEvent): void => {
    if (!this.selectedMesh) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.deleteMesh(this.selectedMesh);
      this.detachTransform();
      return;
    }
    if (event.key === 'n' || event.key === 'N') {
      const id = this.selectedMesh.userData?.['layoutId'] as string | undefined;
      if (!id) return;
      const item = this.layoutMap.get(id);
      if (!item || item.type !== 'box') return;
      const newName = window.prompt('Rename box', item.name || 'Box') || '';
      if (!newName.trim()) return;
      item.name = newName.trim();
        const label = this.boxLabels.get(id);
      if (label) {
        label.parent?.remove(label);
        const updated = this.createBoxLabel(
          this.getBoxDisplayName(item),
          item.size,
          this.getStockStatus(item),
          this.getLabelSide(item)
        );
        this.selectedMesh.add(updated);
        this.boxLabels.set(id, updated);
      }
      this.saveLayout();
    }
  };

  private onWindowClick = (): void => {
    if (this.contextMenu.visible) {
      this.contextMenu.visible = false;
    }
  };
}
