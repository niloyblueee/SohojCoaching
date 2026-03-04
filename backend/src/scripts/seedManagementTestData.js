import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureBatch(name, course) {
  const existing = await prisma.batch.findFirst({
    where: { name, course },
    select: { id: true, name: true, course: true }
  });

  if (existing) {
    return existing;
  }

  return prisma.batch.create({
    data: { name, course },
    select: { id: true, name: true, course: true }
  });
}


async function main() {
  const students = [
    { name: 'Ayesha Rahman', email: 'ayesha.student@sohojcoaching.test', role: 'student' },
    { name: 'Nabil Hasan', email: 'nabil.student@sohojcoaching.test', role: 'student' }
  ];

  const teachers = [
    { name: 'Farzana Akter', email: 'farzana.teacher@sohojcoaching.test', role: 'teacher' },
    { name: 'Tariq Mahmud', email: 'tariq.teacher@sohojcoaching.test', role: 'teacher' }
  ];

  const createdStudents = await Promise.all(
    students.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role },
        create: user,
        select: { id: true, name: true, email: true, role: true }
      })
    )
  );

  const createdTeachers = await Promise.all(
    teachers.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role },
        create: user,
        select: { id: true, name: true, email: true, role: true }
      })
    )
  );

  const batches = await Promise.all([
    ensureBatch('Web Dev Bootcamp - A', 'Web Development'),
    ensureBatch('HSC Math Intensive - B', 'Mathematics')
  ]);

  console.log('✅ Management seed complete');
  console.log('\nStudents:');
  createdStudents.forEach((student) => {
    console.log(`- ${student.name} (${student.email}) [${student.id}]`);
  });

  console.log('\nTeachers:');
  createdTeachers.forEach((teacher) => {
    console.log(`- ${teacher.name} (${teacher.email}) [${teacher.id}]`);
  });

  console.log('\nBatches:');
  batches.forEach((batch) => {
    console.log(`- ${batch.name} / ${batch.course} [${batch.id}]`);
  });
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
