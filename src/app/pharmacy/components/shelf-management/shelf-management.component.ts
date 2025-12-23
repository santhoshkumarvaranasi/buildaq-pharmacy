import { Component, OnInit } from '@angular/core';
import { ShelfMappingService, VisualSpace, Shelf, MedicineLocation } from '../../services/shelf-mapping.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-shelf-management',
  templateUrl: './shelf-management.component.html',
  styleUrls: ['./shelf-management.component.scss']
})
export class ShelfManagementComponent implements OnInit {
  visualSpaces: VisualSpace[] = [];
  selectedSpace: VisualSpace | null = null;
  selectedShelf: Shelf | null = null;
  medicines: MedicineLocation[] = [];
  manualMedicine = {
    name: '',
    barcode: '',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    confidence: 0.9
  };

  displayedMedicineColumns: string[] = ['name', 'position', 'confidence', 'actions'];

  constructor(
    private shelfMappingService: ShelfMappingService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.shelfMappingService.getVisualSpaces().subscribe(spaces => {
      this.visualSpaces = spaces;
    });

    this.shelfMappingService.getCurrentShelf().subscribe(shelf => {
      this.selectedShelf = shelf;
      if (shelf) {
        this.medicines = this.shelfMappingService.getMedicinesByShelf(shelf.id);
      }
    });
  }

  selectVisualSpace(space: VisualSpace): void {
    this.selectedSpace = space;
    this.shelfMappingService.setCurrentVisualSpace(space.id);
    this.selectedShelf = null;
    this.medicines = [];
  }

  selectShelf(shelf: Shelf): void {
    this.selectedShelf = shelf;
    this.shelfMappingService.setCurrentShelf(shelf.id);
    this.medicines = this.shelfMappingService.getMedicinesByShelf(shelf.id);
  }

  deleteShelf(spaceId: string, shelfId: string): void {
    if (confirm('Are you sure you want to delete this shelf?')) {
      this.shelfMappingService.deleteShelf(spaceId, shelfId);
      if (this.selectedShelf?.id === shelfId) {
        this.selectedShelf = null;
        this.medicines = [];
      }
      this.snackBar.open('Shelf deleted', 'Close', { duration: 3000 });
    }
  }

  removeMedicine(medicineId: string): void {
    if (this.selectedShelf) {
      this.shelfMappingService.removeMedicineFromShelf(this.selectedShelf.id, medicineId);
      this.medicines = this.medicines.filter(m => m.id !== medicineId);
      this.snackBar.open('Medicine removed from shelf', 'Close', { duration: 3000 });
    }
  }

  addManualMedicine(): void {
    if (!this.selectedShelf) {
      this.snackBar.open('Please select a shelf first', 'Close', { duration: 3000 });
      return;
    }

    const name = this.manualMedicine.name.trim();
    if (!name) {
      this.snackBar.open('Medicine name is required', 'Close', { duration: 3000 });
      return;
    }

    const medicine: MedicineLocation = {
      id: this.generateId(),
      name,
      barcode: this.manualMedicine.barcode.trim() || undefined,
      x: Number(this.manualMedicine.x) || 0,
      y: Number(this.manualMedicine.y) || 0,
      width: Number(this.manualMedicine.width) || 50,
      height: Number(this.manualMedicine.height) || 50,
      confidence: Number(this.manualMedicine.confidence) || 0.9,
      shelfId: this.selectedShelf.id,
      detectionTime: new Date()
    };

    this.shelfMappingService.addMedicineToShelf(this.selectedShelf.id, medicine);
    this.medicines = this.shelfMappingService.getMedicinesByShelf(this.selectedShelf.id);
    this.manualMedicine = {
      name: '',
      barcode: '',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      confidence: 0.9
    };
    this.snackBar.open('Medicine added to shelf', 'Close', { duration: 3000 });
  }

  exportShelfData(): void {
    if (!this.selectedShelf) {
      this.snackBar.open('Please select a shelf', 'Close', { duration: 3000 });
      return;
    }

    const data = {
      shelf: this.selectedShelf,
      medicines: this.medicines,
      exportDate: new Date(),
      totalMedicines: this.medicines.length
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.selectedShelf.name}_data_${Date.now()}.json`;
    link.click();

    this.snackBar.open('Data exported successfully', 'Close', { duration: 3000 });
  }

  printShelfData(): void {
    if (!this.selectedShelf) {
      this.snackBar.open('Please select a shelf', 'Close', { duration: 3000 });
      return;
    }

    window.print();
  }

  getAverageConfidence(): number {
    if (this.medicines.length === 0) return 0;
    const sum = this.medicines.reduce((acc, m) => acc + m.confidence, 0);
    return sum / this.medicines.length;
  }

  private generateId(): string {
    return '_' + Math.random().toString(36).substr(2, 9);
  }
}
