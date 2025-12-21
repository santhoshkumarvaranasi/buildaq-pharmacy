import { Injectable } from '@angular/core';
import { DetectedObject } from './image-detection.service';

@Injectable({
  providedIn: 'root'
})
export class AdvancedDetectionService {

  constructor() {}

  async detectMedicines(image: HTMLImageElement): Promise<{ objects: DetectedObject[]; medicines: string[] }> {
    try {
      console.log('Advanced detection disabled - using fallback only');
      // Return empty to use fallback detection
      return { objects: [], medicines: [] };
    } catch (error) {
      console.error('Error in advanced detection:', error);
      return { objects: [], medicines: [] };
    }
  }

  async isModelReady(): Promise<boolean> {
    return true;
  }
}
