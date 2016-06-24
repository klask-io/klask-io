(function() {
    'use strict';

    angular
        .module('researchApp')
        .controller('FileDialogController', FileDialogController);

    FileDialogController.$inject = ['$timeout', '$scope', '$stateParams', '$uibModalInstance', 'DataUtils', 'entity', 'File'];

    function FileDialogController ($timeout, $scope, $stateParams, $uibModalInstance, DataUtils, entity, File) {
        var vm = this;

        vm.file = entity;
        vm.clear = clear;
        vm.byteSize = DataUtils.byteSize;
        vm.openFile = DataUtils.openFile;
        vm.save = save;

        $timeout(function (){
            angular.element('.form-group:eq(1)>input').focus();
        });

        function clear () {
            $uibModalInstance.dismiss('cancel');
        }

        function save () {
            vm.isSaving = true;
            if (vm.file.id !== null) {
                File.update(vm.file, onSaveSuccess, onSaveError);
            } else {
                File.save(vm.file, onSaveSuccess, onSaveError);
            }
        }

        function onSaveSuccess (result) {
            $scope.$emit('researchApp:fileUpdate', result);
            $uibModalInstance.close(result);
            vm.isSaving = false;
        }

        function onSaveError () {
            vm.isSaving = false;
        }


    }
})();
