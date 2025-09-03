/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('employee', (table) => {
    table.string('badge').primary();
    table.integer('voucher_id').unsigned().notNullable()
    table.foreign('voucher_id').references('voucher_id').inTable('vouchers');
    table.string('fullname');
    table.string('department');
    table.string('company');
    table.string('camp');
    table.string('mobile_phone');
    table.integer('timestamp');
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('employee');
};
