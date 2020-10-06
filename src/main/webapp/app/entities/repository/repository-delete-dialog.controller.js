(function() {
    'use strict';

    angular
        .module('klaskApp')
        .controller('RepositoryDeleteController',RepositoryDeleteController);

    RepositoryDeleteController.$inject = ['$uibModalInstance', 'entity', 'Repository'];

    function RepositoryDeleteController($uibModalInstance, entity, Repository) {
        var vm = this;

        vm.repository = entity;
        vm.clear = clear;
        vm.confirmDelete = confirmDelete;
        
        function clear () {
            $uibModalInstance.dismiss('cancel');
        }

        function confirmDelete (id) {
            Repository.delete({id: id},
                function () {
                    $uibModalInstance.close(true);
                });
        }
    }
})();
