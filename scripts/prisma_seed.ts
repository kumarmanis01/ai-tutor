import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const boards = ["CBSE", "ICSE", "IB"];

  for (const boardName of boards) {
    const board = await prisma.board.upsert({
      where: { slug: boardName.toLowerCase() },
      update: {},
      create: {
        name: boardName,
        slug: boardName.toLowerCase(),
      },
    });

    for (let grade = 1; grade <= 12; grade++) {
      const cls = await prisma.classLevel.upsert({
          where: {
            id: /* provide the correct id here, e.g., generate or fetch it before upsert */ "", 
          },
        update: {},
        create: {
          grade,
          name: `Class ${grade}`,
          slug: `class-${grade}`,
          boardId: board.id,
        },
      });

      const subjects = ["Mathematics", "Science", "English", "Hindi", "Sanskrit", "Computer", "EVS", "Art", "Physical Education", "Music", "General Knowledge"];

      for (const subject of subjects) {
        const subj = await prisma.subjectDef.create({
          data: {
            name: subject,
            slug: subject.toLowerCase(),
            classId: cls.id,
          },
        });

        for (let c = 1; c <= 5; c++) {
          const chapter = await prisma.chapterDef.create({
            data: {
              name: `${subject} Chapter ${c}`,
              slug: `${subject}-ch-${c}`.toLowerCase(),
              order: c,
              subjectId: subj.id,
            },
          });

          for (let t = 1; t <= 4; t++) {
            await prisma.topicDef.create({
              data: {
                name: `Topic ${t}`,
                slug: `topic-${t}`,
                order: t,
                chapterId: chapter.id,
              },
            });
          }
        }
      }
    }
  }
}

main()
  .then(() => console.log("Academic seed completed"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
