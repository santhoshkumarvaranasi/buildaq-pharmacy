import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PharmaRoutingModule } from './pharmacy-routing.module';
import { PharmaComponentsModule } from './components/components.module';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PharmaRoutingModule,
    PharmaComponentsModule,
    MatTableModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule
  ]
})
export class PharmacyModule { }
