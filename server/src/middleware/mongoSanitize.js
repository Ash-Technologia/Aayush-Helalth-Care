'use strict';

const mongoSanitize = require('express-mongo-sanitize');

module.exports = function (options = {}) {
  const hasOnSanitize = typeof options.onSanitize === 'function';
  return function (req, res, next) {
    ['body', 'params', 'headers', 'query'].forEach(function (key) {
      if (req[key]) {
        // express-mongo-sanitize's sanitize function mutates the object in-place.
        // We do NOT reassign req[key] = target, because in Express 5 some request properties
        // (like req.query and req.params) are read-only / getter-only, and reassigning them
        // throws a TypeError.
        const beforeKeys = Object.keys(req[key]).length;
        mongoSanitize.sanitize(req[key], options);
        const afterKeys = Object.keys(req[key]).length;

        // If we want to check if it was sanitized (for callback)
        if (beforeKeys !== afterKeys && hasOnSanitize) {
          options.onSanitize({
            req,
            key,
          });
        }
      }
    });
    next();
  };
};
