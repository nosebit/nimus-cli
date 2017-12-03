import fs from "fs";
import path from "path";
import os from "os";
import mkdirp from "mkdirp";
import lodash from "lodash";
import {Spinner} from "cli-spinner";
import Table from "cli-table";
import Confirm from "prompt-confirm";
import LoggerFactory from "../utils/logger";
import {GoogleDriver} from "../drivers";

const Logger = new LoggerFactory("nimus");

const PROJECTS_DIR = `${os.homedir()}/.nimus/projects`;
const DRIVERS_DIR = `${os.homedir()}/.nimus/drivers`;

class Nimus {
    constructor({
        shared=false
    } = {}) {
        if(shared) {
            Nimus.shared = this;
        }

        this.load();
    }

    // This function loads all stored data.
    load() {
        const logger = Logger.create("load");
        logger.debug("enter");

        this.projects = {};
        this.drivers = {};

        // Create data dir if necessary
        mkdirp(PROJECTS_DIR);
        mkdirp(DRIVERS_DIR);

        // Variables
        let i, filenames, filename, content;

        // Load all projects
        try {
            filenames = fs.readdirSync(PROJECTS_DIR);
        } catch(error) {
            return logger.error("read project folder error", error);
        }

        for(i = 0; i < filenames.length; i++) {
            filename = filenames[i];

            try {
                content = fs.readFileSync(path.resolve(PROJECTS_DIR, filename), "utf-8");
            } catch(error) {
                logger.error(`could not read project file : ${filename}`, error);
                continue;
            }

            const projectName = path.basename(filename, ".json");

            try {
                const obj = JSON.parse(content);
                this.projects[projectName] = obj;
            } catch(error) {
                logger.error(`could not parse project file to json : ${filename}`, error);
            }
        }

        logger.debug("loaded projects", this.projects);
        LoggerFactory.info("🔎  projects loaded");

        // Load all drivers
        try {
            filenames = fs.readdirSync(DRIVERS_DIR);
        } catch(error) {
            return logger.error("read drivers folder error", error);
        }

        for(i = 0; i < filenames.length; i++) {
            filename = filenames[i];

            try {
                content = fs.readFileSync(path.resolve(DRIVERS_DIR, filename), "utf-8");
            } catch(error) {
                logger.error(`could not read driver file : ${filename}`, error);
                continue;
            }

            const driverName = path.basename(filename, ".json");

            try {
                const config = JSON.parse(content);

                switch(config.provider) {
                    case "gce": this.drivers[driverName] = new GoogleDriver(config);
                }
            } catch(error) {
                logger.error(`could not parse driver file to json : ${filename}`, error);
            }
        }

        logger.debug("loaded drivers", this.drivers);
        LoggerFactory.info("🔎  drivers loaded");
    }

    // This function creates a new project.
    projectCreate(name) {
        const filepath = `${PROJECTS_DIR}/${name}.json`;

        // Check if project already exists
        if(fs.existsSync(filepath)) {
            return LoggerFactory.error(`a project with name "${name}" already exists`);
        } else {
            const project = {
                name,
                instances: {}
            };

            try {
                fs.writeFileSync(filepath, JSON.stringify(project, null, 2) , 'utf-8');
                this.projects[name] = project;
            } catch(error) {
                logger.error("could not write project file", error);
            }
        }

        LoggerFactory.info(`☕️  project "${name}" created`);
    }

    // This function lists all projects
    projectList() {
        const logger = Logger.create("projectList");
        const projects = Object.values(this.projects);

        logger.debug("enter", {projects});

        const table = new Table({
            head: [
                "name",
                "num instances"
            ]
        });

        for(let i = 0; i < projects.length; i++) {
            const project = projects[i];
            const instances = Object.values(project.instances);

            table.push([
                project.name,
                instances.length
            ]);
        }

        LoggerFactory.log(table.toString());
    }

    // This function remove a project.
    projectRemove(name) {
        const logger = Logger.create("projectRemove");
        const filepath = `${PROJECTS_DIR}/${name}.json`;

        logger.debug("enter", {name});

        if(!projects[name]) {
            return logger.error("no project found");
        }

        // Save to file.
        try {
            fs.writeFileSync(filepath, JSON.stringify(obj, null, 2) , 'utf-8');
        } catch(error) {
            return logger.error("could not save new project file", error);
        }

        // Delete from cached projects
        delete this.projects[name];

        LoggerFactory.info(`☕️  project "${name}" removed`);
    }

