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

  'orders.create',
  'orders.read',
  'orders.cancel',

  'payments.create',
  'payments.read',

  'loans.create',
  'loans.read',
  'loans.update',
  'loans.cancel',

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
