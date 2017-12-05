#!/usr/bin/env node

import program from "commander";
import LoggerFactory from "./utils/logger";
import Nimus from "./app";
import pkg from "../package";

program
    .version(pkg.version)
    .command("instance <command>", "Manage cloud instances")
    .command("driver <command>", "Manage drivers")
    .command("project <command>", "Manage projects")
    .parse(process.argv);