(function () {
    'use strict';

    angular
        .module('klaskApp')
        .controller('FileDetailController', FileDetailController);

    FileDetailController.$inject = ['$scope', '$rootScope', '$stateParams', 'DataUtils', 'entity', 'File'];

    function FileDetailController($scope, $rootScope, $stateParams, DataUtils, entity, File) {
        var vm = this;

        vm.file = entity;
        vm.byteSize = DataUtils.byteSize;
        vm.openFile = DataUtils.openFile;

        var unsubscribe = $rootScope.$on('klaskApp:fileUpdate', function(event, result) {
            vm.file = result;
        });
        $scope.$on('$destroy', unsubscribe);
    }
})();
