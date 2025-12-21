import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'pharmacy',
    loadChildren: () => import('./pharmacy/pharmacy.module').then(m => m.PharmacyModule)
  },
  {
    path: '',
    redirectTo: '/pharmacy',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
