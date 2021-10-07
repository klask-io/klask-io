package io.klask.config;

import io.klask.domain.Repository;
import io.klask.repository.RepositoryRepository;
import io.klask.service.CrawlerService;
import io.klask.service.RepositoryService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.Trigger;
import org.springframework.scheduling.TriggerContext;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.config.TriggerTask;
import org.springframework.scheduling.support.CronSequenceGenerator;
import org.springframework.scheduling.support.CronTrigger;


import javax.inject.Inject;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.stream.Stream;

@Configuration
@EnableScheduling
@Slf4j
public class SchedulerConfig implements SchedulingConfigurer, DisposableBean {

    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    //configDataService // to store the cronexpression in data base so that we can change on the fly when server is running.

    @Inject
    private RepositoryRepository repositoryRepository;

    @Inject
    private CrawlerService crawlerService;

    private ScheduledTaskRegistrar taskRegistrar;

    public void reload(){
        if (executor != null) {
            executor.shutdownNow();
            executor = Executors.newSingleThreadScheduledExecutor();
        }
        if(taskRegistrar!=null)
            configureTasks(this.taskRegistrar); // calling recursively.
    }

    public void addRepositoryToSchedule(Repository repository){
        if(taskRegistrar!=null && repository != null) {
            String cron = repository.getSchedule();
            if(cron != null && CronSequenceGenerator.isValidExpression(cron)) {
                Runnable runnableTask = () -> {
                    log.info("[configureTasks] Repository {} crawler scheduled ({}) at -> {}", repository.getName(), repository.getSchedule(), new Date());
                    crawlerService.executeSpecificCrawler(repository);
                };
                Trigger trigger = new Trigger() {
                    @Override
                    public Date nextExecutionTime(TriggerContext triggerContext) {
                        String newCronExpression = repositoryRepository.findOne(repository.getId()).getSchedule();
                        if (!StringUtils.equalsIgnoreCase(newCronExpression, cron)) {
                            log.debug("New cron expression = " + newCronExpression);
                            taskRegistrar.setTriggerTasksList(new ArrayList<TriggerTask>());
                            configureTasks(taskRegistrar); // calling recursively.
                            taskRegistrar.destroy(); // destroys previously scheduled tasks.
                            taskRegistrar.setScheduler(executor);
                            taskRegistrar.afterPropertiesSet(); // this will schedule the task with new cron changes.
                            return null; // return null when the cron changed so the trigger will stop.
                        }
                        CronTrigger crontrigger = new CronTrigger(cron);
                        return crontrigger.nextExecutionTime(triggerContext);
                    }
                };
                taskRegistrar.addTriggerTask(runnableTask, trigger);
            }
            else {
                log.error("Cron expression on repository {}({}) is incorrect", repository.getName(), repository.getId());
            }
        }
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        this.taskRegistrar = taskRegistrar;
        for(Repository repository : repositoryRepository.findAll()) {
            addRepositoryToSchedule(repository);
        }

    }
    @Override
    public void destroy() throws Exception {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

}





