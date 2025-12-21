# BuildAQ Pharmacy Remote Application

This is an Angular remote application configured to work with Module Federation. It serves as a micro frontend that can be loaded into a shell application.

## Project Structure

```
src/
├── app/
│   ├── pharmacy/              # Pharmacy feature module (exposed via Module Federation)
│   │   ├── components/
│   │   │   ├── pharmacy-dashboard/
│   │   │   ├── product-list/
│   │   │   └── order-management/
│   │   ├── pharmacy.module.ts
│   │   └── pharmacy-routing.module.ts
│   ├── app.module.ts
│   ├── app-routing.module.ts
│   ├── app.component.ts
│   └── app.component.html
├── main.ts
├── index.html
└── styles.scss
├── webpack.config.js          # Module Federation configuration
├── angular.json               # Angular CLI configuration
├── tsconfig.json
├── tsconfig.app.json
└── tsconfig.spec.json
```

## Features

### Pharmacy Dashboard
- Main entry point for the pharmacy application
- Navigation between products and orders sections

### Product Management
- View list of pharmacy products
- Add, edit, and delete products
- Display product details (name, category, price, quantity, expiry date)

### Order Management
- Manage customer orders
- View order status (pending, processing, completed, cancelled)
- Create and update orders

## Module Federation Configuration

This application is configured as a **remote module** with the following exposed components:

### Exposed Modules
1. **PharmacyModule** (`./Module`)
   - The main pharmacy feature module
   - Can be imported into a shell application

2. **PharmacyDashboardComponent** (`./PharmaComponent`)
   - The main pharmacy dashboard component
   - Serves as the entry point for the pharmacy feature

### Shared Dependencies
The application shares the following Angular libraries with the shell application:
- @angular/animations
- @angular/common
- @angular/compiler
- @angular/core
- @angular/forms
- @angular/platform-browser
- @angular/platform-browser-dynamic
- @angular/router
- rxjs

## Installation

```bash
npm install
```

## Development Server

Run the development server for the remote application:

```bash
npm start
```

The application will run on `http://localhost:4201` by default.

## Building

Build the remote application:

```bash
npm run build
```

For production:

```bash
npm run build:prod
```

## Integration with Shell Application

To integrate this remote application into a shell application using Module Federation:

### In the Shell Application

1. **Update webpack.config.js:**
```javascript
const { withModuleFederation } = require('@angular-architects/module-federation/webpack');

module.exports = withModuleFederation({
  name: 'shell',
  remotes: {
    pharmacy: 'pharmacy@http://localhost:4201/remoteEntry.js'
  },
  shared: {
    '@angular/core': { singleton: true, strictVersion: false },
    // ... other shared dependencies
  }
});
```

2. **Create a route for the remote module in shell routing:**
```typescript
const routes: Routes = [
  {
    path: 'pharmacy',
    loadChildren: () => import('pharmacy/Module').then(m => m.PharmacyModule)
  }
];
```

## Development Notes

- The pharmacy module is lazy-loaded to improve shell application performance
- All shared libraries use singleton mode to avoid duplication
- The remote application is self-contained and can be developed independently

## API Integration

The components currently use mock data. Replace the mock data in:
- `src/app/pharmacy/components/product-list/product-list.component.ts`
- `src/app/pharmacy/components/order-management/order-management.component.ts`

With actual API calls using Angular HttpClient or a similar service.

## Technologies

- **Angular**: ^17.0.0
- **TypeScript**: ^5.2.0
- **Webpack**: ^5.89.0
- **Module Federation**: @angular-architects/module-federation
- **SCSS**: For styling

## Contributing

This is part of the BuildAQ ecosystem. Follow the project guidelines for contributions.

## License

© 2025 BuildAQ. All rights reserved.