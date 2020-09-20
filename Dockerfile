FROM openjdk:8
MAINTAINER Jérémie H.

ENV SPRING_OUTPUT_ANSI_ENABLED=ALWAYS \
    JHIPSTER_SLEEP=0 \
    SPRING_PROFILES_ACTIVE=docker \
    JAVA_OPTS=""

# add source
ADD . /code/
# package the application and delete all lib
RUN apt update && apt install -y automake && \
    rm -rf /var/lib/apt/lists/* && \
    apt clean && \
    echo '{ "allow_root": true }' > /root/.bowerrc && \
    cd /code/ && \
    ./mvnw clean package -Pprod -DskipTests && \
    mv /code/target/*.war /app.war && \
    mv /code/src/main/resources/config/application-docker.yml /application-docker.yml && \
    rm -Rf /code /root/.npm/ /tmp && \
    rm -Rf /root/.m2/

RUN sh -c 'touch /app.war'
VOLUME /tmp
EXPOSE 8080

CMD echo "The application will start in ${JHIPSTER_SLEEP}s..." && \
    sleep ${JHIPSTER_SLEEP} && \
    java ${JAVA_OPTS} -Djava.security.egd=file:/dev/./urandom -jar /app.war
