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
  applied?: boolean;
}

interface OrderItem {
  productId: number;
  name: string;
  category: string;
  price: number;
  qty: number;
}

interface Receipt {
  id: number;
  receiptNumber: string;
  supplierName: string;
  receivedDate: string;
  items: ReceiptItem[];
  totalUnits: number;
}

interface ReceiptItem {
  productId: number;
  name: string;
  category: string;
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

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss']
})
export class OrderManagementComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  receipts: Receipt[] = [];
  products: Product[] = [];
  customers: Customer[] = [];
  productSearch = '';
  inboundProductSearch = '';
  lowStockItems: Array<{ name: string; qty: number }> = [];
  lowStockThreshold = 10;
  customerSearch = '';
  orderDraft = {
    customerName: '',
    items: [] as OrderItem[]
  };
  customerDraft = {
    name: '',
    phone: ''
  };
  receiptDraft = {
    supplierName: '',
    items: [] as ReceiptItem[]
  };

  private ordersStorageKey = 'buildaq_pharmacy_orders';
  private receiptsStorageKey = 'buildaq_pharmacy_receipts';
  private productsStorageKey = 'buildaq_pharmacy_products';
  private customersStorageKey = 'buildaq_pharmacy_customers';
  private productsUpdatedHandler = () => {
    this.loadProductsFromStorage();
    this.refreshLowStockItems();
  };
  
  constructor() { }
  
  ngOnInit(): void {
    this.loadOrdersFromStorage();
    this.loadReceiptsFromStorage();
    this.loadProductsFromStorage();
    this.loadCustomersFromStorage();
    this.refreshLowStockItems();
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
      const parsed = JSON.parse(raw) as Order[];
      this.orders = parsed.map(order => ({
        ...order,
        applied: order.applied ?? order.status === 'completed'
      }));
    } catch (error) {
      console.warn('Failed to parse orders', error);
      this.orders = [];
    }
  }

  private saveOrders(): void {
    localStorage.setItem(this.ordersStorageKey, JSON.stringify(this.orders));
  }

  private loadCustomersFromStorage(): void {
    const raw = localStorage.getItem(this.customersStorageKey);
    if (!raw) {
      this.customers = [];
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Customer[];
      this.customers = parsed
        .map(item => ({
          id: Number(item.id),
          name: String(item.name || '').trim(),
          phone: item.phone ? String(item.phone).trim() : ''
        }))
        .filter(item => item.name);
    } catch (error) {
      console.warn('Failed to parse customers', error);
      this.customers = [];
    }
  }

  private saveCustomers(): void {
    localStorage.setItem(this.customersStorageKey, JSON.stringify(this.customers));
  }

  private loadReceiptsFromStorage(): void {
    const raw = localStorage.getItem(this.receiptsStorageKey);
    if (!raw) {
      this.receipts = [];
      return;
    }
    try {
      this.receipts = JSON.parse(raw) as Receipt[];
    } catch (error) {
      console.warn('Failed to parse receipts', error);
      this.receipts = [];
    }
  }

  private saveReceipts(): void {
    localStorage.setItem(this.receiptsStorageKey, JSON.stringify(this.receipts));
  }

  private saveProductsToStorage(): void {
    localStorage.setItem(this.productsStorageKey, JSON.stringify(this.products));
    window.dispatchEvent(new Event('buildaq-products-updated'));
  }

  private loadProductsFromStorage(): void {
    const raw = localStorage.getItem(this.productsStorageKey);
    if (!raw) {
      this.products = [];
      this.refreshLowStockItems();
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

  get filteredInboundProducts(): Product[] {
    const term = this.inboundProductSearch.trim().toLowerCase();
    if (!term) return this.products;
    return this.products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term)
    );
  }

  get draftTotal(): number {
    return this.orderDraft.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  }

  get filteredCustomers(): Customer[] {
    const term = this.customerSearch.trim().toLowerCase();
    if (!term) return this.customers;
    return this.customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      (customer.phone || '').toLowerCase().includes(term)
    );
  }

  get receiptUnits(): number {
    return this.receiptDraft.items.reduce((sum, item) => sum + item.qty, 0);
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

  selectCustomer(customer: Customer): void {
    this.orderDraft.customerName = customer.name;
  }

  addCustomer(): void {
    const name = this.customerDraft.name.trim();
    if (!name) return;
    const existing = this.customers.find(customer => customer.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.orderDraft.customerName = existing.name;
      this.customerDraft = { name: '', phone: '' };
      return;
    }
    const nextId = this.customers.reduce((max, customer) => Math.max(max, customer.id), 0) + 1;
    const newCustomer: Customer = {
      id: nextId,
      name,
      phone: this.customerDraft.phone.trim()
    };
    this.customers.unshift(newCustomer);
    this.saveCustomers();
    this.orderDraft.customerName = newCustomer.name;
    this.customerDraft = { name: '', phone: '' };
  }

  addToReceiptDraft(product: Product): void {
    const existing = this.receiptDraft.items.find(item => item.productId === product.id);
    if (existing) {
      existing.qty += 1;
      return;
    }
    this.receiptDraft.items.push({
      productId: product.id,
      name: product.name,
      category: product.category,
      qty: 1
    });
  }

  updateReceiptQty(item: ReceiptItem, next: number): void {
    const qty = Math.max(1, Math.floor(Number(next) || 1));
    item.qty = qty;
  }

  removeReceiptItem(item: ReceiptItem): void {
    this.receiptDraft.items = this.receiptDraft.items.filter(entry => entry !== item);
  }

  clearReceiptDraft(): void {
    this.receiptDraft = {
      supplierName: '',
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

    const knownCustomer = this.customers.find(customer => customer.name.toLowerCase() === customerName.toLowerCase());
    if (!knownCustomer) {
      const nextCustomerId = this.customers.reduce((max, customer) => Math.max(max, customer.id), 0) + 1;
      this.customers.unshift({
        id: nextCustomerId,
        name: customerName
      });
      this.saveCustomers();
    }

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
      items: this.orderDraft.items.map(item => ({ ...item })),
      applied: false
    });
    this.saveOrders();
    this.clearDraft();
  }

  quickReorder(order: Order): void {
    this.orderDraft = {
      customerName: order.customerName,
      items: order.items.map(item => ({ ...item }))
    };
  }

  receiveStock(): void {
    const supplierName = this.receiptDraft.supplierName.trim();
    if (!supplierName || this.receiptDraft.items.length === 0) return;

    const nextId = this.receipts.reduce((max, receipt) => Math.max(max, receipt.id), 0) + 1;
    const date = new Date();
    const dateToken = date.toISOString().slice(0, 10).replace(/-/g, '');
    const receiptNumber = `REC-${dateToken}-${String(nextId).padStart(3, '0')}`;

    this.receiptDraft.items.forEach(item => {
      const product = this.products.find(p => p.id === item.productId);
      if (product) {
        product.quantity += item.qty;
      } else {
        this.products.push({
          id: item.productId,
          name: item.name,
          category: item.category || 'Medicine',
          price: 0,
          quantity: item.qty,
          expiryDate: 'N/A'
        });
      }
    });
    this.saveProductsToStorage();
    this.applyInboundToLayout(this.receiptDraft.items);
    this.refreshLowStockItems();

    this.receipts.unshift({
      id: nextId,
      receiptNumber,
      supplierName,
      receivedDate: date.toISOString().slice(0, 10),
      items: this.receiptDraft.items.map(item => ({ ...item })),
      totalUnits: this.receiptUnits
    });
    this.saveReceipts();
    this.clearReceiptDraft();
  }

  private applyInboundToLayout(items: ReceiptItem[]): void {
    const layoutKey = 'buildaq_pharmacy_layout_v2';
    const raw = localStorage.getItem(layoutKey);
    if (!raw) return;
    try {
      const layout = JSON.parse(raw) as Array<{
        id: string;
        type?: string;
        medicines?: Array<{ name: string; qty: number }> | string[];
        tag?: string;
      }>;
      let updated = false;

      const normalized = layout.map(item => {
        if (item.type !== 'box' || !item.medicines) return item;
        if (item.medicines.length > 0 && typeof item.medicines[0] === 'string') {
          const legacy = item.medicines as string[];
          return { ...item, medicines: legacy.map(name => ({ name, qty: 1 })) };
        }
        return item;
      });

      items.forEach(inbound => {
        let remaining = inbound.qty;
        if (remaining <= 0) return;
        const nameKey = inbound.name.trim().toLowerCase();

        const candidateBoxes = normalized.filter(item => item.type === 'box') as Array<{
          id: string;
          medicines?: Array<{ name: string; qty: number }>;
          tag?: string;
        }>;

        candidateBoxes.forEach(box => {
          if (remaining <= 0) return;
          if (!box.medicines) return;
          const match = box.medicines.find(med => med.name.toLowerCase() === nameKey);
          if (!match) return;
          const add = remaining;
          match.qty += add;
          remaining -= add;
          updated = true;
        });

        if (remaining > 0) {
          const tagged = candidateBoxes.find(box => (box.tag || '').toLowerCase() === inbound.category.toLowerCase());
          const target = tagged || candidateBoxes[0];
          if (target) {
            if (!target.medicines) target.medicines = [];
            const match = target.medicines.find(med => med.name.toLowerCase() === nameKey);
            if (match) {
              match.qty += remaining;
            } else {
              target.medicines.push({ name: inbound.name, qty: remaining });
            }
            updated = true;
          }
        }
      });

      if (updated) {
        localStorage.setItem(layoutKey, JSON.stringify(normalized));
        window.dispatchEvent(new Event('buildaq-layout-updated'));
      }
    } catch (error) {
      console.warn('Failed to apply inbound stock to layout', error);
    }
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
    if (nextStatus === 'completed' && !order.applied) {
      this.applyOutboundToProducts(order.items);
      this.applyOutboundToLayout(order.items);
      order.applied = true;
      this.refreshLowStockItems();
    }
    this.saveOrders();
  }

  private applyOutboundToProducts(items: OrderItem[]): void {
    items.forEach(item => {
      const product = this.products.find(p => p.id === item.productId);
      if (product) {
        product.quantity -= item.qty;
        return;
      }
      this.products.push({
        id: item.productId,
        name: item.name,
        category: item.category || 'Medicine',
        price: item.price ?? 0,
        quantity: -item.qty,
        expiryDate: 'N/A'
      });
    });
    this.saveProductsToStorage();
  }

  private applyOutboundToLayout(items: OrderItem[]): void {
    const layoutKey = 'buildaq_pharmacy_layout_v2';
    const raw = localStorage.getItem(layoutKey);
    if (!raw) return;
    try {
      const layout = JSON.parse(raw) as Array<{
        id: string;
        type?: string;
        medicines?: Array<{ name: string; qty: number }> | string[];
        tag?: string;
      }>;
      let updated = false;

      const normalized = layout.map(item => {
        if (item.type !== 'box' || !item.medicines) return item;
        if (item.medicines.length > 0 && typeof item.medicines[0] === 'string') {
          const legacy = item.medicines as string[];
          return { ...item, medicines: legacy.map(name => ({ name, qty: 1 })) };
        }
        return item;
      });

      const boxes = normalized.filter(item => item.type === 'box') as Array<{
        id: string;
        medicines?: Array<{ name: string; qty: number }>;
        tag?: string;
      }>;

      items.forEach(orderItem => {
        let remaining = orderItem.qty;
        if (remaining <= 0) return;
        const nameKey = orderItem.name.trim().toLowerCase();

        boxes.forEach(box => {
          if (remaining <= 0) return;
          if (!box.medicines) return;
          const match = box.medicines.find(med => med.name.toLowerCase() === nameKey);
          if (!match || match.qty <= 0) return;
          const take = Math.min(match.qty, remaining);
          match.qty -= take;
          remaining -= take;
          updated = true;
        });

        if (remaining > 0) {
          const fallback = boxes[0];
          if (fallback) {
            if (!fallback.medicines) fallback.medicines = [];
            const match = fallback.medicines.find(med => med.name.toLowerCase() === nameKey);
            if (match) {
              match.qty -= remaining;
            } else {
              fallback.medicines.push({ name: orderItem.name, qty: -remaining });
            }
            updated = true;
          }
        }
      });

      if (updated) {
        localStorage.setItem(layoutKey, JSON.stringify(normalized));
        window.dispatchEvent(new Event('buildaq-layout-updated'));
      }
    } catch (error) {
      console.warn('Failed to apply outbound stock to layout', error);
    }
  }

  private refreshLowStockItems(): void {
    this.lowStockItems = this.products
      .filter(product => product.quantity < this.lowStockThreshold)
      .map(product => ({ name: product.name, qty: product.quantity }));
  }
}
