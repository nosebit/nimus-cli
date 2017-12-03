import os from "os";
import fs from "fs";
import path from "path";
import lodash from "lodash";
import mkdirp from "mkdirp";
import LoggerFactory from "../utils/logger";
import {GoogleDriver} from "../drivers";

const Logger = new LoggerFactory("stores.driver");

const DRIVERS_DIR = `${os.homedir()}/.nimus/drivers`;

export default class DriverStore {
    static data = {};

    static load() {
        const logger = Logger.create("load");
        logger.debug("enter");

        // Create drivers dir
        mkdirp(DRIVERS_DIR);

        // Variables
        let i, filenames, filename, content;

        // Load all drivers
        try {
            filenames = fs.readdirSync(DRIVERS_DIR);
        } catch(error) {
            logger.error("read drivers folder error", error);
            return;
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
                    case "gce": DriverStore.data[driverName] = new GoogleDriver(config);
                }
            } catch(error) {
                logger.error(`could not parse driver file to json : ${filename}`, error);
            }
        }

        return DriverStore.data;
    }

    static exists(driverName) {
        return Boolean(DriverStore.data[driverName]);
    }

    static async add(driver = {}) {
        const logger = Logger.create("add");
        logger.debug("enter", driver);

        if(DriverStore.exists(driver.name)) {
            throw `a driver with name ${driver.name} already exists`;
        }

        DriverStore.data[driver.name] = driver;

        // Persist data.
        try {
            await DriverStore.persist(driver.name);
        } catch(error) {
            delete DriverStore.data[driver.name];
            throw error;
        }
    }

    static remove(driverName) {
        const logger = Logger.create("remove");
        logger.debug("enter", {driverName});

        if(!DriverStore.exists(driverName)) {
            logger.debug("driver does not exist");
            return Promise.reject(`driver "${driverName}" not found`);
        }

        return new Promise((resolve, reject) => {
            const filepath = `${DRIVERS_DIR}/${driverName}.json`;

            fs.unlink(filepath, (error) => {
                if(error) {
                    logger.debug("driver file not unlinked", error);
                    return reject(error);
                }

                delete DriverStore.data[driverName];
                resolve();
            });
        });
    }

    static get(driverName) {
        const logger = Logger.create("get");
        const driver = lodash.get(DriverStore.data, `${driverName}`);

        logger.debug("enter", {driverName});

        if(!driver) {
            logger.debug("get all drivers");
            return DriverStore.data;
        }

        return driver;
    }

    // Persist driver data.
    static async persist(driverName) {
        const logger = Logger.create("persist");
        const driver = lodash.get(DriverStore.data, `${driverName}`);
        let driversToPersist = [];

        if(!driver) {
            driversToPersist = Object.values(DriverStore.data);
        } else {
            driversToPersist.push(driver);
        }

        logger.debug("drivers to persist", driversToPersist);

        const promises = [];

        for(let i = 0; i < driversToPersist.length; i++) {
            const driverData = driversToPersist[i].getData();
            const filepath = `${DRIVERS_DIR}/${driverData.name}.json`;

            const promise = new Promise((resolve, reject) => {
                fs.writeFile(filepath, JSON.stringify(driverData, null, 2) , 'utf-8', (error) => {
                    if(error) {
                        logger.error(`driver could not be persisted : name=${driverData.name}`, error);
                        return reject(error);
                    }

                    logger.debug(`driver "${driverData.name}" persisted`);
                    resolve(driverData);
                });
            });

            promises.push(promise);
        }

        return await Promise.all(promises);
    }
}