const PERMISSIONS = [
  'dashboard.read',

  'products.create',
  'products.read',
  'products.update',
  'products.delete',

  'categories.create',
  'categories.read',
  'categories.update',
  'categories.delete',

  'stock.create',
  'stock.read',
  'stock.adjust',

  'suppliers.create',
  'suppliers.read',
  'suppliers.update',
  'suppliers.delete',

  'customers.create',
  'customers.read',
  'customers.update',
  'customers.delete',

  'sales.create',
  'sales.read',
  'sales.cancel',
  'sales.delete',

  'orders.create',
  'orders.read',
  'orders.update',
  'orders.cancel',
  'orders.pay',
  'orders.delete',

  'onDemand.create',
  'onDemand.read',
  'onDemand.cancel',
  'onDemand.pay',
  'onDemand.delete',

  'payments.create',
  'payments.read',

  'loans.create',
  'loans.read',
  'loans.update',
  'loans.cancel',
  'loans.delete',

  'expenses.create',
  'expenses.read',
  'expenses.update',
  'expenses.delete',

  'purchases.create',
  'purchases.read',
  'purchases.update',
  'purchases.delete',

  'supplierDebts.read',
  'supplierDebts.pay',

  'users.create',
  'users.read',
  'users.update',
  'users.delete',

  'roles.read',
  'roles.manage',

  'reports.read',
  'auditLogs.read',
  'settings.manage',
  'notifications.read',

  'backups.create',
  'backups.read',
  'backups.restore',
  'backups.delete'
];

const ALL_PERMISSIONS = [...PERMISSIONS];

module.exports = { PERMISSIONS, ALL_PERMISSIONS };
