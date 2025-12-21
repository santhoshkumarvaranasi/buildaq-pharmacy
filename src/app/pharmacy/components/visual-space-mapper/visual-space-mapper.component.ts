import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImageDetectionService, DetectionResult } from '../../services/image-detection.service';
import { ShelfMappingService, VisualSpace, Shelf } from '../../services/shelf-mapping.service';

@Component({
  selector: 'app-visual-space-mapper',
  templateUrl: './visual-space-mapper.component.html',
  styleUrls: ['./visual-space-mapper.component.scss']
})
export class VisualSpaceMapperComponent implements OnInit, OnDestroy {
  @ViewChild('imageCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideoRef!: ElementRef<HTMLVideoElement>;

  form!: FormGroup;
  detectionResult: DetectionResult | null = null;
  isLoading = false;
  visualSpaces: VisualSpace[] = [];
  selectedSpace: VisualSpace | null = null;
  currentImage: string | null = null;

  detectionMode = 'upload'; // 'upload' or 'camera'
  canvasImage: HTMLImageElement | null = null;
  
  // Camera properties
  cameraActive = false;
  cameraStream: MediaStream | null = null;
  showCameraTab = false;

  constructor(
    private formBuilder: FormBuilder,
    private imageDetectionService: ImageDetectionService,
    private shelfMappingService: ShelfMappingService,
    private snackBar: MatSnackBar
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.shelfMappingService.getVisualSpaces().subscribe(spaces => {
      this.visualSpaces = spaces;
    });

    this.imageDetectionService.getLoadingState().subscribe(loading => {
      this.isLoading = loading;
    });

    this.imageDetectionService.getDetectionResults().subscribe(result => {
      this.detectionResult = result;
    });
  }

  private createForm(): void {
    this.form = this.formBuilder.group({
      spaceName: ['', [Validators.required, Validators.minLength(3)]],
      location: ['', [Validators.required]],
      shelfName: ['', Validators.required],
      shelfWidth: [100, [Validators.required, Validators.min(10)]],
      shelfHeight: [50, [Validators.required, Validators.min(10)]]
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const image = e.target?.result as string;
        this.currentImage = image;
        this.detectMedicines(image);
      };

      reader.readAsDataURL(file);
    }
  }

  async detectMedicines(imageUrl: string): Promise<void> {
    const result = await this.imageDetectionService.detectMedicines(imageUrl);
    if (result) {
      this.snackBar.open(`Detected ${result.objects.length} objects`, 'Close', { duration: 3000 });
      this.drawDetections(result);
    } else {
      this.snackBar.open('Error detecting medicines', 'Close', { duration: 3000 });
    }
  }

  private drawDetections(result: DetectionResult): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      ctx.drawImage(image, 0, 0);

      // Draw bounding boxes
      result.objects.forEach((obj, index) => {
        const [x, y, width, height] = obj.bbox;

        // Draw rectangle
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(x, y - 25, 200, 25);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${obj.class} (${(obj.score * 100).toFixed(1)}%)`, x + 5, y - 8);
      });
    };
    image.src = result.imageUrl;
  }

  createVisualSpace(): void {
    if (this.form.get('spaceName')?.invalid || this.form.get('location')?.invalid || !this.currentImage) {
      this.snackBar.open('Please fill all fields and select an image', 'Close', { duration: 3000 });
      return;
    }

    const spaceName = this.form.get('spaceName')?.value;
    const location = this.form.get('location')?.value;

    const space = this.shelfMappingService.createVisualSpace(spaceName, location, this.currentImage);
    this.selectedSpace = space;
    this.snackBar.open('Visual space created successfully', 'Close', { duration: 3000 });
  }

  createShelf(): void {
    if (!this.selectedSpace || this.form.get('shelfName')?.invalid) {
      this.snackBar.open('Please select a visual space and enter shelf details', 'Close', { duration: 3000 });
      return;
    }

    const shelfName = this.form.get('shelfName')?.value;
    const width = this.form.get('shelfWidth')?.value;
    const height = this.form.get('shelfHeight')?.value;

    this.shelfMappingService.createShelf(this.selectedSpace.id, shelfName, width, height);
    this.form.patchValue({ shelfName: '', shelfWidth: 100, shelfHeight: 50 });
    this.snackBar.open('Shelf created successfully', 'Close', { duration: 3000 });
  }

  clearImage(): void {
    this.currentImage = null;
    this.detectionResult = null;
    if (this.imageInputRef) {
      this.imageInputRef.nativeElement.value = '';
    }
  }

  selectVisualSpace(space: VisualSpace): void {
    this.selectedSpace = space;
    this.shelfMappingService.setCurrentVisualSpace(space.id);
  }

  deleteVisualSpace(spaceId: string): void {
    if (confirm('Are you sure you want to delete this visual space?')) {
      this.shelfMappingService.deleteVisualSpace(spaceId);
      if (this.selectedSpace?.id === spaceId) {
        this.selectedSpace = null;
        this.currentImage = null;
        this.detectionResult = null;
      }
      this.snackBar.open('Visual space deleted', 'Close', { duration: 3000 });
    }
  }

  // Camera Methods
  async startCamera(): Promise<void> {
    try {
      const constraints = {
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      };
      
      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraActive = true;
      this.showCameraTab = true;
      
      // Use setTimeout to ensure DOM is updated before assigning stream
      setTimeout(() => {
        if (this.cameraVideoRef && this.cameraStream) {
          const videoElement = this.cameraVideoRef.nativeElement;
          videoElement.srcObject = this.cameraStream;
          // Ensure video plays
          videoElement.play().catch(err => console.error('Error playing video:', err));
        }
      }, 100);
      
      this.snackBar.open('Camera started', 'Close', { duration: 2000 });
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      let errorMsg = 'Camera not available';
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No camera found';
      }
      this.snackBar.open(errorMsg, 'Close', { duration: 3000 });
    }
  }

  stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
      this.cameraActive = false;
      this.snackBar.open('Camera stopped', 'Close', { duration: 2000 });
    }
  }

  onVideoLoaded(): void {
    console.log('Video loaded successfully');
    if (this.cameraVideoRef) {
      const video = this.cameraVideoRef.nativeElement;
      console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    }
  }

  capturePhoto(): void {
    if (!this.cameraVideoRef) {
      this.snackBar.open('Camera not ready', 'Close', { duration: 3000 });
      return;
    }

    const video = this.cameraVideoRef.nativeElement;
    
    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight) {
      this.snackBar.open('Camera is still initializing. Please wait...', 'Close', { duration: 3000 });
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw with mirror effect
      ctx.scale(-1, 1);
      ctx.drawImage(video, -video.videoWidth, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      this.currentImage = imageData;
      this.stopCamera();
      this.detectMedicines(imageData);
      this.snackBar.open('Photo captured and analyzed', 'Close', { duration: 3000 });
    }
  }

  ngOnDestroy(): void {
    if (this.cameraStream) {
      this.stopCamera();
    }
  }
}
