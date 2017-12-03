import lodash from "lodash";
import {Spinner} from "cli-spinner";
import Table from "cli-table";
import Confirm from "prompt-confirm";

import LoggerFactory from "../utils/logger";
import {DriverStore, ProjectStore} from "../stores";

const Logger = new LoggerFactory("instance.manager");

export default class NimusInstanceManager {
    async create(projectName, driverName, data, count) {
        const logger = Logger.create("instanceCreate");
        logger.debug("enter", {projectName, driverName, data, count});

        const driver = DriverStore.get(driverName);
        const project = ProjectStore.get(projectName);
        let instance;

        // @TODO : validate args
        if(!driver) {
            return logger.error("a driver is required");
        }

        // Create new project if not created yet.
        if(!project) {
            this.projectCreate(projectName);
        }

        const spinner = new Spinner("%s");
        spinner.start();

        const promises = [];

        for(let i = 0; i < count; i++) {
            const instanceData = count > 1 ? lodash.assign({}, data, {name: `${data.name}-${i+1}`}) : data;

            const metrics = LoggerFactory.info(`🚀  creating instance "${instanceData.name}"`);

            ((i, metrics) => {
                const promise = driver.instanceCreate(instanceData).then((instance) => {
                    logger.debug(`instance ${instance.name} created`, {elapsed: metrics.elapsed()});

                    const project = ProjectStore.get(projectName);
                    project.instances[instance.name] = instance;

                    return ProjectStore.persist().then(() => {
                        return {metrics, instance};
                    }).catch((error) => {
                        logger.error(`could not persist project "${projectName}"`, error);
                        return {metrics};
                    });
                }).catch((error) => {
                    if(count === 1) {throw error;}

                    logger.error(`instance create error : index=${i+1}`, error);
                    return {instance: null, metrics};
                });

                promises.push(promise);
            })(i, metrics);
        }

        try {
            const results = await Promise.all(promises);
            spinner.stop(true);

            logger.debug("driver instanceCreate success", results);

            // Update project with new instances
            for(let i = 0; i < results.length; i++) {
                const {instance, metrics} = results[i];

                if(!instance) {
                    continue;
                }

                LoggerFactory.info(`☕️  instance "${instance.name}" created : ip=${instance.network.externalIp}`, {elapsed: metrics.elapsed()});
            }
        } catch(error) {
            spinner.stop(true);
            logger.error("instance create error", error);
        }
    }

    async list() {
        const logger = Logger.create("instanceList");
        const projects = lodash.cloneDeep(Object.values(ProjectStore.get()));
        const status = {};
        const promises = [];

        LoggerFactory.info("🚀  listing instances");

        const spinner = new Spinner("%s");
        spinner.start();

        logger.debug("enter", {projects});

        for(let i = 0; i < projects.length; i++) {
            const project = projects[i];
            const instances = Object.values(project.instances);

            status[project.name] = {};

            for(let j = 0; j < instances.length; j++) {
                const instance = instances[j];
                const driver = DriverStore.get(instance.driver);

                if(!driver) {
                    continue;
                }

                const promise = driver.instanceGet(instance.name).then((updatedInstance) => {
                    status[project.name][instance.name] = updatedInstance.status;
                }).catch((error) => {
                    if(error.code == 404) {
                        status[project.name][instance.name] = "DELETED";

                        logger.debug("instance deleted");

                        // Let's remove the instance resource
                        return this.instanceRemove(project.name, instance.name, {skipConfirmation: true});
                    } else {
                        status[project.name][instance.name] = "FAILED";
                    }
                });

                promises.push(promise);
            }
        }

        try {
            await Promise.all(promises);

            // Create the table
            const table = new Table({
                head: [
                    "project",
                    "instance",
                    "private IP",
                    "public IP",
                    "status"
                ]
            });

            for(let i = 0; i < projects.length; i++) {
                const project = projects[i];
                const instances = Object.values(project.instances);

                for(let j = 0; j < instances.length; j++) {
                    const instance = instances[j];
                    const instanceStatus = lodash.get(status, `${project.name}.${instance.name}`) || instance.status;

                    table.push([
                        project.name,
                        instance.name,
                        instance.network.internalIp,
                        instance.network.externalIp,
                        instanceStatus
                    ]);
                }
            }

            // @TODO : Update projects files with new instance status.

            spinner.stop(true);
            LoggerFactory.log(table.toString());
        } catch(error) {
            // Do nothing
        }
    }

    async remove(projectName, instanceName, {skipConfirmation=false}={}) {
        const logger = Logger.create("instanceRemove");
        const spinner = new Spinner("%s");
        logger.debug("enter", {projectName, instanceName});

        const project = ProjectStore.get(projectName);

        if(!project) {
            return logger.error("project not found");
        }

        const instancesToRemove = [];
        const promises = [];

        if(!project.instances[instanceName]) {
            // Try to check other possible instance names.
            const instances = Object.values(project.instances);
            const rgx = new RegExp(`^${instanceName}-\\d+$`);

            for(let i = 0; i < instances.length; i++) {
                if(rgx.test(instances[i].name)) {
                    instancesToRemove.push(instances[i]);
                }
            }

            if(!instancesToRemove.length) {
                return logger.error("no instances found matching the provided name");
            }
        } else {
            instancesToRemove.push(project.instances[instanceName]);
        }

        if(!skipConfirmation) {
            const answer = await (new Confirm(`Do you really want to remove instance(s) ${instancesToRemove.map(i => i.name).join(", ")}?`)).run();

            if(!answer) {
                return;
            }
        }

        for(let i = 0; i < instancesToRemove.length; i++) {
            const instance = instancesToRemove[i];
            const driver = DriverStore.get(instance.driver);

            if(!driver) {
                logger.error(`no driver found : instance=${instance.name}`);
                continue;
            }

            const metrics = LoggerFactory.info(`🚀  removing instance "${instance.name}"`);

            ((instance, metrics) => {
                const promise = driver.instanceRemove(instance.name).then(() => {
                    delete project.instances[instance.name];

                    return ProjectStore.persist(project.name).then(() => {
                        logger.debug(`instance removed : instance=${instance.name}`, {elapsed: metrics.elapsed()});
                        return {instance, metrics};
                    }).catch((error) => {
                        logger.error(`could not persist project file : instance=${instance.name}`, error);
                        return {metrics};
                    });
                }).catch((error) => {
                    if(error.code == 404) {
                        delete project.instances[instance.name];

                        return ProjectStore.persist(project.name).then(() => {
                            logger.debug(`instance removed : instance=${instance.name}`, {elapsed: metrics.elapsed()});
                            return {instance, metrics};
                        }).catch((error) => {
                            logger.error(`could not persist project file : instance=${instance.name}`, error);
                            return {metrics};
                        });
                    }

                    logger.error(`instance remove failed : instance=${instance.name}`, error);
                    return {metrics};
                });

                promises.push(promise);
            })(instance, metrics);
        }

        spinner.start();

        try {
            const results = await Promise.all(promises);
            spinner.stop(true);

            logger.debug("instances removed", results);

            for(let i = 0; i < results.length; i++) {
                const {instance, metrics} = results[i];

                if(!instance) {
                    continue;
                }

                LoggerFactory.info(`☕️  instance "${instance.name}" removed`, {elapsed: metrics.elapsed()});
            }
        } catch(error) {
            spinner.stop(true);
            logger.error("instance remove error", error);
        }
    }
}