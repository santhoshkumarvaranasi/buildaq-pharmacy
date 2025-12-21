import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-pharmacy-dashboard',
  templateUrl: './pharmacy-dashboard.component.html',
  styleUrls: ['./pharmacy-dashboard.component.scss']
})
export class PharmacyDashboardComponent {
  title = 'Pharmacy Shelf Mapping System';

  navItems: NavItem[] = [
    {
      label: 'Visual Space Mapper',
      route: '/visual-mapper',
      icon: 'landscape',
      description: 'Create and manage pharmacy shelf layouts'
    },
    {
      label: 'Medicine Detection',
      route: '/medicine-detection',
      icon: 'local_pharmacy',
      description: 'Detect medicines from images automatically'
    },
    {
      label: 'Shelf Management',
      route: '/shelf-management',
      icon: 'inventory',
      description: 'Manage and organize shelf medicines'
    },
    {
      label: 'Products',
      route: '/products',
      icon: 'shopping_cart',
      description: 'View and manage product catalog'
    },
    {
      label: 'Orders',
      route: '/orders',
      icon: 'receipt',
      description: 'Manage pharmacy orders'
    }
  ];

  constructor(private router: Router) { }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