    // This function creates a new driver
    driverCreate(provider, data = {}) {
        const logger = Logger.create("driverCreate");
        const name = data.name;
        logger.debug("enter", {provider, data});

        if(!lodash.isString(name)) {
            return logger.error("a name string should be provided");
        }

        const filepath = `${DRIVERS_DIR}/${name}.json`;

        if(fs.existsSync(filepath)) {
            return LoggerFactory.error(`a project with name "${name}" already exists`);
        }

        if(provider == "gce") {
            logger.debug("provider is gce");

            // Validate data
            const validateError = GoogleDriver.validateData(data);

            if(validateError) {
                return logger.error(validateError.message);
            }

            const credentialsPath = path.resolve(process.cwd(), data.credentials);

            logger.debug("credentials path", {cwd : process.cwd(), credentials: data.credentials, credentialsPath});

            fs.readFile(credentialsPath, "utf-8", (error, content) => {
                if(error) {
                    return logger.error("credentials file could not be read", error);
                }

                try {
                    const credentials = JSON.parse(content);

                    const driver = {
                        provider,
                        name,
                        credentials
                    };

                    // Write to a driver file
                    fs.writeFile(filepath, JSON.stringify(driver, null, 2) , 'utf-8', (error) => {
                        if(error) {
                            return logger.error("driver file could not be written", error);
                        }

                        LoggerFactory.info(`☕️  driver "${name}" created`);
                    });
                } catch(error) {
                    logger.error("credentials file could not be parsed to json", error);
                }
            });
        }
    }

    // This function lists the drivers
    driverList() {
        const logger = Logger.create("driverList");
        const drivers = Object.values(this.drivers);

        logger.debug("enter", {drivers});

        const table = new Table({
            head: [
                "name",
                "provider"
            ]
        });

        for(let i = 0; i < drivers.length; i++) {
            const driver = drivers[i];

            table.push([
                driver.name,
                driver.provider
            ]);
        }

        LoggerFactory.log(table.toString());
    }

    // This function removes a driver.
    driverRemove(name) {
        const logger = Logger.create("driverRemove");
        const filepath = `${DRIVERS_DIR}/${name}.json`;

        logger.debug("enter", {name});

        if(!drivers[name]) {
            return logger.error("no driver found");
        }

        // Let's delete the file
        try {
            fs.unlinkSync(filepath);
        } catch(error) {
            return logger.error("could not remove driver file", error);
        }

        delete this.drivers[name];

        LoggerFactory.info(`☕️  driver "${name}" removed`);
    }

    // This function creates a new instance
    async instanceCreate(projectName, driverName, data, count) {
        const logger = Logger.create("instanceCreate");
        logger.debug("enter", {projectName, driverName, data, count});

        const filepath = `${PROJECTS_DIR}/${projectName}.json`;
        const driver = this.drivers[driverName];
        const project = this.projects[projectName];
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

                    this.projects[projectName].instances[instance.name] = instance;

                    try {
                        fs.writeFileSync(filepath, JSON.stringify(this.projects[projectName], null, 2) , 'utf-8');
                    } catch(error) {
                        return logger.error(`could not save new project file : instance=${instance.name}`, error);
                    }

                    return {metrics, instance};
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

    // This function lists the instances
    async instanceList() {
        const logger = Logger.create("instanceList");
        const projects = lodash.cloneDeep(Object.values(this.projects));
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
                const driver = this.drivers[instance.driver];

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

    /**
     * This function will remove the instance resource.
     */
    async instanceRemove(projectName, instanceName, {skipConfirmation=false}={}) {
        const logger = Logger.create("instanceRemove");
        const spinner = new Spinner("%s");
        logger.debug("enter", {projectName, instanceName});

        const project = this.projects[projectName];
        const filepath = `${PROJECTS_DIR}/${projectName}.json`;

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
            const driver = this.drivers[instance.driver];

            if(!driver) {
                logger.error(`no driver found : instance=${instance.name}`);
                continue;
            }

            const metrics = LoggerFactory.info(`🚀  removing instance "${instance.name}"`);

            ((instance, metrics) => {
                const promise = driver.instanceRemove(instance.name).then(() => {
                    delete project.instances[instance.name];

                    logger.debug(`instance removed : instance=${instance.name}`, {elapsed: metrics.elapsed()});

                    // Save to file
                    try {
                        fs.writeFileSync(filepath, JSON.stringify(project, null, 2) , 'utf-8');
                    } catch(error) {
                        logger.error(`could not save new project file : instance=${instance.name}`, error);
                    }

                    return {instance, metrics};
                }).catch((error) => {
                    if(error.code == 404) {
                        delete project.instances[instance.name];

                        // Save to file
                        try {
                            fs.writeFileSync(filepath, JSON.stringify(project, null, 2) , 'utf-8');
                        } catch(error) {
                            logger.error(`could not save new project file : instance=${instance.name}`, error);
                        }

                        return {metrics, instance};
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

export {
    Nimus as default
};