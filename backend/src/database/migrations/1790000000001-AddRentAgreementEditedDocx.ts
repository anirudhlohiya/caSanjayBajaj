import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRentAgreementEditedDocx1790000000001
  implements MigrationInterface
{
  name = 'AddRentAgreementEditedDocx1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_agreements" ADD "edited_docx_s3_key" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rent_agreements" DROP COLUMN "edited_docx_s3_key"`,
    );
  }
}