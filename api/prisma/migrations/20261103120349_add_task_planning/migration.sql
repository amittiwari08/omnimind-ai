-- CreateTable
CREATE TABLE "TaskPlan" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStep" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepType" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskPlan_taskId_idx" ON "TaskPlan"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPlan_taskId_version_key" ON "TaskPlan"("taskId", "version");

-- CreateIndex
CREATE INDEX "TaskStep_planId_status_idx" ON "TaskStep"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStep_planId_position_key" ON "TaskStep"("planId", "position");

-- AddForeignKey
ALTER TABLE "TaskPlan" ADD CONSTRAINT "TaskPlan_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TaskPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
