// Generated on 2016-06-24 using generator-jhipster 3.4.2
'use strict';

var gulp = require('gulp'),
    rev = require('gulp-rev'),
    templateCache = require('gulp-angular-templatecache'),
    htmlmin = require('gulp-htmlmin'),
    imagemin = require('gulp-imagemin'),
    ngConstant = require('gulp-ng-constant'),
    rename = require('gulp-rename'),
    eslint = require('gulp-eslint'),
    mergestream = require('merge-stream'),
    flatten = require('gulp-flatten'),
    del = require('del'),
    runSequence = require('gulp4-run-sequence').use(gulp),
    browserSync = require('browser-sync'),
    KarmaServer = require('karma').Server,
    plumber = require('gulp-plumber'),
    changed = require('gulp-changed'),
    gulpIf = require('gulp-if'),
    inject = require('gulp-inject'),
    angularFilesort = require('gulp-angular-filesort'),
    naturalSort = require('gulp-natural-sort'),
    bowerFiles = require('main-bower-files');

var handleErrors = require('./gulp/handleErrors'),
    serve = require('./gulp/serve'),
    util = require('./gulp/utils'),
    build = require('./gulp/build');

var yorc = require('./.yo-rc.json')['generator-jhipster'];

var config = require('./gulp/config');

gulp.task('clean', function () {
    return del([config.dist], { dot: true });
});

gulp.task('copy', function (done) {
    return mergestream(
        gulp.src(config.app + 'i18n/**')
            .pipe(plumber({ errorHandler: handleErrors }))
            .pipe(changed(config.dist + 'i18n/'))
            .pipe(gulp.dest(config.dist + 'i18n/')),
        gulp.src(config.bower + 'bootstrap/fonts/*.*')
            .pipe(plumber({ errorHandler: handleErrors }))
            .pipe(changed(config.dist + 'content/fonts/'))
            .pipe(rev())
            .pipe(gulp.dest(config.dist + 'content/fonts/'))
            .pipe(rev.manifest(config.revManifest, {
                base: config.dist,
                merge: true
            }))
            .pipe(gulp.dest(config.dist)),
        gulp.src(config.app + 'content/**/*.{woff,woff2,svg,ttf,eot,otf}')
            .pipe(plumber({ errorHandler: handleErrors }))
            .pipe(changed(config.dist + 'content/fonts/'))
            .pipe(flatten())
            .pipe(rev())
            .pipe(gulp.dest(config.dist + 'content/fonts/'))
            .pipe(rev.manifest(config.revManifest, {
                base: config.dist,
                merge: true
            }))
            .pipe(gulp.dest(config.dist)),
        gulp.src(config.app + 'syntaxhighlighter/**')
            .pipe(gulp.dest(config.dist + 'syntaxhighlighter/')),
        gulp.src(config.app + 'prism/**')
            .pipe(gulp.dest(config.dist + 'prism/')),
        gulp.src([config.app + 'robots.txt', config.app + 'favicon.ico', config.app + '.htaccess'], { dot: true })
            .pipe(plumber({ errorHandler: handleErrors }))
            .pipe(changed(config.dist))
            .pipe(gulp.dest(config.dist))
    )
});

gulp.task('images', function (done) {
    return gulp.src(config.app + 'content/images/**')
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(changed(config.dist + 'content/images'))
        .pipe(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true }))
        .pipe(rev())
        .pipe(gulp.dest(config.dist + 'content/images'))
        .pipe(rev.manifest(config.revManifest, {
            base: config.dist,
            merge: true
        }))
        .pipe(gulp.dest(config.dist))
        .pipe(browserSync.reload({ stream: true }));
    done();
});


gulp.task('languages', function (done) {
    var locales = yorc.languages.map(function (locale) {
        return config.bower + 'angular-i18n/angular-locale_' + locale + '.js';
    });
    return gulp.src(locales)
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(changed(config.app + 'i18n/'))
        .pipe(gulp.dest(config.dist + 'i18n/'));
    done();
});

gulp.task('styles', function (done) {
    return gulp.src(config.app + 'content/css')
        .pipe(browserSync.reload({ stream: true }));
    done();
});

gulp.task('inject:app', function () {
    return gulp.src(config.app + 'index.html')
        .pipe(inject(gulp.src(config.app + 'app/**/*.js')
            .pipe(naturalSort())
            .pipe(angularFilesort()), { relative: true }))
        .pipe(gulp.dest(config.app));
});

