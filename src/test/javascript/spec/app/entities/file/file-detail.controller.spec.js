'use strict';

describe('Controller Tests', function () {

    describe('File Management Detail Controller', function () {
        var $scope, $rootScope;
        var MockEntity, MockFile;
        var createController;

        beforeEach(inject(function ($injector) {
            $rootScope = $injector.get('$rootScope');
            $scope = $rootScope.$new();
            MockEntity = jasmine.createSpy('MockEntity');
            MockFile = jasmine.createSpy('MockFile');


            var locals = {
                '$scope': $scope,
                '$rootScope': $rootScope,
                'entity': MockEntity,
                'File': MockFile
            };
            createController = function () {
                $injector.get('$controller')("FileDetailController", locals);
            };
        }));


        describe('Root Scope Listening', function () {
            it('Unregisters root scope listener upon scope destruction', function () {
                var eventType = 'researchApp:fileUpdate';

                createController();
                expect($rootScope.$$listenerCount[eventType]).toEqual(1);

                $scope.$destroy();
                expect($rootScope.$$listenerCount[eventType]).toBeUndefined();
            });
        });
    });

});
