import os from "os";
import fs from "fs";
import path from "path";
import lodash from "lodash";
import mkdirp from "mkdirp";
import LoggerFactory from "../utils/logger";

const Logger = new LoggerFactory("stores.project");

const PROJECTS_DIR = `${os.homedir()}/.nimus/projects`;
const SSH_DIR = `${os.homedir()}/.nimus/ssh`;

export default class ProjectStore {
    static data = {};

    static load() {
        const logger = Logger.create("load");
        logger.debug("enter");

        // Create drivers dir
        mkdirp(PROJECTS_DIR);
        mkdirp(SSH_DIR);

        // Variables
        let i, filenames, filename, content, project, pubKey, prvKey;

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
                project = JSON.parse(content);
            } catch(error) {
                return logger.error(`could not parse project file to json : ${filename}`, error);
            }

            // Read associated ssh priv key
            try {
                prvKey = fs.readFileSync(path.resolve(SSH_DIR, `${projectName}`), "utf-8");
            } catch(error) {
                logger.error(`could not read project ssh prv key file`, error);
                continue;
            }

            // Read associated ssh pub key
            try {
                pubKey = fs.readFileSync(path.resolve(SSH_DIR, `${projectName}.pub`), "utf-8");
            } catch(error) {
                logger.error(`could not read project ssh pub key file`, error);
                continue;
            }

            ProjectStore.data[projectName] = Object.assign(project, {pubKey, prvKey});
        }

        return ProjectStore.data;
    }

    static exists(projectName) {
        return Boolean(ProjectStore.data[projectName]);
    }

    static async add(project = {}) {
        const logger = Logger.create("add");
        logger.debug("enter", project);

        if(ProjectStore.exists(project.name)) {
            throw `a project with name ${project.name} already exists`;
        }

        ProjectStore.data[project.name] = project;

        // Persist data.
        try {
            await ProjectStore.persist(project.name);
        } catch(error) {
            delete ProjectStore.data[project.name];
            throw error;
        }
    }

    static remove(projectName) {
        const logger = Logger.create("remove");
        logger.debug("enter", {projectName});

        if(!ProjectStore.exists(projectName)) {
            logger.debug("project does not exist");
            return Promise.reject(`project "${projectName}" not found`);
        }

        return new Promise((resolve, reject) => {
            const filepath = `${PROJECTS_DIR}/${projectName}.json`;

            fs.unlink(filepath, (error) => {
                if(error) {
                    logger.debug("project file not unlinked", error);
                    return reject(error);
                }

                delete ProjectStore.data[projectName];
                resolve();
            });
        });
    }

    static get(projectName) {
        const logger = Logger.create("get");
        const project = lodash.get(ProjectStore.data, `${projectName}`);

        logger.debug("enter", {projectName});

        if(!project) {
            logger.debug("get all projects");
            return ProjectStore.data;
        }

        return project;
    }

    // Persist project data.
    static async persist(projectName) {
        const logger = Logger.create("persist");
        const project = lodash.get(ProjectStore.data, `${projectName}`);
        let projectsToPersist = [];

        if(!project) {
            projectsToPersist = Object.values(ProjectStore.data);
        } else {
            projectsToPersist.push(project);
        }

        logger.debug("projects to persist", projectsToPersist);

        const promises = [];

        for(let i = 0; i < projectsToPersist.length; i++) {
            const projectData = lodash.pick(projectsToPersist[i], ["name", "instances"]);
            const filepath = `${PROJECTS_DIR}/${projectData.name}.json`;

            const promise = new Promise((resolve, reject) => {
                fs.writeFile(filepath, JSON.stringify(projectData, null, 2) , 'utf-8', (error) => {
                    if(error) {
                        logger.debug(`project could not be persisted : name=${projectData.name}`, error);
                        return reject(error);
                    }

                    logger.debug(`project "${projectData.name}" persisted`);
                    resolve(projectData);
                });
            });

            promises.push(promise);
        }

        return await Promise.all(promises);
    }
}