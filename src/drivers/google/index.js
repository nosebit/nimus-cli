/**
 * This driver should normalize the returns from google cloud api
 * to something nimus can use.
 */
import lodash from "lodash";
import hash from "object-hash";
import GoogleApi from "./api";
import LoggerFactory from "../../utils/logger";

const Logger = new LoggerFactory("drivers.google");

export default class GoogleDriver {
    static validateData(data = {}) {
        if(!data.name) {
            return "name is required for google driver";
        }

        if(!data.credentials) {
            return "credentials file path is required for google driver";
        }
    }

    constructor({
        name="",
        credentials={},
        zone="us-central1-a",
        machineType="n1-standard-1"
    } = {}) {
        this.provider = "gce";
        this.name = name;
        this.project = credentials.project_id;
        this.zone = zone;
        this.machineType = machineType;
        this.credentials = credentials;
        this.api = new GoogleApi({credentials, zone});
    }

    /**
     * This function gets driver core data
     */
    getData() {
        return {
            provider: this.provider,
            name: this.name,
            credentials: this.credentials
        };
    }

    /**
     * This function normalizes instance info.
     */
    normalizeInstanceInfo(instance) {
        return {
            name: instance.name,
            machineType: instance.machineType,
            zone: instance.zone,
            driver: this.name,
            status: instance.status,
            network: {
                internalIp: lodash.get(instance, "networkInterfaces[0].networkIP"),
                externalIp: lodash.get(instance, "networkInterfaces[0].accessConfigs[0].natIP")
            }
        };
    }

    /**
     * This function normalizes errors.
     */
    normalizeError(error) {
        return error;
    }

    /**
     * By default an instance will be created with an attached disk and
     * ephemeral address attached to it.
     */
    async instanceCreate({
        name="",
        zone=this.zone,
        machineType=this.machineType,
        metadata={}
    } = {}) {
        const logger = Logger.create("instanceCreate");
        logger.debug("enter", {name, machineType, zone, metadata});

        const metadataItems = [];
        const metadataKeys = Object.keys(metadata);

        logger.debug("enter", {name, metadata});

        for(let i = 0; i < metadataKeys.length; i++) {
            const key = metadataKeys[i];
            const value = metadata[key];

            metadataItems.push({key, value});
        }

        const fingerprint = hash(metadataItems);

        logger.debug("metadataItems", {metadataItems, fingerprint});

        // (1) create the instance.
        const createResult = await this.api.instanceCreate({
            name,
            machineType: `zones/${zone}/machineTypes/${machineType}`,
            networkInterfaces: [{
                network: "global/networks/default",
                accessConfigs: [{
                    name: "External NAT",
                    type: "ONE_TO_ONE_NAT"
                }]
            }],
            disks: [{
                boot: true,
                initializeParams: {
                    sourceImage: "projects/debian-cloud/global/images/family/debian-8"
                }
            }],
            metadata: {
                kind: "compute#metadata",
                items: metadataItems,
                fingerprint
            }
        });

        logger.debug("instance created", createResult);

        // (2) get created instance info
        const instanceResult = await this.api.instanceGet(name);

        logger.debug("got instance info", instanceResult);

        // (3) normalize instance data for nimus.
        const normalizedResult = this.normalizeInstanceInfo(instanceResult);

        logger.debug("normalized instance info", normalizedResult);

        return normalizedResult;
    }

    // This function get instance info
    async instanceGet(name) {
        const logger = Logger.create("instanceGet");
        logger.debug("instanceGet", {name});

        let instanceResult, normalizedResult;

        try {
            instanceResult = await this.api.instanceGet(name);
        } catch(error) {
            throw this.normalizeError(error);
        }

        logger.debug("got instance info", instanceResult);

        normalizedResult = this.normalizeInstanceInfo(instanceResult);

        logger.debug("normalized instance info", normalizedResult);

        return normalizedResult;
    }

    // This function add metadata to instance
    async instanceMetadataSet(name, metadata = {}) {
        const logger = Logger.create("instanceMetadataSet");
        const items = [];
        const keys = Object.keys(metadata);

        logger.debug("enter", {name, metadata});

        for(let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = metadata[key];

            items.push({key, value});
        }

        const fingerprint = hash(items);

        logger.debug("items", {items, fingerprint});

        try {
            await this.api.instanceMetadataSet(name, {
                fingerprint,
                items
            });
        } catch(error) {
            throw this.normalizeError(error);
        }

        logger.debug("success");
    }

    // This function removes resources assotiated to an instance.
    async instanceRemove(name) {
        const logger = Logger.create("instanceRemove");
        logger.debug("instanceRemove", {name});

        try {
            await this.api.instanceRemove(name);
            logger.debug("instance removed");
        } catch(error) {
            if(error.code != 404) {
                throw this.normalizeError(error);
            }

            logger.debug("instance already removed");
        }

        // Let's try to remove associated disks.
        try {
            await this.api.diskRemove(name);
            logger.debug("disk removed");
        } catch(error) {
            if(error.code != 404) {
                throw this.normalizeError(error);
            }

            logger.debug("disk already removed");
        }
    }
}