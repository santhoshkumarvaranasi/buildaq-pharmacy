const { withModuleFederation } = require('@angular-architects/module-federation/webpack');

module.exports = withModuleFederation({
  name: 'pharmacy',
  filename: 'remoteEntry.js',
  exposes: {
    './Module': './src/app/pharmacy/pharmacy.module.ts',
    './PharmaComponent': './src/app/pharmacy/components/pharmacy-dashboard/pharmacy-dashboard.component.ts',
  },
  shared: [
    'shared',
    {
      '@angular/animations': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/common': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/compiler': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/core': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/forms': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/platform-browser': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/platform-browser-dynamic': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      '@angular/router': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      'rxjs': { singleton: true, strictVersion: false, requiredVersion: 'auto' },
    }
  ]
});
