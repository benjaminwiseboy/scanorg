// Seed LF-EAC-V1 (étape 1 du Build Pack). Idempotent ; refuse de modifier une
// version déjà présente si son contenu diffère (méthodologie immuable).
import "dotenv/config";
import { db } from "../src/lib/prisma";
import { DIMENSIONS, METHODOLOGY_CODE, QUESTIONS } from "../src/engines/methodology/lf-eac-v1";

async function main() {
  const prisma = db();
  const existing = await prisma.methodologyVersion.findUnique({
    where: { code: METHODOLOGY_CODE },
    include: { questions: { include: { dimension: true }, orderBy: { number: "asc" } } },
  });

  if (existing) {
    const same =
      existing.questions.length === QUESTIONS.length &&
      existing.questions.every(
        (q, i) => q.number === QUESTIONS[i].number && q.text === QUESTIONS[i].text && q.dimension.code === QUESTIONS[i].dimension,
      );
    if (!same) throw new Error(`${METHODOLOGY_CODE} existe déjà avec un contenu différent : créer une nouvelle version.`);
    console.log(`${METHODOLOGY_CODE} déjà présent et conforme (42 questions).`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const mv = await tx.methodologyVersion.create({ data: { code: METHODOLOGY_CODE } });
    const dimIds = new Map<string, string>();
    for (const d of DIMENSIONS) {
      const dim = await tx.dimension.create({
        data: { methodologyVersionId: mv.id, code: d.code, pillar: d.pillar, name: d.name },
      });
      dimIds.set(d.code, dim.id);
    }
    await tx.question.createMany({
      data: QUESTIONS.map((q) => ({
        methodologyVersionId: mv.id,
        dimensionId: dimIds.get(q.dimension)!,
        number: q.number,
        text: q.text,
      })),
    });
  });
  console.log(`${METHODOLOGY_CODE} créé : 9 dimensions, 42 questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
