(function() {
    'use strict';

    angular
        .module('klaskApp')
        .controller('RepositoryDialogController', RepositoryDialogController);

    RepositoryDialogController.$inject = ['$timeout', '$scope', '$stateParams', '$uibModalInstance', 'entity', 'Repository'];

    function RepositoryDialogController ($timeout, $scope, $stateParams, $uibModalInstance, entity, Repository) {
        var vm = this;

        vm.repository = entity;
        vm.clear = clear;
        vm.save = save;

        $timeout(function (){
            angular.element('.form-group:eq(1)>input').focus();
        });

        function clear () {
            $uibModalInstance.dismiss('cancel');
        }

        function save () {
            vm.isSaving = true;
            if (vm.repository.id !== null) {
                Repository.update(vm.repository, onSaveSuccess, onSaveError);
            } else {
                Repository.save(vm.repository, onSaveSuccess, onSaveError);
            }
        }

        function onSaveSuccess (result) {
            $scope.$emit('klaskApp:repositoryUpdate', result);
            $uibModalInstance.close(result);
            vm.isSaving = false;
        }

        function onSaveError () {
            vm.isSaving = false;
        }


    }
})();
