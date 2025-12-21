import { Component, OnInit } from '@angular/core';

interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  orderDate: string;
}

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss']
})
export class OrderManagementComponent implements OnInit {
  orders: Order[] = [];
  
  constructor() { }
  
  ngOnInit(): void {
    this.loadOrders();
  }
  
  loadOrders(): void {
    // Mock data - replace with actual API call
    this.orders = [
      {
        id: 1,
        orderNumber: 'ORD-001',
        customerId: 100,
        customerName: 'John Doe',
        totalAmount: 45.99,
        status: 'completed',
        orderDate: '2025-12-15'
      },
      {
        id: 2,
        orderNumber: 'ORD-002',
        customerId: 101,
        customerName: 'Jane Smith',
        totalAmount: 78.50,
        status: 'processing',
        orderDate: '2025-12-18'
      },
      {
        id: 3,
        orderNumber: 'ORD-003',
        customerId: 102,
        customerName: 'Bob Johnson',
        totalAmount: 32.25,
        status: 'pending',
        orderDate: '2025-12-19'
      }
    ];
  }
  
  getStatusColor(status: string): string {
    switch(status) {
      case 'completed':
        return '#27ae60';
      case 'processing':
        return '#f39c12';
      case 'pending':
        return '#3498db';
      case 'cancelled':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  }
  
  onCreateOrder(): void {
    console.log('Create order functionality to be implemented');
  }
  
  onViewOrder(order: Order): void {
    console.log('View order:', order);
  }
  
  onUpdateStatus(order: Order): void {
    console.log('Update order status:', order);
  }
}
