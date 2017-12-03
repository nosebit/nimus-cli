import request from "request";
import lodash from "lodash";
import googleAuth from "google-auto-auth";
import LoggerFactory from "../../utils/logger";

const Logger = new LoggerFactory("drivers.google.api");

const MAX_WAIT_FOR_IT_COUNT = 60;

export default class GoogleApi {
    static computeBaseUrl = "https://www.googleapis.com/compute/v1";

    constructor({
        zone="",
        shared="",
        credentials={}
    } = {}) {
        this.project = credentials.project_id;
        this.zone = zone;

        this.authClient = googleAuth({
            credentials,
            scopes: [
                "https://www.googleapis.com/auth/cloud-platform"
            ]
        })
    }

    baseRequest(reqOpts) {
        return new Promise((resolve, reject) => {
            const logger = Logger.create("baseRequest");
            logger.debug("enter", reqOpts);

            this.authClient.authorizeRequest(reqOpts, (error, authReqOpts) => {
                if(error) {
                    logger.error("authorizeRequest : error", error);
                    return reject(error);
                }

                logger.debug("authorizeRequest : success", authReqOpts);

                request(authReqOpts, async (error, response, result) => {
                    if(error) {
                        logger.error("request : error", error);
                        return reject(error);
                    }

                    if(response.statusCode < 200 || response.statusCode >= 300) {
                        logger.error("request : status code error", result);
                        return reject(result.error);
                    }

                    logger.debug("request : success", result);

                    resolve(result);
                });
            });
        });
    }

    async waitForIt(result, opts={}) {
        const logger = Logger.create("waitForIt");
        logger.debug("enter", result);

        let url, count = 0;
        switch(opts.operationType) {
            case 'zone': url = `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/operations/${result.name}`; break;
        }

        if(!url) {
            logger.debug("no operationType");
            return Promise.resolve(result);
        }

        return new Promise((resolve, reject) => {
            let checkCount = 0;

            // Check from time to time until a maximum.
            const check = async () => {
                try {
                    const result = await this.baseRequest({
                        method: "GET",
                        json: true,
                        url
                    });

                    logger.debug(`check [${checkCount}]`, result);

                    if(opts.logger) {
                        opts.logger(result);
                    }

                    if(result.status === "DONE") {
                        resolve(result);
                    } else if(checkCount >= MAX_WAIT_FOR_IT_COUNT) {
                        reject("timeout");
                    } else {
                        setTimeout(check, 1000);
                    }

                    checkCount++;
                }
                catch(error) {
                    reject(error);
                }
            };

            // Start checking.
            check();
        });
    }

    async request(method, url, data, opts) {
        const logger = Logger.create("request");
        logger.debug("enter", {method, url, data});

        const reqOpts = {
            url,
            method,
            json: true
        };

        if(method == "GET") {
            reqOpts.qs = data;
        } else {
            reqOpts.body = data;

            if(opts.qs) {
                reqOpts.qs = opts.qs;
            }
        }

        let result = await this.baseRequest(reqOpts);
        result = await this.waitForIt(result, opts);

        logger.debug("success", result);

        return result;
    }

    /**
     * This function creates an instance.
     */
    instanceCreate(data) {
        return this.request(
            "POST", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances`, 
            data,
            {operationType: "zone"}
        )
    }

    instanceList() {
        return this.request(
            "GET", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances`
        )
    }

    /**
     * This function get instance info.
     */
    instanceGet(name) {
        return this.request(
            "GET", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances/${name}`
        )
    }

    /**
     * This function removes a instance.
     */
    instanceRemove(name) {
        return this.request(
            "DELETE", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances/${name}`,
            null,
            {operationType: "zone"}
        )
    }

    /**
     * This function sets metadata to an instance
     */
    instanceMetadataSet(instanceName, metadata) {
        return this.request(
            "POST", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances/${instanceName}/setMetadata`,
            metadata,
            {operationType: "zone"}
        )
    }

    /**
     * This function removes a disk.
     */
    diskRemove(name) {
        return this.request(
            "DELETE", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/disks/${name}`,
            null,
            {operationType: "zone"}
        )
    }

    /**
     * Add network access config to an instance.
     */
    instanceAddAccessConfig(id, data) {
        return this.request(
            "POST", 
            `${GoogleApi.computeBaseUrl}/projects/${this.project}/zones/${this.zone}/instances/${id}/addAccessConfig`, 
            lodash.omit(data, ["networkInterface"]),
            {operationType: "zone", qs: {networkInterface: data.networkInterface}}
        )
    }
}