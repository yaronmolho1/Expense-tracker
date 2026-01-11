/**
 * Migration script: Move Beauty Care and Health & Medical to Personal Care
 *
 * Usage: npx tsx scripts/migrate-categories.ts
 */

import { db } from '../lib/db';
import { categories } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function migrateCategories() {
  console.log('🔄 Migrating category structure...\n');

  try {
    // Find parent categories
    const personalCare = await db.query.categories.findFirst({
      where: and(eq(categories.name, 'Personal Care'), eq(categories.level, 0)),
    });

    const healthFitness = await db.query.categories.findFirst({
      where: and(eq(categories.name, 'Health/Fitness'), eq(categories.level, 0)),
    });

    if (!personalCare || !healthFitness) {
      throw new Error('Parent categories not found');
    }

    console.log(`Found parent categories:`);
    console.log(`  - Personal Care (ID: ${personalCare.id})`);
    console.log(`  - Health/Fitness (ID: ${healthFitness.id})\n`);

    // Move "Beauty Care" from Health/Fitness to Personal Care
    const beautyCare = await db.query.categories.findFirst({
      where: and(
        eq(categories.name, 'Beauty Care'),
        eq(categories.parentId, healthFitness.id)
      ),
    });

    if (beautyCare) {
      await db
        .update(categories)
        .set({ parentId: personalCare.id, displayOrder: 5 })
        .where(eq(categories.id, beautyCare.id));
      console.log(`✅ Moved "Beauty Care" to Personal Care (displayOrder: 5)`);
    } else {
      console.log(`⚠️  "Beauty Care" not found or already migrated`);
    }

    // Move "Health & Medical" from Health/Fitness to Personal Care
    const healthMedical = await db.query.categories.findFirst({
      where: and(
        eq(categories.name, 'Health & Medical'),
        eq(categories.parentId, healthFitness.id)
      ),
    });

    if (healthMedical) {
      await db
        .update(categories)
        .set({ parentId: personalCare.id, displayOrder: 6 })
        .where(eq(categories.id, healthMedical.id));
      console.log(`✅ Moved "Health & Medical" to Personal Care (displayOrder: 6)`);
    } else {
      console.log(`⚠️  "Health & Medical" not found or already migrated`);
    }

    // Update display order for Medical under Health/Fitness
    const medical = await db.query.categories.findFirst({
      where: and(
        eq(categories.name, 'Medical'),
        eq(categories.parentId, healthFitness.id)
      ),
    });

    if (medical) {
      await db
        .update(categories)
        .set({ displayOrder: 2 })
        .where(eq(categories.id, medical.id));
      console.log(`✅ Updated "Medical" displayOrder to 2 under Health/Fitness`);
    }

    console.log('\n🎉 Category migration complete!');
    console.log('\nNew structure:');
    console.log('Personal Care:');
    console.log('  1. Haircuts');
    console.log('  2. Nails');
    console.log('  3. Hair');
    console.log('  4. Clothing&Shoes');
    console.log('  5. Beauty Care (moved from Health/Fitness)');
    console.log('  6. Health & Medical (moved from Health/Fitness)');
    console.log('\nHealth/Fitness:');
    console.log('  1. Gym');
    console.log('  2. Medical');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateCategories();
