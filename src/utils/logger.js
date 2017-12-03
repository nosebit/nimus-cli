/**
 * @namespace Utils
 */

import moment from "moment";
import lodash from "lodash";
import colors from "colors";

function getLevelColor(level) {
    switch (level) {
        case "debug": return colors.grey.bold;
        case "info": return colors.blue.bold;
        case "warn": return colors.orange.bold;
        case "error": return colors.red.bold;
    }

    return (text) => text;
}

const levelOrder = ["debug", "info", "warn", "error"];

/**
 * This class defines a logger factory which are attached to a first level scope like a 
 * module.
 * 
 * @class
 * @memberof Utils
 * @example
 * let Logger = new LoggerFactory("myModule")
 * 
 * function myFunction() {
 *      let logger = Logger.create("myFunction");
 *      logger.info("hello, i'm inside myFunction of module myModule");
 * }
 */
class LoggerFactory {
    static level = (process.env.NODE_ENV == "development" ? 0 : 1);

    static _log(level, message, data, opts) {
        const levelColor = getLevelColor(level);
        let text = `${levelColor(level)}: ${message}`;

        let dataStr = data ?
            ": " + JSON.stringify(lodash.merge({}, data)) :
            "";

        if(level == "log") {
            text = message;
        }

        console.log(`${text} ${colors.grey(dataStr)}`);

        return {
            timestamp: moment(),
            elapsed: function() {
                const currentMoment = moment();
                return currentMoment.diff(this.timestamp, 'milliseconds');
            }
        };
    }

    static log(message, data, opts) {return LoggerFactory._log("log", message, data, opts);}
    static debug(message, data, opts) {return LoggerFactory._log("debug", message, data, opts);}
    static info(message, data, opts) {return LoggerFactory._log("info", message, data, opts);}
    static warn(message, data, opts) {return LoggerFactory._log("warn", message, data, opts);}
    static error(message, data, opts) {return LoggerFactory._log("error", message, data, opts);}

    /**
     * This function creates a new logger factory.
     * 
     * @param {string} moduleName - The first level scope of logging.
     * @returns {LoggerFactory} A new logger factory instance.
     */
    constructor(moduleName, opts) {
        this.moduleName = moduleName;
        this.opts = lodash.merge({}, {level: LoggerFactory.level}, opts);
    }

    /**
     * This function creates a new logger instance within the factory 
     * first level scope.
     * 
     * @param {string} scopeName - The second level scope of logging.
     * @returns {Logger} A new logger instance.
     */
    create(scopeName) {
        return new Logger({
            moduleName: this.moduleName,
            scopeName
        }, this.opts);
    }
}

/**
 * This class defines a logger which are attached to a second level scope like a 
 * function.
 * 
 * @class
 * @memberof Utils
 * @private
 */
class Logger {
    // Static properties
    static consoleLevelMap = {
        "debug": "log",
        "info": "info",
        "warn": "warn",
        "error": "error"
    };

    /**
     * This function creates a new logger instance.
     * 
     * @param {object} params - Params wrapper
     * @param {string} moduleName - The wrapping module name that logger gonna be part of.
     * @param {string} scopeName - The specific scope for this logger.
     * @returns {Logger} A new logger instance.
     */
    constructor({
        moduleName = "global",
        scopeName = ""
    } = {}, opts={}) {
        this.moduleName = moduleName;
        this.scopeName = scopeName;
        this.level = (process.env.ENV === "development" ? "debug" : "info");
        this.opts = opts;
    }

    /**
     * This function get the color assotiated with a specific log level.
     * 
     * @private
     * 
     * @param {string} level - The logger level which color we want to retrieve.
     * @returns {string} The color of the level.
     */
    _getLevelColor(level) {
        switch (level) {
            case "debug": return colors.grey.bold;
            case "info": return colors.blue.bold;
            case "warning": return colors.orange.bold;
            case "error": return colors.red.bold;
        }

        return "";
    }

    /**
     * This function performs the main logging through console and is
     * used by all other logging functions. 
     * 
     * @private
     * 
     * @param {string} level - The log level which can be debug, info, warning or error.
     * @param {string} message - The message to be logged.
     * @param {array} rest - An array with metadata entities to be logged alongside the log message.
     * @returns {void}
     */
    _log(level, message, data, opts) {
        if(this.opts.disabled || (this.opts.level >= 0 && levelOrder.indexOf(level) < this.opts.level)){return;}

        let timestamp = colors.blue(moment().toISOString());
        let consoleLevel = Logger.consoleLevelMap[level];
        let levelColor = getLevelColor(level);

        let dataStr = data ?
            ": " + JSON.stringify(lodash.merge({}, data)) :
            "";

        console.log(
            `${levelColor(level)}: [${this.moduleName}] ${this.scopeName} : ${message} ${colors.grey(dataStr)}`
        );

        return {
            timestamp: moment(),
            elapsed: function() {
                const currentMoment = moment();
                return currentMoment.diff(this.timestamp, 'milliseconds');
            }
        };
    }

    /**
     * This function performs a debug log (with importance level of 0).
     * 
     * @param {string} message - The message to be logged.
     * @param {array} rest - An array with metadata entities to be logged alongside the log message.
     * @returns {void}
     */
    debug(message, data, opts) { this._log("debug", message, data, opts); }

    /**
     * This function performs a info log (with importance level of 1).
     * 
     * @param {string} message - The message to be logged.
     * @param {array} rest - An array with metadata entities to be logged alongside the log message.
     * @returns {void}
     */
    info(message, data, opts) { this._log("info", message, data, opts); }

    /**
     * This function performs a warning log (with importance level of 2).
     * 
     * @param {string} message - The message to be logged.
     * @param {array} rest - An array with metadata entities to be logged alongside the log message.
     * @returns {void}
     */
    warn(message, data, opts) { this._log("warn", message, data, opts); }

    /**
     * This function performs a error log (with importance level of 3).
     * 
     * @param {string} message - The message to be logged.
     * @param {array} rest - An array with metadata entities to be logged alongside the log message.
     * @returns {void}
     */
    error(message, data, opts) { this._log("error", message, data, opts); }
}

// Exports
export default LoggerFactory;