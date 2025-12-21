# Testing Guide - Pharmacy Shelf Mapping System

## 🧪 Testing the Application

### Prerequisites
- Node.js installed
- npm or yarn available
- Modern web browser
- Internet connection (for TensorFlow.js model download)

---

## 🚀 Setup & Launch

### Step 1: Install Dependencies
```bash
cd buildaq-pharmacy
npm install
```

### Step 2: Start Development Server
```bash
npm start
```

Expected output:
```
✔ Compiled successfully.
localhost:4200 - Local: http://localhost:4200/
```

### Step 3: Open Application
Navigate to: **http://localhost:4200/**

You should see:
- Purple header with "Pharmacy Shelf Mapping System"
- 5 navigation tabs
- TabGroup with "Visual Mapper" tab active

---

## ✅ Feature Testing Checklist

### Test 1: Visual Space Mapper
**Location**: Visual Mapper tab

#### 1.1 Upload Image
- [ ] Click "Choose Image" button
- [ ] Select a JPG/PNG image from your computer
- [ ] Image preview appears on canvas
- [ ] "Detected Objects" section appears below

#### 1.2 View Detection Results
- [ ] Canvas displays image with bounding boxes
- [ ] Green rectangles show detected objects
- [ ] Text labels show class names and confidence
- [ ] Detection Results panel shows list of objects
- [ ] Each object shows: name, class, confidence

#### 1.3 Create Visual Space
- [ ] Enter "Visual Space Name" (e.g., "Test Aisle 1")
- [ ] Enter "Location" (e.g., "Front of Store")
- [ ] Image is selected
- [ ] Click "Create Visual Space"
- [ ] Success message appears
- [ ] Space appears in "All Visual Spaces" list

#### 1.4 Manage Shelves
- [ ] Go to "Manage Shelves" tab
- [ ] Created space shows at top
- [ ] Enter "Shelf Name" (e.g., "Shelf A")
- [ ] Enter Width: 100, Height: 50
- [ ] Click "Add Shelf"
- [ ] Shelf appears in "Shelves in this Space" list

#### 1.5 Delete Visual Space
- [ ] Click delete icon (trash) next to space name
- [ ] Confirm deletion
- [ ] Space is removed from list

---

### Test 2: Medicine Detection

**Location**: Medicine Detection tab

#### 2.1 Configure Settings
- [ ] Click "Detection Settings" to expand
- [ ] Enter image URL (or test with local image)
- [ ] Min Confidence slider shows values 0-1
- [ ] Filter by Class field is empty
- [ ] All settings are optional

#### 2.2 Start Detection
- [ ] Click "Detect Medicines" button
- [ ] Button shows "Detecting..." state
- [ ] Loading indicator visible
- [ ] Detected medicines appear in table

#### 2.3 View Results
- [ ] Table shows columns: Name, Class, Confidence, Position, Actions
- [ ] Confidence column shows progress bar
- [ ] Position shows (X, Y) coordinates
- [ ] Each medicine has + and - buttons

#### 2.4 Add Medicine to Shelf
- [ ] First select a shelf in Visual Space Mapper
- [ ] Click + button next to medicine
- [ ] Success message: "Medicine added to shelf"
- [ ] Medicine can be removed with - button

#### 2.5 Filter Results
- [ ] Adjust Min Confidence to 0.7
- [ ] Enter filter class (e.g., "bottle")
- [ ] Click "Apply Filters"
- [ ] Table updates with filtered results

#### 2.6 Detection Summary
- [ ] Summary shows:
  - Total Objects Detected
  - Image Dimensions
  - Detection Time

---

### Test 3: Shelf Management

**Location**: Shelf Management tab

#### 3.1 View Locations
- [ ] Left panel shows "Pharmacy Locations"
- [ ] Lists all created visual spaces
- [ ] Click to select a location
- [ ] Selected location highlighted

#### 3.2 View Shelves
- [ ] Middle panel shows "Shelves in [Location Name]"
- [ ] Lists all shelves in selected location
- [ ] Click to select a shelf
- [ ] Shows: Shelf name, size, medicine count

#### 3.3 View Medicines
- [ ] Right panel shows "Medicines on Shelf: [Shelf Name]"
- [ ] Statistics show:
  - Total medicines
  - Average confidence %
  - Shelf dimensions
