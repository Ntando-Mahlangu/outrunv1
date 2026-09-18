-- AlterTable
ALTER TABLE "seo_content_piece" ADD COLUMN     "content" JSONB,
ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "metaDescription" DROP NOT NULL,
ALTER COLUMN "body" DROP NOT NULL;
