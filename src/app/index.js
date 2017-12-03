import fs from "fs";
import path from "path";
import os from "os";
import mkdirp from "mkdirp";
import lodash from "lodash";
import Table from "cli-table";
import Confirm from "prompt-confirm";
import {spawn} from "child_process";
import LoggerFactory from "../utils/logger";
import {GoogleDriver} from "../drivers";
import {DriverStore, ProjectStore} from "../stores";

import InstanceManager from "./instance";

const Logger = new LoggerFactory("nimus");

const SSH_DIR = `${os.homedir()}/.nimus/ssh`;

class Nimus {
    constructor({
        shared=false
    } = {}) {
        if(shared) {
            Nimus.shared = this;
        }

        this.load();

        // Managers
        this.instance = new InstanceManager();
    }

    // This function loads all stored data.
    load() {
        const logger = Logger.create("load");
        logger.debug("enter");

        mkdirp(SSH_DIR);

        // Load all projects
        try {
            ProjectStore.load();
            LoggerFactory.info("🔎  projects loaded");
        } catch(error) {
            // Exit upon error
            process.exit(1);
        }

        // Load all drivers
        try {
            DriverStore.load();
            LoggerFactory.info("🔎  drivers loaded");
        } catch(error) {
            // Exit upon error
            process.exit(1);
        }
    }

    // This function creates a new project.
    async projectCreate(name) {
        const logger = Logger.create("projectCreate");
        const sshKeyPath = `${SSH_DIR}/${name}`;
        logger.debug("enter", {name});

        const sshKeysExists = fs.existsSync(sshKeyPath);
        let sshPubKey;

        logger.debug("ssh exists", {sshKeysExists, path: sshKeyPath});

        // If ssh keys was not created yet, let's create it
        if(!sshKeysExists) {
            LoggerFactory.info("🔓  creating ssh keys");

            const keygen = spawn("ssh-keygen", [
                "-t","rsa",
                "-C", "nimus",
                "-f", sshKeyPath
            ]);

            try {
                sshPubKey = await new Promise((resolve, reject) => {
                    keygen.on('exit', (code) => {
                        if(code) {
                            return reject("could not create ssh keys", {code});
                        }

                        LoggerFactory.info("🔓  setting chmod for ssh keys");

                        const chmod = spawn("chmod", [
                            "400",
                            sshKeyPath
                        ]);

                        chmod.on('exit', (code) => {
                            if(code) {
                                return reject("could not chmod ssh keys", {code});
                            }

                            // Load pub ssh key created.
                            try {
                                const content = fs.readFileSync(`${SSH_DIR}/${name}.pub`, "utf-8");
                                logger.debug("ssh pub key read success", content);

                                resolve(content);
                            } catch(error) {
                                logger.debug('could not read ssh pub key file', error);
                                return reject(error);
                            }
                        });
                    });
                })
            } catch(error) {
                return logger.error("could not create ssh keys", error);
            }
        }

        try {
            await ProjectStore.add({
                name,
                instances: {},
                pubKey: sshPubKey
            });
        } catch(error) {
            return logger.error(`could not create project "${name}"`, error);
        }

        LoggerFactory.info(`☕️  project "${name}" created`);
    }

    // This function lists all projects
    projectList() {
        const logger = Logger.create("projectList");
        const projects = ProjectStore.get();

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
    async projectRemove(name) {
        const logger = Logger.create("projectRemove");
        logger.debug("enter", {name});

        try {
            await ProjectStore.remove(name);
        } catch(error) {
            return logger.error(`could not remove project "${name}"`, error);
        }

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

        if(DriverStore.exists(data.name)) {
            return logger.error(`a driver with name "${name}" already exists`);
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

            fs.readFile(credentialsPath, "utf-8", async (error, content) => {
                if(error) {
                    return logger.error("credentials file could not be read", error);
                }

                try {
                    const credentials = JSON.parse(content);

                    const driver = new GoogleDriver({
                        provider,
                        name,
                        credentials
                    });

                    // Add driver to store.
                    try {
                        await DriverStore.add(driver);
                    } catch(error) {
                        return logger.error(`could not create driver ${name}`, error);
                    }

                    LoggerFactory.info(`☕️  driver "${name}" created`);
                } catch(error) {
                    logger.error("credentials file could not be parsed to json", error);
                }
            });
        }
    }

    // This function lists the drivers
    driverList() {
        const logger = Logger.create("driverList");
        const drivers = DriverStore.get();

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
    async driverRemove(name) {
        const logger = Logger.create("driverRemove");
        logger.debug("enter", {name});

        try {
            await DriverStore.remove(name);
        } catch(error) {
            return logger.error("could not remove driver file", error);
        }

        LoggerFactory.info(`☕️  driver "${name}" removed`);
    }
}

export {
    Nimus as default
};