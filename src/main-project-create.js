import program from "commander";
import lodash from "lodash";
import Nimus from "./app";

const nimus = new Nimus();

program
    .option("-n, --name <name>", "Project name", lodash.kebabCase)
    .parse(process.argv);

nimus.projectCreate(program.name);