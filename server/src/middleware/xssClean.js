'use strict';

const xssFilters = require('xss-filters');

function clean(data = '') {
  let isObject = false;
  if (typeof data === 'object' && data !== null) {
    data = JSON.stringify(data);
    isObject = true;
  }

  if (typeof data === 'string') {
    data = xssFilters.inHTMLData(data).trim();
  }

  if (isObject) {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // fallback if JSON parsing fails
    }
  }

  return data;
}

module.exports = function () {
  return function (req, res, next) {
    if (req.body) {
      req.body = clean(req.body);
    }
    
    if (req.query) {
      const cleanedQuery = clean(req.query);
      // Mutate req.query properties directly because the property itself has only a getter in Express 5
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      for (const key of Object.keys(cleanedQuery)) {
        req.query[key] = cleanedQuery[key];
      }
    }
    
    if (req.params) {
      const cleanedParams = clean(req.params);
      // Mutate req.params properties directly
      for (const key of Object.keys(req.params)) {
        delete req.params[key];
      }
      for (const key of Object.keys(cleanedParams)) {
        req.params[key] = cleanedParams[key];
      }
    }

    next();
  };
};
