import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilePhotoUrl1791264856242 implements MigrationInterface {
  name = 'AddProfilePhotoUrl1791264856242';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "profile_photo_url" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "profile_photo_url"`,
    );
  }
}
