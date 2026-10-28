/* Polyfill / safety wrapper for Service Worker context */
(function () {
  if (typeof self !== 'undefined' && typeof self._async_to_generator === 'undefined') {
    self._async_to_generator = function (fn) {
      return function () {
        var self_ = this, args = arguments;
        return new Promise(function (resolve, reject) {
          var gen = fn.apply(self_, args);
          function _next(value) {
            try {
              var res = gen.next(value);
              if (res.done) resolve(res.value);
              else Promise.resolve(res.value).then(_next, _throw);
            } catch (e) {
              reject(e);
            }
          }
          function _throw(err) {
            try {
              var res = gen.throw(err);
              if (res.done) resolve(res.value);
              else Promise.resolve(res.value).then(_next, _throw);
            } catch (e) {
              reject(e);
            }
          }
          _next(undefined);
        });
      };
    };
  }
})();
