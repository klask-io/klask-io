(function () {
    'use strict';

    angular
        .module('researchApp')
        .controller('FileDeleteController', FileDeleteController);

    FileDeleteController.$inject = ['$uibModalInstance', 'entity', 'File'];

    function FileDeleteController($uibModalInstance, entity, File) {
        var vm = this;
        vm.file = entity;
        vm.clear = function () {
            $uibModalInstance.dismiss('cancel');
        };
        vm.confirmDelete = function (id) {
            File.delete({id: id},
                function () {
                    $uibModalInstance.close(true);
                });
        };
    }
})();
