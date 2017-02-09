(function() {
    'use strict';

    angular
        .module('klaskApp')
        .controller('HomeController', HomeController);

    HomeController.$inject = ['$scope', '$state', 'DataUtils', 'File', 'FileSearch', 'VersionSearch', 'ProjectSearch', 'ExtensionSearch', 'ParseLinks', 'AlertService', 'pagingParams', 'paginationConstants', 'filters'];

    function HomeController ($scope, $state, DataUtils, File, FileSearch, VersionSearch, ProjectSearch, ExtensionSearch, ParseLinks, AlertService, pagingParams, paginationConstants, filters) {
        var vm = this;
        vm.loadPage = loadPage;
        vm.predicate = pagingParams.predicate;
        vm.reverse = pagingParams.ascending;
        vm.transition = transition;
        vm.itemsPerPage = paginationConstants.itemsPerPage;
        vm.clear = clear;
        vm.search = search;
        vm.versionsSelected = filters.version;
        vm.projectsSelected = filters.project;
        vm.extensionsSelected = filters.extension;
        vm.filterByVersion = filterByVersion;
        vm.filterByProject = filterByProject;
        vm.filterByExtension = filterByExtension;
        vm.isVersionIsActive = isVersionIsActive;
        vm.isProjectIsActive = isProjectIsActive;
        vm.isExtensionIsActive = isExtensionIsActive;
        vm.loadAll = loadAll;
        vm.searchQuery = pagingParams.search;
        vm.currentSearch = pagingParams.search;
        vm.openFile = DataUtils.openFile;
        vm.byteSize = DataUtils.byteSize;

	loadAll();

        function loadAll () {
            if (pagingParams.search) {
                FileSearch.query({
                    query: pagingParams.search,
                    page: pagingParams.page - 1,
                    size: vm.itemsPerPage,
                    version : vm.versionsSelected,
                    project : vm.projectsSelected,
                    extension : vm.extensionsSelected,
                    sort: sort()
                }, onSuccessFile, onError);
                VersionSearch.query({
                    query: pagingParams.search
                }, onSuccessVersion, onError);
                ProjectSearch.query({
                    query: pagingParams.search
                }, onSuccessProject, onError);
                ExtensionSearch.query({
                    query: pagingParams.search
                }, onSuccessExtension, onError);
            } else {
                File.query({
                    page: pagingParams.page - 1,
                    size: vm.itemsPerPage,
                    version: vm.versionsSelected,
                    project: vm.projectsSelected,
                    extension: vm.extensionsSelected,
                    sort: sort()
                }, onSuccessFile, onError);
                VersionSearch.get(onSuccessVersion, onError);
                ProjectSearch.get(onSuccessProject, onError);
                ExtensionSearch.get(onSuccessExtension, onError);
            }
            function sort() {
                var result = [vm.predicate + ',' + (vm.reverse ? 'asc' : 'desc')];
                if (vm.predicate !== 'id') {
                    result.push('id');
                }
                return result;
            }

            function onSuccessFile(data, headers) {
                vm.links = ParseLinks.parse(headers('link'));
                vm.totalItems = headers('X-Total-Count');
                //elasticsearch set the parameter 'index.max_result_window' to 10000, so we need to check that
                if(vm.totalItems > 10000){
                    vm.totalItems=10000;
                }
                vm.queryCount = vm.totalItems;
                vm.files = data;
                vm.page = pagingParams.page;
                //elasticsearch set the parameter 'index.max_result_window' to 10000, so we need to check that
                if(vm.totalItems >= 10000 && vm.page>vm.totalItems/vm.itemsPerPage){
                    vm.page=vm.totalItems/vm.itemsPerPage;
                }
            }

            function onSuccessVersion(data, headers) {
                vm.versionsOnRequest = data;
                vm.page = pagingParams.page;
                checkIfAllVersionsSelectedAreInSearchResult();
            }

            function onSuccessProject(data, headers) {
                vm.projectsOnRequest = data;
                vm.page = pagingParams.page;
                checkIfAllProjectsSelectedAreInSearchResult();
            }

            function onSuccessExtension(data, headers) {
                vm.extensionsOnRequest = data;
                vm.page = pagingParams.page;
                checkIfAllExtensionsSelectedAreInSearchResult();
            }

            function onError(error) {
                AlertService.error(error.data.message);
            }
        }

        function loadPage(page) {
            vm.page = page;
            vm.transition();
        }

        function transition() {
            $state.transitionTo($state.$current, {
                page: vm.page,
                sort: vm.predicate + ',' + (vm.reverse ? 'asc' : 'desc'),
                version: vm.versionsSelected,
                project: vm.projectsSelected,
                extension: vm.extensionsSelected,
                search: vm.currentSearch
            });

        }

        function checkIfAllProjectsSelectedAreInSearchResult(){
            var mapProjectsOnRequest = vm.projectsOnRequest.map(function(obj){
            return obj.name;
            });
            //si le tableau de projects sélectionnées est un tableau
            //on conserve seulement les valeurs aussi présentes dans le résultat de requête mapProjectsOnRequest
            var projectsFiltered=vm.projectsSelected;
            if(vm.projectsSelected.constructor === Array){
                projectsFiltered = vm.projectsSelected.filter(function(value){
                    return mapProjectsOnRequest.indexOf(value) != -1;
                });
            }
            else{
                if(mapProjectsOnRequest.indexOf(vm.projectsSelected) == -1){
                    projectsFiltered='';
                }
            }
            if(projectsFiltered!=vm.projectsSelected){
                vm.projectsSelected = projectsFiltered;
                vm.transition();
            }
        }

        function checkIfAllVersionsSelectedAreInSearchResult(){
            var mapVersionsOnRequest = vm.versionsOnRequest.map(function(obj){
            return obj.name;
            });
            //si le tableau de versions sélectionnées est un tableau
            //on conserve seulement les valeurs aussi présentes dans le résultat de requête mapVersionsOnRequest
            var versionsFiltered=vm.versionsSelected;
            if(vm.versionsSelected.constructor === Array){
                versionsFiltered = vm.versionsSelected.filter(function(value){
                    return mapVersionsOnRequest.indexOf(value) != -1;
                });
            }
            else{
                if(mapVersionsOnRequest.indexOf(vm.versionsSelected) == -1){
                    versionsFiltered='';
                }
            }
            if(versionsFiltered!=vm.versionsSelected){
                vm.versionsSelected = versionsFiltered;
                vm.transition();
            }

        }

        function checkIfAllExtensionsSelectedAreInSearchResult(){
            var mapExtensionsOnRequest = vm.extensionsOnRequest.map(function(obj){
            return obj.name;
            });
            //si le tableau de extensions sélectionnées est un tableau
            //on conserve seulement les valeurs aussi présentes dans le résultat de requête mapExtensionsOnRequest
            var extensionsFiltered=vm.extensionsSelected;
            if(vm.extensionsSelected.constructor === Array){
                extensionsFiltered = vm.extensionsSelected.filter(function(value){
                    return mapExtensionsOnRequest.indexOf(value) != -1;
                });
            }
            else{
                if(mapExtensionsOnRequest.indexOf(vm.extensionsSelected) == -1){
                    extensionsFiltered='';
                }
            }
            if(extensionsFiltered!=vm.extensionsSelected){
                vm.extensionsSelected = extensionsFiltered;
                vm.transition();
            }
        }

        function search(searchQuery) {
            if (!searchQuery) {
                return vm.clear();
            }
            vm.links = null;
            vm.page = 1;
            vm.predicate = '_score';
            vm.reverse = false;
            vm.currentSearch = searchQuery;
            vm.transition();
        }

        function filterByVersion(version){
            if(isVersionIsActive(version)){
                if(vm.versionsSelected.constructor === Array)
                  vm.versionsSelected.splice(vm.versionsSelected.indexOf(version),1);
                else
                  vm.versionsSelected=''
            }
            else {
                if(vm.versionsSelected.constructor === Array) {
                    vm.versionsSelected.push(version);
                }
                else{
                    if(vm.versionsSelected==='')
                        vm.versionsSelected = version;
                    else
                        vm.versionsSelected = [vm.versionsSelected, version];
                }
            }
            vm.links = null;
            vm.page = 1;
            vm.predicate = '_score';
            vm.reverse = false;
            vm.transition();
        }

         function filterByProject(project){
            if(isProjectIsActive(project)){
                if(vm.projectsSelected.constructor === Array)
                  vm.projectsSelected.splice(vm.projectsSelected.indexOf(project),1);
                else
                  vm.projectsSelected=''
            }
            else {
                if(vm.projectsSelected.constructor === Array) {
                    vm.projectsSelected.push(project);
                }
                else{
                    if(vm.projectsSelected==='')
                        vm.projectsSelected = project;
                    else
                        vm.projectsSelected = [vm.projectsSelected, project];
                }
            }
            vm.links = null;
            vm.page = 1;
            vm.predicate = '_score';
            vm.reverse = false;
            vm.transition();
        }

         function filterByExtension(extension){
            if(isExtensionIsActive(extension)){
                if(vm.extensionsSelected.constructor === Array)
                  vm.extensionsSelected.splice(vm.extensionsSelected.indexOf(extension),1);
                else
                  vm.extensionsSelected=''
            }
            else {
                if(vm.extensionsSelected.constructor === Array) {
                    vm.extensionsSelected.push(extension);
                }
                else{
                    if(vm.extensionsSelected==='')
                        vm.extensionsSelected = extension;
                    else
                        vm.extensionsSelected = [vm.extensionsSelected, extension];
                }
            }
            vm.links = null;
            vm.page = 1;
            vm.predicate = '_score';
            vm.reverse = false;
            vm.transition();
        }


        function clear() {
            vm.links = null;
            vm.page = 1;
            vm.predicate = 'id';
            vm.reverse = true;
            vm.currentSearch = null;
            vm.transition();
        }

        //on ne sait pas à l'avance si vm.versionsSelected est un tableau ou un string seul
        function isVersionIsActive(versionToCheck){
            if(vm.versionsSelected.constructor === Array) {
                return vm.versionsSelected.indexOf(versionToCheck) != -1;
            }
            else {
                return vm.versionsSelected==versionToCheck;
            }
        }

        //on ne sait pas à l'avance si vm.projectsSelected est un tableau ou un string seul
        function isProjectIsActive(projectToCheck){
            if(vm.projectsSelected.constructor === Array) {
                return vm.projectsSelected.indexOf(projectToCheck) != -1;
            }
            else {
                return vm.projectsSelected==projectToCheck;
            }
        }

        //on ne sait pas à l'avance si vm.extensionsSelected est un tableau ou un string seul
        function isExtensionIsActive(extensionToCheck){
            if(vm.extensionsSelected.constructor === Array) {
                return vm.extensionsSelected.indexOf(extensionToCheck) != -1;
            }
            else {
                return vm.extensionsSelected==extensionToCheck;
            }
        }
    }
})();
