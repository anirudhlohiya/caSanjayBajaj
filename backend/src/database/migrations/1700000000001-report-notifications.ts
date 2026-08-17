import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportNotifications1700000000001 implements MigrationInterface {
  name = 'ReportNotifications1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "report_notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" character varying(1000) NOT NULL,
        "deep_link" character varying(500),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_report_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_report_notifications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_report_notifications_user_read" ON "report_notifications" ("user_id", "is_read")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "report_notifications"`);
  }
}
