import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';

// Components
import { PharmacyDashboardComponent } from './pharmacy-dashboard/pharmacy-dashboard.component';
import { ProductListComponent } from './product-list/product-list.component';
import { OrderManagementComponent } from './order-management/order-management.component';
import { VisualSpaceMapperComponent } from './visual-space-mapper/visual-space-mapper.component';
import { MedicineDetectionComponent } from './medicine-detection/medicine-detection.component';
import { ShelfManagementComponent } from './shelf-management/shelf-management.component';

@NgModule({
  declarations: [
    PharmacyDashboardComponent,
    ProductListComponent,
    OrderManagementComponent,
    VisualSpaceMapperComponent,
    MedicineDetectionComponent,
    ShelfManagementComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatTabsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatTableModule
  ],
  exports: [
    PharmacyDashboardComponent,
    VisualSpaceMapperComponent,
    MedicineDetectionComponent,
    ShelfManagementComponent
  ]
})
export class PharmaComponentsModule { }
