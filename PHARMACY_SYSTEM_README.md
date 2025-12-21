# Pharmacy Shelf Mapping System

A comprehensive Angular web application for pharmacists to identify drugs and manage their placement in pharmacy shelves using AI-powered visual detection. This system helps pharmacists maintain organized shelf layouts and quickly locate medicines.

## 🎯 Features

### 1. **Visual Space Mapper**
- Create pharmacy shelf layouts from photos/videos
- Upload images of pharmacy locations
- Automatically detects objects using AI (TensorFlow.js COCO-SSD)
- Organize shelves within visual spaces
- Easy management of multiple pharmacy locations

### 2. **Medicine Detection**
- Real-time medicine detection from images
- AI-powered object recognition (COCO-SSD model)
- Configurable confidence thresholds
- Filter detection results by class
- Position mapping of detected medicines on shelves

### 3. **Shelf Management**
- Comprehensive shelf inventory management
- View medicines by shelf
- Track medicine positions and placement coordinates
- Calculate average detection confidence
- Export shelf data (JSON format)
- Print shelf information
- Visual shelf organization interface

### 4. **Material Design UI**
- Modern, responsive Angular Material design
- Intuitive tab-based navigation
- Color-coded status indicators
- Professional styling with custom theme
- Mobile-friendly interface

## 🛠️ Tech Stack

- **Frontend Framework**: Angular 17
- **UI Framework**: Angular Material
- **AI/ML**: 
  - TensorFlow.js 4.11.0
  - COCO-SSD Model for object detection
- **State Management**: RxJS BehaviorSubject
- **Forms**: Angular Reactive Forms
- **Styling**: SCSS
- **Storage**: Browser LocalStorage

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Modern web browser with WebGL support

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd buildaq-pharmacy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Development Server

Run the development server:

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/` in your browser.

### 4. Build for Production

```bash
npm run build:prod
# or
ng build --configuration production
```

## 📁 Project Structure

```
src/app/pharmacy/
├── services/
│   ├── image-detection.service.ts      # AI-powered medicine detection
│   ├── shelf-mapping.service.ts         # Shelf and visual space management
│   └── medicine.service.ts              # Medicine database and catalog
├── components/
│   ├── visual-space-mapper/             # Create and manage visual spaces
│   ├── medicine-detection/              # Detect medicines from images
│   ├── shelf-management/                # Manage shelf inventory
│   ├── pharmacy-dashboard/              # Main dashboard with navigation
│   ├── product-list/                    # Product catalog
│   ├── order-management/                # Order management
│   └── components.module.ts             # Components module configuration
├── pharmacy-routing.module.ts           # Pharmacy routing configuration
└── pharmacy.module.ts                   # Pharmacy module
```

## 🔑 Key Components & Services

### ImageDetectionService
Handles AI-powered medicine detection using TensorFlow.js and COCO-SSD model.

**Key Methods:**
- `detectMedicines(imageInput)` - Detect objects in an image
- `detectFromCanvas(canvas)` - Detect objects from canvas element
- `filterDetectionsByClass(results, className)` - Filter results by class
- `getMedicineConfidence(results, minConfidence)` - Get high-confidence results

### ShelfMappingService
Manages visual spaces, shelves, and medicine locations with persistent storage.

**Key Methods:**
- `createVisualSpace(name, location, imageUrl)` - Create new pharmacy location
- `createShelf(visualSpaceId, name, width, height)` - Add shelf to space
- `addMedicineToShelf(shelfId, medicine)` - Place medicine on shelf
- `updateMedicineLocation(shelfId, medicineId, x, y)` - Update position
- `removeMedicineFromShelf(shelfId, medicineId)` - Remove medicine

### MedicineService
Manages medicine catalog and search functionality.

**Key Methods:**
- `getMedicines()` - Get all medicines
- `searchMedicines(query)` - Search by name or barcode
- `getMedicinesByCategory(category)` - Filter by category
- `getMedicineByBarcode(barcode)` - Look up by barcode

## 💡 Usage Guide

### 1. Creating a Visual Space

1. Navigate to **Visual Mapper** tab
2. Enter space name (e.g., "Main Aisle")
3. Enter location details
4. Upload a pharmacy image
5. Click "Create Visual Space"

### 2. Adding Shelves

1. Select an existing visual space
2. Go to **Manage Shelves** tab
3. Enter shelf name and dimensions
4. Click "Add Shelf"

### 3. Detecting Medicines

1. Navigate to **Medicine Detection** tab
2. Enter image URL or upload an image
3. Adjust confidence threshold if needed
4. Click "Detect Medicines"
5. Review detected objects with confidence scores
6. Select high-confidence detections to add to shelf

### 4. Managing Shelf Inventory

1. Go to **Shelf Management** tab
2. Select a pharmacy location
3. Select a shelf
4. View all medicines with their positions
5. Export data or print for record keeping

## 📊 Data Models

### VisualSpace
```typescript
{
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  shelves: Shelf[];
  createdDate: Date;
  lastUpdated: Date;
}
```

### Shelf
```typescript
{
  id: string;
  name: string;
  location: string;
  width: number;
  height: number;
  medicines: MedicineLocation[];
  imageUrl?: string;
}
```

### MedicineLocation
```typescript
{
  id: string;
  name: string;
  barcode?: string;
  x: number;              // X coordinate on shelf
  y: number;              // Y coordinate on shelf
  width: number;          // Detected object width
  height: number;         // Detected object height
  confidence: number;     // Detection confidence (0-1)
  shelfId: string;
  detectionTime: Date;
}
```

## 🎨 Styling & Theming

The application uses Angular Material with a custom indigo-pink theme. Global styles are defined in `src/styles.scss`.

### Color Scheme
- Primary: `#1976d2` (Indigo)
- Accent: `#ff4081` (Pink)
- Success: `#4caf50` (Green)
- Warning: `#ff9800` (Orange)
- Error: `#f44336` (Red)

