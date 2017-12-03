#!/usr/bin/env node

import program from "commander";
import lodash from "lodash";
import Nimus from "./app";

const nimus = new Nimus();

program
    .option("-p, --project <name>", "Project name", lodash.kebabCase)
    .option("-n, --name <name>", "Instance name", lodash.kebabCase)
    .parse(process.argv);

nimus.instanceRemove(program.project, program.name);