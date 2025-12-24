import { Component, OnDestroy, OnInit } from '@angular/core';

interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  orderDate: string;
  items: OrderItem[];
}

interface OrderItem {
  productId: number;
  name: string;
  category: string;
  price: number;
  qty: number;
}

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  expiryDate: string;
}

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss']
})
export class OrderManagementComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  products: Product[] = [];
  productSearch = '';
  orderDraft = {
    customerName: '',
    items: [] as OrderItem[]
  };

  private ordersStorageKey = 'buildaq_pharmacy_orders';
  private productsStorageKey = 'buildaq_pharmacy_products';
  private productsUpdatedHandler = () => this.loadProductsFromStorage();
  
  constructor() { }
  
  ngOnInit(): void {
    this.loadOrdersFromStorage();
    this.loadProductsFromStorage();
    window.addEventListener('buildaq-products-updated', this.productsUpdatedHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('buildaq-products-updated', this.productsUpdatedHandler);
  }
  
  private loadOrdersFromStorage(): void {
    const raw = localStorage.getItem(this.ordersStorageKey);
    if (!raw) {
      this.orders = [];
      return;
    }
    try {
      this.orders = JSON.parse(raw) as Order[];
    } catch (error) {
      console.warn('Failed to parse orders', error);
      this.orders = [];
    }
  }

  private saveOrders(): void {
    localStorage.setItem(this.ordersStorageKey, JSON.stringify(this.orders));
  }

  private loadProductsFromStorage(): void {
    const raw = localStorage.getItem(this.productsStorageKey);
    if (!raw) {
      this.products = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Product[];
      this.products = parsed
        .map(item => ({
          id: Number(item.id),
          name: String(item.name || '').trim(),
          category: String(item.category || 'Medicine'),
          price: Number(item.price ?? 0),
          quantity: Number(item.quantity ?? 0),
          expiryDate: String(item.expiryDate || 'N/A')
        }))
        .filter(item => item.name);
    } catch (error) {
      console.warn('Failed to parse products', error);
      this.products = [];
    }
  }

  get filteredProducts(): Product[] {
    const term = this.productSearch.trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term)
    );
  }

  get draftTotal(): number {
    return this.orderDraft.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  addToDraft(product: Product): void {
    const existing = this.orderDraft.items.find(item => item.productId === product.id);
    if (existing) {
      existing.qty += 1;
      return;
    }
    this.orderDraft.items.push({
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price ?? 0,
      qty: 1
    });
  }

  updateDraftQty(item: OrderItem, next: number): void {
    const qty = Math.max(1, Math.floor(Number(next) || 1));
    item.qty = qty;
  }

  removeDraftItem(item: OrderItem): void {
    this.orderDraft.items = this.orderDraft.items.filter(entry => entry !== item);
  }

  clearDraft(): void {
    this.orderDraft = {
      customerName: '',
      items: []
    };
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
  
  createOrder(): void {
    const customerName = this.orderDraft.customerName.trim();
    if (!customerName || this.orderDraft.items.length === 0) return;

    const nextId = this.orders.reduce((max, order) => Math.max(max, order.id), 0) + 1;
    const date = new Date();
    const dateToken = date.toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-${dateToken}-${String(nextId).padStart(3, '0')}`;

    this.orders.unshift({
      id: nextId,
      orderNumber,
      customerId: nextId,
      customerName,
      totalAmount: this.draftTotal,
      status: 'pending',
      orderDate: date.toISOString().slice(0, 10),
      items: this.orderDraft.items.map(item => ({ ...item }))
    });
    this.saveOrders();
    this.clearDraft();
  }
  
  onViewOrder(order: Order): void {
    console.log('View order:', order);
  }
  
  onUpdateStatus(order: Order): void {
    const nextStatus: Order['status'] =
      order.status === 'pending'
        ? 'processing'
        : order.status === 'processing'
          ? 'completed'
          : order.status === 'completed'
            ? 'cancelled'
            : 'pending';
    order.status = nextStatus;
    this.saveOrders();
  }
}
