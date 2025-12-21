import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PharmaRoutingModule } from './pharmacy-routing.module';
import { PharmaComponentsModule } from './components/components.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PharmaRoutingModule,
    PharmaComponentsModule
  ]
})
export class PharmacyModule { }
