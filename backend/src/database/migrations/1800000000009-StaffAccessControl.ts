import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Finer staff permissions + instant sign-out.
 * - admins.sessions_valid_from: access tokens issued before it are refused
 *   (set when a staff member is deactivated or their password is reset).
 * - One permission per admin area instead of "view_clients" covering most of
 *   the panel. Existing staff keep exactly the access they had: every old key
 *   is expanded to the new keys it used to unlock.
 */
export class StaffAccessControl1800000000009 implements MigrationInterface {
  name = 'StaffAccessControl1800000000009';

  private static readonly CARRY_OVER: [string, string[]][] = [
    [
      'view_clients',
      [
        'manage_clients',
        'manage_tickets',
        'manage_whatsapp',
        'manage_rent_agreements',
      ],
    ],
    ['view_documents', ['manage_documents']],
    ['upload_reports', ['view_reports', 'manage_reports']],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "sessions_valid_from" timestamptz NULL`,
    );
    for (const [
      oldKey,
      newKeys,
    ] of StaffAccessControl1800000000009.CARRY_OVER) {
      for (const newKey of newKeys) {
        await queryRunner.query(
          `INSERT INTO "permissions" ("admin_id", "permission_key", "granted")
           SELECT "admin_id", $1, true FROM "permissions"
            WHERE "permission_key" = $2 AND "granted" = true
           ON CONFLICT ("admin_id", "permission_key") DO UPDATE SET "granted" = true`,
          [newKey, oldKey],
        );
      }
    }
    // Retired keys: reports were split into view/change; the Staff page is
    // super-admin only, so "manage_staff" never unlocked anything.
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "permission_key" IN ('upload_reports', 'manage_staff')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "permissions" SET "permission_key" = 'upload_reports' WHERE "permission_key" = 'manage_reports'`,
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "permission_key" IN
        ('manage_clients', 'manage_tickets', 'manage_whatsapp',
         'manage_rent_agreements', 'manage_documents', 'view_reports')`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" DROP COLUMN IF EXISTS "sessions_valid_from"`,
    );
  }
}
