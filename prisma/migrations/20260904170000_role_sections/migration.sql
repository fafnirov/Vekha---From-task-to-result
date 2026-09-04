-- CreateTable
CREATE TABLE "RoleSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleSection_key_role_key" ON "RoleSection"("key", "role");

