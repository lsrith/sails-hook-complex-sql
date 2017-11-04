'use strict';

const _ = require('lodash');
const path = require('path');
const Query = require(path.join(__dirname, 'lib/query/query'));

module.exports = (sails) => {
    return {
        defaults: {
            __configKey__: {
                logging: true,
                perPage: 10
            }
        },

        initialize: (next) => {
            var waitEvents = [];

            if (sails.hooks.orm) {
                waitEvents.push('hook:orm:loaded');
            }

            if (sails.hooks.pubsub) {
                waitEvents.push('hook:pubsub:loaded');
            }

            sails.after(waitEvents, (() => {
                const context = this;

                _.forEach(sails.models, (model) => {
                    if(model.globalId) {
                        model.cQuery = new Query(model);
                    }
                });

                next();
            }).bind(this))
        }
    }
}
