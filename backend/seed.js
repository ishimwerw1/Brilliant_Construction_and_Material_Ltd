/**
 * Seeds the database with:
 *  - System roles (Super Admin, Manager, Storekeeper, Cashier)
 *  - Default Super Admin account
 *  - Company settings
 *  - Sample categories for plumbing business
 *
 * Usage: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const Role = require('./models/Role');
const User = require('./models/User');
const Setting = require('./models/Setting');
const Category = require('./models/Category');
const { ALL_PERMISSIONS } = require('./utils/permissions');

const ROLE_DEFS = [
  {
    name: 'Super Admin',
    description: 'Full unrestricted access to the entire system.',
    permissions: ALL_PERMISSIONS,
    isSystem: true
  },
  {
    name: 'Manager',
    description: 'Manages operations, sales, stock, customers, loans, expenses, purchases and reports. Cannot manage admins or system settings.',
    isSystem: true,
    permissions: [
      'dashboard.read',
      'products.create', 'products.read', 'products.update', 'products.delete',
      'categories.create', 'categories.read', 'categories.update', 'categories.delete',
      'stock.create', 'stock.read', 'stock.adjust',
      'suppliers.create', 'suppliers.read', 'suppliers.update', 'suppliers.delete',
      'customers.create', 'customers.read', 'customers.update', 'customers.delete',
      'sales.create', 'sales.read', 'sales.cancel',
      'orders.create', 'orders.read', 'orders.cancel',
      'payments.create', 'payments.read',
      'loans.create', 'loans.read', 'loans.update', 'loans.cancel',
      'expenses.create', 'expenses.read', 'expenses.update', 'expenses.delete',
      'purchases.create', 'purchases.read', 'purchases.update', 'purchases.delete',
      'supplierDebts.read', 'supplierDebts.pay',
      'reports.read', 'notifications.read'
    ]
  },
  {
    name: 'Storekeeper',
    description: 'Receives stock, views inventory, performs authorized adjustments, records purchases.',
    isSystem: true,
    permissions: [
      'dashboard.read',
      'products.create', 'products.read', 'products.update',
      'categories.read',
      'stock.create', 'stock.read', 'stock.adjust',
      'suppliers.create', 'suppliers.read', 'suppliers.update',
      'purchases.create', 'purchases.read', 'purchases.update',
      'notifications.read'
    ]
  },
  {
    name: 'Cashier',
    description: 'Creates sales, records payments, manages customers, records expenses.',
    isSystem: true,
    permissions: [
      'dashboard.read',
      'products.read',
      'categories.read',
      'customers.create', 'customers.read', 'customers.update',
      'sales.create', 'sales.read',
      'orders.create', 'orders.read',
      'payments.create', 'payments.read',
      'expenses.create', 'expenses.read',
      'loans.read',
      'notifications.read'
    ]
  }
];

const CATEGORIES = [
  { name: 'Pipes', children: ['PVC Pipes', 'PPR Pipes', 'HDPE Pipes', 'Galvanized Pipes'] },
  { name: 'Fittings', children: ['Elbows', 'Tees', 'Couplers', 'Reducers'] },
  { name: 'Valves', children: ['Ball Valves', 'Gate Valves', 'Check Valves'] },
  { name: 'Water Tanks' },
  { name: 'Taps & Mixers' },
  { name: 'Pumps' },
  { name: 'Plumbing Tools' },
  { name: 'Sanitary Ware' }
];

const seed = async () => {
  await connectDB();
  console.log('Seeding...');

  // Roles
  const roles = {};
  for (const def of ROLE_DEFS) {
    let role = await Role.findOne({ name: def.name });
    if (!role) role = await Role.create(def);
    else if (def.isSystem) {
      role.permissions = def.permissions;
      await role.save();
    }
    roles[def.name] = role;
    console.log(`Role ready: ${def.name} (${role.permissions.length} permissions)`);
  }

  // Super Admin user
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    await User.create({
      fullName: 'System Administrator',
      username: 'admin',
      email: 'admin@brilliantconstruction.rw',
      phone: '+250700000000',
      password: 'Admin@2026',
      role: roles['Super Admin']._id
    });
    console.log('Super Admin created -> username: admin | password: Admin@2026');
  } else {
    console.log('Super Admin already exists.');
  }

  // Super Admin user 2
  const admin2Exists = await User.findOne({ username: 'ishimwe' });
  if (!admin2Exists) {
    await User.create({
      fullName: 'Ishimwe RDA',
      username: 'ishimwe',
      email: 'ishimwerda@gmail.com',
      phone: '+250700000001',
      password: 'Ishimwe@2007',
      role: roles['Super Admin']._id
    });
    console.log('Super Admin created -> username: ishimwe | email: ishimwerda@gmail.com | password: Ishimwe@2007');
  } else {
    console.log('Super Admin 2 already exists.');
  }

  // Settings
  const settings = await Setting.getSettings();
  console.log(`Company settings ready: ${settings.companyName}`);

  // Categories
  for (const cat of CATEGORIES) {
    let parent = await Category.findOne({ name: cat.name, parent: null });
    if (!parent) parent = await Category.create({ name: cat.name });
    for (const childName of cat.children || []) {
      const exists = await Category.findOne({ name: childName, parent: parent._id });
      if (!exists) await Category.create({ name: childName, parent: parent._id });
    }
  }
  console.log(`Categories seeded (${CATEGORIES.length} top-level).`);

  console.log('\nSeed complete.');
  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
