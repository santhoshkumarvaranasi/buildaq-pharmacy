# API Documentation - Pharmacy Shelf Mapping System

## Service Interfaces & Methods

### 1. ImageDetectionService

Handles AI-powered medicine detection using TensorFlow.js COCO-SSD model.

#### Methods

##### `initializeModel(): Promise<void>`
Initializes the COCO-SSD model asynchronously. Called automatically on service creation.

```typescript
await imageDetectionService.initializeModel();
```

##### `detectMedicines(imageInput: HTMLImageElement | string): Promise<DetectionResult | null>`
Detects objects in an image.

**Parameters:**
- `imageInput`: Either an HTMLImageElement or image URL string

**Returns:** Promise containing DetectionResult or null on error

**Example:**
```typescript
const result = await imageDetectionService.detectMedicines('https://example.com/image.jpg');
if (result) {
  console.log(`Detected ${result.objects.length} objects`);
  result.objects.forEach(obj => {
    console.log(`${obj.class}: ${obj.score * 100}%`);
  });
}
```

##### `detectFromCanvas(canvas: HTMLCanvasElement): Promise<DetectionResult | null>`
Detects objects from a canvas element (useful for video frames or camera input).

**Parameters:**
- `canvas`: HTMLCanvasElement containing the image

**Returns:** Promise containing DetectionResult or null on error

**Example:**
```typescript
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const result = await imageDetectionService.detectFromCanvas(canvas);
```

##### `getDetectionResults(): Observable<DetectionResult | null>`
Returns Observable of the latest detection results.

```typescript
imageDetectionService.getDetectionResults().subscribe(result => {
  if (result) {
    console.log(result.objects);
  }
});
```

##### `getLoadingState(): Observable<boolean>`
Returns Observable indicating if detection is in progress.

```typescript
imageDetectionService.getLoadingState().subscribe(isLoading => {
  console.log('Detection in progress:', isLoading);
});
```

##### `filterDetectionsByClass(results: DetectionResult, className: string): DetectedObject[]`
Filters detection results by object class name.

**Parameters:**
- `results`: DetectionResult object
- `className`: Class name to filter by (case-insensitive)

**Returns:** Array of matching DetectedObject

**Example:**
```typescript
const bottles = imageDetectionService.filterDetectionsByClass(result, 'bottle');
```

##### `getMedicineConfidence(results: DetectionResult, minConfidence: number = 0.5): DetectedObject[]`
Filters detections by minimum confidence threshold.

**Parameters:**
- `results`: DetectionResult object
- `minConfidence`: Minimum confidence score (0-1)

**Returns:** Array of DetectedObject meeting confidence threshold

**Example:**
```typescript
const highConfidence = imageDetectionService.getMedicineConfidence(result, 0.7);
```

#### Interfaces

##### DetectedObject
```typescript
interface DetectedObject {
  class: string;                          // Object class (e.g., 'bottle')
  score: number;                          // Confidence score 0-1
  bbox: [number, number, number, number]; // [x, y, width, height]
  x: number;                              // X coordinate
  y: number;                              // Y coordinate
}
```

##### DetectionResult
```typescript
interface DetectionResult {
  imageUrl: string;                       // URL or data URL of image
  objects: DetectedObject[];              // Array of detected objects
  timestamp: Date;                        // Detection timestamp
  imageWidth: number;                     // Image width in pixels
  imageHeight: number;                    // Image height in pixels
}
```

---

### 2. ShelfMappingService

Manages visual spaces, shelves, and medicine locations with persistent storage.

#### Methods

##### `createVisualSpace(name: string, location: string, imageUrl: string): VisualSpace`
Creates a new pharmacy location/visual space.

**Parameters:**
- `name`: Display name of the space
- `location`: Physical location description
- `imageUrl`: Reference image URL/data

**Returns:** Created VisualSpace object

**Example:**
```typescript
const space = shelfMappingService.createVisualSpace(
  'Main Aisle',
  'Front of Store',
  'data:image/jpeg;base64,...'
);
```

##### `createShelf(visualSpaceId: string, name: string, width: number, height: number): Shelf`
Adds a shelf to a visual space.

**Parameters:**
- `visualSpaceId`: ID of parent visual space
- `name`: Shelf name
- `width`: Shelf width in cm
- `height`: Shelf height in cm

**Returns:** Created Shelf object

**Throws:** Error if visual space not found

**Example:**
```typescript
const shelf = shelfMappingService.createShelf(spaceId, 'Shelf A1', 100, 50);
```

##### `addMedicineToShelf(shelfId: string, medicine: MedicineLocation): void`
Adds a medicine to a shelf.

**Parameters:**
- `shelfId`: Target shelf ID
- `medicine`: MedicineLocation object

**Example:**
```typescript
shelfMappingService.addMedicineToShelf(shelfId, {
  id: 'med_1',
  name: 'Aspirin',
  x: 25,
  y: 15,
  width: 8,
  height: 10,
  confidence: 0.95,
  shelfId: shelfId,
  detectionTime: new Date()
});
```