## 💾 Data Persistence

Data is stored in browser's LocalStorage under the `visual_spaces` key. Data persists across browser sessions.

```typescript
// Access stored data
const data = localStorage.getItem('visual_spaces');
const visualSpaces = JSON.parse(data);
```

## 🔍 AI Model Information

### COCO-SSD (Common Objects in Context - Single Shot Detector)
- Pre-trained model for object detection
- Detects 90 different object classes
- Fast and efficient detection
- Works in browser without backend
- Typical objects detected: bottles, boxes, containers, etc.

**Note:** For medicine-specific detection, consider fine-tuning the model with pharmaceutical images.

## 🐛 Troubleshooting

### COCO-SSD Model Not Loading
- Ensure you have internet connection (model is downloaded on first use)
- Check browser console for TensorFlow.js warnings
- Clear browser cache and restart

### Image Upload Issues
- Ensure image format is supported (JPG, PNG, WebP)
- Check image file size (should be < 50MB)
- Use HTTPS for better CORS support

### Confidence Scores Too Low
- Adjust confidence threshold in detection settings
- Ensure good lighting in pharmacy images
- Use clear, high-resolution images

## 📱 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔐 Security Considerations

- Images are processed locally in the browser
- No data is sent to external servers
- LocalStorage data is accessible to the application only
- Consider implementing proper authentication for production use

## 🚀 Performance Optimization

- COCO-SSD model is cached after first download
- Images are processed asynchronously to prevent UI blocking
- Component lazy loading in module federation setup
- CSS and JS optimization for production builds

## 📈 Future Enhancements

1. **Advanced Features**
   - Real-time video stream detection
   - Barcode scanning integration
   - Medicine expiry date tracking
   - Automated shelf alerts

2. **ML Improvements**
   - Custom model training for medicine-specific detection
   - Multiple model support
   - Fine-tuned models for different pharmacy types

3. **User Features**
   - User authentication and roles
   - Multi-user collaboration
   - Audit logging
   - Mobile app (React Native)

4. **Integration**
   - Backend API integration
   - Barcode scanner hardware support
   - Receipt printer support
   - Pharmacy management system integration

## 📞 Support & Documentation

For additional help, refer to:
- [Angular Documentation](https://angular.io)
- [Angular Material](https://material.angular.io)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [COCO-SSD Model](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Development

### Commands

```bash
# Start development server
npm start

# Build for production
npm run build:prod

# Run tests
npm test

# Run linting
ng lint

# Watch mode during development
npm run watch
```

### Code Style

- Follow Angular style guide
- Use TypeScript strict mode
- Use RxJS for reactive programming
- Implement OnDestroy for subscription cleanup

## 🤝 Contributing

Contributions are welcome! Please follow the existing code style and add tests for new features.

---

**Happy Shelving! 🏥💊**
