var gulp = require('gulp'),
  path = require('path');

var mocha = require('gulp-mocha');
var runSequence = require('run-sequence');


gulp.task('test', function () {
  return gulp.src('./test/all-tests.js', { read: false })
      .pipe(mocha({
        ui: 'exports',
        reporter: 'spec'
      }))
    ;
});


gulp.task('default', function(cb) {
  runSequence('test', cb);
});



