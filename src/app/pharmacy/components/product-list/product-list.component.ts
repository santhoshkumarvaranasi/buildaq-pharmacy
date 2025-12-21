import { Component, OnInit, ViewChild, ElementRef, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { ImageDetectionService, DetectionResult } from '../../services/image-detection.service';
import { AdvancedDetectionService } from '../../services/advanced-detection.service';
import { BarcodeScannerService } from '../../services/barcode-scanner.service';
import { OcrService } from '../../services/ocr.service';
import { MedicineService, Medicine } from '../../services/medicine.service';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  expiryDate: string;
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvasRef!: ElementRef<HTMLCanvasElement>;
  
  showImageUpload = false;
  uploadedImageUrl: string | null = null;
  detectedMedicines: DetectionResult | null = null;
  selectedMedicines: { [key: string]: boolean } = {};
  isDetecting = false;
  
  // OCR properties
  isOcrProcessing = false;
  ocrExtractedText = '';
  ocrExtractedMedicines: any[] = [];
  
  // Camera properties
  cameraActive = false;
  cameraStream: MediaStream | null = null;
  showCamera = false;
  
  // Debug console
  consoleLogs: string[] = [];
  showConsole = false;
  maxLogs = 50;
  modelStatus = 'Loading...';
  modelReady = false;
  
  // Test OCR status
  ocrAvailable = false;
  
  // Medicine editing
  editingIndex: number | null = null;
  editingMedicineName = '';
  selectingIndex: number | null = null;
  catalogMedicines: Medicine[] = [];
  
  // Barcode scanning
  @ViewChild('barcodeScanner') barcodeScannerRef!: ElementRef<HTMLVideoElement>;
  showBarcodeScanner = false;
  isBarcodeScanning = false;
  scannedBarcode: string | null = null;
  scannedMedicine: any = null;
  manualBarcodeInput = '';
  barcodeStream: MediaStream | null = null;
  barcodeScannerError: string | null = null;
  cameraPermissionDenied = false;
  cameraInitialized = false;
  
  // Manual medicine entry (for adding medicines not in catalog)
  showManualMedicineForm = false;
  newMedicine = {
    name: '',
    genericName: '',
    strength: '',
    manufacturer: '',
    category: 'Medicine',
    quantity: 50
  };
  
  constructor(
    private imageDetectionService: ImageDetectionService,
    private advancedDetectionService: AdvancedDetectionService,
    private barcodeScannerService: BarcodeScannerService,
    private ocrService: OcrService,
    private medicineService: MedicineService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.setupConsoleLogging();
  }
  
  ngOnInit(): void {
    this.loadProducts();
    this.checkModelStatus();
    this.loadCatalogMedicines();
    this.checkOcrAvailability();
  }
  
  private checkOcrAvailability(): void {
    setTimeout(() => {
      try {
        if (typeof (window as any).Tesseract !== 'undefined') {
          this.ocrAvailable = true;
          console.log('✅ OCR (Tesseract.js) is available');
        } else {
          this.ocrAvailable = false;
          console.warn('⚠️ OCR (Tesseract.js) not available');
        }
      } catch (error) {
        this.ocrAvailable = false;
        console.error('❌ Error checking OCR availability:', error);
      }
    }, 2000); // Wait 2 seconds for Tesseract to load
  }
  
  ngOnDestroy(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
    }
  }
  
  setupConsoleLogging(): void {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const addLog = (type: string, args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      this.consoleLogs.push(`[${type}] ${message}`);
      if (this.consoleLogs.length > this.maxLogs) {
        this.consoleLogs.shift();
      }
    };
    
    console.log = (...args: any[]) => {
      originalLog(...args);
      addLog('LOG', args);
    };
    
    console.error = (...args: any[]) => {
      originalError(...args);
      addLog('ERROR', args);
    };
    
    console.warn = (...args: any[]) => {
      originalWarn(...args);
      addLog('WARN', args);
    };
  }
  
  toggleConsole(): void {
    this.showConsole = !this.showConsole;
  }
  
  clearConsole(): void {
    this.consoleLogs = [];
  }
  
  getLogClass(log: string): string {
    if (log.startsWith('[ERROR]')) return 'log-error';
    if (log.startsWith('[WARN]')) return 'log-warn';
    return 'log-info';
  }
  
  checkModelStatus(): void {
    const checkInterval = setInterval(() => {
      const logs = this.consoleLogs.join('\n');
      
      if (logs.includes('✓ COCO-SSD model loaded successfully')) {
        this.modelStatus = '✓ AI Detection Ready';
        this.modelReady = true;
        clearInterval(checkInterval);
      } else if (logs.includes('using fallback detection')) {
        this.modelStatus = '⚠ Fallback Mode (Image Analysis)';
        this.modelReady = true; // Still functional with fallback
        clearInterval(checkInterval);
      } else if (logs.includes('Failed to load COCO-SSD model')) {
        this.modelStatus = '⚠ Using Fallback Detection';
        this.modelReady = true;
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(checkInterval), 30000);
  }
  
  hasSelectedMedicines(): boolean {
    return Object.values(this.selectedMedicines).some(v => v);
  }
  
  loadProducts(): void {
    // Mock data - replace with actual API call
    this.products = [
      {
        id: 1,
        name: 'Aspirin 500mg',
        category: 'Pain Relief',
        price: 5.99,
        quantity: 100,
        expiryDate: '2025-12-31'
      },
      {
        id: 2,
        name: 'Cough Syrup',
        category: 'Cough & Cold',
        price: 8.99,
        quantity: 50,
        expiryDate: '2025-11-30'
      },
      {
        id: 3,
        name: 'Vitamin C Tablets',
        category: 'Vitamins',
        price: 12.99,
        quantity: 200,
        expiryDate: '2026-06-30'
      }
    ];
  }
  
  onAddProduct(): void {
    this.toggleImageUpload();
  }
  
  toggleImageUpload(): void {
    this.showImageUpload = !this.showImageUpload;
    if (!this.showImageUpload) {
      this.resetImageUpload();
    }
  }
  
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadedImageUrl = e.target?.result as string;
      this.detectMedicinesFromImage();
      // Also extract text from image for faster medicine entry
      this.extractTextFromImage();
    };
    reader.readAsDataURL(file);
  }
  
  async extractTextFromImage(): Promise<void> {
    if (!this.uploadedImageUrl) return;
    
    this.isOcrProcessing = true;
    this.ocrExtractedText = '';
    this.ocrExtractedMedicines = [];
    this.cdr.detectChanges(); // Force UI update
    
    console.log('🔤 Starting OCR extraction from uploaded image...');
    
    try {
      const result = await this.ocrService.extractMedicineDetails(this.uploadedImageUrl);
      
      console.log('OCR Result:', result);
      
      if (result.success && result.rawText) {
        this.ocrExtractedText = result.rawText;
        console.log('✅ Text extracted successfully:', this.ocrExtractedText.substring(0, 100));
        
        // If medicine details were extracted, offer to auto-fill the form
        if (result.medicineDetails && result.medicineDetails.name) {
          this.ocrExtractedMedicines = [result.medicineDetails];
          console.log('📋 Extracted medicine details:', result.medicineDetails);
          
          // Auto-fill the manual medicine form
          this.newMedicine = {
            name: result.medicineDetails.name || '',
            genericName: result.medicineDetails.genericName || '',
            strength: result.medicineDetails.strength || '',
            manufacturer: result.medicineDetails.manufacturer || '',
            category: 'Medicine',
            quantity: 50
          };
          
          // Show confirmation
          const shouldUseExtracted = confirm(
            `Found medicine details:\n\n` +
            `Name: ${result.medicineDetails.name}\n` +
            `Strength: ${result.medicineDetails.strength || 'Not detected'}\n\n` +
            `Click OK to add this medicine, or Cancel to edit manually.`
          );
          
          if (shouldUseExtracted) {
            this.showManualMedicineForm = true;
          }
        } else {
          console.log('⚠️ No medicine details extracted, showing raw text only');
        }
      } else {
        console.warn('⚠️ OCR extraction unsuccessful:', result.error);
      }
    } catch (error) {
      console.error('❌ Error during OCR extraction:', error);
    } finally {
      this.isOcrProcessing = false;
      this.cdr.detectChanges(); // Force UI update
    }
  }
  
  async detectMedicinesFromImage(): Promise<void> {
    if (!this.uploadedImageUrl) return;
    
    this.isDetecting = true;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const imageUrl = this.uploadedImageUrl;
      
      // Promise-based image loading
      const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image loading timeout'));
        }, 5000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(img);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load image'));
        };
        
        img.src = imageUrl;
      });
      
      const loadedImg = await imageLoaded;
      console.log('Image loaded, starting advanced detection...');
      
      // Try advanced detection first (MediaPipe + OCR)
      const advancedResult = await this.advancedDetectionService.detectMedicines(loadedImg);
      
      if (advancedResult && advancedResult.objects && advancedResult.objects.length > 0) {
        console.log('Advanced detection found objects:', advancedResult.objects);
        console.log('Extracted medicines:', advancedResult.medicines);
        
        // Create detection result from advanced detection
        this.detectedMedicines = {
          imageUrl: imageUrl,
          objects: advancedResult.objects,
          timestamp: new Date(),
          imageWidth: loadedImg.width,
          imageHeight: loadedImg.height
        };
      } else {
        // Fallback to basic detection
        console.log('Advanced detection found nothing, using fallback...');
        this.detectedMedicines = await this.imageDetectionService.detectMedicines(loadedImg);
      }
      
      console.log('Detection complete:', this.detectedMedicines);
      
      // Check if detection returned any objects
      if (!this.detectedMedicines || !this.detectedMedicines.objects || this.detectedMedicines.objects.length === 0) {
        console.warn('No medicines detected in the image. Please try another image.');
        this.isDetecting = false;
        alert('❌ No pharmacy items detected in this image.\n\nPlease try a different image that contains:\n• Medicine bottles\n• Medication boxes\n• Pill containers\n• Medicine labels/text');
        return;
      }
      
      // Initialize selection checkboxes
      this.detectedMedicines.objects.forEach((obj, index) => {
        this.selectedMedicines[index] = true;
      });
      console.log('Found', this.detectedMedicines.objects.length, 'medicines');
      this.isDetecting = false;
    } catch (error) {
      console.error('Error detecting medicines:', error);
      alert(`Error detecting medicines: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.isDetecting = false;
    }
  }
  
  addDetectedMedicines(): void {
    if (!this.detectedMedicines) {
      alert('❌ No medicines detected');
      return;
    }
    
    console.log('=== Adding Detected Medicines ===');
    console.log('Detected objects:', this.detectedMedicines.objects.length);
    console.log('Selected indices:', Object.keys(this.selectedMedicines).filter(k => this.selectedMedicines[k]));
    
    const medicineCatalog = this.medicineService.getMedicines();
    let addedCount = 0;
    const medicinesToAdd: string[] = [];
    
    // Only process selected medicines
    this.detectedMedicines.objects.forEach((obj, index) => {
      console.log(`Object ${index}:`, { 
        matchedMedicine: obj.matchedMedicine, 
        class: obj.class, 
        selected: this.selectedMedicines[index] 
      });
      
      if (this.selectedMedicines[index] && obj.matchedMedicine) {
        medicinesToAdd.push(obj.matchedMedicine);
      }
    });
    
    console.log('Medicines to add:', medicinesToAdd);
    
    // Add each selected medicine only once
    medicinesToAdd.forEach(medicineName => {
      // Check if already in product table
      const alreadyInTable = this.products.some(
        p => p.name.toLowerCase() === medicineName.toLowerCase()
      );
      
      if (alreadyInTable) {
        console.log('Already in products table:', medicineName);
        return;
      }
      
      // Check if in medicine catalog
      let medicine = medicineCatalog.find(
        m => m.name.toLowerCase() === medicineName.toLowerCase()
      );
      
      // If not in catalog, create it
      if (!medicine) {
        medicine = {
          id: (medicineCatalog.length + 1).toString(),
          name: medicineName,
          barcode: this.generateBarcode(),
          genericName: medicineName,
          manufacturer: 'Unknown',
          strength: 'As per standard',
          category: 'Medications',
          quantity: 50
        };
        this.medicineService.addMedicine(medicine);
        console.log('✅ Added new medicine to catalog:', medicineName);
      } else {
        console.log('ℹ️ Medicine exists in catalog:', medicineName);
      }
      
      // Add to products table
      const product = this.medicineToProduct(medicine);
      this.products.push(product);
      addedCount++;
      console.log('✅ Added to products table:', medicineName);
    });
    
    this.resetImageUpload();
    
    console.log('=== Summary ===');
    console.log('Total products added:', addedCount);
    
    if (addedCount > 0) {
      alert(`✅ Successfully added ${addedCount} medicine(s)!\n\nNow showing ${this.products.length} total products.`);
    } else {
      alert('ℹ️ All selected medicines were already in your products list.');
    }
  }
  
  private medicineToProduct(medicine: Medicine): Product {
    return {
      id: parseInt(medicine.id),
      name: medicine.name,
      category: medicine.category || 'Uncategorized',
      price: 0,
      quantity: medicine.quantity || 50,
      expiryDate: '2026-12-31'
    };
  }
  
  private generateBarcode(): string {
    return '890' + Math.random().toString().slice(2, 12);
  }
  
  private categorizeByObjectType(objectClass: string): string {
    const categoryMap: { [key: string]: string } = {
      'bottle': 'Syrups & Liquids',
      'box': 'Tablets & Capsules',
      'pill': 'Pain Relief',
      'tablet': 'Medications',
      'cup': 'Containers'
    };
    return categoryMap[objectClass] || 'Medications';
  }
  
  resetImageUpload(): void {
    this.uploadedImageUrl = null;
    this.detectedMedicines = null;
    this.selectedMedicines = {};
    if (this.imageInput) {
      this.imageInput.nativeElement.value = '';
    }
  }
  
  // Camera methods
  async startCamera(): Promise<void> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      
      this.cameraActive = true;
      
      setTimeout(() => {
        if (this.cameraVideoRef) {
          this.cameraVideoRef.nativeElement.srcObject = this.cameraStream;
          this.cameraVideoRef.nativeElement.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      alert(`Camera error: ${error.message || 'Unable to access camera'}`);
    }
  }
  
  stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.cameraActive = false;
  }
  
  capturePhoto(): void {
    if (!this.cameraVideoRef || !this.cameraActive) return;
    
    const video = this.cameraVideoRef.nativeElement;
    const canvas = this.captureCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Check if canvas has content
    const imageData = ctx.getImageData(0, 0, 1, 1).data;
    console.log('Canvas pixel data (first pixel):', imageData);
    
    canvas.toBlob(blob => {
      if (blob) {
        console.log('Blob size:', blob.size, 'bytes');
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadedImageUrl = e.target?.result as string;
          console.log('Image URL created, starting detection...');
          this.showCamera = false; // Hide camera after capture
          this.detectMedicinesFromImage();
        };
        reader.readAsDataURL(blob);
      } else {
        console.error('Failed to create blob from canvas');
      }
    }, 'image/jpeg', 0.9);
  }
  
  onVideoLoaded(): void {
    console.log('Video stream loaded');
  }
  
  toggleCameraView(): void {
    this.showCamera = !this.showCamera;
    if (!this.showCamera) {
      this.stopCamera();
    }
  }
  
  onEditProduct(product: Product): void {
    console.log('Edit product:', product);
  }
  
  onDeleteProduct(id: number): void {
    this.products = this.products.filter(p => p.id !== id);
  }
  
  // Medicine identification methods
  loadCatalogMedicines(): void {
    this.catalogMedicines = this.medicineService.getMedicines();
  }
  
  editMedicineName(index: number): void {
    this.editingIndex = index;
    if (this.detectedMedicines) {
      this.editingMedicineName = this.detectedMedicines.objects[index].matchedMedicine || this.detectedMedicines.objects[index].class;
    }
  }
  
  confirmEditMedicine(): void {
    if (this.editingIndex !== null && this.detectedMedicines && this.editingMedicineName.trim()) {
      const index = this.editingIndex;
      this.detectedMedicines.objects[index].matchedMedicine = this.editingMedicineName.trim();
      console.log('Medicine updated:', this.detectedMedicines.objects[index]);
      this.editingIndex = null;
      this.editingMedicineName = '';
    }
  }
  
  cancelEditMedicine(): void {
    this.editingIndex = null;
    this.editingMedicineName = '';
  }
  
  selectFromCatalog(index: number): void {
    this.selectingIndex = index;
  }
  
  selectMedicineFromCatalog(index: number, medicineName: string): void {
    if (this.detectedMedicines) {
      this.detectedMedicines.objects[index].matchedMedicine = medicineName;
      this.selectingIndex = null;
      console.log(`Selected ${medicineName} for object ${index}`);
    }
  }
  
  cancelSelectMedicine(): void {
    this.selectingIndex = null;
  }

  // Barcode scanning methods
  async startBarcodeScanner(): Promise<void> {
    console.log('Opening barcode scanner...');
    this.showBarcodeScanner = true;
    this.isBarcodeScanning = true;
    this.scannedBarcode = null;
    this.scannedMedicine = null;
    this.manualBarcodeInput = '';
    this.barcodeScannerError = null;
    this.cameraPermissionDenied = false;
    this.cameraInitialized = false;
    
    // Trigger change detection to render the video element
    this.cdr.detectChanges();

    // Wait for view to render before accessing video element
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(async () => {
          try {
            const videoElement = this.barcodeScannerRef?.nativeElement;
            if (videoElement) {
              console.log('Video element found, starting camera...');
              this.barcodeScannerError = null;
              await this.barcodeScannerService.startScanning(videoElement);
              console.log('Camera started successfully');
              this.isBarcodeScanning = false;
              this.cameraInitialized = true;
              this.cdr.detectChanges();
            } else {
              console.warn('Video element not found');
              this.isBarcodeScanning = false;
              this.barcodeScannerError = '❌ Camera element not found. Please try again.';
              this.cdr.detectChanges();
            }
          } catch (error) {
            console.error('Error starting camera:', error);
            this.isBarcodeScanning = false;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if it's a permission denied error
            if (errorMsg.includes('NotAllowedError') || errorMsg.includes('permission') || errorMsg.includes('denied')) {
              this.cameraPermissionDenied = true;
              this.barcodeScannerError = '❌ Camera permission denied. Please allow camera access in browser settings.';
            } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('device')) {
              this.barcodeScannerError = '❌ No camera device found. Please use manual barcode input below.';
            } else {
              this.barcodeScannerError = `❌ Camera error: ${errorMsg}. Use manual input below.`;
            }
            this.cdr.detectChanges();
          }
        });
      }, 200);
    });
  }

  scanManualBarcode(): void {
    if (!this.manualBarcodeInput.trim()) {
      this.barcodeScannerError = '⚠️ Please enter a barcode number';
      return;
    }

    console.log('Manual barcode entered:', this.manualBarcodeInput);
    this.scannedBarcode = this.manualBarcodeInput;
    this.barcodeScannerError = null;

    // Lookup medicine info from barcode
    this.scannedMedicine = this.barcodeScannerService.lookupMedicine(this.scannedBarcode);
    
    if (this.scannedMedicine.name.includes('Medicine (Barcode:')) {
      this.barcodeScannerError = `⚠️ Barcode not found in database. Adding as new medicine.`;
    } else {
      this.barcodeScannerError = null;
    }
    
    console.log('Looked up medicine:', this.scannedMedicine);
    this.cdr.detectChanges();
  }

  stopBarcodeScanner(): void {
    console.log('Stopping barcode scanner...');
    this.barcodeScannerService.stopScanning();
    
    // Stop video stream
    if (this.barcodeStream) {
      this.barcodeStream.getTracks().forEach(track => track.stop());
      this.barcodeStream = null;
    }

    this.showBarcodeScanner = false;
    this.isBarcodeScanning = false;
    this.barcodeScannerError = null;
  }

  addScannedMedicine(): void {
    if (!this.scannedMedicine) {
      alert('No medicine scanned. Please scan a barcode first.');
      return;
    }

    const medicineList = this.medicineService.getMedicines();
    const exists = medicineList.some(m => m.name.toLowerCase() === this.scannedMedicine.name.toLowerCase());

    if (exists) {
      alert(`✅ "${this.scannedMedicine.name}" already exists in catalog`);
    } else {
      // Add new medicine
      const newMedicine: Medicine = {
        id: (medicineList.length + 1).toString(),
        name: this.scannedMedicine.name,
        barcode: this.scannedBarcode || '',
        genericName: this.scannedMedicine.name,
        manufacturer: this.scannedMedicine.manufacturer || 'Unknown',
        strength: this.scannedMedicine.strength || 'Standard',
        category: 'Medicine',
        quantity: 50
      };

      this.medicineService.addMedicine(newMedicine);
      this.catalogMedicines.push(newMedicine);

      // Add to products table
      const product = this.medicineToProduct(newMedicine);
      this.products.push(product);

      console.log('Added new medicine:', newMedicine);
      alert(`✅ "${this.scannedMedicine.name}" added to catalog successfully!`);
    }

    // Reset and close scanner
    this.barcodeScannerService.resetBarcode();
    this.stopBarcodeScanner();
    this.scannedMedicine = null;
    this.scannedBarcode = null;
    this.manualBarcodeInput = '';
  }

  cancelBarcodeScanning(): void {
    this.stopBarcodeScanner();
    this.scannedBarcode = null;
    this.scannedMedicine = null;
    this.manualBarcodeInput = '';
  }

  // Manual medicine entry methods
  openManualMedicineForm(): void {
    this.showManualMedicineForm = true;
    this.newMedicine = {
      name: '',
      genericName: '',
      strength: '',
      manufacturer: '',
      category: 'Medicine',
      quantity: 50
    };
  }

  saveManualMedicine(): void {
    if (!this.newMedicine.name.trim()) {
      alert('⚠️ Please enter medicine name');
      return;
    }

    const medicineList = this.medicineService.getMedicines();
    const exists = medicineList.some(m => m.name.toLowerCase() === this.newMedicine.name.toLowerCase());

    if (exists) {
      alert(`✅ "${this.newMedicine.name}" already exists in catalog`);
      this.showManualMedicineForm = false;
      return;
    }

    // Add new medicine
    const medicine: Medicine = {
      id: (medicineList.length + 1).toString(),
      name: this.newMedicine.name.trim(),
      barcode: '',
      genericName: this.newMedicine.genericName.trim() || this.newMedicine.name.trim(),
      manufacturer: this.newMedicine.manufacturer.trim() || 'Unknown',
      strength: this.newMedicine.strength.trim() || 'Standard',
      category: this.newMedicine.category,
      quantity: this.newMedicine.quantity
    };

    this.medicineService.addMedicine(medicine);
    this.catalogMedicines.push(medicine);

    // Add to products table
    const product = this.medicineToProduct(medicine);
    this.products.push(product);

    console.log('Added new medicine manually:', medicine);
    alert(`✅ "${medicine.name}" added to catalog successfully!`);

    this.showManualMedicineForm = false;
  }

  cancelManualMedicine(): void {
    this.showManualMedicineForm = false;
  }
}

