import { db } from './index';
import { categories } from './schema';

export async function seedCategories() {
  console.log('🌱 Seeding categories...');

  const categoryData: { name: string; parentId: number | null; level: number; displayOrder: number }[] = [
    // Level 0: Parent Categories
    { name: 'Housing', parentId: null, level: 0, displayOrder: 1 },
    { name: 'Transportation & Car', parentId: null, level: 0, displayOrder: 2 },
    { name: 'Pets', parentId: null, level: 0, displayOrder: 3 },
    { name: 'Food & Household', parentId: null, level: 0, displayOrder: 4 },
    { name: 'Personal Care', parentId: null, level: 0, displayOrder: 5 },
    { name: 'Health/Fitness', parentId: null, level: 0, displayOrder: 6 },
    { name: 'Communications&Subscriptions', parentId: null, level: 0, displayOrder: 7 },
    { name: 'Lifestyle&Leisure', parentId: null, level: 0, displayOrder: 8 },
    { name: 'Baby', parentId: null, level: 0, displayOrder: 9 },
  ];

  const insertedParents = await db.insert(categories).values(categoryData).returning();
  const parentMap = new Map(insertedParents.map(cat => [cat.name, cat.id]));

  const childCategoryData: { name: string; parentId: number; level: number; displayOrder: number }[] = [
    { name: 'Rent - Inc (water/electricity/arnona)', parentId: parentMap.get('Housing')!, level: 1, displayOrder: 1 },
    { name: 'Internet', parentId: parentMap.get('Housing')!, level: 1, displayOrder: 2 },
    { name: 'Maintenance/Repairs', parentId: parentMap.get('Housing')!, level: 1, displayOrder: 3 },
    { name: 'Insurance', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 1 },
    { name: 'Maintenance', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 2 },
    { name: 'licensing - טסט + אגרה', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 3 },
    { name: 'Fuel and ev charging', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 4 },
    { name: 'Parking', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 5 },
    { name: 'Public Transport', parentId: parentMap.get('Transportation & Car')!, level: 1, displayOrder: 6 },
    { name: 'Dog food', parentId: parentMap.get('Pets')!, level: 1, displayOrder: 1 },
    { name: 'Cat food', parentId: parentMap.get('Pets')!, level: 1, displayOrder: 2 },
    { name: 'Vet & Vaccinations', parentId: parentMap.get('Pets')!, level: 1, displayOrder: 3 },
    { name: 'Insurance', parentId: parentMap.get('Pets')!, level: 1, displayOrder: 4 },
    { name: 'Unexpected', parentId: parentMap.get('Pets')!, level: 1, displayOrder: 5 },
    { name: 'Gun, shooting range, gear and etc', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 1 },
    { name: 'Groceries', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 2 },
    { name: 'Supplies & Home goods', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 3 },
    { name: 'Devices & electronics', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 4 },
    { name: 'Abroad', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 5 },
    { name: 'Eating out and deliveries', parentId: parentMap.get('Food & Household')!, level: 1, displayOrder: 6 },
    { name: 'Haircuts', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 1 },
    { name: 'Nails', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 2 },
    { name: 'Hair', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 3 },
    { name: 'Clothing&Shoes', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 4 },
    { name: 'Beauty Care', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 5 },
    { name: 'Health & Medical', parentId: parentMap.get('Personal Care')!, level: 1, displayOrder: 6 },
    { name: 'Gym', parentId: parentMap.get('Health/Fitness')!, level: 1, displayOrder: 1 },
    { name: 'Medical', parentId: parentMap.get('Health/Fitness')!, level: 1, displayOrder: 2 },
    { name: 'Mobile phones', parentId: parentMap.get('Communications&Subscriptions')!, level: 1, displayOrder: 1 },
    { name: 'Streaming services', parentId: parentMap.get('Communications&Subscriptions')!, level: 1, displayOrder: 2 },
    { name: 'Cloud storage', parentId: parentMap.get('Communications&Subscriptions')!, level: 1, displayOrder: 3 },
    { name: 'AI/Developer tools', parentId: parentMap.get('Communications&Subscriptions')!, level: 1, displayOrder: 4 },
    { name: 'Other software subs', parentId: parentMap.get('Communications&Subscriptions')!, level: 1, displayOrder: 5 },
    { name: 'Travel/vacations', parentId: parentMap.get('Lifestyle&Leisure')!, level: 1, displayOrder: 1 },
    { name: 'Entertainment&hobbies', parentId: parentMap.get('Lifestyle&Leisure')!, level: 1, displayOrder: 2 },
    { name: 'Gifts', parentId: parentMap.get('Lifestyle&Leisure')!, level: 1, displayOrder: 3 },
    { name: 'Diapers/wipes', parentId: parentMap.get('Baby')!, level: 1, displayOrder: 1 },
    { name: 'Formula/food', parentId: parentMap.get('Baby')!, level: 1, displayOrder: 2 },
    { name: 'Clothing', parentId: parentMap.get('Baby')!, level: 1, displayOrder: 3 },
    { name: 'supplies', parentId: parentMap.get('Baby')!, level: 1, displayOrder: 4 },
    { name: 'Childcare', parentId: parentMap.get('Baby')!, level: 1, displayOrder: 5 },
  ];

  await db.insert(categories).values(childCategoryData);

  console.log('✅ Categories seeded successfully!');
}

// Run if called directly
if (require.main === module) {
  seedCategories()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
