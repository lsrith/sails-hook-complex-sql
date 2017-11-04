const Sails = require('sails').Sails;

let sails = null;

before((done) => {
    const liftOpts = {
        hooks: {
            "complex-sql": require('../'),
            grunt: false
        },
        models: {
            connection: 'mysql',
            migrate: 'drop'
        },
        log: {
            level: "error"
        },
        connections: {
            mysql: {
                adapter: 'sails-mysql',
                host: 'localhost',
                user: 'root',
                password: '12345678',
                database: 'complex-sql'
            }
        }
    };

    Sails().lift(liftOpts, (err, _sails) => {
        if (err) {
            return done(err)
        } else {
            sails = _sails
            return done()
        }
    })
})

after((done) => {
    if (sails) {
        return sails.lower(done);
    }

    return done();
})