##### `updateMedicineLocation(shelfId: string, medicineId: string, x: number, y: number): void`
Updates a medicine's position on a shelf.

**Parameters:**
- `shelfId`: Shelf ID
- `medicineId`: Medicine ID
- `x`: New X coordinate
- `y`: New Y coordinate

**Example:**
```typescript
shelfMappingService.updateMedicineLocation(shelfId, medicineId, 30, 20);
```

##### `removeMedicineFromShelf(shelfId: string, medicineId: string): void`
Removes a medicine from a shelf.

**Parameters:**
- `shelfId`: Shelf ID
- `medicineId`: Medicine ID to remove

**Example:**
```typescript
shelfMappingService.removeMedicineFromShelf(shelfId, medicineId);
```

##### `deleteShelf(visualSpaceId: string, shelfId: string): void`
Deletes a shelf from a visual space.

**Parameters:**
- `visualSpaceId`: Parent space ID
- `shelfId`: Shelf to delete

**Example:**
```typescript
shelfMappingService.deleteShelf(spaceId, shelfId);
```

##### `deleteVisualSpace(id: string): void`
Deletes an entire visual space and all its shelves.

**Parameters:**
- `id`: Visual space ID

**Example:**
```typescript
shelfMappingService.deleteVisualSpace(spaceId);
```

##### `getVisualSpaces(): Observable<VisualSpace[]>`
Returns Observable of all visual spaces.

**Returns:** Observable of VisualSpace[]

**Example:**
```typescript
shelfMappingService.getVisualSpaces().subscribe(spaces => {
  spaces.forEach(space => console.log(space.name));
});
```

##### `getCurrentVisualSpace(): Observable<VisualSpace | null>`
Returns Observable of currently selected visual space.

**Returns:** Observable of VisualSpace or null

**Example:**
```typescript
shelfMappingService.getCurrentVisualSpace().subscribe(space => {
  if (space) console.log(`Current: ${space.name}`);
});
```

##### `getCurrentShelf(): Observable<Shelf | null>`
Returns Observable of currently selected shelf.

**Returns:** Observable of Shelf or null

##### `setCurrentVisualSpace(id: string): void`
Sets the active visual space.

**Parameters:**
- `id`: Visual space ID

##### `setCurrentShelf(id: string): void`
Sets the active shelf.

**Parameters:**
- `id`: Shelf ID

##### `getMedicinesByShelf(shelfId: string): MedicineLocation[]`
Gets all medicines on a specific shelf.

**Parameters:**
- `shelfId`: Shelf ID

**Returns:** Array of MedicineLocation

**Example:**
```typescript
const medicines = shelfMappingService.getMedicinesByShelf(shelfId);
console.log(`Shelf has ${medicines.length} medicines`);
```

#### Interfaces

##### VisualSpace
```typescript
interface VisualSpace {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  location: string;              // Physical location description
  imageUrl: string;              // Reference image
  shelves: Shelf[];              // Shelves in this space
  createdDate: Date;             // Creation timestamp
  lastUpdated: Date;             // Last modification timestamp
}
```

##### Shelf
```typescript
interface Shelf {
  id: string;                    // Unique identifier
  name: string;                  // Shelf name
  location: string;              // Location description
  width: number;                 // Width in cm
  height: number;                // Height in cm
  medicines: MedicineLocation[]; // Medicines on shelf
  imageUrl?: string;             // Optional shelf image
}
```

##### MedicineLocation
```typescript
interface MedicineLocation {
  id: string;                    // Unique identifier
  name: string;                  // Medicine name
  barcode?: string;              // Optional barcode
  x: number;                     // X position on shelf
  y: number;                     // Y position on shelf
  width: number;                 // Detected width
  height: number;                // Detected height
  confidence: number;            // Detection confidence 0-1
  shelfId: string;               // Parent shelf ID
  detectionTime: Date;           // Detection timestamp
}
```

---

### 3. MedicineService

Manages medicine catalog and search functionality.

#### Methods

##### `getMedicines(): Observable<Medicine[]>`
Returns Observable of all medicines in catalog.

**Returns:** Observable of Medicine[]

**Example:**
```typescript
medicineService.getMedicines().subscribe(medicines => {
  console.log(`Catalog has ${medicines.length} medicines`);
});
```

##### `getMedicinesByCategory(category: string): Medicine[]`
Returns medicines filtered by category.

**Parameters:**
- `category`: Category name

**Returns:** Array of Medicine objects

**Example:**
```typescript
const painRelief = medicineService.getMedicinesByCategory('Pain Relief');
```

##### `searchMedicines(query: string): Medicine[]`
Searches medicines by name, generic name, or barcode.

**Parameters:**
- `query`: Search query string

**Returns:** Array of matching Medicine objects

**Example:**
```typescript
const results = medicineService.searchMedicines('aspirin');
```

##### `getMedicineByBarcode(barcode: string): Medicine | undefined`
Finds a medicine by barcode.

**Parameters:**
- `barcode`: Medicine barcode

**Returns:** Medicine object or undefined

