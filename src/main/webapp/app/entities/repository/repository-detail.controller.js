(function() {
    'use strict';

    angular
        .module('klaskApp')
        .controller('RepositoryDetailController', RepositoryDetailController);

    RepositoryDetailController.$inject = ['$scope', '$rootScope', '$stateParams', 'entity', 'Repository'];

    function RepositoryDetailController($scope, $rootScope, $stateParams, entity, Repository) {
        var vm = this;

        vm.repository = entity;

        var unsubscribe = $rootScope.$on('klaskApp:repositoryUpdate', function(event, result) {
            vm.repository = result;
        });
        $scope.$on('$destroy', unsubscribe);
    }
})();
