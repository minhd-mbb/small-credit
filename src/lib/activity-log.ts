import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogActivityInput = {
  username: string;
  action: string;
  functionName?: string;
  beforeChange?: Prisma.InputJsonValue | null;
  afterChange?: Prisma.InputJsonValue | null;
};

const MAX_LOGS_PER_USERNAME = 6000;
const RETENTION_MONTHS = 6;
const NO_CHANGE_DETAIL_ACTIONS = new Set([
  "LOGIN",
  "LOGOUT",
  "EXPORT_REPORT",
  "EXPORT_STATEMENT",
  "IMPORT_DATA",
  "EXPORT_DATA",
]);

export async function logActivity({
  username,
  action,
  functionName = "General",
  beforeChange = null,
  afterChange = null,
}: LogActivityInput) {
  if (!username) {
    return;
  }

  const shouldOmitChangeDetails = NO_CHANGE_DETAIL_ACTIONS.has(action);
  const normalizedBeforeChange = shouldOmitChangeDetails ? null : beforeChange;
  const normalizedAfterChange = shouldOmitChangeDetails ? null : afterChange;

  await prisma.activityLog.create({
    data: {
      username,
      action,
      functionName: functionName || "General",
      beforeChange:
        normalizedBeforeChange === null ? Prisma.JsonNull : normalizedBeforeChange,
      afterChange:
        normalizedAfterChange === null ? Prisma.JsonNull : normalizedAfterChange,
    },
  });

  await pruneActivityLogs(username);
}

async function pruneActivityLogs(username: string) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  await prisma.activityLog.deleteMany({
    where: {
      username,
      time: { lt: cutoff },
    },
  });

  const overflow = await prisma.activityLog.findMany({
    where: { username },
    orderBy: { time: "desc" },
    skip: MAX_LOGS_PER_USERNAME,
    select: { id: true },
  });

  if (overflow.length > 0) {
    await prisma.activityLog.deleteMany({
      where: {
        id: { in: overflow.map((entry) => entry.id) },
      },
    });
  }
}
