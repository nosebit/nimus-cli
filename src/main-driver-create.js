import program from "commander";
import path from "path";
import lodash from "lodash";
import Nimus from "./app";

const nimus = new Nimus();

program
    .option("-n, --name <name>", "Driver name id", lodash.kebabCase)
    .option("-p, --provider <provider>", "Driver provider (gce, aws, do, etc...)")
    .option("-c, --credentials [credentials]", "Credentials file path")
    .parse(process.argv);

nimus.driverCreate(
    program.provider,
    {
        name: program.name,
        credentials: program.credentials
    }
);