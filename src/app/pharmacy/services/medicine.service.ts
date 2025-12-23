import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Medicine {
  id: string;
  name: string;
  barcode: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  quantity?: number;
  expiryDate?: Date;
  category?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MedicineService {
  private medicines = new BehaviorSubject<Medicine[]>([]);
  private readonly storageKey = 'buildaq.pharmacy.medicineCatalog';

  // Sample medicine database
  private readonly seedCatalog: Medicine[] = [
    {
      id: '1',
      name: 'Aspirin',
      barcode: '8901234567890',
      genericName: 'Acetylsalicylic Acid',
      manufacturer: 'Generic Pharma',
      strength: '500mg',
      category: 'Pain Relief'
    },
    {
      id: '2',
      name: 'Paracetamol',
      barcode: '8901234567891',
      genericName: 'Acetaminophen',
      manufacturer: 'Generic Pharma',
      strength: '500mg',
      category: 'Pain Relief'
    },
    {
      id: '3',
      name: 'Amoxicillin',
      barcode: '8901234567892',
      genericName: 'Amoxicillin',
      manufacturer: 'Antibiotic Labs',
      strength: '250mg',
      category: 'Antibiotics'
    },
    {
      id: '4',
      name: 'Ibuprofen',
      barcode: '8901234567893',
      genericName: 'Ibuprofen',
      manufacturer: 'Generic Pharma',
      strength: '400mg',
      category: 'Pain Relief'
    },
    {
      id: '5',
      name: 'Metformin',
      barcode: '8901234567894',
      genericName: 'Metformin',
      manufacturer: 'Diabetes Care',
      strength: '500mg',
      category: 'Diabetes'
    },
    {
      id: '6',
      name: 'Lisinopril',
      barcode: '8901234567895',
      genericName: 'Lisinopril',
      manufacturer: 'Cardio Labs',
      strength: '10mg',
      category: 'Cardiovascular'
    },
    {
      id: '7',
      name: 'Atorvastatin',
      barcode: '8901234567896',
      genericName: 'Atorvastatin',
      manufacturer: 'Cardio Labs',
      strength: '20mg',
      category: 'Cholesterol'
    },
    {
      id: '8',
      name: 'Omeprazole',
      barcode: '8901234567897',
      genericName: 'Omeprazole',
      manufacturer: 'GI Health',
      strength: '20mg',
      category: 'Gastric'
    }
  ];

  private medicineCatalog: Medicine[] = [];

  constructor() {
    this.loadFromStorage();
  }

  getMedicines(): Medicine[] {
    return [...this.medicineCatalog];
  }

  getMedicinesObservable(): Observable<Medicine[]> {
    return this.medicines.asObservable();
  }

  getMedicinesByCategory(category: string): Medicine[] {
    return this.medicineCatalog.filter(m => m.category === category);
  }

  searchMedicines(query: string): Medicine[] {
    const lowerQuery = query.toLowerCase();
    return this.medicineCatalog.filter(m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.genericName?.toLowerCase().includes(lowerQuery) ||
      m.barcode.includes(query)
    );
  }

  getMedicineByBarcode(barcode: string): Medicine | undefined {
    return this.medicineCatalog.find(m => m.barcode === barcode);
  }

  getMedicineById(id: string): Medicine | undefined {
    return this.medicineCatalog.find(m => m.id === id);
  }

  addMedicine(medicine: Medicine): void {
    this.medicineCatalog.push(medicine);
    this.medicines.next([...this.medicineCatalog]);
    this.saveToStorage();
  }

  updateMedicine(id: string, updates: Partial<Medicine>): void {
    const index = this.medicineCatalog.findIndex(m => m.id === id);
    if (index !== -1) {
      this.medicineCatalog[index] = { ...this.medicineCatalog[index], ...updates };
      this.medicines.next([...this.medicineCatalog]);
      this.saveToStorage();
    }
  }

  deleteMedicine(id: string): void {
    this.medicineCatalog = this.medicineCatalog.filter(m => m.id !== id);
    this.medicines.next([...this.medicineCatalog]);
    this.saveToStorage();
  }

  getCategories(): string[] {
    const categories = new Set(
      this.medicineCatalog
        .map(m => m.category)
        .filter((c): c is string => !!c)
    );
    return Array.from(categories).sort();
  }

  importMedicines(medicines: Medicine[]): { added: number; updated: number; skipped: number; total: number } {
    let added = 0;
    let updated = 0;
    let skipped = 0;

    medicines.forEach((incoming) => {
      if (!incoming?.name) {
        skipped++;
        return;
      }

      const incomingBarcode = (incoming.barcode || '').trim();
      const incomingName = incoming.name.trim().toLowerCase();

      const existing = this.medicineCatalog.find(m => {
        if (incomingBarcode && m.barcode) {
          return m.barcode.trim() === incomingBarcode;
        }
        return m.name.trim().toLowerCase() === incomingName;
      });

      if (existing) {
        this.mergeMedicine(existing, incoming);
        updated++;
        return;
      }

      const newMedicine: Medicine = {
        id: incoming.id || (this.medicineCatalog.length + 1).toString(),
        name: incoming.name,
        barcode: incomingBarcode,
        genericName: incoming.genericName || '',
        manufacturer: incoming.manufacturer || '',
        strength: incoming.strength || '',
        quantity: incoming.quantity ?? 0,
        expiryDate: incoming.expiryDate,
        category: incoming.category || ''
      };

      this.medicineCatalog.push(newMedicine);
      added++;
    });

    this.medicines.next([...this.medicineCatalog]);
    this.saveToStorage();

    return { added, updated, skipped, total: medicines.length };
  }

  private mergeMedicine(target: Medicine, incoming: Medicine): void {
    target.name = incoming.name || target.name;
    target.barcode = (incoming.barcode || target.barcode || '').trim();
    target.genericName = incoming.genericName || target.genericName;
    target.manufacturer = incoming.manufacturer || target.manufacturer;
    target.strength = incoming.strength || target.strength;
    target.quantity = incoming.quantity ?? target.quantity;
    target.expiryDate = incoming.expiryDate || target.expiryDate;
    target.category = incoming.category || target.category;
  }

  private loadFromStorage(): void {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.medicineCatalog = parsed;
        }
      }
    } catch {
      // Ignore storage errors and fall back to seed data
    }

    if (!this.medicineCatalog.length) {
      this.medicineCatalog = [...this.seedCatalog];
    }

    this.medicines.next([...this.medicineCatalog]);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.medicineCatalog));
    } catch {
      // Ignore storage errors (e.g., storage disabled)
    }
  }
}
