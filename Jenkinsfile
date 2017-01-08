node {
    // uncomment these 2 lines and edit the name 'node-4.4.5' according to what you choose in configuration
    def nodeHome = tool name: 'NodeJS-4.4.7', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
    env.PATH = "${nodeHome}/bin:${env.PATH}"
    def mvnHome = tool 'maven-3.3.9'

    stage ("check environment") {
        sh "node -v"
        sh "npm -v"
        sh "bower -v"
        sh "gulp -v"
    }

    stage ("checkout") {
        checkout scm
    }

    stage ("npm install") {
        sh "npm cache clean -f"
        sh "npm install"
        sh "bower install"
        sh "gulp install"
    }

    stage ("clean") {
        sh "${mvnHome}/bin/mvn clean"
        //sh "./mvnw clean"
    }

    stage ("backend tests") {
        sh "${mvnHome}/bin/mvn test"
        //sh "./mvnw test"
    }

    stage ("frontend tests") {
        sh "gulp test"
    }

    stage ("packaging") {
        sh "${mvnHome}/bin/mvn package -Pprod -DskipTests"
        //sh "./mvnw package -Pprod -DskipTests"
    }
}