- [ ] Three stat cards visible

#### 3.4 Medicines Table
- [ ] Table shows medicine details:
  - Name, Position, Confidence, Actions
- [ ] Confidence shows visual progress bar
- [ ] Position shows coordinates
- [ ] Delete button removes medicines

#### 3.5 Export Data
- [ ] Select a shelf
- [ ] Click "Export Data"
- [ ] JSON file downloads with format:
  ```json
  {
    "shelf": {...},
    "medicines": [...],
    "exportDate": "...",
    "totalMedicines": N
  }
  ```

#### 3.6 Print Functionality
- [ ] Click "Print" button
- [ ] Browser print dialog opens
- [ ] Page shows shelf information
- [ ] Can save as PDF

---

### Test 4: Data Persistence

#### 4.1 LocalStorage
- [ ] Create a visual space
- [ ] Open browser DevTools (F12)
- [ ] Go to Application → LocalStorage
- [ ] Find key: `visual_spaces`
- [ ] Value is valid JSON string
- [ ] Contains created space data

#### 4.2 Browser Refresh
- [ ] Create some data
- [ ] Refresh page (F5)
- [ ] All data is still visible
- [ ] No data loss occurs

#### 4.3 Clear Data
- [ ] DevTools → Application → Storage
- [ ] Clear Local Storage
- [ ] Refresh page
- [ ] All data is gone (starting fresh)

---

### Test 5: Responsive Design

#### 5.1 Desktop (1920px)
- [ ] Shelf Management shows 3-column layout
- [ ] Tables are full width
- [ ] All buttons visible and accessible

#### 5.2 Tablet (768px)
- [ ] DevTools → Toggle device toolbar
- [ ] Set to iPad (768 x 1024)
- [ ] Layout shifts to single column
- [ ] All content is readable
- [ ] Buttons are touch-friendly

#### 5.3 Mobile (375px)
- [ ] Set to iPhone (375 x 812)
- [ ] Tab labels show icons only
- [ ] Content is vertically stacked
- [ ] No horizontal scrolling
- [ ] Forms are easily usable

---

### Test 6: Material Design

#### 6.1 Colors
- [ ] Header has purple gradient
- [ ] Primary buttons are blue
- [ ] Warning buttons are red
- [ ] Tab active state is styled
- [ ] Icons are properly colored

#### 6.2 Animations
- [ ] Card hover effects visible
- [ ] Tab switching is animated
- [ ] Buttons have ripple effect
- [ ] Expansion panels animate smoothly

#### 6.3 Typography
- [ ] Headers are bold and prominent
- [ ] Body text is readable
- [ ] All text is properly spaced
- [ ] Font sizes are consistent

#### 6.4 Icons
- [ ] All Material icons display correctly
- [ ] Icons are properly sized
- [ ] Icons have correct colors
- [ ] Icons align properly

---

### Test 7: Form Validation

#### 7.1 Visual Space Form
- [ ] Space name required validation works
- [ ] Location required validation works
- [ ] Error messages display
- [ ] "Create Visual Space" disabled until valid
- [ ] Image selection required

#### 7.2 Shelf Form
- [ ] Shelf name required
- [ ] Width must be >= 10
- [ ] Height must be >= 10
- [ ] Error messages on invalid input
- [ ] Button disabled when invalid

#### 7.3 Detection Form
- [ ] Image URL field works
- [ ] Confidence slider 0-1 range
- [ ] Class filter is optional
- [ ] Form submits without errors

---

### Test 8: Error Handling

#### 8.1 Invalid Image URL
- [ ] Enter non-existent image URL
- [ ] Click "Detect Medicines"
- [ ] Error handled gracefully
- [ ] No UI crashes

#### 8.2 Large Images
- [ ] Try uploading very large image
- [ ] Detection still works
- [ ] May be slower but completes
- [ ] No memory issues

#### 8.3 Unsupported Formats
- [ ] Try uploading non-image file
- [ ] Input validation prevents
- [ ] Error message shown
- [ ] Application continues working

---

### Test 9: Navigation

#### 9.1 Tab Switching
- [ ] Click each tab
- [ ] Tab content loads
- [ ] URL structure consistent
- [ ] Back/forward buttons work

