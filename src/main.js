#!/usr/bin/env node

import program from "commander";
import LoggerFactory from "utils/logger";
import Nimus from "./app";

program
    .version("1.0.0")
    .command("instance <command>", "Manage cloud instances")
    .command("driver <command>", "Manage drivers")
    .command("project <command>", "Manage projects")
    .parse(process.argv);