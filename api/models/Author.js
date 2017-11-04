module.exports = {
    schema: true,
    attributes: {
        name: {
            type: 'string'
        },
        books: {
            collection: 'book',
            via: 'authors'
        }
    }
}
