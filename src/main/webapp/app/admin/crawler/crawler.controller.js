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
        vm.stopCrawler = stopCrawler;
        vm.isCrawling = true;
        isCrawling();

        function crawler() {
            if(!vm.isCrawling){
                 vm.isCrawling = true;
                 CrawlerService.crawler(onCrawlerSuccess, onCrawlerError);
            }
        }
         function onCrawlerSuccess(result) {
             vm.isCrawling = true;
         }

         function onCrawlerError(error) {
             vm.isCrawling = false;
             AlertService.error(error.data.message);
         }

        function stopCrawler() {
             if(vm.isCrawling){
                 CrawlerService.stopcrawler(onStopCrawlerSuccess, onStopCrawlerError);
             }
        }
        function onStopCrawlerSuccess(result) {
         vm.isCrawling = false;
        }

        function onStopCrawlerError(error) {
         vm.isCrawling = false;
         AlertService.error(error.data.message);
        }

        function isCrawling () {
            CrawlerService.iscrawling(function(result){
                vm.isCrawling = ("true" === result.data);
            });
        }


    }
})();
