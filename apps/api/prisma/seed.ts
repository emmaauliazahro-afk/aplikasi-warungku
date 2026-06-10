import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // --- Users ---
  const hashedPassword = await bcrypt.hash('password123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@warung.test' },
    update: { password: hashedPassword },
    create: {
      name: 'Pemilik Warung',
      email: 'owner@warung.test',
      password: hashedPassword,
      role: 'OWNER',
    },
  });
  console.log(`✅ User created: ${owner.email}`);

  // --- Categories ---
  const categoryNames = ['Sembako', 'Minuman', 'Makanan Ringan', 'Kebutuhan Rumah', 'Rokok'];
  const categories = [];
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories.push(cat);
  }
  console.log(`✅ ${categories.length} categories created`);

  // --- Products ---
  const products = [
    { sku: 'BRS-001', name: 'Beras Premium 5kg', purchasePrice: 60000, sellingPrice: 68000, stock: 50, minStock: 10, unit: 'karung', category: 'Sembako' },
    { sku: 'MYK-001', name: 'Minyak Goreng 1L', purchasePrice: 14000, sellingPrice: 17000, stock: 40, minStock: 10, unit: 'botol', category: 'Sembako' },
    { sku: 'GLA-001', name: 'Gula Pasir 1kg', purchasePrice: 13000, sellingPrice: 15000, stock: 30, minStock: 8, unit: 'kg', category: 'Sembako' },
    { sku: 'TLR-001', name: 'Telur Ayam 1kg', purchasePrice: 25000, sellingPrice: 28000, stock: 4, minStock: 5, unit: 'kg', category: 'Sembako' },
    { sku: 'AQA-001', name: 'Air Mineral 600ml', purchasePrice: 2500, sellingPrice: 4000, stock: 100, minStock: 24, unit: 'botol', category: 'Minuman' },
    { sku: 'TEH-001', name: 'Teh Botol 350ml', purchasePrice: 3000, sellingPrice: 5000, stock: 60, minStock: 12, unit: 'botol', category: 'Minuman' },
    { sku: 'KOP-001', name: 'Kopi Sachet', purchasePrice: 1200, sellingPrice: 2000, stock: 80, minStock: 20, unit: 'pcs', category: 'Minuman' },
    { sku: 'CHK-001', name: 'Chiki Snack', purchasePrice: 1500, sellingPrice: 2500, stock: 70, minStock: 15, unit: 'pcs', category: 'Makanan Ringan' },
    { sku: 'BIS-001', name: 'Biskuit Kaleng', purchasePrice: 18000, sellingPrice: 23000, stock: 3, minStock: 5, unit: 'kaleng', category: 'Makanan Ringan' },
    { sku: 'SBN-001', name: 'Sabun Mandi', purchasePrice: 3000, sellingPrice: 4500, stock: 45, minStock: 10, unit: 'pcs', category: 'Kebutuhan Rumah' },
    { sku: 'DTR-001', name: 'Detergen 800g', purchasePrice: 12000, sellingPrice: 15000, stock: 25, minStock: 8, unit: 'pcs', category: 'Kebutuhan Rumah' },
    { sku: 'RKK-001', name: 'Rokok Filter', purchasePrice: 20000, sellingPrice: 23000, stock: 30, minStock: 10, unit: 'bungkus', category: 'Rokok' },
  ];

  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  let productCount = 0;
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit,
        categoryId: catMap.get(p.category) ?? null,
      },
    });
    productCount++;
  }
  console.log(`✅ ${productCount} products created`);

  // --- Customers ---
  const customers = [
    { name: 'Budi Santoso', phone: '081234567890', address: 'Jl. Merdeka No. 1' },
    { name: 'Siti Aminah', phone: '081298765432', address: 'Jl. Mawar No. 5' },
    { name: 'Warga RT 03', phone: null, address: null },
  ];
  let customerCount = 0;
  for (const c of customers) {
    // customers have no unique field besides id, so check by name+phone
    const existing = await prisma.customer.findFirst({
      where: { name: c.name },
    });
    if (!existing) {
      await prisma.customer.create({ data: c });
      customerCount++;
    }
  }
  console.log(`✅ ${customerCount} customers created`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
