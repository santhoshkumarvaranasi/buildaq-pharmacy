import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImageDetectionService, DetectionResult } from '../../services/image-detection.service';
import { ShelfMappingService, MedicineLocation } from '../../services/shelf-mapping.service';
import { MedicineService, Medicine } from '../../services/medicine.service';

@Component({
  selector: 'app-medicine-detection',
  templateUrl: './medicine-detection.component.html',
  styleUrls: ['./medicine-detection.component.scss']
})
export class MedicineDetectionComponent implements OnInit {
  form!: FormGroup;
  detectionResult: DetectionResult | null = null;
  isLoading = false;
  selectedShelf: any = null;
  medicines: any[] = [];
  detectedMedicines: MedicineLocation[] = [];

  displayedColumns: string[] = ['name', 'class', 'confidence', 'position', 'actions'];

  constructor(
    private formBuilder: FormBuilder,
    private imageDetectionService: ImageDetectionService,
    private shelfMappingService: ShelfMappingService,
    private medicineService: MedicineService,
    private snackBar: MatSnackBar
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.medicineService.getMedicinesObservable().subscribe((medicines: Medicine[]) => {
      this.medicines = medicines;
    });

    this.imageDetectionService.getLoadingState().subscribe(loading => {
      this.isLoading = loading;
    });

    this.imageDetectionService.getDetectionResults().subscribe(result => {
      this.detectionResult = result;
      if (result) {
        this.processDetectionResults(result);
      }
    });

    this.shelfMappingService.getCurrentShelf().subscribe(shelf => {
      this.selectedShelf = shelf;
      if (shelf) {
        this.detectedMedicines = this.shelfMappingService.getMedicinesByShelf(shelf.id);
      }
    });
  }

  private createForm(): void {
    this.form = this.formBuilder.group({
      imageUrl: ['', Validators.required],
      minConfidence: [0.5, [Validators.required, Validators.min(0), Validators.max(1)]],
      filterClass: ['']
    });
  }

  async detectFromUrl(): Promise<void> {
    const imageUrl = this.form.get('imageUrl')?.value;
    if (imageUrl) {
      const result = await this.imageDetectionService.detectMedicines(imageUrl);
      if (result) {
        this.snackBar.open(`Detected ${result.objects.length} objects`, 'Close', { duration: 3000 });
      }
    }
  }

  private processDetectionResults(result: DetectionResult): void {
    const minConfidence = this.form.get('minConfidence')?.value || 0.5;
    const filterClass = this.form.get('filterClass')?.value;

    let filtered = result.objects.filter(obj => obj.score >= minConfidence);

    if (filterClass) {
      filtered = filtered.filter(obj => obj.class.toLowerCase().includes(filterClass.toLowerCase()));
    }

    this.detectedMedicines = filtered.map((obj, index) => ({
      id: `detected_${index}_${Date.now()}`,
      name: this.getMedicineNameByClass(obj.class),
      barcode: '',
      x: Math.round(obj.x),
      y: Math.round(obj.y),
      width: Math.round(obj.bbox[2]),
      height: Math.round(obj.bbox[3]),
      confidence: obj.score,
      shelfId: this.selectedShelf?.id || '',
      detectionTime: new Date()
    }));
  }

  private getMedicineNameByClass(className: string): string {
    // Try to find a matching medicine by class name
    const medicine = this.medicines.find(m =>
      m.name.toLowerCase().includes(className.toLowerCase()) ||
      m.category?.toLowerCase().includes(className.toLowerCase())
    );
    return medicine?.name || className;
  }

  addMedicineToShelf(medicine: MedicineLocation): void {
    if (!this.selectedShelf) {
      this.snackBar.open('Please select a shelf first', 'Close', { duration: 3000 });
      return;
    }

    this.shelfMappingService.addMedicineToShelf(this.selectedShelf.id, medicine);
    this.snackBar.open(`${medicine.name} added to shelf`, 'Close', { duration: 3000 });
  }

  removeMedicine(medicineId: string): void {
    if (this.selectedShelf) {
      this.shelfMappingService.removeMedicineFromShelf(this.selectedShelf.id, medicineId);
      this.detectedMedicines = this.detectedMedicines.filter(m => m.id !== medicineId);
      this.snackBar.open('Medicine removed', 'Close', { duration: 3000 });
    }
  }

  updatePosition(medicineId: string, x: number, y: number): void {
    if (this.selectedShelf) {
      this.shelfMappingService.updateMedicineLocation(this.selectedShelf.id, medicineId, x, y);
      this.snackBar.open('Position updated', 'Close', { duration: 2000 });
    }
  }

  filterDetections(): void {
    if (this.detectionResult) {
      this.processDetectionResults(this.detectionResult);
    }
  }

  getPositionText(medicine: MedicineLocation): string {
    return `(${medicine.x}, ${medicine.y})`;
  }
}
