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
    .filter('formatKoMoGo', ['$locale', function ($locale) {
        return function (size) {
            if (isNaN(size))
                size = 0;
            for(var iter=0; iter < 8; iter++){
                if (size < 1024){
                    var formatSize = (iter===0 ? size : size.toFixed(2))+'';
                    return formatSize.replace('\.', $locale.NUMBER_FORMATS.DECIMAL_SEP)
                    + ' '+$locale.NUMBER_FORMATS.BINARY_PREFIX[iter];
                }
                else
                    size/=1024;
            }
            return size.toFixed(2) + ' YiB';//YiB ?!
        };
    }])
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
