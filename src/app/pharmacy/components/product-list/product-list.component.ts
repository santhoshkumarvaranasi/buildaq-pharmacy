import { Component, OnInit, ViewChild, ElementRef, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { ImageDetectionService, DetectionResult } from '../../services/image-detection.service';
import { AdvancedDetectionService } from '../../services/advanced-detection.service';
import { BarcodeScannerService } from '../../services/barcode-scanner.service';
import { OcrService } from '../../services/ocr.service';
import { LlmExtractionService } from '../../services/llm-extraction.service';
import { MedicineService, Medicine } from '../../services/medicine.service';
import { PageEvent } from '@angular/material/paginator';

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
  pageIndex = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  searchTerm = '';
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
  isBarcodeLookup = false;
  scannedBarcode: string | null = null;
  scannedMedicine: any = null;
  manualBarcodeInput = '';
  barcodeStream: MediaStream | null = null;
  barcodeScannerError: string | null = null;
  cameraPermissionDenied = false;
  cameraInitialized = false;

  // Local catalog import
  catalogImportError: string | null = null;
  catalogImportSummary: string | null = null;
  expiryThresholdDays = 60;
  
  private storageKey = 'buildaq_pharmacy_products';
  private layoutStorageKey = 'buildaq_pharmacy_layout_v2';
  private productsUpdatedHandler = () => this.loadProductsFromStorage();
  private layoutUpdatedHandler = () => this.syncFromVisualMapper();
  
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
    private llmExtractionService: LlmExtractionService,
    private medicineService: MedicineService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.setupConsoleLogging();
  }
  
  ngOnInit(): void {
    this.loadProducts();
    this.ensureExpiryDates();
    this.syncFromVisualMapper();
    this.checkModelStatus();
    this.loadCatalogMedicines();
    this.checkOcrAvailability();
    window.addEventListener('buildaq-products-updated', this.productsUpdatedHandler);
    window.addEventListener('buildaq-layout-updated', this.layoutUpdatedHandler);
  }
  
  private checkOcrAvailability(): void {
    setTimeout(() => {
      try {
        if (typeof (window as any).Tesseract !== 'undefined') {
          this.ocrAvailable = true;
          console.log('âœ… OCR (Tesseract.js) is available');
        } else {
          this.ocrAvailable = false;
          console.warn('âš ï¸ OCR (Tesseract.js) not available');
        }
      } catch (error) {
        this.ocrAvailable = false;
        console.error('âŒ Error checking OCR availability:', error);
      }
    }, 2000); // Wait 2 seconds for Tesseract to load
  }
  
  ngOnDestroy(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
    }
    window.removeEventListener('buildaq-products-updated', this.productsUpdatedHandler);
    window.removeEventListener('buildaq-layout-updated', this.layoutUpdatedHandler);
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

      setTimeout(() => {
        this.consoleLogs.push(`[${type}] ${message}`);
        if (this.consoleLogs.length > this.maxLogs) {
          this.consoleLogs.shift();
        }
        this.cdr.detectChanges();
      }, 0);
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
      
      if (logs.includes('âœ“ COCO-SSD model loaded successfully')) {
        this.modelStatus = 'âœ“ AI Detection Ready';
        this.modelReady = true;
        clearInterval(checkInterval);
      } else if (logs.includes('using fallback detection')) {
        this.modelStatus = 'âš  Fallback Mode (Image Analysis)';
        this.modelReady = true; // Still functional with fallback
        clearInterval(checkInterval);
      } else if (logs.includes('Failed to load COCO-SSD model')) {
        this.modelStatus = 'âš  Using Fallback Detection';
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
    if (this.loadProductsFromStorage()) {
      return;
    }
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
    this.saveProducts();
  }

  private loadProductsFromStorage(): boolean {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved) as Array<Partial<Product>>;
      this.products = parsed.map((item, index) => ({
        id: Number(item.id ?? index + 1),
        name: String(item.name || '').trim(),
        category: String(item.category || 'Medicine').trim(),
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        expiryDate: String(item.expiryDate || 'N/A')
      })).filter(item => item.name);
      this.ensureExpiryDates();
      return true;
    } catch (error) {
      console.warn('Failed to parse saved products', error);
      return false;
    }
  }

  private saveProducts(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.products));
    window.dispatchEvent(new Event('buildaq-products-updated'));
  }

  syncFromVisualMapper(): void {
    const raw = localStorage.getItem(this.layoutStorageKey);
    if (!raw) return;
    try {
      const layout = JSON.parse(raw) as Array<{
        type?: string;
        medicines?: unknown;
        tag?: string;
      }>;
      const totals = new Map<string, { qty: number; category: string }>();
      layout.forEach(item => {
        if (item.type !== 'box' || !item.medicines) return;
        const category = item.tag || 'Medicine';
        const entries: Array<{ name: string; qty: number }> = [];

        if (Array.isArray(item.medicines)) {
          item.medicines.forEach(med => {
            if (typeof med === 'string') {
              entries.push({ name: med, qty: 1 });
              return;
            }
            if (med && typeof med === 'object') {
              const name = String((med as { name?: string; medicine?: string; title?: string }).name
                || (med as { medicine?: string }).medicine
                || (med as { title?: string }).title
                || '').trim();
              const qty = Number((med as { qty?: number; quantity?: number }).qty
                ?? (med as { quantity?: number }).quantity
                ?? 1);
              entries.push({ name, qty: Number.isFinite(qty) ? qty : 0 });
            }
          });
        } else if (item.medicines && typeof item.medicines === 'object') {
          Object.entries(item.medicines as Record<string, number>).forEach(([name, qty]) => {
            entries.push({ name: String(name).trim(), qty: Number(qty ?? 0) });
          });
        }

        entries.forEach(entry => {
          const key = entry.name.trim().toLowerCase();
          if (!key) return;
          const current = totals.get(key);
          totals.set(key, {
            qty: (current?.qty || 0) + (Number.isFinite(entry.qty) ? entry.qty : 0),
            category: current?.category || category
          });
        });
      });

      if (totals.size === 0) return;

      const existingByName = new Map(this.products.map(p => [p.name.toLowerCase(), p]));
      let nextId = this.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      const nextProducts: Product[] = [];
      totals.forEach((value, key) => {
        const existing = existingByName.get(key);
        nextProducts.push({
          id: existing?.id ?? nextId++,
          name: existing?.name || key.replace(/\b\w/g, char => char.toUpperCase()),
          category: existing?.category || value.category || 'Medicine',
          price: existing?.price ?? 0,
          quantity: value.qty,
          expiryDate: existing?.expiryDate || 'N/A'
        });
      });
      this.products = nextProducts.sort((a, b) => a.name.localeCompare(b.name));
      this.pageIndex = 0;
      this.ensureExpiryDates();
      this.saveProducts();
    } catch (error) {
      console.warn('Failed to sync from visual mapper', error);
    }
  }

  get filteredProducts(): Product[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter(product => {
      return (
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term)
      );
    });
  }

  get expiringSoonProducts(): Array<Product & { daysLeft: number }> {
    return this.products
      .map(product => {
        const daysLeft = this.getDaysUntilExpiry(product.expiryDate);
        return { ...product, daysLeft };
      })
      .filter(item => Number.isFinite(item.daysLeft) && item.daysLeft > 0 && item.daysLeft <= this.expiryThresholdDays)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  get expiredProducts(): Array<Product & { daysLeft: number }> {
    return this.products
      .map(product => {
        const daysLeft = this.getDaysUntilExpiry(product.expiryDate);
        return { ...product, daysLeft };
      })
      .filter(item => Number.isFinite(item.daysLeft) && item.daysLeft <= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  getExpiryStatus(expiryDate: string): { label: string; className: string } | null {
    const daysLeft = this.getDaysUntilExpiry(expiryDate);
    if (!Number.isFinite(daysLeft)) return null;
    if (daysLeft <= 0) {
      return { label: 'Expired', className: 'expiry-expired' };
    }
    if (daysLeft <= this.expiryThresholdDays) {
      return { label: `${daysLeft} days`, className: 'expiry-soon' };
    }
    return null;
  }

  private getDaysUntilExpiry(expiryDate: string): number {
    if (!expiryDate || expiryDate.toLowerCase() === 'n/a') return Number.NaN;
    const parsed = new Date(expiryDate);
    if (Number.isNaN(parsed.getTime())) return Number.NaN;
    const now = new Date();
    const diffMs = parsed.getTime() - now.setHours(0, 0, 0, 0);
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  private ensureExpiryDates(): void {
    let updated = false;
    this.products = this.products.map(product => {
      if (!product.expiryDate || product.expiryDate.toLowerCase() === 'n/a') {
        updated = true;
        return { ...product, expiryDate: this.generateExpiryDate(product.name) };
      }
      return product;
    });
    if (updated) {
      this.saveProducts();
    }
  }

  private generateExpiryDate(seed: string): string {
    const base = new Date();
    const days = 180 + (this.simpleHash(seed) % 540);
    const expiry = new Date(base.getTime());
    expiry.setDate(expiry.getDate() + days);
    return expiry.toISOString().slice(0, 10);
  }

  private simpleHash(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  get pagedProducts(): Product[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
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
    
    console.log('ðŸ”¤ Starting OCR extraction from uploaded image...');
    
    try {
      const result = await this.ocrService.extractMedicineDetails(this.uploadedImageUrl);
      
      console.log('OCR Result:', result);
      
      if (result.success && result.rawText) {
        this.ocrExtractedText = result.rawText;
        console.log('âœ… Text extracted successfully:', this.ocrExtractedText.substring(0, 100));

        try {
          const llmDetails = await this.llmExtractionService.extractMedicineDetails(result.rawText);
          if (llmDetails) {
            result.medicineDetails = {
              ...result.medicineDetails,
              ...llmDetails
            };

          }
        } catch (error) {
          console.warn('LLM extraction failed:', error);
        }

        if (!result.medicineDetails?.name) {
          const resolvedName = this.resolveMedicineFromText(result.rawText);
          if (resolvedName) {
            result.medicineDetails = {
              ...result.medicineDetails,
              name: resolvedName
            };
          }
        }
        
        // If medicine details were extracted, offer to auto-fill the form
        if (result.medicineDetails && result.medicineDetails.name) {
          this.ocrExtractedMedicines = [result.medicineDetails];
          console.log('ðŸ“‹ Extracted medicine details:', result.medicineDetails);
          
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
          console.log('âš ï¸ No medicine details extracted, showing raw text only');
        }
      } else {
        console.warn('âš ï¸ OCR extraction unsuccessful:', result.error);
      }
    } catch (error) {
      console.error('âŒ Error during OCR extraction:', error);
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
      if (this.detectedMedicines && this.detectedMedicines.objects.length === 0) {
        const ocrDetection = await this.buildDetectionFromOcr(imageUrl, loadedImg);
        if (ocrDetection) {
          console.log('OCR fallback detected medicine:', ocrDetection);
          this.detectedMedicines = ocrDetection;
        }
      }
      
      // Check if detection returned any objects
      if (!this.detectedMedicines || !this.detectedMedicines.objects || this.detectedMedicines.objects.length === 0) {
        console.warn('No medicines detected in the image. Please try another image.');
        this.isDetecting = false;
        alert('âŒ No pharmacy items detected in this image.\n\nPlease try a different image that contains:\nâ€¢ Medicine bottles\nâ€¢ Medication boxes\nâ€¢ Pill containers\nâ€¢ Medicine labels/text');
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

  private async buildDetectionFromOcr(imageUrl: string, image: HTMLImageElement): Promise<DetectionResult | null> {
    try {
      console.log('Attempting OCR fallback detection...');
      const ocrResult = await this.ocrService.extractMedicineDetails(imageUrl);
      const medicineName = this.resolveMedicineFromText(ocrResult?.rawText || '') ||
        ocrResult?.medicineDetails?.name?.trim();

      if (!ocrResult?.success || !medicineName) {
        console.warn('OCR fallback did not find a medicine name');
        return null;
      }

      return {
        imageUrl,
        objects: [
          {
            class: 'text',
            score: 0.6,
            bbox: [0, 0, image.width || 640, image.height || 480],
            x: 0,
            y: 0,
            matchedMedicine: medicineName,
            confidence: 0.6
          }
        ],
        timestamp: new Date(),
        imageWidth: image.width || 640,
        imageHeight: image.height || 480
      };
    } catch (error) {
      console.error('OCR fallback error:', error);
      return null;
    }
  }

  private resolveMedicineFromText(rawText: string): string | null {
    if (!rawText) return null;
    const text = rawText.toLowerCase();
    const medicines = this.medicineService.getMedicines();

    let bestMatch: string | null = null;
    let bestLength = 0;

    medicines.forEach(med => {
      const name = med.name.toLowerCase();
      const generic = med.genericName?.toLowerCase() || '';
      if (name && text.includes(name) && name.length > bestLength) {
        bestMatch = med.name;
        bestLength = name.length;
      } else if (generic && text.includes(generic) && generic.length > bestLength) {
        bestMatch = med.name;
        bestLength = generic.length;
      }
    });

    return bestMatch;
  }
  
  addDetectedMedicines(): void {
    if (!this.detectedMedicines) {
      alert('âŒ No medicines detected');
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
        console.log('âœ… Added new medicine to catalog:', medicineName);
      } else {
        console.log('â„¹ï¸ Medicine exists in catalog:', medicineName);
      }
      
      // Add to products table
      const product = this.medicineToProduct(medicine);
      this.products.push(product);
      addedCount++;
      console.log('âœ… Added to products table:', medicineName);
    });
    
    this.resetImageUpload();
    if (this.pageIndex * this.pageSize >= this.products.length) {
      this.pageIndex = 0;
    }
    this.saveProducts();
    
    console.log('=== Summary ===');
    console.log('Total products added:', addedCount);
    
    if (addedCount > 0) {
      alert(`âœ… Successfully added ${addedCount} medicine(s)!\n\nNow showing ${this.products.length} total products.`);
    } else {
      alert('â„¹ï¸ All selected medicines were already in your products list.');
    }
  }
  
  private medicineToProduct(medicine: Medicine): Product {
    return {
      id: parseInt(medicine.id),
      name: medicine.name,
      category: medicine.category || 'Uncategorized',
      price: 0,
      quantity: medicine.quantity || 50,
      expiryDate: this.generateExpiryDate(medicine.name)
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
          this.extractTextFromImage();
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
    if (this.pageIndex * this.pageSize >= this.products.length) {
      this.pageIndex = Math.max(0, Math.floor((this.products.length - 1) / this.pageSize));
    }
    this.saveProducts();
  }
  
  // Medicine identification methods
  loadCatalogMedicines(): void {
    this.catalogMedicines = this.medicineService.getMedicines();
  }

  onCatalogFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.catalogImportError = null;
    this.catalogImportSummary = null;

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      this.importCatalogJson(raw);
      input.value = '';
    };
    reader.onerror = () => {
      this.catalogImportError = 'Failed to read file.';
    };
    reader.readAsText(file);
  }

  private importCatalogJson(raw: string): void {
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.medicines;
      if (!Array.isArray(list)) {
        this.catalogImportError = 'Invalid JSON format. Expected an array or { medicines: [] }.';
        return;
      }

      const medicines: Medicine[] = list.map((item: any) => ({
        id: String(item.id || ''),
        name: String(item.name || '').trim(),
        barcode: String(item.barcode || '').trim(),
        genericName: item.genericName ? String(item.genericName).trim() : '',
        manufacturer: item.manufacturer ? String(item.manufacturer).trim() : '',
        strength: item.strength ? String(item.strength).trim() : '',
        category: item.category ? String(item.category).trim() : '',
        quantity: typeof item.quantity === 'number' ? item.quantity : undefined
      }));

      const summary = this.medicineService.importMedicines(medicines);
      this.loadCatalogMedicines();
      this.catalogImportSummary = `Imported ${summary.total}. Added ${summary.added}, updated ${summary.updated}, skipped ${summary.skipped}.`;
    } catch (error) {
      this.catalogImportError = 'Invalid JSON. Please check the file format.';
      console.warn('Catalog import failed:', error);
    }
  }

  loadCatalogToProducts(): void {
    const catalog = this.medicineService.getMedicines();
    if (!catalog.length) {
      this.catalogImportError = 'Catalog is empty. Import a JSON file first.';
      return;
    }

    let added = 0;
    let skipped = 0;
    const existingNames = new Set(this.products.map(p => p.name.toLowerCase()));
    let nextId = this.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;

    catalog.forEach(medicine => {
      const name = (medicine.name || '').trim();
      if (!name) {
        skipped++;
        return;
      }
      const key = name.toLowerCase();
      if (existingNames.has(key)) {
        skipped++;
        return;
      }

      const idNum = Number(medicine.id);
      const expiry = medicine.expiryDate ? new Date(medicine.expiryDate) : null;

      this.products.push({
        id: Number.isFinite(idNum) ? idNum : nextId++,
        name,
        category: medicine.category || 'Uncategorized',
        price: 0,
        quantity: medicine.quantity ?? 0,
        expiryDate: expiry ? expiry.toISOString().slice(0, 10) : this.generateExpiryDate(name)
      });
      existingNames.add(key);
      added++;
    });

    this.catalogImportSummary = `Loaded catalog into products. Added ${added}, skipped ${skipped}.`;
    if (this.pageIndex * this.pageSize >= this.products.length) {
      this.pageIndex = 0;
    }
    this.ensureExpiryDates();
    this.saveProducts();
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
              this.barcodeScannerError = 'âŒ Camera element not found. Please try again.';
              this.cdr.detectChanges();
            }
          } catch (error) {
            console.error('Error starting camera:', error);
            this.isBarcodeScanning = false;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if it's a permission denied error
            if (errorMsg.includes('NotAllowedError') || errorMsg.includes('permission') || errorMsg.includes('denied')) {
              this.cameraPermissionDenied = true;
              this.barcodeScannerError = 'âŒ Camera permission denied. Please allow camera access in browser settings.';
            } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('device')) {
              this.barcodeScannerError = 'âŒ No camera device found. Please use manual barcode input below.';
            } else {
              this.barcodeScannerError = `âŒ Camera error: ${errorMsg}. Use manual input below.`;
            }
            this.cdr.detectChanges();
          }
        });
      }, 200);
    });
  }

  async scanManualBarcode(): Promise<void> {
    if (!this.manualBarcodeInput.trim()) {
      this.barcodeScannerError = 'Please enter a barcode number';
      return;
    }

    console.log('Manual barcode entered:', this.manualBarcodeInput);
    this.scannedBarcode = this.manualBarcodeInput;
    this.barcodeScannerError = null;
    this.isBarcodeLookup = true;
    this.scannedMedicine = null;
    this.cdr.detectChanges();

    // Lookup medicine info from barcode
    try {
      this.scannedMedicine = await this.barcodeScannerService.lookupMedicine(this.scannedBarcode || '');
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      this.barcodeScannerError = 'Barcode lookup failed. Please try again or add manually.';
    } finally {
      this.isBarcodeLookup = false;
    }
    
    if (this.scannedMedicine?.name?.includes('Medicine (Barcode:')) {
      this.barcodeScannerError = 'Barcode not found in database. You can add it manually.';
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
      alert(`âœ… "${this.scannedMedicine.name}" already exists in catalog`);
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
      if (this.pageIndex * this.pageSize >= this.products.length) {
        this.pageIndex = 0;
      }
      this.ensureExpiryDates();
      this.saveProducts();

      console.log('Added new medicine:', newMedicine);
      alert(`âœ… "${this.scannedMedicine.name}" added to catalog successfully!`);
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
      alert('âš ï¸ Please enter medicine name');
      return;
    }

    const medicineList = this.medicineService.getMedicines();
    const exists = medicineList.some(m => m.name.toLowerCase() === this.newMedicine.name.toLowerCase());

    if (exists) {
      alert(`âœ… "${this.newMedicine.name}" already exists in catalog`);
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
    if (this.pageIndex * this.pageSize >= this.products.length) {
      this.pageIndex = 0;
    }
    this.ensureExpiryDates();
    this.saveProducts();

    console.log('Added new medicine manually:', medicine);
    alert(`âœ… "${medicine.name}" added to catalog successfully!`);

    this.showManualMedicineForm = false;
  }

  cancelManualMedicine(): void {
    this.showManualMedicineForm = false;
  }
}







