import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebsiteTables1787563472838 implements MigrationInterface {
  name = 'AddWebsiteTables1787563472838';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."blog_posts_status_enum" AS ENUM('draft', 'published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "blog_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "excerpt" text,
        "content_md" text NOT NULL,
        "status" "public"."blog_posts_status_enum" NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_by_admin_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_posts" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_blog_posts_slug" ON "blog_posts" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_blog_posts_status" ON "blog_posts" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_posts" ADD CONSTRAINT "fk_blog_posts_admin" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."leads_status_enum" AS ENUM('new', 'contacted', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "leads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "query_type" character varying(255),
        "message" text NOT NULL,
        "status" "public"."leads_status_enum" NOT NULL DEFAULT 'new',
        "source_ip" character varying(64),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leads" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leads_status" ON "leads" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leads_created_at" ON "leads" ("created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_leads_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_leads_status"`);
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(`DROP TYPE "public"."leads_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "blog_posts" DROP CONSTRAINT "fk_blog_posts_admin"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_blog_posts_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_blog_posts_slug"`);
    await queryRunner.query(`DROP TABLE "blog_posts"`);
    await queryRunner.query(`DROP TYPE "public"."blog_posts_status_enum"`);
  }
}
