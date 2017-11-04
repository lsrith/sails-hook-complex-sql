const _ = require('lodash');
const _tableAlias = require('./tableAlias');

/*
 * Reference Association to Model
 * @param {object} Query
 * @param {object} Query Reference Mapper
 * @param {object} Model to be associated with
 * @param {object} Association string or object
 * @param {integer} Association level
 * @return {object} Associated Model
 */
const _reference = module.exports = (context, mapper, model, association, lvl) => {
    if (_.isEmpty(association)) {
        // do nothing
    } else if (typeof association === 'string') {
        const attr = model.attributes[association];
        const [parent, parentAlias] = _tableAlias(context, model.tableName, lvl);
        const joinsTable = {};
        let child, childAlias, relationship;

        if (!(attr instanceof Object)) {
            throw new Error(`${association} is not associated with ${model.tableName}`)
        } else if (attr.model) {
            [child, childAlias] = _tableAlias(context, attr.model, (lvl + 1));
            joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${childAlias}.id = ${parentAlias}.${child}`;
        } else if (attr.collection && attr.through) {
            const [junction, junctionAlias] = _tableAlias(context, attr.through, lvl);
            [child, childAlias] = _tableAlias(context, attr.collection, (lvl + 1));

            joinsTable[`LEFT JOIN ${junction} AS ${junctionAlias}`] = `${junctionAlias}.${parent} = ${parentAlias}.id`;
            joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${childAlias}.id = ${junctionAlias}.${child}`;
        } else if (attr.collection && !attr.through && attr.via) {
            [child, childAlias] = _tableAlias(context, attr.collection, (lvl + 1));
            const viaAttr = sails.models[child].attributes[attr.via];

            if (viaAttr.collection) {
                const parentKey = `${parent}_${association}`;
                const childKey = `${child}_${attr.via}`;

                const joinTable = parent < child ? `${parentKey}__${childKey}` : `${childKey}__${parentKey}`;
                const [junction, junctionAlias] = _tableAlias(context, joinTable, lvl);

                joinsTable[`LEFT JOIN ${junction} AS ${junctionAlias}`] = `${junctionAlias}.${parentKey} = ${parent}.id`;
                joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${child}.id = ${junctionAlias}.${childKey}`;
            } else {
                joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${childAlias}.${parent} = ${parentAlias}.id`;
            }
        } else {
            // do nothing, not expected
        }

        if (!mapper[association]) {
            Object.keys(joinsTable).forEach(key => {
                if (context.sql.joinsTable[key]) {
                    context.sql.joinsTable[key].push(joinsTable[key]);
                } else {
                    context.sql.joinsTable[key] = [joinsTable[key]];
                }
            })

            mapper[association] = {};
        }

        return sails.models[child];
    } else if (association instanceof Array) {
        association.forEach(key => _reference(context, mapper, model, key, lvl));
    } else if (association instanceof Object) {
        Object.keys(association).forEach(key => {
            const child = _reference(context, mapper, model, key, lvl);
            _reference(context, mapper[key], child, association[key], (lvl + 1));
        })
    } else {
        // do nothing, not expected
    }
};
