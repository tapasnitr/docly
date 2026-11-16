-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
