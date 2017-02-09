(function() {
    'use strict';

    angular
        .module('klaskApp', [
            'ngStorage',
            'tmh.dynamicLocale',
            'pascalprecht.translate',
            'ngResource',
            'ngCookies',
            'ngAria',
            'ngCacheBuster',
            'ngFileUpload',
            'ui.bootstrap',
            'ui.bootstrap.datetimepicker',
            'ui.router',
            'infinite-scroll',
            'filters',
            'ngSanitize',
            // jhipster-needle-angularjs-add-module JHipster will add new module here
            'angular-loading-bar'
        ])
        .run(run);

    run.$inject = ['stateHandler', 'translationHandler'];

    function run(stateHandler, translationHandler) {
        stateHandler.initialize();
        translationHandler.initialize();
    }


})();




angular.module('filters', [])
    .filter('formatKoMoGo', function () {
        return function (size) {
            if (isNaN(size))
                size = 0;
            if (size < 1024)
                return size + ' o';
            size /= 1024;
            if (size < 1024)
                return size.toFixed(2) + ' Kio';
            size /= 1024;
            if (size < 1024)
                return size.toFixed(2) + ' Mio';
            size /= 1024;
            if (size < 1024)
                return size.toFixed(2) + ' Gio';
            size /= 1024;
            return size.toFixed(2) + ' Tio';
        };
    })
    .filter('unsafe',['$sce', function ($sce) {
        return function (content) {
            if (content != null){
                var aAfficher = content.replace(/&lt;mark&gt;/g,"<mark>")
                .replace(/&lt;\/mark&gt;/g,"</mark>")
                .replace(/\n+/g,"<br>");
                return $sce.trustAsHtml(aAfficher);
            }
            else{
                return null;
            }
        };
    }])
    //even if elasticsearch return encoded html (set in CustomSearchRepositoryImpl)
    //the findAll method could return html tag, so we need to ensure that it's ok in any case
    .filter('escapeall',['$sce', function ($sce) {
            return function (content) {
            if (content != null){
                return content
                .replace(/</g,"&lt;")
                .replace(/>/g,"&gt;")
                .replace(/\[\.\.\.\]/g,"<small class=\"contentTruncated\">[...]</small>")
                ;
            }
            else {
                return null;
            }

            };
        }])
    .filter('countDocs', function () {
        return function (tableauClefValeur) {
            if (tableauClefValeur === undefined)
                return 0;
            var count=0;
            angular.forEach(tableauClefValeur, function(key, value) {
                if (key.hasOwnProperty('docNumber')) {
                    count = count + key['docNumber'];
                }
            });
            return count.toLocaleString("fr");
        };
    });
