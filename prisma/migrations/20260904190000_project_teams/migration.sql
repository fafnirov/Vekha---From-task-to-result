-- Доступ к проекту выдаётся командам поимённо.
--
-- Раньше проект был виден тому, кто вёл в нём хоть одну задачу. Это
-- ошибалось в обе стороны: человек с одной задачей получал карточку
-- чужого проекта целиком — цель, срок, руководителя, долю выполненного, —
-- а тот, кого в проект только собираются привлечь, не видел ничего.
--
-- Существующие проекты остаются без команд намеренно: их увидят
-- администраторы и свой руководитель, а доступ администратор выдаст
-- осознанно. Открыть их всем автоматически значило бы расширить доступ
-- при обновлении — ровно то, от чего уходим.
-- CreateTable
CREATE TABLE "_ProjectToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProjectToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProjectToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectToTeam_AB_unique" ON "_ProjectToTeam"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectToTeam_B_index" ON "_ProjectToTeam"("B");