**Example:**
```typescript
const medicine = medicineService.getMedicineByBarcode('8901234567890');
```

##### `getMedicineById(id: string): Medicine | undefined`
Finds a medicine by ID.

**Parameters:**
- `id`: Medicine ID

**Returns:** Medicine object or undefined

**Example:**
```typescript
const medicine = medicineService.getMedicineById('1');
```

##### `addMedicine(medicine: Medicine): void`
Adds a new medicine to the catalog.

**Parameters:**
- `medicine`: Medicine object to add

**Example:**
```typescript
medicineService.addMedicine({
  id: 'med_new',
  name: 'New Drug',
  barcode: '1234567890123',
  genericName: 'Generic Name',
  manufacturer: 'Pharma Corp',
  strength: '500mg',
  category: 'Pain Relief'
});
```

##### `updateMedicine(id: string, updates: Partial<Medicine>): void`
Updates an existing medicine's properties.

**Parameters:**
- `id`: Medicine ID
- `updates`: Partial medicine object with fields to update

**Example:**
```typescript
medicineService.updateMedicine('1', {
  name: 'Updated Name',
  quantity: 100
});
```

##### `deleteMedicine(id: string): void`
Removes a medicine from the catalog.

**Parameters:**
- `id`: Medicine ID

**Example:**
```typescript
medicineService.deleteMedicine('1');
```

##### `getCategories(): string[]`
Returns array of all available categories.

**Returns:** Sorted array of category names

**Example:**
```typescript
const categories = medicineService.getCategories();
// ['Antibiotics', 'Cardiovascular', 'Cholesterol', ...]
```

#### Interface

##### Medicine
```typescript
interface Medicine {
  id: string;                    // Unique identifier
  name: string;                  // Medicine name
  barcode: string;               // Product barcode
  genericName?: string;          // Generic/chemical name
  manufacturer?: string;         // Manufacturer name
  strength?: string;             // Dosage strength
  quantity?: number;             // Available quantity
  expiryDate?: Date;             // Expiration date
  category?: string;             // Category
}
```

---

## Data Flow Diagram

```
User Input (Image)
        ↓
ImageDetectionService.detectMedicines()
        ↓
TensorFlow.js COCO-SSD Model
        ↓
DetectionResult (Objects + Confidence)
        ↓
Component processes & filters results
        ↓
MedicineLocation created
        ↓
ShelfMappingService.addMedicineToShelf()
        ↓
LocalStorage persisted
        ↓
Display in ShelfManagementComponent
```

---

## Usage Examples

### Complete Workflow Example

```typescript
// 1. Initialize services (done automatically)
constructor(
  private imageDetectionService: ImageDetectionService,
  private shelfMappingService: ShelfMappingService,
  private medicineService: MedicineService
) {}

// 2. Create a visual space
const space = this.shelfMappingService.createVisualSpace(
  'Main Aisle',
  'Store Front',
  'https://example.com/pharmacy.jpg'
);

// 3. Add a shelf
const shelf = this.shelfMappingService.createShelf(
  space.id,
  'Shelf A1',
  100,
  50
);

// 4. Detect medicines from image
const detectionResult = await this.imageDetectionService.detectMedicines(
  'https://example.com/shelf-image.jpg'
);

// 5. Filter high-confidence detections
const highConfidence = this.imageDetectionService.getMedicineConfidence(
  detectionResult,
  0.7
);

// 6. Add detected medicines to shelf
highConfidence.forEach((detected, index) => {
  const medicine: MedicineLocation = {
    id: `detected_${index}`,
    name: detected.class,
    x: detected.x,
    y: detected.y,
    width: detected.bbox[2],
    height: detected.bbox[3],
    confidence: detected.score,
    shelfId: shelf.id,
    detectionTime: new Date()
  };
  
  this.shelfMappingService.addMedicineToShelf(shelf.id, medicine);
});

// 7. Retrieve and display shelf medicines
const medicines = this.shelfMappingService.getMedicinesByShelf(shelf.id);
console.log(`Added ${medicines.length} medicines to shelf`);

// 8. Export data
const allSpaces = JSON.parse(
  localStorage.getItem('visual_spaces') || '[]'
);
```

---

## Error Handling

All services include error handling. Errors are logged to console but services continue operating gracefully.

```typescript
try {
  const result = await this.imageDetectionService.detectMedicines(imageUrl);
  if (!result) {
    // Handle detection failure
    console.log('Detection failed, returned null');
  }
} catch (error) {
  // Handle exceptions
  console.error('Error during detection:', error);
}
```

---

## Performance Considerations

- COCO-SSD model is cached after first download (~100MB)
- Detection is asynchronous to prevent UI blocking
- LocalStorage operations are synchronous
- Observable subscriptions should be unsubscribed to prevent memory leaks

```typescript
private destroy$ = new Subject<void>();

ngOnInit() {
  this.shelfMappingService.getVisualSpaces()
    .pipe(takeUntil(this.destroy$))
    .subscribe(spaces => {
      // ...
    });
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

---

**For more information, see PHARMACY_SYSTEM_README.md**
