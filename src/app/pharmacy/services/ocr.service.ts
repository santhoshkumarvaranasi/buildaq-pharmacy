import { Injectable } from '@angular/core';

declare var Tesseract: any;

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private isAvailable = false;

  constructor() {
    this.checkTesseractAvailability();
  }

  private checkTesseractAvailability(): void {
    try {
      if (typeof Tesseract !== 'undefined') {
        this.isAvailable = true;
        console.log('✅ Tesseract.js is available');
      } else {
        console.warn('⚠️ Tesseract.js not found - OCR disabled');
        this.isAvailable = false;
      }
    } catch (error) {
      console.warn('⚠️ Tesseract.js error:', error);
      this.isAvailable = false;
    }
  }

  async extractTextFromImage(imageUrl: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.isAvailable || typeof Tesseract === 'undefined') {
          reject(new Error('Tesseract.js not available'));
          return;
        }

        console.log('🔄 Starting OCR text extraction...');
        
        // Create a worker for this extraction
        const worker = await Tesseract.createWorker('eng');
        const { data: { text } } = await worker.recognize(imageUrl);
        
        console.log('✅ OCR extraction complete');
        console.log('📝 Extracted text:', text.substring(0, 100) + '...');
        
        await worker.terminate();
        resolve(text);
      } catch (error) {
        console.error('❌ OCR extraction error:', error);
        reject(error);
      }
    });
  }

  async extractMedicineDetails(imageUrl: string): Promise<any> {
    try {
      console.log('🔍 Attempting to extract medicine details from image...');
      
      const extractedText = await this.extractTextFromImage(imageUrl);
      const details = this.parseExtractedText(extractedText);
      
      console.log('📋 Parsed medicine details:', details);
      
      return {
        success: true,
        rawText: extractedText,
        medicineDetails: details
      };
    } catch (error) {
      console.error('❌ Error extracting medicine details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR failed',
        rawText: '',
        medicineDetails: {}
      };
    }
  }

  private parseExtractedText(text: string): any {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const details: any = {
      name: '',
      strength: '',
      manufacturer: '',
      genericName: ''
    };

    // Try to extract medicine name (usually first or second non-empty line)
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim();
      // Skip very short lines and lines that look like numbers
      if (line.length > 3 && !/^[\d\s]+$/.test(line)) {
        details.name = line.substring(0, 50); // Limit name length
        break;
      }
    }

    // Look for strength patterns (e.g., "500mg", "10mg", "2%")
    const strengthPattern = /(\d+(?:\.\d+)?)\s*(mg|g|ml|%|mcg|iu|units?)/gi;
    const strengthMatches = text.match(strengthPattern);
    if (strengthMatches && strengthMatches.length > 0) {
      details.strength = strengthMatches[0];
    }

    // Look for common manufacturer keywords
    const manufacturerKeywords = ['Ltd', 'Inc', 'Corp', 'Pharma', 'Pharmaceutical', 'Laboratories', 'Labs', 'Pvt'];
    for (const keyword of manufacturerKeywords) {
      const pattern = new RegExp(`([A-Za-z\\s&]+${keyword}[A-Za-z\\s&]*)`, 'i');
      const match = text.match(pattern);
      if (match) {
        details.manufacturer = match[1].trim().substring(0, 40);
        break;
      }
    }

    return details;
  }
}

