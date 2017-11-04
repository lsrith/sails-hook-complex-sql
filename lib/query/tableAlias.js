/*
 * Construct table alias to avoid ER_NONUNIQ_TABLE
 * @param {object} Query
 * @param {string} Table name
 * @param {integer} Association level
 */
const _tableAlias = module.exports = (context, table, lvl) => {
    const tables = context.mapper.tables;

    if (tables[table]) {
        const idx = tables[table].indexOf(lvl);
        if (idx < 0) {
            tables[table].push(lvl);
            return [table, `${table}_${tables[table].length}`];
        } else if (idx > 0) {
            return [table, `${table}_${idx + 1}`];
        } else {
            return [table, table];
        }
    } else {
        tables[table] = [lvl];
        return [table, table];
    }
}
