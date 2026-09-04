-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "num" INTEGER NOT NULL,
    "queueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "statusId" TEXT NOT NULL,
    "typeId" TEXT,
    "resolutionId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigneeId" TEXT,
    "authorId" TEXT NOT NULL,
    "projectId" TEXT,
    "sprintId" TEXT,
    "teamId" TEXT,
    "parentId" TEXT,
    "dueDate" DATETIME,
    "estimate" INTEGER,
    "rank" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "Task_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TaskType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "Resolution" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "authorId", "closedAt", "createdAt", "description", "dueDate", "estimate", "id", "key", "num", "parentId", "priority", "projectId", "queueId", "rank", "resolutionId", "sprintId", "statusId", "title", "typeId", "updatedAt") SELECT "assigneeId", "authorId", "closedAt", "createdAt", "description", "dueDate", "estimate", "id", "key", "num", "parentId", "priority", "projectId", "queueId", "rank", "resolutionId", "sprintId", "statusId", "title", "typeId", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_key_key" ON "Task"("key");
CREATE INDEX "Task_queueId_idx" ON "Task"("queueId");
CREATE INDEX "Task_statusId_idx" ON "Task"("statusId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_typeId_idx" ON "Task"("typeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
