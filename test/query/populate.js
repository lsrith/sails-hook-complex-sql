require("./../bootstrap.js")

const _ = require('lodash')
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

    before((done) => {
        _createBooks()
        .then(books => Promise.all([
            _createAuthor(books.slice(0, 3)),
            _createAuthor(books.slice(1, 5)),
            _createAuthor(books.slice(2, 7))
        ]))
        .then(done.bind(null, null))
        .catch(done)
    })

    after((done) => {
        Promise.all([
            Author.destroy(),
            Book.destroy()
        ]).then(done.bind(null, null))
        .catch(done)
    })

    describe('Author', () => {
        it('populate all books', (done) => {
            Author.cQuery.populate('books').exec()
                .then(authors => {
                    assert.equal(authors.length, 3);

                    bookLengths = authors.map(author => author.books.length).sort();
                    assert.equal(_.isEqual(bookLengths, [3, 4, 5]), true);
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        });

        it('populated by all books', (done) => {
            Book.cQuery.populate('authors').exec()
                .then(books => {
                    assert.equal(books.length, 7);

                    authorLengths = books.map(book => book.authors.length).sort();
                    assert.equal(_.isEqual(authorLengths, [1, 1, 1, 2, 2, 2, 3]), true);
                })
                .then(done.bind(null, null))
                .catch(err => done(err))
        })
    })
})
