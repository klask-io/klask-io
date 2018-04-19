#!/bin/bash
#################################################################
#
# Description : le script parcours l'ensemble des projets de gitlab, les clone et les index
# exemple : ./exploreGitlab.sh https://gitlab.yvesrocher.com
#
# Parametres :
#
# $1 l'adresse du gitlab
#
#################################################################

display_usage() {
	echo "This script explore gitlab repositories and push to klask server"
	echo -e "\nUsage:\n$0 [gitlab url] [klask url] \n"
}

# if less than two arguments supplied, display usage
if [  $# -lt 2 ]; then
	display_usage
	exit 1
fi

# check whether user had supplied -h or --help . If yes display usage
if [[ ( $# == "--help") ||  $# == "-h" ]]
then
	display_usage
	exit 1
fi

URL_GITLAB="$1"
URL_KLASK="$2"

if [ -z "${BUILD_NUMBER}" ]; then
  BUILD_NUMBER="0"
fi

hash jq 2>/dev/null || { echo >&2 "J'ai besoin de jq (apt install jq). Stop."; exit 1; }

#Récupère les 10 premières pages de 100 projets (1000 projets au maximum donc)
FLUX_JSON=$(curl -s --header "Private-Token: vMky9q9ozQBcKU8h-iHi" "$URL_GITLAB/api/v4/projects?per_page=100&page=[1-10]" | jq '.[] | {urls: .http_url_to_repo} | .urls')
#FLUX_JSON=$(curl -s --header "Private-Token: cohUyXyHXiJS4AtGExNr" "$URL_GITLAB/api/v4/projects" | jq '.[] | {urls: .ssh_url_to_repo} | .urls')
# if [ $? -eq 0 ]; then
#    # Erreur 500 : afficher la réponse sur la console pour qu'elle soit visible dans Jenkins
#    echo "l'url de gitlab ${ARGS_FILE} n'existe pas. Stop."
#    exit 255;
# else

  while read p; do
    if [ "${p}" != "" ]; then
      urlgit=$(echo "${p}");
      echo "$urlgit";
      nomrepo=$(echo "$urlgit" | awk -F'/' '{print $NF'} |awk -F'.' '{print $(NF-1)}');
      echo  "{\"path\":${urlgit},\"username\":null,\"password\":null,\"type\":\"GIT\",\"name\":\"${nomrepo}\",\"revision\":null,\"schedule\":null}";
      curl --header "Authorization: Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImF1dGgiOiJST0xFX0FETUlOLFJPTEVfVVNFUiIsImV4cCI6MTUyNjQ2NDI5M30.HRwcB0CQSMLNSKB7jlOGkVHU-Nxl-uQcJ-U-hCvD5DNUyjdmiEu9nEpMQ5u91pU7vBnaHwDKZqOdBrJ5xaT2HA" --header 'Content-Type: application/json' --header 'Accept: application/json' \
       -X POST --data "{\"path\":${urlgit},\"username\":null,\"password\":null,\"type\":\"GIT\",\"name\":\"${nomrepo}\",\"revision\":null,\"schedule\":null}" "${URL_KLASK}/api/repositories";


    fi
  done < <(echo "$FLUX_JSON")
  sortie=0;
  exit $sortie;
# fi
