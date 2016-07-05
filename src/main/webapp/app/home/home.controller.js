(function() {
    'use strict';

    angular
        .module('researchApp')
        .controller('HomeController', HomeController);

    HomeController.$inject = ['$scope', '$state', 'DataUtils', 'File', 'FileSearch', 'VersionSearch', 'ProjectSearch', 'ParseLinks', 'AlertService', 'pagingParams', 'paginationConstants', 'filters'];

    function HomeController ($scope, $state, DataUtils, File, FileSearch, VersionSearch, ProjectSearch, ParseLinks, AlertService, pagingParams, paginationConstants, filters) {
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
        vm.filterByVersion = filterByVersion;
        vm.filterByProject = filterByProject;
        vm.isVersionIsActive = isVersionIsActive;
        vm.isProjectIsActive = isProjectIsActive;
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
                    sort: sort()
                }, onSuccessFile, onError);
                VersionSearch.query({
                    query: pagingParams.search
                }, onSuccessVersion, onError);
                ProjectSearch.query({
                    query: pagingParams.search
                }, onSuccessProject, onError);
            } else {
                File.query({
                    page: pagingParams.page - 1,
                    size: vm.itemsPerPage,
                    version: vm.versionsSelected,
                    project: vm.projectsSelected,
                    sort: sort()
                }, onSuccessFile, onError);
                VersionSearch.get(onSuccessVersion, onError);
                ProjectSearch.get(onSuccessProject, onError);
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
                checkIfAllVersionsSelectedAreInSearchResult();
            }

            function onSuccessProject(data, headers) {
                vm.projectsOnRequest = data;
                checkIfAllProjectsSelectedAreInSearchResult();
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
    }
})();
