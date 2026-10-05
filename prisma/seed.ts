import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.auditLog.deleteMany({});
  await prisma.securityEvent.deleteMany({});
  await prisma.releaseSchedule.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.questionPaperVersion.deleteMany({});
  await prisma.questionPaper.deleteMany({});
  await prisma.examAssignment.deleteMany({});
  await prisma.examination.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding User...');
  const passwordHash = hashSync('TestPassword123!', 12);
  const user = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Test Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Seeding Examination...');
  const exam = await prisma.examination.create({
    data: {
      name: 'Spring 2027 Finals',
      code: 'SPF-2027',
      subject: 'Computer Science',
      examDate: new Date('2027-05-15T10:00:00Z'),
      duration: 180,
      totalMarks: 100,
      createdById: user.id,
    },
  });

  console.log('Seeding Question Paper...');
  const paper = await prisma.questionPaper.create({
    data: {
      examinationId: exam.id,
      title: 'CS101 Final Exam',
      status: 'APPROVED',
      createdById: user.id,
    },
  });

  console.log('Seeding Question Paper Version...');
  await prisma.questionPaperVersion.create({
    data: {
      paperId: paper.id,
      version: 1,
      encryptedData: Buffer.from('test-encrypted-data'),
      iv: 'test-iv',
      authTag: 'test-auth-tag',
      sha256Hash: 'test-hash',
      originalFilename: 'test.pdf',
      fileSize: 1024,
    },
  });

  console.log('Seeding Approval...');
  await prisma.approval.create({
    data: {
      paperId: paper.id,
      userId: user.id,
      action: 'APPROVED',
      comments: 'Looks good.',
    },
  });

  console.log('Seeding Release Schedule...');
  await prisma.releaseSchedule.create({
    data: {
      paperId: paper.id,
      scheduledDate: new Date('2027-05-15T09:30:00Z'),
      releaseTime: new Date('2027-05-15T09:50:00Z'),
    },
  });

  console.log('Seeding Audit Log...');
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userRole: 'SUPER_ADMIN',
      action: 'USER_CREATE',
      success: true,
      details: 'Created super admin user',
    },
  });

  console.log('Seeding Security Event...');
  await prisma.securityEvent.create({
    data: {
      userId: user.id,
      severity: 'LOW',
      eventType: 'SYSTEM_START',
      description: 'System seeded successfully',
    },
  });

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
