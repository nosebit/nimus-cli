import program from "commander";
import Nimus from "./app";

const nimus = new Nimus();

program
    .parse(process.argv);

nimus.driverList();