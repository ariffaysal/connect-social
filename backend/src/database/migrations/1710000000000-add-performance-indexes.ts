import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddPerformanceIndexes1710000000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1710000000000';

  private readonly indexes = [
    { table: 'post', name: 'IDX_post_owner_created_at', columns: ['ownerId', 'createdAt'] },
    { table: 'post', name: 'IDX_post_department_created_at', columns: ['departmentId', 'createdAt'] },
    { table: 'comment', name: 'IDX_comment_owner_created_at', columns: ['ownerId', 'createdAt'] },
    { table: 'reaction', name: 'IDX_reaction_owner_created_at', columns: ['ownerId', 'createdAt'] },
    {
      table: 'notification',
      name: 'IDX_notification_recipient_read_created_at',
      columns: ['recipientId', 'isRead', 'createdAt'],
    },
    { table: 'report', name: 'IDX_report_status_created_at', columns: ['status', 'createdAt'] },
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const index of this.indexes) {
      const table = await queryRunner.getTable(index.table);
      if (!table || table.indices.some((existing) => existing.name === index.name)) continue;

      await queryRunner.createIndex(
        table,
        new TableIndex({
          name: index.name,
          columnNames: index.columns,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of this.indexes) {
      const table = await queryRunner.getTable(index.table);
      const existing = table?.indices.find((candidate) => candidate.name === index.name);
      if (table && existing) await queryRunner.dropIndex(table, existing);
    }
  }
}
