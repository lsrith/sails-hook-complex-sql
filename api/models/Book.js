module.exports = {
    schema: true,
    attributes: {
        title: {
            type: 'string'
        },
        authors: {
            collection: 'author',
            via: 'books'
        }
    }
};
