const _ = require('lodash');
const _populate = require('./populate');

const __ = {
    tableAlias: require('./tableAlias'),

    /*
     * Construct SQL Query for sql option
     * @param {object} Query
     * @params {integer[]} ids of records
     * @return {string} Raw SQL
     */
    constructSql: (query, distinctIds = null) => {
        _populate(query, query.mapper.populates, query.model, null, 0)

        const joinsTables = Object.keys(query.sql.joinsTable);

        let wheres = query.sql.wheres.slice(0);
        if (distinctIds) {
            ids = distinctIds.length > 0 ? distinctIds.map(id => `'${id}'`).join(', ') : 'NULL';
            wheres.push(`${query.model.tableName}.id IN (${ids})`);
        }

        let sql = `SELECT ${query.sql.columns.join(', ')} FROM ${query.model.tableName} `

        if (query.sql.joinsRaw.length > 0) { sql += query.sql.joinsRaw.join(' ') + ' '; }
        if (joinsTables.length > 0) { sql += joinsTables.map(key => `${key} ON (${query.sql.joinsTable[key].join(') AND (')})`).join(' ') + ' '; }
        if (wheres.length > 0) { sql += `WHERE (${wheres.join(') AND (')}) `; }
        if (query.sql.orders.length > 0) { sql += `ORDER BY ${query.sql.orders.join(', ')} `; }
        if (query.sql.limit) { sql += `LIMIT ${query.sql.limit} OFFSET ${query.sql.offset} `; }

        return sql;
    },

    /*
     * Construct SQL Query for sql distinct option
     * @param {object} Query
     * @param {integer} Number of records
     * @param {integer} Offset
     * @return {string} Raw SQL
     */
    constructDistinctSql: (query, limit = false, offset = 0) => {
        const joinsTables = Object.keys(query.sql.joinsTable);

        let orderKeys = query.sql.orders.join(', ').replace(/\sASC|\sDESC/ig, '').trim();
        orderKeys = orderKeys.length > 0 ? `, ${orderKeys}` : ''

        let sql = `SELECT DISTINCT ${query.model.tableName}.id AS distinctId ${orderKeys} FROM ${query.model.tableName} `;

        if (query.sql.joinsRaw.length > 0) { sql += query.sql.joinsRaw.join(' ') + ' '; }
        if (joinsTables.length > 0) { sql += joinsTables.map(key => `${key} ON (${query.sql.joinsTable[key].join(') AND (')})`).join(' ') + ' '; }
        if (query.sql.wheres.length > 0) { sql += 'WHERE (' + query.sql.wheres.join(') AND (') + ') '; }
        if (query.sql.orders.length > 0) { sql += `ORDER BY ${query.sql.orders.join(', ')} `; }
        if (limit) { sql += `LIMIT ${limit} OFFSET ${offset} `; }

        return sql;
    },

    /*
     * Map native records to Model objects
     * Assume that the Primary Key is `id`
     * @param {object} Query
     * @param {object[]} Array of Native Records
     * @return {object[]} Array of Model Records
     */
    parseRecords: (query, sqlRows) => {
        return sqlRows.reduce((records, sqlRow) => {
            return __.mapRecord(0, records, sqlRow, query, query.model.tableName, query.mapper.populates);
        }, [])
    },

    mapRecord: (lvl, records, sqlRow, query, table, populates = {}) => {
        let record;
        const [, tableAlias] = __.tableAlias(query, table, lvl);
        const columns = query.mapper.columns;
        const model = sails.models[table];

        // map record itself
        const raw = {};
        Object.keys(columns[tableAlias]).forEach(key => {
            raw[columns[tableAlias][key]] = sqlRow[key];
        })
        record = new model._model(raw);

        // stop parsing if primary key is null
        if (!record.id) {
            return records || undefined;
        }

        // check if new record based on primary key
        if (records instanceof Array) {
            const filter = records.filter(r => r.id == record.id);
            if (filter.length > 0) {
                record = filter[0];
            } else {
                records.push(record);
            }
        } else if (records instanceof Object && records.id == record.id) {
            record = records
        } else {
            // expected undefined, and therefore do nothing
        }

        // map associations of the record
        let child;
        const joins = Object.keys(populates);
        const forceShowJoins = [];
        joins.forEach(association => {
            if (model.attributes[association].model && Object.keys(populates[association]) > 0) { forceShowJoins.push(association); }

            child = model.attributes[association].collection || model.attributes[association].model;
            record[association] = __.mapRecord((lvl + 1), record[association], sqlRow, query, child, populates[association]);
        })

        // add to waterline properties
        if (joins.length > 0) {
            record._properties.showJoins = true;
            record._properties.joins = joins;
        }

        // force show joins (for non- *to-many association)
        if (forceShowJoins.length > 0) {
            const clone = _.clone(record);

            record.toObject = () => {
                const obj = clone.toObject();
                forceShowJoins.forEach(join => {
                    if (obj[join]) { obj[join] = clone[join].toObject(); }
                })
                return obj;
            };
        }
        return records || record;
    },

    whereClause: (col, val) => {
        let clause;

        if (typeof val === 'object') {
            if (!val) {
                clause = `${col} IS NULL`;
            } else if (val instanceof Array) {
                if (val.map(ele => (typeof ele)).indexOf('object') < 0) {
                    clause = `${col} ${__.whereVal(val)}`;
                } else {
                    _clauses = val.map(ele => __.whereClause(col, ele));
                    clause = `(${_clauses.join(') OR (')})`;
                }
            } else {
                _clauses = Object.keys(val).map(verb => `${col} ${__.whereVal(val[verb], verb)}`);
                clause = _clauses.join(' AND ');
            }
        } else {
            clause = `${col} ${__.whereVal(val)}`;
        }

        return clause;
    },

    whereVal: (value, verb = null) => {
        let val;

        if (!verb) {
            switch(typeof value) {
                case 'undefined':
                    verb = 'IS';
                    break;
                case 'boolean':
                case 'number':
                case 'string':
                    verb = '=';
                    break;
                case 'object':
                    if (value instanceof Array) { verb = 'IN'; }
                    break;
            }
        }

        switch(typeof value) {
            case 'undefined':
                val = 'NULL';
                break;
            case 'boolean':
                val = value ? 1 : 0;
                break;
            case 'number':
                val = value;
                break;
            case 'string':
                val = `'${value}'`;
                break;
            case 'object':
                if (value instanceof Array) {
                    val = value.map(ele => typeof ele == 'undefined' ? 'NULL' : typeof ele == 'number' ? ele : `'${ele}'`).join(', ');
                    val = `(${val})`;
                } else if (value instanceof Query) {
                    val = `IN (${__.constructSql(value)})`;
                } else {
                    // do nothing, not expected
                }
                break;
        }

        return `${verb} ${val}`;
    },

    /*
     * Reference Association to Model
     * @param {object} Query
     * @param {object} Query Reference Mapper
     * @param {object} Model to be associated with
     * @param {object} Association string or object
     * @param {integer} Association level
     * @return {object} Associated Model
     */
    reference: (query, mapper, model, association, lvl) => {
        if (_.isEmpty(association)) {
            // do nothing
        } else if (typeof association === 'string') {
            const attr = model.attributes[association];
            const [parent, parentAlias] = __.tableAlias(query, model.tableName, lvl);
            const joinsTable = {};
            let child, childAlias, relationship;

            if (!(attr instanceof Object)) {
                throw new Error(`${association} is not associated with ${model.tableName}`)
            } else if (attr.model) {
                [child, childAlias] = __.tableAlias(query, attr.model, (lvl + 1));
                joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${childAlias}.id = ${parentAlias}.${child}`;
            } else if (attr.collection && attr.through) {
                const [junction, junctionAlias] = __.tableAlias(query, attr.through, lvl);
                [child, childAlias] = __.tableAlias(query, attr.collection, (lvl + 1));

                joinsTable[`LEFT JOIN ${junction} AS ${junctionAlias}`] = `${junctionAlias}.${parent} = ${parentAlias}.id`;
                joinsTable[`LEFT JOIN ${child} AS ${childAlias}`] = `${childAlias}.id = ${junctionAlias}.${child}`;
            } else if (attr.collection && !attr.through && attr.via) {
                [child, childAlias] = __.tableAlias(query, attr.collection, (lvl + 1));
                const viaAttr = sails.models[child].attributes[attr.via];

                if (viaAttr.collection) {
                    const parentKey = `${parent}_${association}`;
                    const childKey = `${child}_${attr.via}`;

                    const joinTable = parent < child ? `${parentKey}__${childKey}` : `${childKey}__${parentKey}`;
                    const [junction, junctionAlias] = __.tableAlias(query, joinTable, lvl);

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
                    if (query.sql.joinsTable[key]) {
                        query.sql.joinsTable[key].push(joinsTable[key]);
                    } else {
                        query.sql.joinsTable[key] = [joinsTable[key]];
                    }
                })

                mapper[association] = {};
            }

            return sails.models[child];
        } else if (association instanceof Array) {
            association.forEach(key => __.reference(query, mapper, model, key, lvl));
        } else if (association instanceof Object) {
            Object.keys(association).forEach(key => {
                const child = __.reference(query, mapper, model, key, lvl);
                __.reference(query, mapper[key], child, association[key], (lvl + 1));
            })
        } else {
            // do nothing, not expected
        }
    },

    paginationMeta: (query, totalCount) => {
        const totalPages = (totalCount / query.pagination.perPage >> 0) + 1;

        return {
            perPage: query.pagination.perPage,
            currentPage: query.pagination.page,
            nextPage: (query.pagination.page < totalPages) ? query.pagination.page + 1 : null,
            prevPage: (query.pagination.page > 1) ? query.pagination.page - 1 : null,
            totalCount,
            totalPages
        }
    }
}

Query = function(model) {
    this.model = model;
    this.pagination = false;
    this.customColumn = false;

    this.sql = {
        columns: [],
        joinsRaw: [],
        joinsTable: {},
        wheres: [],
        orders: [],
        limit: null,
        offset: 0
    };

    this.mapper = {
        columns: {}, // {table_1: {table_1c0: '', table_1c1: ''}, table_2: {}}
        populates: {}, // {table_1: '', table_2: {table_3: ''}}
        references: {}, // {table_1: '', table_2: {table_3: ''}}
        tables: {}, // {table_1: [0, 1], table_2: [1, 2]}
    },

    this.yetToImplement = false;
};

/**
 * Execute the constructed SQL
 * @return {Promise} Resolved to records if pagination is false, else object with pagination meta like Pagify hook
 */
Query.prototype.exec = function() {
    if (this.yetToImplement) {
        return Promise.reject({ message: `${this.yetToImplement} is yet to be implemented!` })
    } else if (this.pagination) {
        return this.query(__.constructDistinctSql(this, this.pagination.perPage, (this.pagination.perPage * (this.pagination.page - 1))))
            .then(records => Promise.all([
                this.query(__.constructSql(this, records.map(record => record.distinctId)))
                    .then(records => __.parseRecords(this, records)),
                this.count()
                    .then(count => __.paginationMeta(this, count))
            ]))
    } else {
        return this.query(__.constructSql(this))
            .then(records => __.parseRecords(this, records))
    }
};

/**
 * Count the number of records
 * @return {Promise} Resolved to the number of records
**/
Query.prototype.count = function() {
    if (this.yetToImplement) {
        return Promise.reject({ message: `${this.yetToImplement} is yet to be implemented!` })
    } else {
        return this.query(`SELECT COUNT(*) AS tc FROM (${__.constructDistinctSql(this)}) AS qry`)
            .then(records => records[0].tc)
    }
};

/**
 * Set custom select column
 * @param {string} column to be selected
 * @return {object} chainable Query
 */
Query.prototype.column = function(col) {
    this.customColumn = true;
    this.sql.columns = [col];

    return this;
};

/**
 * Populate association
 * @param {object} table to be populated, format: 'table1', {table1: 'table2'} or {table1: {table2: 'table3'}}}
 * @return {object} chainable Query
 */
Query.prototype.populate = function(association) {
    _populate(this, this.mapper.populates, this.model, association, 1);
    return this.reference(association, 0);
};

/**
 * Referencing tables
 * Assume that the Primary Key is `id`
 * @param {object} table to be referenced, format: 'table1', {table1: {'table2'}} or {table1: {table2: 'table3'}}}
 * @return {object} chainable Query
 * Conflict between join & reference is not handled yet
 */
Query.prototype.reference = function(association) {
    __.reference(this, this.mapper.references, this.model, association, 0);
    return this;
};

/**
 * Add conditional clause
 * @param {query} conditional clause
 * @return {object} chainable Query
 * Query can be a string -- it will be treated as raw sql
 * Query can be an object -- format: {table: {col: condition}} where condition can be any types including array or Query
 * Query can be an array -- each option in the array will be chain together by OR
 */
Query.prototype.where = function(option) {
    if (typeof option === 'string') {
        this.sql.wheres.push(option);
    } else if (typeof option === 'object') {
        const options = option instanceof Array ? option : [option];

        const orClauses = options.map(opt => {
            let nClauses = [];

            Object.keys(opt).forEach(table => {
                Object.keys(opt[table]).forEach(attr => {
                    nClauses.push(__.whereClause(`${table}.${attr}`, opt[table][attr]));
                })
            })

            return `(${nClauses.join(') AND (')})`
        })

        this.sql.wheres.push(`(${orClauses.join(') OR (')})`);
    } else {
        // do nothing, not expected
    }

    return this;
};

/**
 * Add conditional clause
 * @param {verb} join verb such as LEFT JOIN, INNER JOIN
 * @param {query} conditional clause
 * @return {object} chainable Query
 * Query can be a string -- it will be treated as raw sql
 * Query can be an object -- format: {table: {col: condition}} where condition can be any types including array or Query
 * Query can NOT be an array
 */
Query.prototype.join = function(verb, option) {
    if (typeof option === 'string') {
        this.sql.joinsRaw.push(`${verb} ${option}`);
    } else if (typeof option === 'object') {
        let tableAlias;

        Object.keys(option).forEach(table => {
            [, tableAlias] = __.tableAlias(this, table, 1);
            let nClauses = [];

            Object.keys(option[table]).forEach(attr => {
                nClauses.push(__.whereClause(`${table}.${attr}`, option[table][attr]));
            })

            const subject = `${verb} ${table} AS ${tableAlias}`;
            const condition = `(${nClauses.join(') AND (')})`

            if (this.sql.joinsTable[subject]) {
                this.sql.joinsTable[subject].push(condition);
            } else {
                this.sql.joinsTable[subject] = [condition];
            }
        })
    } else {
        // do nothing, not expected
    }

    return this;
}

/**
 * Add order clause
 * @param {object} order columns
 * @return {object} chainable Query
 */
Query.prototype.sort = function(order) {
    if (!order) {
        // do nothing
    } else if (typeof order === 'string') {
        this.sql.orders.push(order);
    } else {
        const clause = Object.keys(order).map(key => {
            return `${key} ${order[key]}`
        }).join(', ');

        this.sql.orders.push(clause);
    }

    return this;
};

/**
 * Add limit clause
 * @param {integer} limit
 * @param {integer} offset
 * @return {object} chainable Query
 */
Query.prototype.limit = function(limit, offset = 0) {
    this.sql.limit = limit;
    this.sql.offset = offset;

    return this;
};

/**
 * Pagify records
 * @param {integer} page, default 1
 * @param {integer} perPage, default 10
 * @return {object} chainable Query
 */
Query.prototype.pagify = function(page = 1, perPage = 10) {
    this.pagination = {page, perPage};
    return this;
};

/*
 * Async Query
 * @param {string} Raw SQL
 * @return {promise} A promise resolve to array of native records
 */
Query.prototype.query = function(sql) {
    console.log(`
        [36m> Complex SQL Query [${(new Date()).toISOString()}][0m
        ${sql}
    `)

    return new Promise((resolve, reject) => {
        this.model.query(sql, [], (err, records) => err ? reject(err) : resolve(records))
    })
};

module.exports = Query;
