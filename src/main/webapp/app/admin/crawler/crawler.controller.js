(function() {
    'use strict';

    angular
        .module('researchApp')
        .controller('CrawlerController', CrawlerController);

    CrawlerController.$inject = ['$scope','CrawlerService', 'AlertService'];

    function CrawlerController ($scope, CrawlerService, AlertService) {
        var vm = this;
        vm.updatingCrawler = true;
        vm.crawler = crawler;


        function crawler() {
                    vm.isCrawling = true;
                    CrawlerService.crawler(onCrawlerSuccess, onCrawlerError);
                }
                function onCrawlerSuccess(result) {
                    vm.isCrawling = false;
                }

                function onCrawlerError(error) {
                    vm.isCrawling = false;
                    AlertService.error(error.data.message);
                }
    }
})();
