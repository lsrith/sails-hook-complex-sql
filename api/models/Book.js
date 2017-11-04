module.exports = {
    schema: true,
    attributes: {
        title: {
            type: 'string'
        },
        authors: {
            collection: 'author',
            via: 'books'
        },
        publisher: {
            model: 'publisher',
            via: 'books'
        },
        readerType: {
            type: 'string'
        },
        readerId: {
            type: 'integer'
        }
    }
};
