import program from "commander";
import lodash from "lodash";
import Nimus from "./app";

const nimus = new Nimus();

program
    .option("-d, --driver <driver>", "Driver for the cloud provider", lodash.kebabCase)
    .option("-p, --project <project>", "Project name scope for the new instance", lodash.kebabCase)
    .option("-n, --name <name>", "Instance name", lodash.kebabCase)
    .option("-t, --type [type]", "Instance type")
    .option("-z, --zone [zone]", "Instance zone")
    .option("-c, --count [count]", "Number of instances to create", 1)
    .parse(process.argv);

nimus.instanceCreate(
    program.project,
    program.driver,
    {
        name: program.name,
        machineType: program.type,
        zone: program.zone
    },
    program.count
)