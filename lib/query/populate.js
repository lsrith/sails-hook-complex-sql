const _ = require('lodash');
const _tableAlias = require('./tableAlias');

/*
 * Add all columns of the model to the SQL Query
 * @param {object} Query
 * @param {object} Model
 */
const _addColumns = (context, model, lvl) => {
    if (context.customColumn) { return; }

    const mapper = context.mapper;
    const tables = Object.keys(mapper.columns);
    const [tableName, tableAlias] = _tableAlias(context, model.tableName, lvl);

    if (tables.indexOf(tableAlias) >= 0) { return; }

    const table = `t${tables.length}`;
    const columns = mapper.columns[tableAlias] = {};

    Object.keys(model.attributes).forEach((key, index) => {
        val = model.attributes[key];
        if (typeof val === 'function' || val.collection || val.model || !val.type) { return; }

        const column = `${table}c${index}`;
        columns[column] = key;
        context.sql.columns.push(`${tableAlias}.${key} AS ${column}`);
    })
};

/*
 * Popoulate Association to Model
 * @param {object} Query
 * @param {object} Query Populate Mapper
 * @param {object} Model to be populated with
 * @param {object} Association string or object
 * @param {integer} Association level
 * @return {object} Associated Model
 */
const _populate = module.exports = (context, mapper, model, association, lvl) => {
    if (_.isEmpty(association)) {
        _addColumns(context, model, lvl);
    } else if (typeof association === 'string') {
        const attr = model.attributes[association];

        if (!(attr instanceof Object)) throw new Error(`${association} is not associated with ${model.tableName}`)

        const child = sails.models[attr.collection || attr.model];

        if (!mapper[association]) {
            _addColumns(context, child, lvl);
            mapper[association] = {};
        }

        return child;
    } else if (association instanceof Array) {
        association.forEach(key => _populate(context, mapper, model, key, lvl));
    } else if (association instanceof Object) {
        Object.keys(association).forEach(key => {
            const child = _populate(context, mapper, model, key, lvl);
            _populate(context, mapper[key], child, association[key], (lvl + 1));
        })
    } else {
        // do nothing, not expected
    }
}