gulp.task('inject:vendor', function (done) {
    var stream = gulp.src(config.app + 'index.html')
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(inject(gulp.src(bowerFiles(), { read: false }), {
            name: 'bower',
            relative: true
        }))
        .pipe(gulp.dest(config.app));
    done();
    return stream;
});

gulp.task('inject:test', function () {
    return gulp.src(config.test + 'karma.conf.js')
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(inject(gulp.src(bowerFiles({ includeDev: true, filter: ['**/*.js'] }), { read: false }), {
            starttag: '// bower:js',
            endtag: '// endbower',
            transform: function (filepath) {
                return '\'' + filepath.substring(1, filepath.length) + '\',';
            }
        }))
        .pipe(gulp.dest(config.test));
});

gulp.task('inject:troubleshoot', function (done) {
    /* this task removes the troubleshooting content from index.html*/
    return gulp.src(config.app + 'index.html')
        .pipe(plumber({ errorHandler: handleErrors }))
        /* having empty src as we dont have to read any files*/
        .pipe(inject(gulp.src('.', { read: false, allowEmpty: true }), {
            starttag: '<!-- inject:troubleshoot -->',
            removeTags: true,
            transform: function () {
                return '<!-- Angular views -->';
            }
        }))
        .pipe(gulp.dest(config.app));
    done();
});

gulp.task('inject:dep', gulp.series('inject:test', 'inject:vendor'));
gulp.task('inject', gulp.series('inject:dep', 'inject:app'));

gulp.task('html', function (done) {
    return gulp.src(config.app + 'app/**/*.html')
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(templateCache({
            module: 'klaskApp',
            root: 'app/',
            moduleSystem: 'IIFE'
        }))
        .pipe(gulp.dest(config.tmp));
    done();
});

gulp.task('assets:prod', gulp.series('images', 'styles', 'html', build));

gulp.task('ngconstant:dev', function () {
    return ngConstant({
        name: 'klaskApp',
        constants: {
            VERSION: util.parseVersion(),
            DEBUG_INFO_ENABLED: true,
            SMTP_ACTIVE: false
        },
        template: config.constantTemplate,
        stream: true
    })
    .pipe(rename('app.constants.js'))
    .pipe(gulp.dest(config.app + 'app/'));
});

gulp.task('ngconstant:prod', function (done) {
    var f = ngConstant({
        name: 'klaskApp',
        constants: {
            VERSION: util.parseVersion(),
            DEBUG_INFO_ENABLED: false,
            SMTP_ACTIVE: false
        },
        template: config.constantTemplate,
        stream: true
    })
        .pipe(rename('app.constants.js'))
        .pipe(gulp.dest(config.app + 'app/'));
    done();
    return f;
});

// check app for eslint errors
gulp.task('eslint', function () {
    return gulp.src(['gulpfile.js', config.app + 'app/**/*.js'])
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError());
});

// check app for eslint errors anf fix some of them
gulp.task('eslint:fix', function () {
    return gulp.src(config.app + 'app/**/*.js')
        .pipe(plumber({ errorHandler: handleErrors }))
        .pipe(eslint({
            fix: true
        }))
        .pipe(eslint.format())
        .pipe(gulpIf(util.isLintFixed, gulp.dest(config.app + 'app')));
});

gulp.task('test', gulp.series('inject:test', 'ngconstant:dev', function (done) {
    new KarmaServer({
        configFile: __dirname + '/' + config.test + 'karma.conf.js',
        singleRun: true,
    }, done).start();
}));


gulp.task('watch', function () {
    gulp.watch('bower.json', gulp.series('install'));
    gulp.watch(['gulpfile.js', 'pom.xml'], gulp.series('ngconstant:dev'));
    gulp.watch(config.app + 'content/css/**/*.css', gulp.series('styles'));
    gulp.watch(config.app + 'content/images/**', gulp.series('images'));
    gulp.watch(config.app + 'app/**/*.js', gulp.series('inject:app'));
    gulp.watch([config.app + '*.html', config.app + 'app/**', config.app + 'i18n/**']).on('change', browserSync.reload);
});

gulp.task('install', function (cb) {
    runSequence(['inject:dep', 'ngconstant:dev'], 'languages', 'inject:app', 'inject:troubleshoot', cb);
});

gulp.task('serve', function (cb) {
    runSequence('install', serve, cb);
});

gulp.task('build', gulp.series('clean', function (cb) {
    runSequence(['copy', 'inject:vendor', 'ngconstant:prod', 'languages'], 'inject:app', 'inject:troubleshoot', 'assets:prod', 'html', cb);
}));

gulp.task('default', gulp.series('serve'));