#### 9.2 Component Loading
- [ ] Visual Mapper loads without errors
- [ ] Medicine Detection loads properly
- [ ] Shelf Management displays correctly
- [ ] No console errors

#### 9.3 Deep Linking
- [ ] Copy URL with tab state
- [ ] Share URL with others
- [ ] Opening URL loads correct tab
- [ ] State is preserved

---

## 🧬 AI Detection Testing

### Test 1: Detection Accuracy

#### Test Images to Try
1. **Pharmacy Shelf Photo**
   - Expected: Detect bottles, boxes, containers
   - Confidence: 0.6-0.95

2. **Medicine Bottle**
   - Expected: Bottle, label detection
   - Confidence: 0.8+

3. **Multiple Items**
   - Expected: All items detected
   - Confidence: 0.5-0.9

#### Confidence Interpretation
- **0.9+**: Very confident, reliable
- **0.7-0.9**: Good confidence, mostly reliable
- **0.5-0.7**: Moderate confidence, review recommended
- **<0.5**: Low confidence, may be false positive

---

## 📊 Sample Data for Testing

### Test Medicines (Pre-loaded)
1. Aspirin (500mg)
2. Paracetamol (500mg)
3. Amoxicillin (250mg)
4. Ibuprofen (400mg)
5. Metformin (500mg)
6. Lisinopril (10mg)
7. Atorvastatin (20mg)
8. Omeprazole (20mg)

### Sample Shelf Dimensions
- Standard shelf: 100cm × 50cm
- Tall shelf: 100cm × 80cm
- Wide shelf: 150cm × 50cm
- Corner shelf: 75cm × 75cm

---

## 🔍 Browser Console Testing

### Check Services
```javascript
// In browser console:

// Check TensorFlow.js loaded
tf

// Check model
coco

// Check LocalStorage
localStorage.getItem('visual_spaces')

// Check component state
ng.getComponent(document.body).shelfMappingService
```

### Monitor Network
1. Open DevTools
2. Go to Network tab
3. Perform detection
4. Check model file download (~100MB on first load)
5. Check JSON responses

---

## ⚡ Performance Testing

### Baseline Metrics
- Initial load: < 3 seconds
- Tab switch: < 500ms
- Image upload: < 1 second
- Detection: 5-30 seconds (first run loads model)
- Detection: 2-10 seconds (subsequent runs)

### Memory Usage
- Initial load: ~50MB
- After detection: ~150-200MB (model cached)
- Grows with number of medicines tracked

### Network
- First load: ~2-3MB
- Model download: ~100MB (one time)
- Subsequent operations: < 100KB

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Model not loading | Check internet, wait for download |
| Images not uploading | Check file format, size, permissions |
| Detection not working | Ensure image is clear, well-lit |
| Data not saving | Check LocalStorage enabled |
| Performance slow | Close browser tabs, restart app |
| UI elements missing | Hard refresh (Ctrl+Shift+R) |

---

## ✅ Final Verification

Before deployment, verify:

- [ ] npm install completes without errors
- [ ] npm start runs successfully
- [ ] Application loads at localhost:4200
- [ ] All tabs are functional
- [ ] Can create visual space
- [ ] Can upload image
- [ ] Detection works on test image
- [ ] Data persists after refresh
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Export functionality works
- [ ] Print functionality works

---

## 📝 Test Report Template

```
Test Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

RESULTS:
✓ Visual Space Mapper: PASS / FAIL
✓ Medicine Detection: PASS / FAIL
✓ Shelf Management: PASS / FAIL
✓ Data Persistence: PASS / FAIL
✓ Responsive Design: PASS / FAIL
✓ Material Design: PASS / FAIL
✓ Form Validation: PASS / FAIL
✓ Navigation: PASS / FAIL

Issues Found:
___________________________

Overall Status: PASS / FAIL / NEEDS FIXES
```

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] Run npm run build:prod
- [ ] Check dist folder contents
- [ ] Test production build locally
- [ ] Verify all assets present
- [ ] Check file sizes
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Performance optimization complete
- [ ] Security review passed
- [ ] Documentation complete

---

**Happy Testing! 🎉**

For issues or questions, refer to the comprehensive documentation in:
- PHARMACY_SYSTEM_README.md
- API_DOCUMENTATION.md
- QUICK_START.md
