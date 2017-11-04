require("./../bootstrap.js")

const faker = require('faker')
const assert = require('chai').assert
const expect = require('chai').expect

describe('Query::Populate Tests', () => {
    const _createBooks = () => {
        return Promise.all([
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() }),
            Book.create({ title: faker.system.fileName() })
        ])
    };

    const _createAuthor = (books) => {
        return Author.create({ name: faker.name.findName() })
            .then(author => {
                books.forEach(book => author.books.add(book));
                return author.save();
            })
    };

    const _createPublisher = (books) => {
        return Publisher.create({ name: faker.name.findName() })
            .then(publisher => {
                books.forEach(book => publisher.books.add(book));
                return publisher.save();
            })
    };

    before((done) => {
        _createBooks()
        .then(books => Promise.all([
            _createAuthor(books.slice(0, 3)),
            _createAuthor(books.slice(1, 5)),
            _createAuthor(books.slice(2, 7)),
            _createPublisher(books.slice(0, 4)),
            _createPublisher(books.slice(4, 7))
        ]))
        .then(done.bind(null, null))
        .catch(done)
    })

    after((done) => {
        Promise.all([
            Author.destroy(),
            Book.destroy(),
            Publisher.destroy()
        ]).then(done.bind(null, null))
        .catch(done)
    })

    describe('Author', () => {
        it('populate all books', (done) => {
            Author.cQuery.populate('books').exec()
                .then(authors => {
                    assert.equal(authors.length, 3);

                    bookLengths = authors.map(author => author.books.length).sort();
                    assert.deepEqual(bookLengths, [3, 4, 5]);
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        });

        it('populated by all books', (done) => {
            Book.cQuery.populate('authors').exec()
                .then(books => {
                    assert.equal(books.length, 7);

                    authorLengths = books.map(book => book.authors.length).sort();
                    assert.deepEqual(authorLengths, [1, 1, 1, 2, 2, 2, 3]);
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        });

        it(`populate all books' publisher`, (done) => {
            Author.cQuery.populate({ books: 'publisher' }).exec()
                .then(authors => {
                    authors.map(author => author.books.map(book => assert.isOk(book.publisher)))
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        });

        it('populated by all publishers', (done) => {
            Publisher.cQuery.populate({ books: 'authors' }).exec()
                .then(publishers => {
                    assert.equal(publishers.length, 2);

                    bookLengths = publishers.map(publisher => publisher.books.length).sort();
                    assert.deepEqual(bookLengths, [3, 4]);

                    authorLengths = publishers.map(publisher => publisher.books.map(book => book.authors.length));
                    authorLengths = authorLengths.reduce((rs, arr) => rs.concat(arr), []).sort();
                    assert.deepEqual(authorLengths, [1, 1, 1, 2, 2, 2, 3]);
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        });
    })
})
