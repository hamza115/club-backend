const dns = require('dns');
const mongoose = require('mongoose');
const env = require('../src/config/env');

dns.setServers(['8.8.8.8', '8.8.4.4']);
const { User, Organization, Table, Setting } = require('../src/models');
const { ROLES, TABLE_STATUS } = require('../src/config/constants');
const logger = require('../src/utils/logger');

const seed = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info('Connected to MongoDB');

    // ── Seed Organization ──
    let org = await Organization.findOne({ orgId: 'ORG-DEMO1' });
    if (!org) {
      org = await Organization.create({
        name: 'Cuemaster Elite',
        orgId: 'ORG-DEMO1',
        owner: null,
        currency: 'PKR',
      });
      logger.info('Created demo organization: ORG-DEMO1');
    }

    // ── Seed Super Admin ──
    const existingAdmin = await User.findOne({ email: 'admin@cuemaster.com' });
    if (!existingAdmin) {
      const admin = await User.create({
        name: 'Admin',
        email: 'admin@cuemaster.com',
        password: 'admin123',
        role: ROLES.SUPER_ADMIN,
        phone: '0300-0000000',
        organizationId: org._id,
      });
      org.owner = admin._id;
      await org.save();
      logger.info('Created super admin: admin@cuemaster.com / admin123');
    } else if (!existingAdmin.organizationId) {
      existingAdmin.organizationId = org._id;
      await existingAdmin.save();
      org.owner = existingAdmin._id;
      await org.save();
      logger.info('Updated admin with organizationId');
    }

    // ── Seed Manager ──
    const existingManager = await User.findOne({ email: 'manager@cuemaster.com' });
    if (!existingManager) {
      await User.create({
        name: 'Manager',
        email: 'manager@cuemaster.com',
        password: 'manager123',
        role: ROLES.MANAGER,
        phone: '0300-0000001',
        organizationId: org._id,
      });
      logger.info('Created manager: manager@cuemaster.com / manager123');
    } else if (!existingManager.organizationId) {
      existingManager.organizationId = org._id;
      await existingManager.save();
    }

    // ── Seed Cashier ──
    const existingCashier = await User.findOne({ email: 'cashier@cuemaster.com' });
    if (!existingCashier) {
      await User.create({
        name: 'Cashier',
        email: 'cashier@cuemaster.com',
        password: 'cashier123',
        role: ROLES.CASHIER,
        phone: '0300-0000002',
        organizationId: org._id,
      });
      logger.info('Created cashier: cashier@cuemaster.com / cashier123');
    } else if (!existingCashier.organizationId) {
      existingCashier.organizationId = org._id;
      await existingCashier.save();
    }

    // ── Seed Tables ──
    const existingTables = await Table.countDocuments({ organizationId: org._id });
    if (existingTables === 0) {
      const tables = [];
      for (let i = 1; i <= 6; i++) {
        tables.push({ tableNumber: i, status: TABLE_STATUS.AVAILABLE, hourlyRate: 500, frameRate: 200, organizationId: org._id });
      }
      await Table.insertMany(tables);
      logger.info(`Created ${tables.length} tables`);
    }

    // ── Seed Default Settings ──
    const existingSettings = await Setting.countDocuments();
    if (existingSettings === 0) {
      await Setting.insertMany([
        { key: 'club_name', value: 'Cuemaster Elite', group: 'general', description: 'Name of the club' },
        { key: 'club_currency', value: 'PKR', group: 'general', description: 'Default currency' },
        { key: 'default_hourly_rate', value: 500, group: 'pricing', description: 'Default hourly rate in PKR' },
        { key: 'default_frame_rate', value: 200, group: 'pricing', description: 'Default frame rate in PKR' },
        { key: 'tax_rate', value: 0, group: 'tax', description: 'Tax percentage' },
        { key: 'receipt_footer', value: 'Thank you for visiting Cuemaster Elite!', group: 'receipt', description: 'Receipt footer text' },
        { key: 'receipt_header', value: 'Cuemaster Elite', group: 'receipt', description: 'Receipt header text' },
        { key: 'theme_mode', value: 'dark', group: 'theme', description: 'UI theme: light or dark' },
      ]);
      logger.info('Created default settings');
    }

    logger.info('Database seeding completed');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
