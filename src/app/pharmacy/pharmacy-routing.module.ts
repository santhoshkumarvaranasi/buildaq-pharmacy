import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PharmacyDashboardComponent } from './components/pharmacy-dashboard/pharmacy-dashboard.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { OrderManagementComponent } from './components/order-management/order-management.component';
import { VisualSpaceMapperComponent } from './components/visual-space-mapper/visual-space-mapper.component';
import { MedicineDetectionComponent } from './components/medicine-detection/medicine-detection.component';
import { ShelfManagementComponent } from './components/shelf-management/shelf-management.component';
import { ThreeEditorComponent } from './components/three-editor/three-editor.component';

const routes: Routes = [
  {
    path: '',
    component: PharmacyDashboardComponent,
    children: [
      { path: 'products', component: ProductListComponent },
      { path: 'orders', component: OrderManagementComponent },
      { path: 'visual-mapper', component: VisualSpaceMapperComponent },
      { path: 'visual-editor', component: ThreeEditorComponent },
      { path: 'medicine-detection', component: MedicineDetectionComponent },
      { path: 'shelf-management', component: ShelfManagementComponent },
      { path: '', redirectTo: 'visual-mapper', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PharmaRoutingModule { }
