declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher } from 'three';

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    enabled: boolean;
    enableDamping: boolean;
    update(): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/controls/TransformControls' {
  import { Camera, EventDispatcher, Object3D } from 'three';

  export class TransformControls extends Object3D {
    constructor(object: Camera, domElement?: HTMLElement);
    setMode(mode: 'translate' | 'rotate' | 'scale'): void;
    attach(object: Object3D): void;
    detach(): void;
    enabled: boolean;
    dragging: boolean;
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    dispose(): void;
  }
}
