import program from "commander";

program
    .command("create", "Create a driver")
    .command("list", "List all drivers")
    .command("remove", "Remove a driver")
    .parse(process.argv);