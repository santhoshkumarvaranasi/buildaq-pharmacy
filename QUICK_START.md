# Quick Start Guide - Pharmacy Shelf Mapping System

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
cd buildaq-pharmacy
npm install
```

### 2. Start the Application
```bash
npm start
```

The application will open at `http://localhost:4200/`

### 3. First Steps

#### Step 1: Create a Visual Space
1. Click on **Visual Mapper** tab
2. Fill in:
   - **Visual Space Name**: e.g., "Main Aisle 1"
   - **Location**: e.g., "Store Front"
3. Click **Choose Image** and select a pharmacy shelf photo
4. The system will automatically detect objects in the image
5. Click **Create Visual Space**

#### Step 2: Add Shelves
1. Stay on **Visual Mapper** → **Manage Shelves** tab
2. Your newly created space will be selected
3. Enter:
   - **Shelf Name**: e.g., "Shelf A"
   - **Width (cm)**: e.g., 100
   - **Height (cm)**: e.g., 50
4. Click **Add Shelf**

#### Step 3: Detect Medicines
1. Click on **Medicine Detection** tab
2. Enter the **Image URL** or upload an image
3. Adjust **Min Confidence** (0-1 range, default 0.5)
4. Click **Detect Medicines**
5. Review detected objects in the table
6. Click the **+** button to add a medicine to the selected shelf

#### Step 4: Manage Inventory
1. Click on **Shelf Management** tab
2. Select a **Location** from the left panel
3. Select a **Shelf** from the middle panel
4. View all medicines with their positions
5. Export data by clicking **Export Data**

## 📊 Key Features

### Visual Space Mapper
- **Create locations**: Store pharmacy shelf layouts as visual spaces
- **Multiple shelves**: Each space can contain multiple shelves
- **Image storage**: Keep reference images of each location
- **Real-time detection**: AI automatically detects objects in photos

### Medicine Detection
- **Confidence filtering**: Only show high-confidence detections
- **Class filtering**: Filter by specific object types
- **Position tracking**: Know exactly where medicines are placed (X, Y coordinates)
- **Batch operations**: Add multiple medicines at once

### Shelf Management
- **Inventory view**: See all medicines on a shelf at a glance
- **Position details**: View (X, Y) coordinates of each medicine
- **Statistics**: Average confidence scores and total medicine count
- **Export/Print**: Generate reports for record keeping

## 💡 Tips & Tricks

### Best Practices for Detection
1. **Lighting**: Use good lighting for better detection accuracy
2. **Image Quality**: Use clear, high-resolution images
3. **Angle**: Take photos straight-on for best results
4. **Distance**: Ensure medicines are clearly visible and not too small

### Confidence Threshold
- **0.7+**: Very confident detections, fewest false positives
- **0.5-0.7**: Balanced accuracy and recall
- **Below 0.5**: Includes uncertain detections, may have errors

### Organizing Shelves
1. Create separate visual spaces for different pharmacy sections
2. Use consistent shelf naming (e.g., "Shelf 1A", "Shelf 1B")
3. Include dimensions for accurate positioning
4. Keep reference images for future verification

## 🛠️ Common Tasks

### Add a New Medicine to a Shelf
1. Go to **Medicine Detection** tab
2. Upload/paste image URL
3. Review detected medicines
4. Click the **+** button next to the medicine name
5. Medicine is automatically added to selected shelf

### Remove a Medicine
1. Go to **Shelf Management** tab
2. Select the shelf containing the medicine
3. Find the medicine in the table
4. Click the **trash icon** to remove

### Export Shelf Data
1. Go to **Shelf Management** tab
2. Select a shelf
3. Click **Export Data** button
4. A JSON file will be downloaded with all shelf information

### Print Shelf Information
1. Go to **Shelf Management** tab
2. Select a shelf
3. Click **Print** button
4. Your browser's print dialog will open
5. Save as PDF or print directly

## 🎯 Real-World Examples

### Example 1: Organizing Pain Relief Aisle
```
Visual Space: Pain Relief Section
├── Shelf A1 (100cm × 50cm)
│   ├── Aspirin (25, 15)
│   ├── Ibuprofen (40, 15)
│   └── Paracetamol (60, 15)
└── Shelf A2 (100cm × 50cm)
    ├── Naproxen (25, 35)
    └── Diclofenac (55, 35)
```

### Example 2: Antibiotic Section
```
Visual Space: Antibiotics Aisle
├── Shelf B1 (80cm × 40cm)
│   ├── Amoxicillin (20, 10)
│   ├── Azithromycin (40, 10)
│   └── Ciprofloxacin (60, 10)
```

## ⚙️ Configuration

### Adjusting Detection Sensitivity
In **Medicine Detection** tab:
- Lower the **Min Confidence** to catch more items (less accurate)
- Raise the **Min Confidence** to be more selective (more accurate)

### Filtering by Object Class
- Use the **Filter by Class** field to only show specific types
- Examples: "bottle", "box", "pill", "container"

## 📱 Mobile Access

The application is fully responsive and works on tablets and large mobile devices.

### Mobile Tips
- Use portrait orientation for better navigation
- Touch-friendly buttons and controls
- Same functionality as desktop version

## 🔄 Data Management

### Local Storage
- All data is stored in your browser's localStorage
- Data persists even after closing the browser
- Clear browser data to reset (Warning: This deletes all your data!)

### Backup
To backup your data:
1. Go to **Shelf Management**
2. Select each shelf and click **Export Data**
3. Save the JSON files to your computer

To restore:
1. Use your JSON files as reference
2. Manually recreate shelves and add medicines

## ❓ Frequently Asked Questions

**Q: Why are some medicines not being detected?**
A: The COCO-SSD model is trained on general objects. For specific medicine detection, use clear images with good lighting.

**Q: Can I edit medicine positions manually?**
A: Currently, positions are auto-detected. You can manually adjust by re-uploading and re-detecting.

**Q: Will my data be lost if I refresh the browser?**
A: No, data is saved in localStorage automatically.

**Q: How accurate is the AI detection?**
A: COCO-SSD achieves ~80-85% accuracy on general object detection. Accuracy varies with image quality.

**Q: Can I use this on my phone camera?**
A: Yes, you can upload photos taken with your phone's camera.

## 🆘 Troubleshooting

### AI Model Not Loading
- Refresh the page
- Check your internet connection
- Clear browser cache (Ctrl+Shift+Delete)
- Try a different browser

### Image Upload Failing
- Ensure image size is less than 50MB
- Try converting image to JPG format
- Check browser's file input permissions

### No Objects Detected
- Use clearer, higher resolution images
- Ensure good lighting
- Try taking photos from different angles
- Lower the confidence threshold

### Data Not Saving
- Check if localStorage is enabled in browser
- Try using a different browser
- Export data regularly as backup

## 📞 Need Help?

1. Check the detailed documentation in `PHARMACY_SYSTEM_README.md`
2. Review console errors (F12 → Console tab)
3. Verify browser compatibility (Chrome 90+, Firefox 88+, Safari 14+)

## 🎓 Learning Resources

- [Angular Material Components](https://material.angular.io/)
- [TensorFlow.js Guide](https://www.tensorflow.org/js/guide)
- [COCO-SSD Model Details](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)

---

**Ready to get started? Open your browser and navigate to `http://localhost:4200/` 🎉**
