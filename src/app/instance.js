import lodash from "lodash";
import ora from "ora";
import Table from "cli-table";
import Confirm from "prompt-confirm";
import ssh2 from "ssh2";

import LoggerFactory from "../utils/logger";
import {DriverStore, ProjectStore} from "../stores";

const Logger = new LoggerFactory("instance.manager");

export default class NimusInstanceManager {
    /**
     * This function setups an instance.
     */
    async setup(projectName, instanceName) {
        const logger = Logger.create("setup");
        logger.debug("enter", {projectName, instanceName});

        const project = ProjectStore.get(projectName);

        LoggerFactory.startSpinner();

        // Create new project if not created yet.
        if(!project) {
            return logger.error("project not found");
        }

        const instance = project.instances[instanceName];

        if(!instance) {
            return logger.error("instance not found");
        }

        const driver = DriverStore.get(instance.driver);

        if(!driver) {
            return logger.error("driver not found");
        }

        return new Promise((resolve, reject) => {
            const ssh = new ssh2.Client();
            const connectData = {
                host: instance.network.externalIp,
                username: 'nimus',
                port: 22,
                privateKey: project.prvKey,
                readyTimeout: 99999
            };

            logger.debug("ssh connect data", connectData);
            
            let metrics = LoggerFactory.info(`📡  (${instance.name}) connecting to instance ...`);

            ssh.on('ready', () => {
                LoggerFactory.info(`⚙️  (${instance.name}) setting up instance ...`, {timeToConnect: metrics.elapsed()});

                ssh.exec('uptime', (error, stream) => {
                    if (error) {
                        LoggerFactory.stopSpinner();
                        logger.error(`😱  (${instance.name}) ssh command failed`, error);
                        return reject(error);
                    }

                    stream.on('close', (code, signal) => {
                        LoggerFactory.stopSpinner();
                        LoggerFactory.info(`📡  (${instance.name}) disconnect`, {timeToSetup: metrics.elapsed()});

                        resolve();
                        ssh.end();
                    }).on('data', (info) => {
                        info = lodash.toString(info);
                        LoggerFactory.info(`⚙️  (${instance.name}) ${info.replace(/\r?\n|\r/g, "").replace(/^ +/, "")}`);
                    });
                });
            }).connect(connectData);
        });
    }

    async create(projectName, driverName, data, count) {
        const logger = Logger.create("create");
        logger.debug("enter", {projectName, driverName, data, count});

        const driver = DriverStore.get(driverName);
        const project = ProjectStore.get(projectName);
        let instance;

        // @TODO : validate args
        if(!driver) {
            return logger.error("driver not found");
        }

        // Create new project if not created yet.
        if(!project) {
            return logger.error("project not found");
        }

        LoggerFactory.startSpinner();

        const promises = [];

        for(let i = 0; i < count; i++) {
            const instanceData = count > 1 ? lodash.assign({}, data, {name: `${data.name}-${i+1}`}) : data;

            // Add metadata
            instanceData.metadata = {
                "sshKeys": `nimus:${project.pubKey}`
            };

            const metrics = LoggerFactory.info(`🚀  (${instanceData.name}) creating instance`);

            logger.debug(`instance data`, instanceData);

            ((i, metrics) => {
                const promise = driver.instanceCreate(instanceData).then(async (instance) => {
                    logger.debug(`instance ${instance.name} created`, {elapsed: metrics.elapsed(), instance});

                    // Set instance
                    project.instances[instance.name] = instance;

                    try {
                        await ProjectStore.persist();
                    } catch(error) {
                        logger.error(`could not persist project "${projectName}"`, error);
                        return {metrics};
                    }

                    // setup instance
                    try {
                        await this.setup(project.name, instance.name);
                    } catch(error) {
                        logger.error(`(${instance.name}) could not setup instance`, error);
                    }

                    return {metrics, instance};
                }).catch((error) => {
                    if(count === 1) {throw error;}

                    logger.error(`😱  instance create error : index=${i+1}`, error);
                    return {instance: null, metrics};
                });

                promises.push(promise);
            })(i, metrics);
        }

        try {
            const results = await Promise.all(promises);
            LoggerFactory.stopSpinner();

            logger.debug("driver instanceCreate success", {count: results.length});

            // Update project with new instances
            for(let i = 0; i < results.length; i++) {
                const {instance, metrics} = results[i];

                if(!instance) {
                    continue;
                }

                LoggerFactory.info(`☕️  (${instance.name}) instance created : ip=${instance.network.externalIp}`, {elapsed: metrics.elapsed()});
            }
        } catch(error) {
            LoggerFactory.stopSpinner();
            logger.error("instance create error", error);
        }
    }

    async list() {
        const logger = Logger.create("instanceList");
        const projects = lodash.cloneDeep(Object.values(ProjectStore.get()));
        const status = {};
        const promises = [];

        LoggerFactory.info("🚀  listing instances");
        LoggerFactory.startSpinner();

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
                        return this.remove(project.name, instance.name, {skipConfirmation: true});
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

            LoggerFactory.stopSpinner();
            LoggerFactory.log(table.toString());
        } catch(error) {
            // Do nothing
        }
    }

    async remove(projectName, instanceName, {skipConfirmation=false}={}) {
        const logger = Logger.create("instanceRemove");
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

        LoggerFactory.startSpinner();

        try {
            const results = await Promise.all(promises);

            LoggerFactory.stopSpinner();

            logger.debug("instances removed", {count: results.length});

            for(let i = 0; i < results.length; i++) {
                const {instance, metrics} = results[i];

                if(!instance) {
                    continue;
                }

                LoggerFactory.info(`☕️  instance "${instance.name}" removed`, {elapsed: metrics.elapsed()});
            }
        } catch(error) {
            LoggerFactory.stopSpinner();
            logger.error("instance remove error", error);
        }
    }
}