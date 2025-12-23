import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MedicineLocation {
  id: string;
  name: string;
  barcode?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  shelfId: string;
  detectionTime: Date;
}

export interface Shelf {
  id: string;
  name: string;
  location: string;
  width: number;
  height: number;
  depth?: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  medicines: MedicineLocation[];
  imageUrl?: string;
}

export interface VisualSpace {
  id: string;
  name: string;
  location: string;
  imageUrl?: string;
  unit?: 'cm' | 'm';
  roomWidth?: number;
  roomDepth?: number;
  roomHeight?: number;
  locationPoint?: { x: number; y: number; z: number };
  deskPosition?: { x: number; y: number; z: number; rotY?: number };
  chairPosition?: { x: number; y: number; z: number; rotY?: number };
  buildaqBoxes?: Array<{
    name: string;
    category: string;
    label?: string;
    shelf: string;
    x: number;
    y: number;
    width: number;
    depth: number;
  }>;
  shelves: Shelf[];
  createdDate: Date;
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ShelfMappingService {
  private visualSpaces = new BehaviorSubject<VisualSpace[]>([]);
  private currentVisualSpace = new BehaviorSubject<VisualSpace | null>(null);
  private currentShelf = new BehaviorSubject<Shelf | null>(null);

  constructor() {
    this.loadFromLocalStorage();
  }

  createVisualSpace(name: string, location: string, imageUrl?: string): VisualSpace {
    const newSpace: VisualSpace = {
      id: this.generateId(),
      name,
      location,
      imageUrl: imageUrl || '',
      shelves: [],
      createdDate: new Date(),
      lastUpdated: new Date()
    };

    const spaces = this.visualSpaces.getValue();
    spaces.push(newSpace);
    this.visualSpaces.next(spaces);
    this.currentVisualSpace.next(newSpace);
    this.saveToLocalStorage();

    return newSpace;
  }

  createVisualSpace3D(
    name: string,
    location: string,
    unit: 'cm' | 'm',
    roomWidth: number,
    roomDepth: number,
    roomHeight: number,
    locationPoint?: { x: number; y: number; z: number }
  ): VisualSpace {
    const newSpace: VisualSpace = {
      id: this.generateId(),
      name,
      location,
      unit,
      roomWidth,
      roomDepth,
      roomHeight,
      locationPoint,
      deskPosition: { x: 0, y: 0, z: 2, rotY: 0 },
      chairPosition: { x: 0, y: 0, z: 1, rotY: Math.PI },
      buildaqBoxes: [],
      shelves: [],
      createdDate: new Date(),
      lastUpdated: new Date()
    };

    const spaces = this.visualSpaces.getValue();
    spaces.push(newSpace);
    this.visualSpaces.next(spaces);
    this.currentVisualSpace.next(newSpace);
    this.saveToLocalStorage();

    return newSpace;
  }

  createShelf(visualSpaceId: string, name: string, width: number, height: number): Shelf {
    const spaces = this.visualSpaces.getValue();
    const space = spaces.find(s => s.id === visualSpaceId);

    if (!space) {
      throw new Error('Visual space not found');
    }

    const newShelf: Shelf = {
      id: this.generateId(),
      name,
      location: space.location,
      width,
      height,
      medicines: []
    };

    space.shelves.push(newShelf);
    space.lastUpdated = new Date();
    this.visualSpaces.next(spaces);
    this.currentShelf.next(newShelf);
    this.saveToLocalStorage();

    return newShelf;
  }

  createShelf3D(
    visualSpaceId: string,
    name: string,
    width: number,
    depth: number,
    height: number,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): Shelf {
    const spaces = this.visualSpaces.getValue();
    const space = spaces.find(s => s.id === visualSpaceId);

    if (!space) {
      throw new Error('Visual space not found');
    }

    const newShelf: Shelf = {
      id: this.generateId(),
      name,
      location: space.location,
      width,
      height,
      depth,
      position,
      rotation,
      medicines: []
    };

    space.shelves.push(newShelf);
    space.lastUpdated = new Date();
    this.visualSpaces.next(spaces);
    this.currentShelf.next(newShelf);
    this.saveToLocalStorage();

    return newShelf;
  }

  updateShelfGeometry(shelfId: string, updates: Partial<Shelf>): void {
    const spaces = this.visualSpaces.getValue();

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        Object.assign(shelf, updates);
        space.lastUpdated = new Date();
      }
    });

    this.visualSpaces.next(spaces);
    this.saveToLocalStorage();
  }

  updateVisualSpace3D(visualSpaceId: string, updates: Partial<VisualSpace>): void {
    const spaces = this.visualSpaces.getValue();
    const space = spaces.find(s => s.id === visualSpaceId);
    if (space) {
      Object.assign(space, updates);
      space.lastUpdated = new Date();
      this.visualSpaces.next(spaces);
      this.currentVisualSpace.next(space);
      this.saveToLocalStorage();
    }
  }

  addMedicineToShelf(shelfId: string, medicine: MedicineLocation): void {
    const spaces = this.visualSpaces.getValue();
    let found = false;

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        medicine.shelfId = shelfId;
        shelf.medicines.push(medicine);
        space.lastUpdated = new Date();
        found = true;
      }
    });

    if (found) {
      this.visualSpaces.next(spaces);
      this.saveToLocalStorage();
    }
  }

  updateMedicineOnShelf(shelfId: string, medicineId: string, updates: Partial<MedicineLocation>): void {
    const spaces = this.visualSpaces.getValue();
    let updated = false;

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        const medicine = shelf.medicines.find(m => m.id === medicineId);
        if (medicine) {
          Object.assign(medicine, updates);
          space.lastUpdated = new Date();
          updated = true;
        }
      }
    });

    if (updated) {
      this.visualSpaces.next(spaces);
      this.saveToLocalStorage();
    }
  }

  updateMedicineLocation(shelfId: string, medicineId: string, x: number, y: number): void {
    const spaces = this.visualSpaces.getValue();

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        const medicine = shelf.medicines.find(m => m.id === medicineId);
        if (medicine) {
          medicine.x = x;
          medicine.y = y;
          space.lastUpdated = new Date();
        }
      }
    });

    this.visualSpaces.next(spaces);
    this.saveToLocalStorage();
  }

  removeMedicineFromShelf(shelfId: string, medicineId: string): void {
    const spaces = this.visualSpaces.getValue();

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        shelf.medicines = shelf.medicines.filter(m => m.id !== medicineId);
        space.lastUpdated = new Date();
      }
    });

    this.visualSpaces.next(spaces);
    this.saveToLocalStorage();
  }

  deleteShelf(visualSpaceId: string, shelfId: string): void {
    const spaces = this.visualSpaces.getValue();
    const space = spaces.find(s => s.id === visualSpaceId);

    if (space) {
      space.shelves = space.shelves.filter(s => s.id !== shelfId);
      space.lastUpdated = new Date();
      this.visualSpaces.next(spaces);
      this.saveToLocalStorage();
    }
  }

  deleteVisualSpace(id: string): void {
    const spaces = this.visualSpaces.getValue().filter(s => s.id !== id);
    this.visualSpaces.next(spaces);
    this.saveToLocalStorage();
  }

  getVisualSpaces(): Observable<VisualSpace[]> {
    return this.visualSpaces.asObservable();
  }

  getCurrentVisualSpace(): Observable<VisualSpace | null> {
    return this.currentVisualSpace.asObservable();
  }

  getCurrentShelf(): Observable<Shelf | null> {
    return this.currentShelf.asObservable();
  }

  setCurrentVisualSpace(id: string): void {
    const spaces = this.visualSpaces.getValue();
    const space = spaces.find(s => s.id === id) || null;
    this.currentVisualSpace.next(space);
  }

  setCurrentShelf(id: string): void {
    const spaces = this.visualSpaces.getValue();
    let shelf: Shelf | null = null;

    spaces.forEach(space => {
      const found = space.shelves.find(s => s.id === id);
      if (found) {
        shelf = found;
      }
    });

    this.currentShelf.next(shelf);
  }

  getMedicinesByShelf(shelfId: string): MedicineLocation[] {
    const spaces = this.visualSpaces.getValue();
    let medicines: MedicineLocation[] = [];

    spaces.forEach(space => {
      const shelf = space.shelves.find(s => s.id === shelfId);
      if (shelf) {
        medicines = shelf.medicines;
      }
    });

    return medicines;
  }

  private generateId(): string {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  private saveToLocalStorage(): void {
    const spaces = this.visualSpaces.getValue();
    localStorage.setItem('visual_spaces', JSON.stringify(spaces));
  }

  private loadFromLocalStorage(): void {
    const data = localStorage.getItem('visual_spaces');
    if (data) {
      try {
        const spaces = JSON.parse(data) as VisualSpace[];
        spaces.forEach(space => {
          if (!space.deskPosition) {
            space.deskPosition = { x: 0, y: 0, z: 2, rotY: 0 };
          }
          if (!space.chairPosition) {
            space.chairPosition = { x: 0, y: 0, z: 1, rotY: Math.PI };
          }
          if (!space.buildaqBoxes) {
            space.buildaqBoxes = [];
          }
          space.shelves.forEach(shelf => {
            if (!shelf.depth) shelf.depth = shelf.width;
            if (!shelf.position) shelf.position = { x: 0, y: 0, z: 0 };
            if (!shelf.rotation) shelf.rotation = { x: 0, y: 0, z: 0 };
          });
        });
        this.visualSpaces.next(spaces);
      } catch (error) {
        console.error('Error loading visual spaces from storage:', error);
      }
    }
  }
}
