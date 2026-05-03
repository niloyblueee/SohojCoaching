import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
    'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS entry_close_at TIMESTAMPTZ NULL',
    'CREATE INDEX IF NOT EXISTS idx_quizzes_entry_close_at ON quizzes(entry_close_at)'
];

async function main() {
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }

    console.log('FR-22 quiz entry close time migration completed.');
}

main()
    .catch((error) => {
        console.error('FR-22 quiz entry close time migration failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
