import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BarcodeScannerService {
  private scannedBarcode = new BehaviorSubject<string | null>(null);
  private isScanning = new BehaviorSubject<boolean>(false);
  private medicineDatabase: { [key: string]: any } = {
    // Common medicine barcodes (these are sample/demo barcodes)
    '5012254500012': { name: 'Aspirin', strength: '500mg', manufacturer: 'Generic' },
    '5014496014175': { name: 'Ibuprofen', strength: '200mg', manufacturer: 'Generic' },
    '5000017000049': { name: 'Paracetamol', strength: '500mg', manufacturer: 'Generic' },
    '5012254300013': { name: 'Vitamin C', strength: '1000mg', manufacturer: 'Generic' },
    '5000456000127': { name: 'Amoxicillin', strength: '500mg', manufacturer: 'Generic' },
    '5010415000081': { name: 'Cetirizine', strength: '10mg', manufacturer: 'Generic' },
    '5014496011156': { name: 'Loratadine', strength: '10mg', manufacturer: 'Generic' },
    '5015687000129': { name: 'Omeprazole', strength: '20mg', manufacturer: 'Generic' },
    '5010415000463': { name: 'Metformin', strength: '500mg', manufacturer: 'Generic' },
    '5010887010316': { name: 'Lisinopril', strength: '10mg', manufacturer: 'Generic' },
  };

  constructor() {}

  private currentStream: MediaStream | null = null;

  async startScanning(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Starting camera for barcode scanning...');
        this.isScanning.next(true);

        // Request camera access
        navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        }).then((stream) => {
          console.log('Camera stream obtained');
          this.currentStream = stream;
          videoElement.srcObject = stream;
          
          // Play video and handle potential errors
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Video playback started successfully');
                resolve();
              })
              .catch((error) => {
                console.error('Video playback error:', error);
                reject(new Error('Failed to play video stream'));
              });
          } else {
            console.log('Video playback initiated');
            resolve();
          }
        }).catch((error) => {
          console.error('Camera access denied:', error);
          this.isScanning.next(false);
          reject(new Error(`Camera access denied: ${error.message}`));
        });
      } catch (error) {
        console.error('Error starting camera:', error);
        this.isScanning.next(false);
        reject(error);
      }
    });
  }

  stopScanning(): void {
    try {
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
        this.currentStream = null;
      }
      this.isScanning.next(false);
      console.log('Camera stopped');
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  }

  setScannedBarcode(barcode: string): void {
    console.log('Barcode set:', barcode);
    this.scannedBarcode.next(barcode);
    this.isScanning.next(false);
  }

  getScannedBarcode(): Observable<string | null> {
    return this.scannedBarcode.asObservable();
  }

  getIsScanning(): Observable<boolean> {
    return this.isScanning.asObservable();
  }

  async lookupMedicine(barcode: string): Promise<any> {
    console.log('Looking up medicine for barcode:', barcode);
    
    // Check if barcode exists in database
    if (this.medicineDatabase[barcode]) {
      return { ...this.medicineDatabase[barcode], barcode };
    }

    const openFdaResult = await this.lookupOpenFda(barcode);
    if (openFdaResult) {
      return openFdaResult;
    }

    // Return generic info for unknown barcodes
    return {
      name: `Medicine (Barcode: ${barcode})`,
      strength: 'Unknown',
      manufacturer: 'Unknown',
      barcode: barcode
    };
  }

  resetBarcode(): void {
    this.scannedBarcode.next(null);
  }

  private async lookupOpenFda(barcode: string): Promise<any | null> {
    try {
      const terms = this.buildNdcSearchTerms(barcode);
      for (const term of terms) {
        const queries = [
          `package_ndc:\"${term}\"`,
          `product_ndc:\"${term}\"`
        ];
        for (const query of queries) {
          const url = `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(query)}&limit=1`;
          const response = await fetch(url);
          if (!response.ok) {
            continue;
          }
          const data = await response.json();
          const result = data?.results?.[0];
          if (result) {
            const ingredient = result.active_ingredients?.[0];
            return {
              name: result.brand_name || result.generic_name || `Medicine (Barcode: ${barcode})`,
              strength: ingredient?.strength || 'Unknown',
              manufacturer: result.labeler_name || 'Unknown',
              genericName: result.generic_name || '',
              ndc: result.product_ndc || result.package_ndc || '',
              barcode
            };
          }
        }
      }
    } catch (error) {
      console.warn('OpenFDA lookup failed:', error);
    }
    return null;
  }

  private buildNdcSearchTerms(barcode: string): string[] {
    const digits = (barcode || '').replace(/\D/g, '');
    if (!digits) return [];

    const terms: string[] = [digits];

    if (digits.length === 11) {
      terms.push(`${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`);
    }

    if (digits.length === 10) {
      terms.push(`${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`);
      terms.push(`${digits.slice(0, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`);
      terms.push(`${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`);
    }

    return Array.from(new Set(terms));
  }
}
