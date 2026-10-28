const fs = require('fs');
const path = require('path');

const swPolyfill = `/* Injected Service Worker Polyfill for _async_to_generator */
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
`;

function patchServiceWorker(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('self._async_to_generator = function')) {
        content = swPolyfill + '\n' + content;
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Postbuild] Successfully injected _async_to_generator polyfill into ${filePath}`);
      }
    }
  } catch (err) {
    console.error(`[Postbuild] Failed to patch ${filePath}:`, err);
  }
}

function copyDir(src, dest) {
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      console.log(`[Postbuild] Successfully copied ${src} -> ${dest}`);
    } else {
      console.log(`[Postbuild] Warning: Source path ${src} does not exist.`);
    }
  } catch (err) {
    console.error(`[Postbuild] Error copying ${src} -> ${dest}:`, err);
  }
}

const root = path.join(__dirname, '..');
const standalonePath = path.join(root, '.next', 'standalone');

// Patch any existing service workers in public before copying
patchServiceWorker(path.join(root, 'public', 'sw.js'));
patchServiceWorker(path.join(root, 'public', 'admin', 'sw.js'));

if (fs.existsSync(standalonePath)) {
  console.log('[Postbuild] Standalone folder found. Copying assets...');
  copyDir(path.join(root, 'public'), path.join(standalonePath, 'public'));
  copyDir(path.join(root, '.next', 'static'), path.join(standalonePath, '.next', 'static'));

  // Also patch in standalone public
  patchServiceWorker(path.join(standalonePath, 'public', 'sw.js'));
  patchServiceWorker(path.join(standalonePath, 'public', 'admin', 'sw.js'));
} else {
  console.log('[Postbuild] Standalone folder not found. Skipping static files copy.');
}
